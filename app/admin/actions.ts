"use server";
import crypto from "node:crypto";
import { redirect } from "next/navigation";
import { handleIncoming } from "@/lib/bot";
import { config } from "@/lib/config";
import { db, type Submission } from "@/lib/db";
import { sendDM } from "@/lib/instagram";
import { closeRoundAndPublish, getOrCreateOpenRound } from "@/lib/rounds";
import { requireAdmin } from "@/lib/admin-auth";


const done = (msg: string): never => redirect("/admin?notice=" + encodeURIComponent(msg));

async function submitterIgsid(sub: Submission): Promise<string | null> {
  const { data } = await db().from("users").select("igsid").eq("id", sub.submitter_id).maybeSingle();
  return data?.igsid ?? null;
}

export async function approve(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const round = await getOrCreateOpenRound();
  const { data } = await db()
    .from("submissions")
    .update({ status: "approved", round_id: round.id, screening_reason: "approved by admin" })
    .eq("id", id)
    .select()
    .single();
  const igsid = data ? await submitterIgsid(data as Submission) : null;
  if (igsid) await sendDM(igsid, `You're in! Your shot is live in today's hunt. Share the link so people vote: ${config.siteUrl}`);
  done("Approved.");
}

export async function reject(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const reason = String(formData.get("reason") || "it doesn't fit our guidelines.");
  const { data } = await db()
    .from("submissions")
    .update({ status: "rejected", screening_reason: `admin: ${reason}` })
    .eq("id", id)
    .select()
    .single();
  const igsid = data && formData.get("notify") ? await submitterIgsid(data as Submission) : null;
  if (igsid) await sendDM(igsid, `Thanks for sending it in. We can't use this one: ${reason}`);
  done("Rejected.");
}

export async function closeRound(formData: FormData) {
  await requireAdmin();
  const forceDry = formData.get("mode") === "dry";
  const r = await closeRoundAndPublish({ dryRun: forceDry || config.dryRun });
  done(
    `Round ${r.roundId} closed. Winner: ${r.winner ?? "none"}. ${r.dryRun ? "Dry run, nothing posted." : r.published ? `Posted ${r.published.mediaId}.` : ""}${r.error ? ` Error: ${r.error}` : ""} New round ${r.newRoundId}.`,
  );
}

export async function simulateDM(formData: FormData) {
  await requireAdmin();
  const sender = String(formData.get("sender") || "tester").replace(/[^a-z0-9._]/gi, "").slice(0, 30) || "tester";
  const text = String(formData.get("text") || "").trim();
  const imageUrl = String(formData.get("imageUrl") || "").trim();
  const kind = formData.get("kind") === "video" ? "video" : "image";
  await handleIncoming({
    igsid: `sim_${sender.toLowerCase()}`,
    usernameHint: sender,
    mid: `sim_${crypto.randomUUID()}`,
    text: text || undefined,
    attachments: imageUrl ? [{ type: kind, payload: { url: imageUrl } }] : undefined,
  });
  done(`Simulated DM from @${sender} processed. See the message log.`);
}

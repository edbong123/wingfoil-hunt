"use server";
import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import { handleIncoming, type IncomingAttachment } from "@/lib/bot";
import { db, must, type User } from "@/lib/db";
import { closeRoundAndPublish } from "@/lib/rounds";
import { imageById, personaByKey, simIgsid } from "@/lib/sim-data";

export async function sendSimMessage(formData: FormData) {
  await requireAdmin();
  const persona = personaByKey(String(formData.get("persona")));
  const text = String(formData.get("text") ?? "").trim();
  const image = imageById(String(formData.get("imageId") ?? ""));
  const attachType = String(formData.get("attachType") || "image");

  const attachments: IncomingAttachment[] = [];
  if (image) {
    attachments.push({
      type: attachType,
      payload: { url: attachType === "ig_reel" ? `https://www.instagram.com/reel/sim${Date.now()}/` : image.url },
    });
  }
  if (!text && !attachments.length) return;

  await handleIncoming({
    igsid: simIgsid(persona),
    usernameHint: persona.handle,
    mid: `sim_${crypto.randomUUID()}`,
    text: text || undefined,
    attachments: attachments.length ? attachments : undefined,
  });
  revalidatePath("/admin/sim/dm");
}

/** Simulated crowd: creates throwaway sim voters and casts votes without the per-IP cap. */
export async function crowdVote(formData: FormData) {
  await requireAdmin();
  const submissionId = String(formData.get("submissionId"));
  const n = Math.min(50, Math.max(1, Number(formData.get("n") ?? 1)));
  let cast = 0;
  for (let i = 0; i < n; i++) {
    const id = `dev_crowd_${crypto.randomUUID().slice(0, 8)}`;
    const user = must(await db().from("users").insert({ ig_user_id: id, handle: id }).select().single()) as User;
    const { data } = await db().rpc("cast_vote", { p_user: user.id, p_submission: submissionId, p_ip_hash: null, p_max_per_ip: 0 });
    if (data === "ok") cast++;
  }
  revalidatePath("/admin/sim/crowd");
  redirect(`/admin/sim/crowd?notice=${encodeURIComponent(`${cast} simulated vote(s) cast.`)}`);
}

export async function simCloseRound() {
  await requireAdmin();
  const r = await closeRoundAndPublish({ dryRun: true });
  redirect(
    `/admin/sim/feed?notice=${encodeURIComponent(`Round ${r.roundId} closed (dry run). ${r.winner ? "Winner picked." : "No winner: no approved entry with enough votes."}`)}`,
  );
}

/** Wipes everything created by the simulator: sim_ senders, dev_ voters and their data. */
export async function resetSim() {
  await requireAdmin();
  const d = db();
  const simUsers = ((await d.from("users").select("id").or("igsid.like.sim_%,ig_user_id.like.dev_%")).data ?? []).map((u) => u.id);
  const subs = simUsers.length
    ? ((await d.from("submissions").select("id, storage_path").in("submitter_id", simUsers)).data ?? [])
    : [];
  const subIds = subs.map((s) => s.id);

  await d.from("conversations").delete().like("igsid", "sim_%");
  if (subIds.length) {
    await d.from("rounds").update({ winner_submission_id: null }).in("winner_submission_id", subIds);
    await d.from("publish_log").delete().in("submission_id", subIds);
    await d.from("votes").delete().in("submission_id", subIds);
    await d.from("reports").delete().in("submission_id", subIds);
    await d.from("submissions").delete().in("id", subIds);
    await d.storage.from("media").remove(subs.map((s) => s.storage_path));
  }
  if (simUsers.length) {
    await d.from("votes").delete().in("user_id", simUsers);
    await d.from("reports").delete().in("reporter_id", simUsers);
    await d.from("users").delete().in("id", simUsers);
  }
  await d.from("messages").delete().like("igsid", "sim_%");
  redirect(`/admin/sim?notice=${encodeURIComponent("Simulation data cleared.")}`);
}

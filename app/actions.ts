"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { config } from "@/lib/config";
import { db } from "@/lib/db";
import { currentUser, ipHash } from "@/lib/session";

const MESSAGES: Record<string, string> = {
  ok: "Vote counted. Thanks!",
  already_voted: "You already voted in this round. Come back tomorrow.",
  ip_limit: "Too many votes from this network in this round.",
  not_votable: "That entry can't be voted on right now.",
};

export async function vote(formData: FormData) {
  const user = await currentUser();
  if (!user) redirect("/?notice=" + encodeURIComponent("Sign in with Instagram to vote."));
  const submissionId = String(formData.get("submissionId") ?? "");
  const { data, error } = await db().rpc("cast_vote", {
    p_user: user.id,
    p_submission: submissionId,
    p_ip_hash: await ipHash(),
    p_max_per_ip: config.votesPerIpPerRound,
  });
  revalidatePath("/");
  redirect("/?notice=" + encodeURIComponent(error ? "Something went wrong." : (MESSAGES[data as string] ?? "Done.")));
}

export async function report(formData: FormData) {
  const submissionId = String(formData.get("submissionId") ?? "");
  const user = await currentUser();
  const ip = await ipHash();

  // One report per person/network per submission.
  let dupe = db().from("reports").select("id", { count: "exact", head: true }).eq("submission_id", submissionId);
  dupe = user ? dupe.eq("reporter_id", user.id) : dupe.eq("ip_hash", ip ?? "none");
  const { count } = await dupe;
  if (!count) {
    await db().from("reports").insert({ submission_id: submissionId, reporter_id: user?.id ?? null, ip_hash: ip, reason: "reported from voting page" });
    const { count: total } = await db().from("reports").select("id", { count: "exact", head: true }).eq("submission_id", submissionId);
    const update: Record<string, unknown> = { report_count: total ?? 0 };
    if ((total ?? 0) >= config.reportsToFlag) {
      update.status = "flagged";
      update.screening_reason = "flagged by community reports";
    }
    await db().from("submissions").update(update).eq("id", submissionId).eq("status", "approved");
  }
  revalidatePath("/");
  redirect("/?notice=" + encodeURIComponent("Thanks, we'll take a look."));
}

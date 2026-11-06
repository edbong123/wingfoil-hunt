import "server-only";
import { config } from "./config";
import { db, must, type Round, type Submission } from "./db";
import { publishToFeed, sendDM } from "./instagram";

/** Next close time strictly after `from`, at ROUND_CLOSE_HOUR_UTC. */
export function nextCloseAfter(from: Date): Date {
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate(), config.roundCloseHourUtc));
  if (d.getTime() <= from.getTime() + 60 * 60 * 1000) d.setUTCDate(d.getUTCDate() + 1); // at least 1h long
  return d;
}

export async function getOpenRound(): Promise<Round | null> {
  const { data } = await db().from("rounds").select("*").eq("status", "open").maybeSingle();
  return (data as Round) ?? null;
}

export async function getOrCreateOpenRound(): Promise<Round> {
  const existing = await getOpenRound();
  if (existing) return existing;
  const now = new Date();
  const res = await db()
    .from("rounds")
    .insert({ starts_at: now.toISOString(), ends_at: nextCloseAfter(now).toISOString(), status: "open" })
    .select()
    .single();
  if (res.error) {
    // Lost a race against another insert: the unique index allows only one open round.
    const again = await getOpenRound();
    if (again) return again;
    throw new Error(res.error.message);
  }
  return res.data as Round;
}

export function buildCaption(s: Submission & { submitter_handle: string | null }): string {
  const parts: string[] = [];
  if (s.caption) parts.push(s.caption.trim());
  const credits: string[] = [];
  if (s.submitter_handle) credits.push(`Photo: @${s.submitter_handle}`);
  if (s.athlete_handle && s.athlete_handle.toLowerCase() !== s.submitter_handle?.toLowerCase()) {
    credits.push(`Rider: @${s.athlete_handle}`);
  }
  parts.push(["Today's Wingfoil Hunt winner.", ...credits].join("\n"));
  parts.push(`Vote for tomorrow's pick: ${config.siteUrl}\n#wingfoil #wingfoiling #wingfoilhunt`);
  return parts.join("\n\n").slice(0, 2200);
}

export type CloseResult = {
  roundId: number;
  winner: string | null;
  dryRun: boolean;
  published?: { mediaId: string } | null;
  error?: string;
  newRoundId: number;
};

/** Close the open round, publish the winner, DM them, open the next round. Idempotent per round. */
export async function closeRoundAndPublish(opts: { dryRun?: boolean } = {}): Promise<CloseResult> {
  const dryRun = opts.dryRun ?? config.dryRun;
  const round = await getOrCreateOpenRound();

  // Claim the round so concurrent runs don't double-publish.
  const claimed = must(
    await db()
      .from("rounds")
      .update({ status: "closed", closed_at: new Date().toISOString() })
      .eq("id", round.id)
      .eq("status", "open")
      .select("id"),
  ) as { id: number }[];
  if (!claimed.length) throw new Error("round already closed by another run");

  const candidates = must(
    await db()
      .from("submissions")
      .select("*, submitter:users!submissions_submitter_id_fkey(handle, igsid)")
      .eq("round_id", round.id)
      .eq("status", "approved")
      .gte("vote_count", config.minVotesToWin)
      .order("vote_count", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(1),
  ) as (Submission & { submitter: { handle: string | null; igsid: string | null } })[];

  const winner = candidates[0] ?? null;
  const result: CloseResult = { roundId: round.id, winner: winner?.id ?? null, dryRun, newRoundId: 0 };

  if (winner) {
    const caption = buildCaption({ ...winner, submitter_handle: winner.submitter.handle });
    const payload = {
      mediaType: winner.media_type,
      mediaUrl: winner.media_url,
      caption,
      tagUsername: winner.submitter.handle,
    };
    let mediaId: string | null = null;
    let error: string | null = null;
    if (!dryRun) {
      try {
        mediaId = (await publishToFeed(payload)).mediaId;
      } catch (e) {
        error = (e as Error).message;
      }
    }
    await db().from("publish_log").insert({
      round_id: round.id,
      submission_id: winner.id,
      dry_run: dryRun,
      payload,
      result: mediaId ? { mediaId } : null,
      error,
    });
    result.published = mediaId ? { mediaId } : null;
    if (error) result.error = error;

    await db().from("rounds").update({ winner_submission_id: winner.id }).eq("id", round.id);
    if (!error) {
      await db()
        .from("submissions")
        .update({ status: "published", published_at: new Date().toISOString(), ig_media_id: mediaId })
        .eq("id", winner.id);
      await db().from("users").update({ is_hunter: true }).eq("id", winner.submitter_id);
      if (winner.submitter.igsid) await dmWinner(winner.submitter.igsid, dryRun);
    }
  }

  const next = await getOrCreateOpenRound();
  result.newRoundId = next.id;

  if (config.carryOver) {
    await db()
      .from("submissions")
      .update({ round_id: next.id, vote_count: 0 })
      .eq("round_id", round.id)
      .eq("status", "approved");
  }
  return result;
}

async function dmWinner(igsid: string, dryRun: boolean) {
  // Meta only allows replies within 24h of the user's last message.
  const { data: conv } = await db().from("conversations").select("last_user_message_at").eq("igsid", igsid).maybeSingle();
  const last = conv?.last_user_message_at ? new Date(conv.last_user_message_at).getTime() : 0;
  const inWindow = Date.now() - last < 24 * 60 * 60 * 1000;
  const text = dryRun
    ? "[dry run] You won today's Wingfoil Hunt! (In live mode your shot is now posted on our feed.)"
    : "You won today's Wingfoil Hunt! Your shot is now live on our feed with credit to you. You're officially a hunter.";
  if (inWindow) await sendDM(igsid, text);
  else await db().from("messages").insert({ igsid, direction: "out", text, error: "skipped: outside 24h messaging window" });
}

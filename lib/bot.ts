import "server-only";
import { config } from "./config";
import { db, must, type Submission, type User } from "./db";
import { getSenderUsername, sendDM } from "./instagram";
import { getOrCreateOpenRound } from "./rounds";
import { botReply, screenSubmission } from "./screen";
import { storeRemoteMedia } from "./storage";

export type IncomingAttachment = { type: string; payload?: { url?: string } };
export type IncomingMessage = {
  igsid: string;
  mid: string;
  text?: string;
  attachments?: IncomingAttachment[];
  usernameHint?: string; // simulator only
};

const RAW_MEDIA = new Set(["image", "video"]);
const YES = /\b(yes|yep|yeah|ja|oui|si|sí|confirm(ed)?|ok(ay)?|sure)\b/i;
const NO = /^\s*(no|nope|nein|non|cancel)\b/i;
const HANDLE = /@([a-z0-9._]{1,30})/gi;

async function upsertSender(igsid: string, usernameHint?: string): Promise<User> {
  const existing = (await db().from("users").select("*").eq("igsid", igsid).maybeSingle()).data as User | null;
  if (existing?.handle) return existing;

  const handle = usernameHint ?? (await getSenderUsername(igsid));
  if (existing) {
    if (handle) await db().from("users").update({ handle }).eq("id", existing.id);
    return { ...existing, handle };
  }
  // A voter who logged in with Instagram may already exist under the same handle: link them.
  if (handle) {
    const byHandle = (await db().from("users").select("*").ilike("handle", handle).maybeSingle()).data as User | null;
    if (byHandle && !byHandle.igsid) {
      await db().from("users").update({ igsid }).eq("id", byHandle.id);
      return { ...byHandle, igsid };
    }
  }
  return must(await db().from("users").insert({ igsid, handle }).select().single()) as User;
}

export async function handleIncoming(msg: IncomingMessage): Promise<void> {
  // Dedupe: Meta retries webhooks.
  const logged = await db()
    .from("messages")
    .insert({ igsid: msg.igsid, direction: "in", mid: msg.mid, text: msg.text ?? null, attachments: msg.attachments ?? null });
  if (logged.error?.code === "23505") return;

  const user = await upsertSender(msg.igsid, msg.usernameHint);
  const now = new Date().toISOString();
  const conv =
    (await db().from("conversations").select("*").eq("igsid", msg.igsid).maybeSingle()).data ??
    must(await db().from("conversations").insert({ igsid: msg.igsid }).select().single());
  await db().from("conversations").update({ last_user_message_at: now, updated_at: now }).eq("igsid", msg.igsid);

  const attachments = msg.attachments ?? [];
  const media = attachments.find((a) => RAW_MEDIA.has(a.type) && a.payload?.url);

  if (media) {
    // Text sent just before the media (within 15 min) becomes the caption.
    const recentText =
      conv.last_text && conv.last_text_at && Date.now() - new Date(conv.last_text_at).getTime() < 15 * 60 * 1000
        ? (conv.last_text as string)
        : null;
    return onMedia(user, media.type as "image" | "video", media.payload!.url!, msg.text?.trim() || recentText);
  }

  if (attachments.length) {
    // share, ig_reel, story_mention, etc. arrive as links only, not the raw file.
    return sendDM(
      msg.igsid,
      "Thanks! Shared posts and reels come through as links only, so we can't use them. Please attach the original photo or video file directly from your camera roll.",
    );
  }

  const text = (msg.text ?? "").trim();
  if (!text) return;

  if (conv.state === "awaiting_rights" && conv.pending_submission_id) {
    return onRightsReply(user, conv.pending_submission_id as string, text);
  }

  await db().from("conversations").update({ last_text: text, last_text_at: now }).eq("igsid", msg.igsid);
  await sendDM(msg.igsid, await botReply(text));
}

async function onMedia(user: User, kind: "image" | "video", url: string, caption: string | null) {
  let stored;
  try {
    stored = await storeRemoteMedia(url, kind);
  } catch (e) {
    console.error("store media failed", e);
    return sendDM(user.igsid!, "Sorry, we couldn't download that file. Could you try sending it again?");
  }

  const sub = must(
    await db()
      .from("submissions")
      .insert({
        submitter_id: user.id,
        media_type: kind,
        media_url: stored.publicUrl,
        storage_path: stored.path,
        content_type: stored.contentType,
        caption,
        status: "awaiting_rights",
      })
      .select()
      .single(),
  ) as Submission;

  // A newer upload replaces any earlier one still waiting for confirmation.
  const { data: conv } = await db().from("conversations").select("pending_submission_id").eq("igsid", user.igsid!).single();
  if (conv?.pending_submission_id) {
    await db()
      .from("submissions")
      .update({ status: "rejected", screening_reason: "superseded by a newer upload" })
      .eq("id", conv.pending_submission_id)
      .eq("status", "awaiting_rights");
  }
  await db()
    .from("conversations")
    .update({ state: "awaiting_rights", pending_submission_id: sub.id, last_text: null, last_text_at: null })
    .eq("igsid", user.igsid!);

  const who = user.handle ? `@${user.handle}` : "you";
  await sendDM(
    user.igsid!,
    `Nice one! Before it goes into the hunt: reply YES to confirm you took this (or own it) and allow Wingfoil to repost it with credit to ${who}. ` +
      `If the rider is someone else, add their @handle, e.g. "YES @rider". You can add a short caption in the same reply.`,
  );
}

async function onRightsReply(user: User, submissionId: string, text: string) {
  const igsid = user.igsid!;
  if (NO.test(text)) {
    await db().from("submissions").update({ status: "rejected", screening_reason: "rights not confirmed" }).eq("id", submissionId);
    await db().from("conversations").update({ state: "idle", pending_submission_id: null }).eq("igsid", igsid);
    return sendDM(igsid, "No problem, we won't use it. Send another one any time.");
  }
  if (!YES.test(text)) {
    const answer = await botReply(text);
    return sendDM(igsid, `${answer}\n\nTo enter your upload, just reply YES (plus the rider's @handle if it's not you).`);
  }

  const handles = [...text.matchAll(HANDLE)].map((m) => m[1]);
  const athlete = handles.find((h) => h.toLowerCase() !== user.handle?.toLowerCase()) ?? null;
  const leftover = text.replace(HANDLE, "").replace(YES, "").replace(/^[\s,.!:-]+|[\s,.!:-]+$/g, "").trim();

  const current = must(await db().from("submissions").select("*").eq("id", submissionId).single()) as Submission;
  const caption = current.caption || (leftover.length >= 3 ? leftover : null);

  await db()
    .from("submissions")
    .update({
      rights_confirmed: true,
      rights_confirmed_at: new Date().toISOString(),
      athlete_handle: athlete,
      caption,
      status: "pending",
    })
    .eq("id", submissionId);
  await db().from("conversations").update({ state: "idle", pending_submission_id: null }).eq("igsid", igsid);

  await screenAndNotify({ ...current, caption, athlete_handle: athlete }, igsid);
}

export async function screenAndNotify(sub: Submission, igsid: string | null) {
  const verdict = await screenSubmission({ mediaType: sub.media_type, mediaUrl: sub.media_url, caption: sub.caption });
  const status = verdict.decision === "approve" ? "approved" : verdict.decision === "reject" ? "rejected" : "flagged";
  const round = status === "approved" ? await getOrCreateOpenRound() : null;

  await db()
    .from("submissions")
    .update({ status, screening_reason: verdict.reason, screening: verdict, round_id: round?.id ?? null })
    .eq("id", sub.id);

  if (!igsid) return;
  if (status === "approved") {
    await sendDM(igsid, `You're in! Your shot is live in today's hunt. Share the link so people vote: ${config.siteUrl}`);
  } else if (status === "rejected") {
    await sendDM(igsid, `Thanks for sending it in. We can't use this one: ${verdict.reason} Feel free to send another.`);
  } else {
    await sendDM(igsid, "Thanks! Your upload needs a quick human check. We'll add it to the hunt once it's reviewed.");
  }
}

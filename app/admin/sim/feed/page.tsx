import Link from "next/link";
import { Bookmark, Comment, Heart, More, Person, Send } from "../icons";
import { db } from "@/lib/db";
import { buildCaption, getOrCreateOpenRound } from "@/lib/rounds";

export const dynamic = "force-dynamic";

type Post = {
  key: string;
  label: string;
  mediaType: "image" | "video";
  mediaUrl: string;
  caption: string;
  tag: string | null;
  votes: number;
  when: string;
};

function Caption({ text }: { text: string }) {
  return (
    <span className="caption">
      {text.split(/([@#][\w.]+)/g).map((part, i) =>
        /^[@#]/.test(part) ? <span key={i} className="mention">{part}</span> : <span key={i}>{part}</span>,
      )}
    </span>
  );
}

function IgPost({ p }: { p: Post }) {
  return (
    <article className="post">
      <div className="post-head">
        <div className="avatar ring" style={{ background: "linear-gradient(135deg,#0a7ea4,#38b2d8)" }}>W</div>
        <div style={{ flex: 1 }}><b>wingfoil</b> <span className="verified">&#10004;</span><div style={{ fontSize: 12, color: "var(--ig-muted)" }}>Wingfoil Hunt</div></div>
        <More />
      </div>
      <div className="post-media">
        {p.mediaType === "video" ? (
          <video src={p.mediaUrl} controls playsInline muted />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.mediaUrl} alt="" />
        )}
        {p.tag && <div className="tag">{p.tag}</div>}
        {p.tag && <div className="tagicon"><Person /></div>}
      </div>
      <div className="post-actions"><Heart /><Comment /><Send /><span className="right"><Bookmark /></span></div>
      <div className="post-body">
        <div><b>{(312 + p.votes * 17).toLocaleString("en-US")} likes</b></div>
        <div><b>wingfoil</b> <Caption text={p.caption} /></div>
        <div style={{ color: "var(--ig-muted)", marginTop: 4 }}>View all {3 + p.votes} comments</div>
        <div className="muted">{p.when}</div>
      </div>
    </article>
  );
}

export default async function Feed({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const { notice } = await searchParams;
  const { data: logs } = await db().from("publish_log").select("*").order("created_at", { ascending: false }).limit(9);

  const posts: Post[] = (logs ?? []).map((l) => ({
    key: `log${l.id}`,
    label: `Round ${l.round_id} winner (${l.dry_run ? "dry run" : "posted"})`,
    mediaType: l.payload?.mediaType ?? "image",
    mediaUrl: l.payload?.mediaUrl,
    caption: l.payload?.caption ?? "",
    tag: l.payload?.tagUsername ?? null,
    votes: 0,
    when: new Date(l.created_at).toLocaleString("en-GB", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }),
  }));

  // Live preview of today's current leader.
  const round = await getOrCreateOpenRound();
  const { data: lead } = await db()
    .from("submissions")
    .select("*, submitter:users!submissions_submitter_id_fkey(handle)")
    .eq("round_id", round.id)
    .eq("status", "approved")
    .order("vote_count", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  const leader: Post | null = lead
    ? {
        key: "leader",
        label: `If round ${round.id} closed now`,
        mediaType: lead.media_type,
        mediaUrl: lead.media_url,
        caption: buildCaption({ ...lead, submitter_handle: lead.submitter?.handle ?? null }),
        tag: lead.submitter?.handle ?? null,
        votes: lead.vote_count,
        when: "Preview",
      }
    : null;

  return (
    <div className="sim-layout">
      <div>
        {notice && <div className="notice">{notice}</div>}
        <div className="phone" style={{ height: "auto", minHeight: 0 }}>
          <div className="statusbar"><span>9:41</span><span>5G 87%</span></div>
          <div className="profile">
            <div className="avatar lg ring" style={{ background: "linear-gradient(135deg,#0a7ea4,#38b2d8)" }}>W</div>
            <div className="stats">
              <div><b>{1208 + posts.length}</b>posts</div>
              <div><b>10.2K</b>followers</div>
              <div><b>318</b>following</div>
            </div>
          </div>
          <div style={{ padding: "0 12px 12px", fontSize: 14 }}>
            <b>Wingfoil</b>
            <div>Daily Wingfoil Hunt: DM your best shot, the community votes, the winner gets posted here.</div>
          </div>
          <div className="grid3">
            {posts.map((p) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={p.key} src={p.mediaUrl} alt="" />
            ))}
          </div>
          {posts.length === 0 && <p style={{ padding: 16, fontSize: 13, color: "var(--ig-muted)" }}>No winner posts yet. Close a round in <Link href="/admin/sim/crowd">2. Votes</Link>.</p>}
        </div>
      </div>

      <div>
        {[leader, ...posts].filter(Boolean).map((p) => (
          <div key={p!.key} style={{ maxWidth: 470, marginBottom: 24 }}>
            <p className="small muted" style={{ margin: "0 0 6px" }}><b>{p!.label}</b></p>
            <IgPost p={p!} />
          </div>
        ))}
        {!leader && posts.length === 0 && <div className="panel">Nothing to preview yet. Get an entry approved in <Link href="/admin/sim/dm">1. DMs</Link>.</div>}
      </div>
    </div>
  );
}

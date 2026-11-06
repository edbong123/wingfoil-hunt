import { Header } from "../Header";
import { Media } from "../Media";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type Winner = {
  id: string;
  media_type: "image" | "video";
  media_url: string;
  caption: string | null;
  athlete_handle: string | null;
  vote_count: number;
  published_at: string;
  submitter: { handle: string | null } | null;
};

export default async function Winners() {
  const { data } = await db()
    .from("submissions")
    .select("id, media_type, media_url, caption, athlete_handle, vote_count, published_at, submitter:users!submissions_submitter_id_fkey(handle)")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(30);
  const winners = (data ?? []) as unknown as Winner[];

  return (
    <main className="wrap">
      <Header />
      <h2 style={{ fontSize: 18 }}>Past winners</h2>
      {winners.length === 0 && <div className="empty muted">No winners yet.</div>}
      {winners.map((w) => (
        <article className="card" key={w.id}>
          <Media type={w.media_type} url={w.media_url} alt={w.caption ?? "Winning wingfoil shot"} />
          <div className="body">
            <div className="row">
              <span className="credit">@{w.submitter?.handle ?? "unknown"}<span className="badge">Hunter</span></span>
              <span className="muted small">{new Date(w.published_at).toISOString().slice(0, 10)}</span>
            </div>
            {w.athlete_handle && <div className="muted small">Rider @{w.athlete_handle}</div>}
            {w.caption && <p className="caption">{w.caption}</p>}
          </div>
        </article>
      ))}
    </main>
  );
}

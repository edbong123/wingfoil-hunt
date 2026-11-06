import { report, vote } from "./actions";
import { Countdown } from "./Countdown";
import { Header } from "./Header";
import { Media } from "./Media";
import { SubmitButton } from "./SubmitButton";
import { db } from "@/lib/db";
import { getOrCreateOpenRound } from "@/lib/rounds";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

type Entry = {
  id: string;
  media_type: "image" | "video";
  media_url: string;
  caption: string | null;
  athlete_handle: string | null;
  vote_count: number;
  submitter: { handle: string | null; is_hunter: boolean } | null;
};

export default async function Home({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const { notice } = await searchParams;
  const [round, user] = await Promise.all([getOrCreateOpenRound(), currentUser()]);

  const { data } = await db()
    .from("submissions")
    .select("id, media_type, media_url, caption, athlete_handle, vote_count, created_at, submitter:users!submissions_submitter_id_fkey(handle, is_hunter)")
    .eq("round_id", round.id)
    .eq("status", "approved")
    .order("vote_count", { ascending: false })
    .order("created_at", { ascending: true });
  const entries = (data ?? []) as unknown as Entry[];

  const myVote = user
    ? (await db().from("votes").select("submission_id").eq("user_id", user.id).eq("round_id", round.id).maybeSingle()).data
    : null;

  return (
    <main className="wrap">
      <Header />
      {notice && <div className="notice">{notice}</div>}

      <p className="muted" style={{ marginTop: 0 }}>
        DM your best wingfoil shot to <strong>@wingfoil</strong> on Instagram. Vote below. The top pick each day gets posted with credit.
      </p>

      <div className="round">
        <strong>Today&apos;s round</strong>
        <span className="muted small"><Countdown to={round.ends_at} /></span>
      </div>

      {entries.length === 0 && (
        <div className="empty">
          <p><strong>No entries yet.</strong></p>
          <p className="muted">Be the first: DM a photo or video to the Wingfoil Instagram.</p>
        </div>
      )}

      {entries.map((e, i) => {
        const handle = e.submitter?.handle;
        const mine = myVote?.submission_id === e.id;
        return (
          <article className="card" key={e.id}>
            <Media type={e.media_type} url={e.media_url} alt={e.caption ?? `Wingfoil shot by ${handle ?? "a hunter"}`} />
            <div className="body">
              <div className="row">
                <div>
                  <span className="rank">#{i + 1}</span>
                  <span className="credit">{handle ? `@${handle}` : "anonymous"}</span>
                  {e.submitter?.is_hunter && <span className="badge">Hunter</span>}
                  {e.athlete_handle && <div className="muted small">Rider @{e.athlete_handle}</div>}
                </div>
                <div className="row" style={{ gap: 10 }}>
                  <span className="votes">{e.vote_count}</span>
                  <form action={vote}>
                    <input type="hidden" name="submissionId" value={e.id} />
                    <SubmitButton className="primary" disabled={!!myVote}>
                      {mine ? "Voted" : "Vote"}
                    </SubmitButton>
                  </form>
                </div>
              </div>
              {e.caption && <p className="caption">{e.caption}</p>}
              <form action={report} style={{ marginTop: 8 }}>
                <input type="hidden" name="submissionId" value={e.id} />
                <button className="link" type="submit">Report</button>
              </form>
            </div>
          </article>
        );
      })}

      <p className="muted small">One vote per person per round. Sign in with Instagram to vote.</p>
    </main>
  );
}

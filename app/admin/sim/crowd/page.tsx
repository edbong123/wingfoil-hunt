import Link from "next/link";
import { crowdVote, simCloseRound } from "../actions";
import { SubmitButton } from "../../../SubmitButton";
import { config } from "@/lib/config";
import { db } from "@/lib/db";
import { getOrCreateOpenRound } from "@/lib/rounds";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Row = {
  id: string;
  media_type: "image" | "video";
  media_url: string;
  caption: string | null;
  athlete_handle: string | null;
  status: string;
  vote_count: number;
  submitter: { handle: string | null } | null;
};

const VOTERS = ["anna.surfs", "ben_on_foil", "carla.tarifa", "diego.wing", "emma.waterkid"];

export default async function Crowd({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const { notice } = await searchParams;
  const round = await getOrCreateOpenRound();
  const [{ data: entries }, { data: waiting }] = await Promise.all([
    db()
      .from("submissions")
      .select("id, media_type, media_url, caption, athlete_handle, status, vote_count, submitter:users!submissions_submitter_id_fkey(handle)")
      .eq("round_id", round.id)
      .eq("status", "approved")
      .order("vote_count", { ascending: false }),
    db().from("submissions").select("id", { count: "exact" }).in("status", ["flagged", "pending"]),
  ]);
  const rows = (entries ?? []) as unknown as Row[];

  return (
    <div className="wrap" style={{ maxWidth: 900 }}>
      {notice && <div className="notice">{notice}</div>}

      <section className="panel" style={{ marginBottom: 16 }}>
        <h2>2. Votes for round {round.id}</h2>
        <p className="small muted" style={{ marginTop: 0 }}>
          Closes {new Date(round.ends_at).toUTCString()}. Simulated votes skip the per-network limit so you can build a leaderboard fast.
          {waiting && waiting.length > 0 && <> {waiting.length} entr{waiting.length === 1 ? "y waits" : "ies wait"} for review in <Link href="/admin">Admin</Link> (flagged items need approval before they can get votes).</>}
        </p>

        {rows.length === 0 && <p className="muted">No approved entries yet. Run a persona script in <Link href="/admin/sim/dm">1. DMs</Link> first.</p>}
        <table>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id}>
                <td style={{ width: 70 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="thumb" src={r.media_url} alt="" />
                </td>
                <td>
                  <b>#{i + 1} @{r.submitter?.handle}</b>
                  {r.athlete_handle && <span className="muted small"> rider @{r.athlete_handle}</span>}
                  <div className="small muted">{r.caption}</div>
                </td>
                <td style={{ whiteSpace: "nowrap" }}><b style={{ fontSize: 18 }}>{r.vote_count}</b> votes</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  {[1, 5, 20].map((n) => (
                    <form key={n} action={crowdVote} style={{ display: "inline-block", marginRight: 4 }}>
                      <input type="hidden" name="submissionId" value={r.id} />
                      <input type="hidden" name="n" value={n} />
                      <SubmitButton>+{n}</SubmitButton>
                    </form>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="panel" style={{ marginBottom: 16 }}>
        <h2>Vote yourself on the real page</h2>
        <p className="small muted" style={{ marginTop: 0 }}>Each link logs you in as a test voter and opens the public voting page in a new tab. One vote per voter per round, max {config.votesPerIpPerRound} per network.</p>
        {config.devLogin ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {VOTERS.map((v) => (
              <a key={v} className="btn" target="_blank" href={`/api/auth/dev?handle=${v}`}>Vote as @{v}</a>
            ))}
          </div>
        ) : (
          <p className="small">Test login is off. Set DEV_LOGIN=true in Vercel to use these.</p>
        )}
      </section>

      <section className="panel">
        <h2>Close the round</h2>
        <p className="small muted" style={{ marginTop: 0 }}>Picks the top entry, logs the Instagram post it would make (dry run), DMs the winner in the simulator and opens a new round.</p>
        <form action={simCloseRound}><SubmitButton className="primary">Close round now (dry run)</SubmitButton></form>
      </section>
    </div>
  );
}

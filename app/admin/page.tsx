import { approve, closeRound, reject, simulateDM } from "./actions";
import { SubmitButton } from "../SubmitButton";
import { config } from "@/lib/config";
import { db } from "@/lib/db";
import { getOrCreateOpenRound } from "@/lib/rounds";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  media_type: "image" | "video";
  media_url: string;
  caption: string | null;
  athlete_handle: string | null;
  status: string;
  screening_reason: string | null;
  vote_count: number;
  report_count: number;
  rights_confirmed: boolean;
  created_at: string;
  submitter: { handle: string | null } | null;
};

const SELECT =
  "id, media_type, media_url, caption, athlete_handle, status, screening_reason, vote_count, report_count, rights_confirmed, created_at, submitter:users!submissions_submitter_id_fkey(handle)";

function Thumb({ r }: { r: Row }) {
  return r.media_type === "video" ? (
    <video className="thumb" src={r.media_url} muted preload="metadata" />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img className="thumb" src={r.media_url} alt="" />
  );
}

export default async function Admin({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const { notice } = await searchParams;
  const round = await getOrCreateOpenRound();
  const [review, leaderboard, recent, messages, publishes] = await Promise.all([
    db().from("submissions").select(SELECT).in("status", ["flagged", "pending"]).order("created_at", { ascending: false }).limit(50),
    db().from("submissions").select(SELECT).eq("round_id", round.id).eq("status", "approved").order("vote_count", { ascending: false }).limit(10),
    db().from("submissions").select(SELECT).order("created_at", { ascending: false }).limit(20),
    db().from("messages").select("*").order("created_at", { ascending: false }).limit(40),
    db().from("publish_log").select("*").order("created_at", { ascending: false }).limit(10),
  ]);
  const reviewRows = (review.data ?? []) as unknown as Row[];
  const boardRows = (leaderboard.data ?? []) as unknown as Row[];
  const recentRows = (recent.data ?? []) as unknown as Row[];

  return (
    <main className="wrap" style={{ maxWidth: 960 }}>
      <header className="top">
        <h1>Hunt admin</h1>
        <nav><a href="/">Voting page</a></nav>
      </header>
      {notice && <div className="notice">{notice}</div>}

      <section className="admin">
        <h2>Round {round.id}</h2>
        <p className="small muted">
          Closes {new Date(round.ends_at).toUTCString()} &middot; Mode: <strong>{config.dryRun ? "DRY RUN (nothing gets posted)" : "LIVE"}</strong>
        </p>
        <div className="row" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <form action={closeRound}>
            <input type="hidden" name="mode" value="dry" />
            <SubmitButton>Close round now (dry run)</SubmitButton>
          </form>
          {!config.dryRun && (
            <form action={closeRound}>
              <input type="hidden" name="mode" value="live" />
              <SubmitButton className="primary">Close round and publish now</SubmitButton>
            </form>
          )}
        </div>
      </section>

      <section className="admin">
        <h2>Top candidates (check before the round closes)</h2>
        {boardRows.length === 0 ? <p className="muted small">No approved entries in this round.</p> : (
          <table>
            <tbody>
              {boardRows.map((r) => (
                <tr key={r.id}>
                  <td><Thumb r={r} /></td>
                  <td>@{r.submitter?.handle ?? "?"}{r.athlete_handle && <> / rider @{r.athlete_handle}</>}<div className="muted small">{r.caption}</div></td>
                  <td>{r.vote_count} votes<div className="muted small">{r.report_count} reports</div></td>
                  <td>
                    <form action={reject}>
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="reason" value="it was removed after review." />
                      <SubmitButton>Remove</SubmitButton>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="admin">
        <h2>Needs review ({reviewRows.length})</h2>
        {reviewRows.length === 0 ? <p className="muted small">Nothing flagged.</p> : (
          <table>
            <tbody>
              {reviewRows.map((r) => (
                <tr key={r.id}>
                  <td><a href={r.media_url} target="_blank"><Thumb r={r} /></a></td>
                  <td>
                    @{r.submitter?.handle ?? "?"} <span className={`status-${r.status}`}>{r.status}</span>
                    <div className="small">{r.screening_reason}</div>
                    <div className="muted small">{r.caption}</div>
                  </td>
                  <td style={{ minWidth: 220 }}>
                    <form action={approve} style={{ marginBottom: 6 }}>
                      <input type="hidden" name="id" value={r.id} />
                      <SubmitButton className="primary">Approve</SubmitButton>
                    </form>
                    <form action={reject}>
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="notify" value="1" />
                      <input name="reason" placeholder="Reason sent to the hunter" />
                      <SubmitButton>Reject</SubmitButton>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="admin">
        <h2>Simulate a DM</h2>
        <p className="muted small">Runs the real bot, storage and screening flow without Meta. Replies are logged below instead of sent. To test: send an image URL, then send &quot;yes @rider&quot; from the same sender.</p>
        <form action={simulateDM}>
          <div className="grid2">
            <div><label>Sender handle</label><input name="sender" defaultValue="test_hunter" /></div>
            <div><label>Attachment type</label><select name="kind" defaultValue="image"><option value="image">image</option><option value="video">video</option></select></div>
          </div>
          <label>Media URL (optional, any public image or mp4)</label>
          <input name="imageUrl" placeholder="https://..." />
          <label>Text (optional)</label>
          <input name="text" placeholder="e.g. yes @rider_handle  /  how does this work?" />
          <div style={{ marginTop: 10 }}><SubmitButton className="primary">Send</SubmitButton></div>
        </form>
      </section>

      <section className="admin">
        <h2>Message log</h2>
        <table>
          <tbody>
            {(messages.data ?? []).map((m) => (
              <tr key={m.id}>
                <td className="small muted" style={{ whiteSpace: "nowrap" }}>{new Date(m.created_at).toISOString().slice(5, 16).replace("T", " ")}</td>
                <td className="small">{m.direction === "in" ? "IN" : "OUT"}</td>
                <td className="small">{m.igsid}</td>
                <td className="small">
                  {m.text}
                  {m.attachments && <div className="muted">[{(m.attachments as { type: string }[]).map((a) => a.type).join(", ")}]</div>}
                  {m.error && <div className="status-rejected">{m.error}</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="admin">
        <h2>Recent submissions</h2>
        <table>
          <tbody>
            {recentRows.map((r) => (
              <tr key={r.id}>
                <td><Thumb r={r} /></td>
                <td>@{r.submitter?.handle ?? "?"}<div className="muted small">{r.caption}</div></td>
                <td className={`status-${r.status}`}>{r.status}<div className="small muted">{r.screening_reason}</div></td>
                <td className="small">{r.rights_confirmed ? "rights ok" : "no rights"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="admin">
        <h2>Publish log</h2>
        {(publishes.data ?? []).map((p) => (
          <pre key={p.id}>{JSON.stringify({ at: p.created_at, round: p.round_id, dry_run: p.dry_run, caption: p.payload?.caption, result: p.result, error: p.error }, null, 2)}</pre>
        ))}
      </section>
    </main>
  );
}

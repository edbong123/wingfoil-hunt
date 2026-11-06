import Link from "next/link";
import { resetSim } from "./actions";
import { SubmitButton } from "../../SubmitButton";
import { config } from "@/lib/config";
import { IMAGES, PERSONAS } from "@/lib/sim-data";

export const dynamic = "force-dynamic";

async function checkImage(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "WingfoilHunt/0.1 (+https://wingfoil-hunt.vercel.app)" },
      signal: AbortSignal.timeout(6000),
    });
    return res.ok ? "ok" : `HTTP ${res.status}`;
  } catch (e) {
    return (e as Error).name === "TimeoutError" ? "timeout" : "error";
  }
}

export default async function SimHome({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const { notice } = await searchParams;
  const checks = await Promise.all(IMAGES.map((i) => checkImage(i.url)));
  const site = config.siteUrl;

  return (
    <div className="wrap" style={{ maxWidth: 900 }}>
      {notice && <div className="notice">{notice}</div>}

      <section className="panel" style={{ marginBottom: 16 }}>
        <h2>Simulation walkthrough</h2>
        <p className="small muted" style={{ marginTop: 0 }}>
          Runs the real app (bot, storage, Claude screening, votes, round close) with fake Instagram users. Nothing is sent to Instagram and nothing is posted. Mode: {config.dryRun ? "dry run" : "LIVE (round close in the simulator still forces dry run)"}.
        </p>
        <ol style={{ paddingLeft: 18, lineHeight: 1.7 }}>
          <li><Link href="/admin/sim/dm?p=kai"><b>DMs</b></Link>: pick a persona, press Send through the pre-filled script. Start with @kai.foils (happy path).</li>
          <li><Link href="/admin/sim/crowd"><b>Votes</b></Link>: add simulated votes or vote yourself as a test voter on the public page.</li>
          <li><Link href="/admin/sim/crowd"><b>Close round</b></Link>: dry-run the nightly job. The winner gets a DM in the simulator.</li>
          <li><Link href="/admin/sim/feed"><b>Feed post</b></Link>: see the Instagram post exactly as it would be published, with credits and tag.</li>
          <li><Link href="/admin"><b>Admin</b></Link>: approve flagged entries (videos, unclear cases), check logs.</li>
        </ol>
      </section>

      <section className="panel" style={{ marginBottom: 16 }}>
        <h2>All URLs</h2>
        <table>
          <tbody>
            {[
              ["/", "Public voting page (what voters see)"],
              ["/winners", "Past winners"],
              ["/admin/sim", "This overview"],
              ...PERSONAS.map((p) => [`/admin/sim/dm?p=${p.key}`, `DM as @${p.handle}: ${p.blurb}`]),
              ["/admin/sim/crowd", "Simulated votes, test voter logins, close round"],
              ["/admin/sim/feed", "Instagram post preview + profile grid"],
              ["/admin", "Moderation queue, message log, publish log"],
              ["/api/auth/dev?handle=anna.surfs", "Log in as a test voter (needs DEV_LOGIN=true)"],
              ["/api/health", "Settings and database check"],
            ].map(([path, desc]) => (
              <tr key={path}>
                <td style={{ whiteSpace: "nowrap" }}><a href={path} target={path.startsWith("/admin") ? undefined : "_blank"}>{site}{path}</a></td>
                <td className="small muted">{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="panel" style={{ marginBottom: 16 }}>
        <h2>Sample photos</h2>
        <p className="small muted" style={{ marginTop: 0 }}>Public Wikimedia Commons files. Status = can the server download it.</p>
        <div className="gallery" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))" }}>
          {IMAGES.map((i, idx) => (
            <a key={i.id} href={i.source} target="_blank" style={{ position: "relative", borderRadius: 10, overflow: "hidden", display: "block" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={i.thumb} alt={i.label} />
              <span style={{ position: "absolute", left: 0, right: 0, bottom: 0, fontSize: 11, color: "#fff", background: "linear-gradient(transparent, rgba(0,0,0,.75))", padding: "12px 6px 4px" }}>
                {i.label} &middot; {checks[idx] === "ok" ? "ok" : `failed: ${checks[idx]}`}
              </span>
            </a>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>Reset</h2>
        <p className="small muted" style={{ marginTop: 0 }}>Deletes all simulated senders, test voters, their submissions, votes, messages and stored files. Real data is untouched.</p>
        <form action={resetSim}><SubmitButton>Clear simulation data</SubmitButton></form>
      </section>
    </div>
  );
}

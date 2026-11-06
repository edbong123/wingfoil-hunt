import { DmSimulator } from "./DmSimulator";
import { db } from "@/lib/db";
import { IMAGES, PERSONAS, personaByKey, simIgsid } from "@/lib/sim-data";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Msg = {
  id: number;
  direction: "in" | "out";
  text: string | null;
  attachments: { type: string; payload?: { url?: string } }[] | null;
  error: string | null;
  created_at: string;
};

const URL_RE = /(https?:\/\/[^\s]+)/g;
function Linked({ text }: { text: string }) {
  return (
    <>
      {text.split(URL_RE).map((part, i) =>
        /^https?:\/\//.test(part) ? <a key={i} href={part} target="_blank">{part}</a> : <span key={i}>{part}</span>,
      )}
    </>
  );
}

const thumbFor = (url: string) => url.replace(/width=\d+/, "width=480");

export default async function SimDM({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const { p } = await searchParams;
  const persona = personaByKey(p);
  const igsid = simIgsid(persona);
  const { data } = await db().from("messages").select("*").eq("igsid", igsid).order("created_at", { ascending: true }).limit(200);
  const msgs = (data ?? []) as Msg[];
  const nextIndex = Math.min(msgs.filter((m) => m.direction === "in").length, persona.steps.length);

  let lastTime = 0;
  const thread = (
    <>
      <div className="intro">
        <div className="avatar lg" style={{ background: "linear-gradient(135deg,#0a7ea4,#38b2d8)", margin: "0 auto" }}>W</div>
        <b>wingfoil</b>
        <span>10.2K followers &middot; Business account</span>
      </div>
      {msgs.map((m, idx) => {
        const t = new Date(m.created_at).getTime();
        const showTime = t - lastTime > 15 * 60 * 1000;
        lastTime = t;
        const me = m.direction === "in"; // "in" = sent by the hunter, shown on the right from their point of view
        const nextSame = msgs[idx + 1]?.direction === m.direction;
        const atts = m.attachments ?? [];
        return (
          <div key={m.id} style={{ display: "contents" }}>
            {showTime && <div className="time">{new Date(m.created_at).toLocaleString("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" })} UTC</div>}
            {atts.map((a, i) => (
              <div key={`a${i}`} className={`msg ${me ? "me" : ""}`}>
                {a.type === "ig_reel" || a.type === "share" ? (
                  <div className="reel">
                    <div style={{ aspectRatio: "9 / 12", background: "linear-gradient(160deg,#0a7ea4,#1e293b)", display: "grid", placeItems: "center", color: "#fff", fontSize: 32 }}>&#9654;</div>
                    <div><b>Reel</b><br /><span style={{ color: "var(--ig-muted)" }}>Shared from @{persona.handle}</span></div>
                  </div>
                ) : a.payload?.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="pic" src={thumbFor(a.payload.url)} alt="" />
                ) : null}
              </div>
            ))}
            {m.text && (
              <div className={`msg ${me ? "me" : ""}`}>
                {!me && (nextSame ? <span className="spacer-av" /> : <div className="avatar" style={{ background: "linear-gradient(135deg,#0a7ea4,#38b2d8)" }}>W</div>)}
                <div>
                  <div className="bubble"><Linked text={m.text} /></div>
                  {m.error && <div className="err">{m.error}</div>}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </>
  );

  return (
    <DmSimulator
      key={`${persona.key}-${msgs.length}`}
      persona={persona}
      personas={PERSONAS}
      images={IMAGES}
      nextIndex={nextIndex}
      thread={thread}
    />
  );
}

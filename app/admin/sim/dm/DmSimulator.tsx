"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { sendSimMessage } from "../actions";
import { Back, Camera, Phone, Video } from "../icons";
import type { Persona, SampleImage, Step } from "@/lib/sim-data";

function Typing() {
  const { pending } = useFormStatus();
  if (!pending) return null;
  return (
    <div className="msg typing" style={{ margin: "0 2px 8px" }}>
      <div className="bubble"><i /><i /><i /></div>
      <span className="small" style={{ alignSelf: "center", color: "var(--ig-muted)" }}>wingfoil is typing</span>
    </div>
  );
}

function SendBtn({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return <button className="send" type="submit" disabled={disabled || pending}>{pending ? "..." : "Send"}</button>;
}

export function DmSimulator({
  persona,
  personas,
  images,
  nextIndex,
  thread,
}: {
  persona: Persona;
  personas: Persona[];
  images: SampleImage[];
  nextIndex: number;
  thread: React.ReactNode;
}) {
  const start: Step | undefined = persona.steps[nextIndex];
  const [text, setText] = useState(start?.text ?? "");
  const [imageId, setImageId] = useState(start?.imageId ?? "");
  const [attachType, setAttachType] = useState(start?.attachType ?? "image");
  const [gallery, setGallery] = useState(false);
  const image = images.find((i) => i.id === imageId);
  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight });
  });

  const load = (s: Step) => {
    setText(s.text ?? "");
    setImageId(s.imageId ?? "");
    setAttachType(s.attachType ?? "image");
  };

  return (
    <div className="sim-layout">
      {/* Phone */}
      <div className="phone">
        <div className="statusbar"><span>9:41</span><span>5G 87%</span></div>
        <div className="ig-head">
          <Back />
          <div className="avatar" style={{ background: "linear-gradient(135deg,#0a7ea4,#38b2d8)" }}>W</div>
          <div className="who"><b>wingfoil</b><span>Business chat, viewed as @{persona.handle}</span></div>
          <Phone /><Video />
        </div>
        <div className="thread" ref={threadRef}>{thread}</div>

        <form action={sendSimMessage} className="composer">
          <input type="hidden" name="persona" value={persona.key} />
          <input type="hidden" name="imageId" value={imageId} />
          <input type="hidden" name="attachType" value={attachType} />
          <Typing />
          {image && (
            <div className="attach-preview">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.thumb} alt="" />
              <span>{attachType === "ig_reel" ? "Shared reel (arrives as a link)" : `Photo: ${image.label}`}</span>
              <button type="button" className="link" onClick={() => setImageId("")}>Remove</button>
            </div>
          )}
          <div className="pill">
            <button type="button" className="cam" title="Attach a sample photo" onClick={() => setGallery((v) => !v)}><Camera /></button>
            <textarea name="text" rows={2} placeholder="Message..." value={text} onChange={(e) => setText(e.target.value)} />
            <SendBtn disabled={!text.trim() && !image} />
          </div>
          {gallery && (
            <div className="gallery" style={{ marginTop: 8 }}>
              {images.map((i) => (
                <button type="button" key={i.id} className={i.id === imageId ? "on" : ""} onClick={() => { setImageId(i.id); setAttachType("image"); setGallery(false); }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={i.thumb} alt={i.label} /><span>{i.label}</span>
                </button>
              ))}
            </div>
          )}
        </form>
      </div>

      {/* Control panel */}
      <div className="panel">
        <h2>Who is sending?</h2>
        <p className="small muted" style={{ marginTop: 0 }}>Each persona is a scripted scenario. Messages run through the real bot, storage and Claude screening. Nothing is sent to Instagram.</p>
        <div className="personas">
          {personas.map((p) => (
            <Link key={p.key} href={`/admin/sim/dm?p=${p.key}`} className={`persona ${p.key === persona.key ? "on" : ""}`}>
              <div className="avatar" style={{ background: p.color }}>{p.name[0]}</div>
              <div><b>@{p.handle}</b><span>{p.blurb}</span></div>
            </Link>
          ))}
        </div>

        <h3>Script for @{persona.handle}</h3>
        <div className="steps">
          {persona.steps.map((s, i) => (
            <button type="button" key={i} className={`step ${i < nextIndex ? "done" : ""} ${i === nextIndex ? "next" : ""}`} onClick={() => load(s)}>
              <span className="n">{i < nextIndex ? "✓" : i + 1}</span>
              <span>
                <b>{s.label}</b>
                {s.text && <> &ldquo;{s.text}&rdquo;</>}
                {s.imageId && <> [{s.attachType === "ig_reel" ? "shared reel" : "photo"}: {images.find((i2) => i2.id === s.imageId)?.label}]</>}
                <small>Expected: {s.expect}</small>
              </span>
            </button>
          ))}
        </div>
        <p className="small muted">
          {nextIndex < persona.steps.length
            ? "The next step is already filled in the phone. Press Send, or click any step to load it."
            : "Script done. Check the voting page, then cast votes in step 2."}
        </p>
        <p className="small"><Link href="/admin/sim/crowd">Next: simulate votes</Link></p>
      </div>
    </div>
  );
}

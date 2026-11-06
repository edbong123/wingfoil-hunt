export function Media({ type, url, alt }: { type: "image" | "video"; url: string; alt: string }) {
  if (type === "video") {
    return <video className="media" src={url} controls playsInline preload="metadata" muted />;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="media" src={url} alt={alt} loading="lazy" />;
}

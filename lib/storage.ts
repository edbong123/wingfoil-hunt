import "server-only";
import crypto from "node:crypto";
import { db } from "./db";

const BUCKET = "media";
const MAX_BYTES = 50 * 1024 * 1024;

/** Download Meta media immediately (its URLs expire) and store our own public copy. */
export async function storeRemoteMedia(
  url: string,
  kind: "image" | "video",
): Promise<{ publicUrl: string; path: string; contentType: string }> {
  const res = await fetch(url, { headers: { "User-Agent": "WingfoilHunt/0.1 (+https://wingfoil-hunt.vercel.app)" } });
  if (!res.ok) throw new Error(`media download failed: ${res.status}`);
  const contentType = res.headers.get("content-type")?.split(";")[0] ?? (kind === "image" ? "image/jpeg" : "video/mp4");
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength > MAX_BYTES) throw new Error("media too large");

  const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : kind === "image" ? "jpg" : "mp4";
  const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${ext}`;
  const up = await db().storage.from(BUCKET).upload(path, buf, { contentType, upsert: false });
  if (up.error) throw new Error(`storage upload failed: ${up.error.message}`);
  const { data } = db().storage.from(BUCKET).getPublicUrl(path);
  return { publicUrl: data.publicUrl, path, contentType };
}

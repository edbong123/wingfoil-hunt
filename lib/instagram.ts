import "server-only";
import crypto from "node:crypto";
import { config } from "./config";
import { db } from "./db";

// Official Instagram Platform API (Instagram API with Instagram Login).
// Never uses passwords or unofficial endpoints.
const graph = () => `https://graph.instagram.com/${config.graphVersion}`;

async function call<T>(path: string, init: RequestInit & { query?: Record<string, string> } = {}): Promise<T> {
  const url = new URL(path.startsWith("http") ? path : `${graph()}${path}`);
  for (const [k, v] of Object.entries(init.query ?? {})) url.searchParams.set(k, v);
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.igAccessToken}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });
  const json = (await res.json().catch(() => ({}))) as T & { error?: { message: string } };
  if (!res.ok || json.error) {
    throw new Error(`Instagram API ${res.status}: ${json.error?.message ?? JSON.stringify(json)}`);
  }
  return json;
}

/** Simulated senders (from the admin simulator) start with sim_ and never hit Meta. */
export const isSimulated = (igsid: string) => igsid.startsWith("sim_");

export function verifySignature(rawBody: string, header: string | null): boolean {
  if (!config.igAppSecret || !header?.startsWith("sha256=")) return false;
  const expected = crypto.createHmac("sha256", config.igAppSecret).update(rawBody).digest("hex");
  const given = header.slice("sha256=".length);
  return given.length === expected.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

/** Send a DM. Logged to the messages table either way. Only valid within 24h of the user's last message. */
export async function sendDM(igsid: string, text: string): Promise<void> {
  let error: string | null = null;
  if (!isSimulated(igsid)) {
    try {
      await call("/me/messages", {
        method: "POST",
        body: JSON.stringify({ recipient: { id: igsid }, message: { text } }),
      });
    } catch (e) {
      error = (e as Error).message;
      console.error("sendDM failed", igsid, error);
    }
  }
  await db().from("messages").insert({ igsid, direction: "out", text, error });
}

export async function getSenderUsername(igsid: string): Promise<string | null> {
  if (isSimulated(igsid)) return null;
  try {
    const r = await call<{ username?: string }>(`/${igsid}`, { query: { fields: "username" } });
    return r.username ?? null;
  } catch (e) {
    console.error("username lookup failed", (e as Error).message);
    return null;
  }
}

export type PublishInput = {
  mediaType: "image" | "video";
  mediaUrl: string;
  caption: string;
  tagUsername: string | null;
};

/** Content Publishing API: create container, wait until ready, publish. */
export async function publishToFeed(input: PublishInput): Promise<{ containerId: string; mediaId: string }> {
  const params: Record<string, string> = { caption: input.caption };
  if (input.mediaType === "image") {
    params.image_url = input.mediaUrl;
    if (input.tagUsername) params.user_tags = JSON.stringify([{ username: input.tagUsername, x: 0.5, y: 0.5 }]);
  } else {
    params.media_type = "REELS";
    params.video_url = input.mediaUrl;
    if (input.tagUsername) params.user_tags = JSON.stringify([{ username: input.tagUsername }]);
  }

  const container = await call<{ id: string }>(`/${config.igUserId}/media`, {
    method: "POST",
    body: JSON.stringify(params),
  });

  // Videos (and sometimes images) need processing before publish.
  for (let i = 0; i < 25; i++) {
    const s = await call<{ status_code?: string }>(`/${container.id}`, { query: { fields: "status_code" } });
    if (!s.status_code || s.status_code === "FINISHED") break;
    if (s.status_code === "ERROR" || s.status_code === "EXPIRED") {
      throw new Error(`Container ${container.id} status ${s.status_code}`);
    }
    await new Promise((r) => setTimeout(r, 2000));
  }

  const published = await call<{ id: string }>(`/${config.igUserId}/media_publish`, {
    method: "POST",
    body: JSON.stringify({ creation_id: container.id }),
  });
  return { containerId: container.id, mediaId: published.id };
}

// ---------- Instagram Login (voters) ----------

export function loginUrl(state: string): string {
  const u = new URL("https://www.instagram.com/oauth/authorize");
  u.searchParams.set("client_id", config.igAppId);
  u.searchParams.set("redirect_uri", `${config.siteUrl}/api/auth/instagram/callback`);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", "instagram_business_basic");
  u.searchParams.set("state", state);
  return u.toString();
}

export type IgProfile = {
  user_id: string;
  username: string;
  account_type?: string;
  followers_count?: number;
  media_count?: number;
};

export async function exchangeLoginCode(code: string): Promise<IgProfile> {
  const form = new URLSearchParams({
    client_id: config.igAppId,
    client_secret: config.igAppSecret,
    grant_type: "authorization_code",
    redirect_uri: `${config.siteUrl}/api/auth/instagram/callback`,
    code,
  });
  const tokenRes = await fetch("https://api.instagram.com/oauth/access_token", { method: "POST", body: form });
  const token = (await tokenRes.json()) as { access_token?: string; error_message?: string };
  if (!token.access_token) throw new Error(`Instagram login failed: ${token.error_message ?? tokenRes.status}`);

  const me = new URL(`${graph()}/me`);
  me.searchParams.set("fields", "user_id,username,account_type,followers_count,media_count");
  me.searchParams.set("access_token", token.access_token);
  const profileRes = await fetch(me);
  const profile = (await profileRes.json()) as IgProfile & { error?: { message: string } };
  if (profile.error) throw new Error(profile.error.message);
  return profile;
}

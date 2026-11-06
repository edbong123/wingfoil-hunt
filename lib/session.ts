import "server-only";
import crypto from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { cookies, headers } from "next/headers";
import { config } from "./config";
import { db, type User } from "./db";

const COOKIE = "wh_session";
const key = () => new TextEncoder().encode(config.sessionSecret || "dev-only-insecure-secret-change-me!!");

export async function setSession(userId: string) {
  const token = await new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(key());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: config.siteUrl.startsWith("https"),
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSession() {
  (await cookies()).delete(COOKIE);
}

export async function currentUser(): Promise<User | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    const { data } = await db().from("users").select("*").eq("id", payload.uid as string).maybeSingle();
    return (data as User) ?? null;
  } catch {
    return null;
  }
}

export async function ipHash(): Promise<string | null> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip");
  if (!ip) return null;
  return crypto.createHmac("sha256", key()).update(ip).digest("hex").slice(0, 32);
}

/** Login-time anti-bot thresholds. Returns a reason string when the account is too new/empty. */
export function voterEligibility(p: { followers_count?: number; media_count?: number }): string | null {
  if ((p.media_count ?? 0) < config.minVoterMedia) return `Your account needs at least ${config.minVoterMedia} post(s) to vote.`;
  if ((p.followers_count ?? 0) < config.minVoterFollowers)
    return `Your account needs at least ${config.minVoterFollowers} followers to vote.`;
  return null;
}

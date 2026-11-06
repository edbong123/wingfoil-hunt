import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { config } from "@/lib/config";
import { db, must, type User } from "@/lib/db";
import { exchangeLoginCode } from "@/lib/instagram";
import { setSession, voterEligibility } from "@/lib/session";

const back = (msg?: string) =>
  NextResponse.redirect(`${config.siteUrl}/${msg ? `?notice=${encodeURIComponent(msg)}` : ""}`);

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const jar = await cookies();
  const expected = jar.get("wh_oauth_state")?.value;
  jar.delete("wh_oauth_state");
  if (!code || !state || state !== expected) return back("Login failed, please try again.");

  try {
    const p = await exchangeLoginCode(code);
    const blocked = voterEligibility(p);
    if (blocked) return back(blocked);

    const fields = {
      ig_user_id: p.user_id,
      handle: p.username,
      account_type: p.account_type ?? null,
      followers_count: p.followers_count ?? null,
      media_count: p.media_count ?? null,
    };
    let user = (await db().from("users").select("*").eq("ig_user_id", p.user_id).maybeSingle()).data as User | null;
    if (!user) {
      // Same person may already exist from DMs (matched by handle).
      user = (await db().from("users").select("*").ilike("handle", p.username).is("ig_user_id", null).maybeSingle())
        .data as User | null;
    }
    if (user) await db().from("users").update(fields).eq("id", user.id);
    else user = must(await db().from("users").insert(fields).select().single()) as User;

    await setSession(user.id);
    return back();
  } catch (e) {
    console.error("instagram login failed", e);
    return back("Login failed, please try again.");
  }
}

import crypto from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { loginUrl } from "@/lib/instagram";

export async function GET() {
  const state = crypto.randomBytes(16).toString("hex");
  (await cookies()).set("wh_oauth_state", state, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 600 });
  return NextResponse.redirect(loginUrl(state));
}

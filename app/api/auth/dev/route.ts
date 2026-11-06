import { NextResponse, type NextRequest } from "next/server";
import { config } from "@/lib/config";
import { db, must, type User } from "@/lib/db";
import { setSession } from "@/lib/session";

// Test-only login: /api/auth/dev?handle=someone. Disabled unless DEV_LOGIN=true.
export async function GET(req: NextRequest) {
  if (!config.devLogin) return new NextResponse("not found", { status: 404 });
  const handle = (req.nextUrl.searchParams.get("handle") ?? "").replace(/[^a-z0-9._]/gi, "").slice(0, 30);
  if (!handle) return new NextResponse("handle required", { status: 400 });
  const id = `dev_${handle.toLowerCase()}`;
  const user =
    ((await db().from("users").select("*").eq("ig_user_id", id).maybeSingle()).data as User | null) ??
    (must(await db().from("users").insert({ ig_user_id: id, handle: `dev_${handle}` }).select().single()) as User);
  await setSession(user.id);
  return NextResponse.redirect(`${config.siteUrl}/`);
}

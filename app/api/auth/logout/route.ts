import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { clearSession } from "@/lib/session";

export async function POST() {
  await clearSession();
  return NextResponse.redirect(`${config.siteUrl}/`, { status: 303 });
}

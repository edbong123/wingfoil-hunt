import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Reports which settings are present (true/false only, never values) and whether the DB answers.
export async function GET() {
  const env = {
    SUPABASE_URL: !!config.supabaseUrl,
    SUPABASE_SERVICE_ROLE_KEY: !!config.supabaseServiceKey,
    ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
    SITE_URL: !!process.env.SITE_URL,
    SESSION_SECRET: !!config.sessionSecret,
    ADMIN_PASSWORD: !!config.adminPassword,
    CRON_SECRET: !!config.cronSecret,
    IG_APP_ID: !!config.igAppId,
    IG_APP_SECRET: !!config.igAppSecret,
    IG_USER_ID: !!config.igUserId,
    IG_ACCESS_TOKEN: !!config.igAccessToken,
  };
  let database = "ok";
  try {
    const { error } = await db().from("rounds").select("id", { head: true, count: "exact" });
    if (error) database = `error: ${error.message}`;
  } catch (e) {
    database = `error: ${(e as Error).message}`;
  }
  return NextResponse.json({ database, dryRun: config.dryRun, env });
}

import { NextResponse, type NextRequest } from "next/server";
import { config } from "@/lib/config";
import { closeRoundAndPublish } from "@/lib/rounds";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

// Called daily by Vercel Cron (see vercel.json). Vercel sends "Authorization: Bearer $CRON_SECRET".
export async function GET(req: NextRequest) {
  if (!config.cronSecret || req.headers.get("authorization") !== `Bearer ${config.cronSecret}`) {
    return new NextResponse("unauthorized", { status: 401 });
  }
  try {
    const result = await closeRoundAndPublish();
    console.log("round closed", result);
    return NextResponse.json(result);
  } catch (e) {
    console.error("close round failed", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

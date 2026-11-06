import { after, NextResponse, type NextRequest } from "next/server";
import { handleIncoming, type IncomingAttachment } from "@/lib/bot";
import { config } from "@/lib/config";
import { verifySignature } from "@/lib/instagram";

export const maxDuration = 60;

// Meta webhook verification handshake.
export function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  if (p.get("hub.mode") === "subscribe" && config.igVerifyToken && p.get("hub.verify_token") === config.igVerifyToken) {
    return new NextResponse(p.get("hub.challenge") ?? "", { status: 200 });
  }
  return new NextResponse("forbidden", { status: 403 });
}

type WebhookBody = {
  object?: string;
  entry?: {
    id: string;
    messaging?: {
      sender: { id: string };
      recipient: { id: string };
      timestamp: number;
      message?: { mid: string; text?: string; is_echo?: boolean; is_deleted?: boolean; attachments?: IncomingAttachment[] };
    }[];
  }[];
};

export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!verifySignature(raw, req.headers.get("x-hub-signature-256"))) {
    return new NextResponse("bad signature", { status: 401 });
  }
  const body = JSON.parse(raw) as WebhookBody;

  const events = (body.entry ?? []).flatMap((e) => e.messaging ?? []);
  // Ack fast; Meta retries slow webhooks. Process after the response is sent.
  after(async () => {
    for (const ev of events) {
      const m = ev.message;
      if (!m || m.is_echo || m.is_deleted) continue;
      if (ev.sender.id === config.igUserId) continue;
      try {
        await handleIncoming({ igsid: ev.sender.id, mid: m.mid, text: m.text, attachments: m.attachments });
      } catch (e) {
        console.error("webhook event failed", m.mid, e);
      }
    }
  });
  return NextResponse.json({ ok: true });
}

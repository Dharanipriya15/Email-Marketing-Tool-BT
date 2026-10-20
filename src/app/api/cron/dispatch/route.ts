import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { isSendingEnabled } from "@/lib/email-sending-config";
import { dispatchDueCampaigns } from "@/services/campaign-send-service";

// Long-ish batches; harmless where the platform ignores it.
export const maxDuration = 60;

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(header);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

async function handle(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isSendingEnabled()) {
    return NextResponse.json({ skipped: "EMAIL_SENDING_ENABLED is not true" }, { status: 200 });
  }
  try {
    const summary = await dispatchDueCampaigns();
    return NextResponse.json(summary);
  } catch (error) {
    console.error("Cron dispatch failed:", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ error: "Dispatch failed" }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
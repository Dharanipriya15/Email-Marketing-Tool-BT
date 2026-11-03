import { NextResponse } from "next/server";
import { verifyClick } from "@/lib/tracking";
import { recordClick } from "@/services/tracking-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const click = verifyClick(new URL(request.url).searchParams);
  // Unsigned / tampered links are rejected rather than redirected anywhere.
  if (!click) return new NextResponse("Invalid or expired link.", { status: 400 });
  try {
    await recordClick(click.recipientId, click.url);
  } catch (error) {
    console.error("[tracking] click failed", error instanceof Error ? error.message : error);
  }
  return NextResponse.redirect(click.url, { status: 302, headers: { "Cache-Control": "no-store" } });
}

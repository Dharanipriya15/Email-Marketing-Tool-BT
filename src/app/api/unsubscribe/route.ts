import { NextResponse, type NextRequest } from "next/server";
import { verifyUnsubscribeToken } from "@/lib/unsubscribe-token";
import { unsubscribeRecipient } from "@/services/unsubscribe-service";

// RFC 8058 one-click unsubscribe. Mail clients POST
// "List-Unsubscribe=One-Click" to the URL from the List-Unsubscribe header.
// Only POST is handled, so link scanners issuing GETs can't unsubscribe anyone.
export async function POST(request: NextRequest) {
  const payload = verifyUnsubscribeToken(request.nextUrl.searchParams.get("token"));
  if (!payload) {
    return NextResponse.json({ error: "Invalid unsubscribe token." }, { status: 400 });
  }

  try {
    await unsubscribeRecipient(payload, "one-click");
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("One-click unsubscribe failed:", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ error: "Could not process unsubscribe." }, { status: 500 });
  }
}
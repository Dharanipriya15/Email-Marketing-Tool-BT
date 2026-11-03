import { verifyOpenToken } from "@/lib/tracking";
import { recordOpen } from "@/services/tracking-service";

export const dynamic = "force-dynamic";

// 1x1 transparent GIF.
const PIXEL = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const recipientId = verifyOpenToken(token);
  if (recipientId) {
    try {
      await recordOpen(recipientId);
    } catch (error) {
      console.error("[tracking] open failed", error instanceof Error ? error.message : error);
    }
  }
  // Always return the pixel so the email renders normally.
  return new Response(new Uint8Array(PIXEL), {
    headers: {
      "Content-Type": "image/gif",
      "Content-Length": String(PIXEL.length),
      "Cache-Control": "no-store, no-cache, must-revalidate, private",
    },
  });
}

// SNS endpoint for SES bounce and complaint notifications.
// Every message must carry a valid SNS signature; subscription confirmations
// are confirmed only for SNS-hosted URLs and allowed topics (AWS_SNS_TOPIC_ARN).
import { NextResponse, type NextRequest } from "next/server";
import { isAllowedTopic, isSnsUrl, parseSnsMessage, verifySnsMessage } from "@/lib/sns";
import { applySesFeedback, parseSesFeedback } from "@/services/ses-feedback-service";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    // SNS posts JSON with Content-Type text/plain.
    body = JSON.parse(await request.text());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const message = parseSnsMessage(body);
  if (!message) return NextResponse.json({ error: "Not an SNS message" }, { status: 400 });
  if (!isAllowedTopic(message.TopicArn)) return NextResponse.json({ error: "Topic not allowed" }, { status: 403 });
  if (!(await verifySnsMessage(message))) return NextResponse.json({ error: "Invalid signature" }, { status: 403 });

  if (message.Type === "SubscriptionConfirmation") {
    if (!isSnsUrl(message.SubscribeURL)) return NextResponse.json({ error: "Bad SubscribeURL" }, { status: 400 });
    const response = await fetch(message.SubscribeURL!, { cache: "no-store" });
    return NextResponse.json({ confirmed: response.ok }, { status: response.ok ? 200 : 502 });
  }
  if (message.Type !== "Notification") return NextResponse.json({ ignored: message.Type });

  const feedback = parseSesFeedback(message.Message);
  if (!feedback) return NextResponse.json({ ignored: "not a permanent bounce or complaint" });
  try {
    return NextResponse.json(await applySesFeedback(feedback));
  } catch (error) {
    console.error("[ses-feedback] failed:", error instanceof Error ? error.message : "unknown error");
    // 500 makes SNS retry later.
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}

import { createSign, generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildStringToSign, isSnsUrl, parseSnsMessage, verifySnsMessage, type SnsMessage } from "@/lib/sns";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const pem = publicKey.export({ type: "spki", format: "pem" }).toString();

function signed(overrides: Partial<SnsMessage> = {}, version = "1"): SnsMessage {
  const message: SnsMessage = {
    Type: "Notification",
    MessageId: "id-1",
    TopicArn: "arn:aws:sns:ap-south-1:123:ses",
    Message: "{}",
    Timestamp: "2026-10-20T00:00:00.000Z",
    SignatureVersion: version,
    Signature: "",
    SigningCertURL: "https://sns.ap-south-1.amazonaws.com/SimpleNotificationService-x.pem",
    ...overrides,
  };
  const signer = createSign(version === "1" ? "RSA-SHA1" : "RSA-SHA256");
  signer.update(buildStringToSign(message));
  message.Signature = signer.sign(privateKey, "base64");
  return message;
}

describe("sns", () => {
  it("accepts only https SNS hosts", () => {
    expect(isSnsUrl("https://sns.us-east-1.amazonaws.com/cert.pem")).toBe(true);
    expect(isSnsUrl("http://sns.us-east-1.amazonaws.com/cert.pem")).toBe(false);
    expect(isSnsUrl("https://sns.us-east-1.amazonaws.com.evil.com/cert.pem")).toBe(false);
    expect(isSnsUrl("https://evil.com/sns.us-east-1.amazonaws.com")).toBe(false);
  });

  it("verifies valid v1 and v2 signatures", async () => {
    expect(await verifySnsMessage(signed({}, "1"), async () => pem)).toBe(true);
    expect(await verifySnsMessage(signed({}, "2"), async () => pem)).toBe(true);
  });

  it("rejects tampered messages and foreign cert URLs", async () => {
    const message = signed();
    expect(await verifySnsMessage({ ...message, Message: '{"x":1}' }, async () => pem)).toBe(false);
    expect(await verifySnsMessage({ ...message, SigningCertURL: "https://evil.com/c.pem" }, async () => pem)).toBe(false);
  });

  it("signs subscription confirmations over SubscribeURL and Token", () => {
    const text = buildStringToSign({ ...signed(), Type: "SubscriptionConfirmation", SubscribeURL: "u", Token: "t" });
    expect(text).toContain("SubscribeURL\nu\n");
    expect(text).toContain("Token\nt\n");
  });

  it("rejects non-SNS bodies", () => {
    expect(parseSnsMessage({ hello: 1 })).toBeNull();
  });
});

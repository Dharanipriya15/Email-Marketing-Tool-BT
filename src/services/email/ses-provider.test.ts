import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SendEmailCommand } from "@aws-sdk/client-sesv2";
import { SesProvider, formatAddress } from "./ses-provider";

const SECRET = "aws-super-secret-test-key";
const KEY_ID = "AKIATESTKEYID";

function makeProvider(send: ReturnType<typeof vi.fn>, configurationSet?: string) {
  return new SesProvider(
    {
      region: "us-east-1",
      accessKeyId: KEY_ID,
      secretAccessKey: SECRET,
      fromEmail: "sender@example.com",
      fromName: "Sender Co",
      configurationSet,
    },
    { send } as never
  );
}

describe("SesProvider", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends Simple content with headers, toName, text and configuration set", async () => {
    const send = vi.fn().mockResolvedValue({ MessageId: "ses-123" });
    const result = await makeProvider(send, "tracking").sendEmail({
      to: "a@example.com",
      toName: "Ada Lovelace",
      subject: "Hi",
      html: "<p>Hi</p>",
      text: "Hi",
      headers: { "List-Unsubscribe": "<https://x/u>", "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
    });

    expect(result).toEqual({ success: true, messageId: "ses-123" });
    const command = send.mock.calls[0][0];
    expect(command).toBeInstanceOf(SendEmailCommand);
    const input = command.input;
    expect(input.FromEmailAddress).toBe('"Sender Co" <sender@example.com>');
    expect(input.Destination.ToAddresses).toEqual(['"Ada Lovelace" <a@example.com>']);
    expect(input.ConfigurationSetName).toBe("tracking");
    expect(input.Content.Simple.Subject.Data).toBe("Hi");
    expect(input.Content.Simple.Body.Html.Data).toBe("<p>Hi</p>");
    expect(input.Content.Simple.Body.Text.Data).toBe("Hi");
    expect(input.Content.Simple.Headers).toEqual([
      { Name: "List-Unsubscribe", Value: "<https://x/u>" },
      { Name: "List-Unsubscribe-Post", Value: "List-Unsubscribe=One-Click" },
    ]);
  });

  it("omits optional fields when not provided", async () => {
    const send = vi.fn().mockResolvedValue({ MessageId: "m" });
    await makeProvider(send).sendEmail({ to: "a@example.com", subject: "S", html: "<p>x</p>" });
    const input = send.mock.calls[0][0].input;
    expect(input.ConfigurationSetName).toBeUndefined();
    expect(input.Content.Simple.Headers).toBeUndefined();
    expect(input.Content.Simple.Body.Text).toBeUndefined();
    expect(input.Destination.ToAddresses).toEqual(["a@example.com"]);
  });

  it("returns a safe error without leaking credentials", async () => {
    const error = Object.assign(new Error(`Signature mismatch for ${SECRET} / ${KEY_ID}`), {
      name: "MessageRejected",
      $metadata: { httpStatusCode: 400 },
    });
    const send = vi.fn().mockRejectedValue(error);
    const result = await makeProvider(send).sendEmail({ to: "a@example.com", subject: "S", html: "x" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("HTTP 400");
      expect(result.error).toContain("MessageRejected");
      expect(result.error).not.toContain(SECRET);
      expect(result.error).not.toContain(KEY_ID);
    }
    expect(JSON.stringify((console.error as unknown as ReturnType<typeof vi.fn>).mock.calls)).not.toContain(SECRET);
  });
});

describe("formatAddress", () => {
  it("encodes non-ASCII names and strips header injection", () => {
    expect(formatAddress("a@x.com", "Jos\u00e9")).toMatch(/^=\?UTF-8\?B\?.+\?= <a@x\.com>$/);
    expect(formatAddress("a@x.com\r\nBcc: evil@x.com", "N")).not.toMatch(/[\r\n]/);
    expect(formatAddress("a@x.com", 'Say "hi"')).toBe('"Say \\"hi\\"" <a@x.com>');
  });
});
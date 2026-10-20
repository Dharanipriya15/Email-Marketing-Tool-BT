import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BREVO_SEND_URL, BrevoProvider } from "./brevo-provider";

const API_KEY = "xkeysib-super-secret-test-key";

function makeProvider() {
  return new BrevoProvider({ apiKey: API_KEY, fromEmail: "sender@example.com", fromName: "Sender" });
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("BrevoProvider", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("maps messageId on success", async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, { messageId: "<abc@smtp-relay.brevo.com>" }));
    const result = await makeProvider().sendEmail({ to: "a@example.com", subject: "Hi", html: "<p>Hi</p>" });
    expect(result).toEqual({ success: true, messageId: "<abc@smtp-relay.brevo.com>" });
  });

  it("sends the correct request body and headers", async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, { messageId: "m1" }));
    await makeProvider().sendEmail({
      to: "a@example.com",
      toName: "Asha",
      subject: "Subject",
      html: "<p>Body</p>",
      text: "Body",
      headers: { "List-Unsubscribe": "<https://example.com/u>" },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(BREVO_SEND_URL);
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({
      "api-key": API_KEY,
      "content-type": "application/json",
      accept: "application/json",
    });
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(init.body)).toEqual({
      sender: { email: "sender@example.com", name: "Sender" },
      to: [{ email: "a@example.com", name: "Asha" }],
      subject: "Subject",
      htmlContent: "<p>Body</p>",
      textContent: "Body",
      headers: { "List-Unsubscribe": "<https://example.com/u>" },
    });
  });

  it("returns failure with status and Brevo code/message on non-2xx", async () => {
    fetchMock.mockResolvedValue(jsonResponse(401, { code: "unauthorized", message: "Key not found" }));
    const result = await makeProvider().sendEmail({ to: "a@example.com", subject: "Hi", html: "<p>Hi</p>" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("401");
      expect(result.error).toContain("unauthorized");
      expect(result.error).toContain("Key not found");
    }
  });

  it("never includes the api key in errors", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(400, { code: "bad_request", message: `invalid key ${API_KEY}` }));
    fetchMock.mockRejectedValueOnce(new Error(`network failure for ${API_KEY}`));
    const provider = makeProvider();
    for (let i = 0; i < 2; i++) {
      const result = await provider.sendEmail({ to: "a@example.com", subject: "Hi", html: "<p>Hi</p>" });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).not.toContain(API_KEY);
    }
    for (const call of vi.mocked(console.error).mock.calls) {
      expect(JSON.stringify(call)).not.toContain(API_KEY);
    }
  });
});
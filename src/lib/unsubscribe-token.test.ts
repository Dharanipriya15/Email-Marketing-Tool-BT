import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildOneClickUnsubscribeUrl,
  buildUnsubscribePageUrl,
  createUnsubscribeToken,
  verifyUnsubscribeToken,
} from "@/lib/unsubscribe-token";

beforeEach(() => {
  vi.stubEnv("UNSUBSCRIBE_SECRET", "test-unsubscribe-secret");
  vi.stubEnv("APP_URL", "https://mail.example.com/");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

const payload = { organizationId: "org_1", email: "Ada@Example.com", contactId: "c1", campaignId: "m1" };

describe("unsubscribe tokens", () => {
  it("round-trips a signed payload (email normalized)", () => {
    const token = createUnsubscribeToken(payload);
    expect(token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(verifyUnsubscribeToken(token)).toEqual({ ...payload, email: "ada@example.com" });
  });

  it("rejects a tampered payload", () => {
    const token = createUnsubscribeToken(payload);
    const [, sig] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ o: "org_2", e: "ada@example.com" })).toString("base64url");
    expect(verifyUnsubscribeToken(`${forged}.${sig}`)).toBeNull();
  });

  it("rejects a tampered signature and garbage input", () => {
    const token = createUnsubscribeToken(payload);
    expect(verifyUnsubscribeToken(token.slice(0, -2) + "xx")).toBeNull();
    expect(verifyUnsubscribeToken("badtoken")).toBeNull();
    expect(verifyUnsubscribeToken("")).toBeNull();
    expect(verifyUnsubscribeToken(null)).toBeNull();
  });

  it("rejects tokens signed with a different secret", () => {
    const token = createUnsubscribeToken(payload);
    vi.stubEnv("UNSUBSCRIBE_SECRET", "another-secret");
    expect(verifyUnsubscribeToken(token)).toBeNull();
  });

  it("falls back to AUTH_SECRET", () => {
    vi.stubEnv("UNSUBSCRIBE_SECRET", "");
    vi.stubEnv("AUTH_SECRET", "auth-secret");
    expect(verifyUnsubscribeToken(createUnsubscribeToken(payload))?.organizationId).toBe("org_1");
  });

  it("builds absolute URLs from APP_URL", () => {
    expect(buildUnsubscribePageUrl("t.k")).toBe("https://mail.example.com/unsubscribe/t.k");
    expect(buildOneClickUnsubscribeUrl("t.k")).toBe("https://mail.example.com/api/unsubscribe?token=t.k");
  });
});
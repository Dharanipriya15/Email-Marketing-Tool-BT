import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyTracking,
  isTrackingAvailable,
  buildClickUrl,
  buildOpenPixelUrl,
  rewriteLinksForTracking,
  verifyClick,
  verifyOpenToken,
} from "@/lib/tracking";

beforeEach(() => {
  vi.stubEnv("UNSUBSCRIBE_SECRET", "test-secret");
  vi.stubEnv("APP_URL", "https://app.example.com");
});

const params = (url: string) => new URL(url).searchParams;

describe("tracking links", () => {
  it("signs and verifies open tokens", () => {
    const url = buildOpenPixelUrl("rec_1");
    const token = url.split("/api/t/o/")[1];
    expect(verifyOpenToken(token)).toBe("rec_1");
    expect(verifyOpenToken(token.replace("rec_1", "rec_2"))).toBeNull();
    expect(verifyOpenToken("garbage")).toBeNull();
  });

  it("signs click URLs and rejects tampering (no open redirect)", () => {
    const url = buildClickUrl("rec_1", "https://shop.example.com/a?x=1&y=2");
    expect(verifyClick(params(url))).toEqual({ recipientId: "rec_1", url: "https://shop.example.com/a?x=1&y=2" });

    const evil = Buffer.from("https://evil.example.com").toString("base64url");
    const tampered = new URL(url);
    tampered.searchParams.set("u", evil);
    expect(verifyClick(tampered.searchParams)).toBeNull();
    const otherRecipient = new URL(url);
    otherRecipient.searchParams.set("r", "rec_2");
    expect(verifyClick(otherRecipient.searchParams)).toBeNull();
    expect(verifyClick(new URLSearchParams("r=rec_1&u=x"))).toBeNull();
  });

  it("does not accept signatures from another secret", () => {
    const url = buildClickUrl("rec_1", "https://a.com");
    vi.stubEnv("UNSUBSCRIBE_SECRET", "different");
    expect(verifyClick(params(url))).toBeNull();
  });

  it("never signs non-http links", () => {
    const html = '<a href="javascript:alert(1)">x</a><a href="mailto:a@b.c">m</a><a href="#top">t</a>';
    expect(rewriteLinksForTracking(html, "rec_1")).toBe(html);
  });

  it("rewrites links but keeps the unsubscribe link", () => {
    const unsub = "https://app.example.com/unsubscribe/tok.sig";
    const html = `<a class="b" href="https://site.com/p?a=1&amp;b=2">Go</a> <a href="${unsub}">Unsubscribe</a>`;
    const out = rewriteLinksForTracking(html, "rec_1", [unsub]);
    expect(out).toContain(`href="${unsub}"`);
    const tracked = out.match(/href="([^"]+\/api\/t\/c[^"]+)"/)![1].replace(/&amp;/g, "&");
    expect(verifyClick(params(tracked))?.url).toBe("https://site.com/p?a=1&b=2");
  });

  it("respects trackOpens / trackClicks", () => {
    const html = '<html><body><a href="https://a.com">a</a></body></html>';
    expect(applyTracking(html, "r", { trackOpens: false, trackClicks: false })).toBe(html);
    const both = applyTracking(html, "r", { trackOpens: true, trackClicks: true });
    expect(both).toContain("/api/t/o/r.");
    expect(both).toContain("/api/t/c?r=r");
    expect(both.indexOf("/api/t/o/")).toBeLessThan(both.indexOf("</body>"));
  });

  it("skips tracking unless APP_URL is public https", () => {
    const html = '<html><body><a href="https://boilertechenergy.com/contact">Contact</a></body></html>';
    for (const url of ["http://localhost:3000", "https://localhost:3000", "https://127.0.0.1", "http://app.example.com", "not a url"]) {
      vi.stubEnv("APP_URL", url);
      expect(isTrackingAvailable()).toBe(false);
      expect(applyTracking(html, "r", { trackOpens: true, trackClicks: true })).toBe(html);
    }
    vi.stubEnv("APP_URL", "https://app.example.com");
    expect(isTrackingAvailable()).toBe(true);
  });
});

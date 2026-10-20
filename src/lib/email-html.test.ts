import { describe, expect, it } from "vitest";
import { escapeHtml, normalizeUrl } from "@/lib/email-html";

describe("escapeHtml", () => {
  it("escapes HTML-significant characters", () => {
    expect(escapeHtml(`<a href="x">Tom & Jerry's</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&#39;s&lt;/a&gt;"
    );
  });
});

describe("normalizeUrl", () => {
  it("keeps http(s) and mailto URLs as-is", () => {
    expect(normalizeUrl("https://example.com/a?b=1")).toBe("https://example.com/a?b=1");
    expect(normalizeUrl("http://example.com")).toBe("http://example.com");
    expect(normalizeUrl("mailto:sales@example.com")).toBe("mailto:sales@example.com");
  });

  it("adds https:// to bare domains typed by users", () => {
    expect(normalizeUrl("example.com")).toBe("https://example.com");
    expect(normalizeUrl("  www.example.com/offer ")).toBe("https://www.example.com/offer");
  });

  it("turns bare email addresses into mailto links", () => {
    expect(normalizeUrl("sales@example.com")).toBe("mailto:sales@example.com");
  });

  it("rejects unsafe schemes and blank input", () => {
    expect(normalizeUrl("javascript:alert(1)")).toBe("");
    expect(normalizeUrl("data:text/html;base64,xyz")).toBe("");
    expect(normalizeUrl("   ")).toBe("");
  });
});

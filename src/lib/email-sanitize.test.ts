import { describe, expect, it } from "vitest";
import { sanitizeEmailHtml } from "@/lib/email-sanitize";
import { buildButtonHtml } from "@/lib/email-button";

describe("sanitizeEmailHtml", () => {
  it("keeps allowed tags and safe inline styles", () => {
    const html = '<p style="text-align:center;">Hello <strong>world</strong></p>';
    const result = sanitizeEmailHtml(html);
    expect(result).toContain("<strong>world</strong>");
    expect(result).toContain("text-align:center");
  });

  it("strips script tags entirely", () => {
    const result = sanitizeEmailHtml('<p>Hi</p><script>alert("xss")</script>');
    expect(result).not.toContain("<script");
    expect(result).not.toContain("alert");
  });

  it("strips event handler attributes from images", () => {
    const result = sanitizeEmailHtml('<img src="x.png" onerror="alert(1)" alt="x">');
    expect(result).not.toContain("onerror");
    expect(result).toContain("src=\"x.png\"");
  });

  it("blocks javascript: URLs in links", () => {
    const result = sanitizeEmailHtml('<a href="javascript:alert(1)">Click</a>');
    expect(result).not.toContain("javascript:");
  });

  it("preserves ordinary http(s) links and adds safe rel", () => {
    const result = sanitizeEmailHtml('<a href="https://example.com">Visit</a>');
    expect(result).toContain('href="https://example.com"');
    expect(result).toContain("noopener");
  });

  it("drops disallowed tags like iframe while keeping their text content", () => {
    const result = sanitizeEmailHtml("<p>Before</p><iframe src=\"evil\"></iframe><p>After</p>");
    expect(result).not.toContain("<iframe");
    expect(result).toContain("Before");
    expect(result).toContain("After");
  });

  it("preserves personalization tokens as plain text", () => {
    const result = sanitizeEmailHtml("<p>Hi {{first_name}}, from {{company}}</p>");
    expect(result).toContain("{{first_name}}");
    expect(result).toContain("{{company}}");
  });

  it("keeps the table-based CTA button intact, including multi-value padding", () => {
    const button = buildButtonHtml({ text: "Go", href: "https://example.com" });
    const result = sanitizeEmailHtml(button);
    expect(result).toContain('data-type="email-button"');
    expect(result).toContain('bgcolor="#2a78d6"');
    expect(result).toContain("padding:12px 28px");
    expect(result).toContain('role="presentation"');
  });

  it("blocks data: and javascript: image sources", () => {
    expect(sanitizeEmailHtml('<img src="data:image/png;base64,AAAA">')).not.toContain("data:");
    expect(sanitizeEmailHtml('<img src="javascript:alert(1)">')).not.toContain("javascript:");
  });

  it("drops unsafe CSS values such as url() backgrounds", () => {
    const result = sanitizeEmailHtml('<p style="background-color:url(evil);color:#111111">x</p>');
    expect(result).not.toContain("url(");
    expect(result).toContain("color:#111111");
  });
});

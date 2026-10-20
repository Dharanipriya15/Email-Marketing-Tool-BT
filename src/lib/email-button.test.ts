import { describe, expect, it } from "vitest";
import { EMAIL_BUTTON_DEFAULTS, buildButtonHtml, buildButtonSpec } from "@/lib/email-button";

describe("buildButtonHtml", () => {
  it("builds a table-based button with the given text, link, and color", () => {
    const html = buildButtonHtml({ text: "Shop Now", href: "https://example.com/sale", color: "#ff5500" });
    expect(html).toContain('data-type="email-button"');
    expect(html).toContain('href="https://example.com/sale"');
    expect(html).toContain(">Shop Now</a>");
    expect(html).toContain('bgcolor="#ff5500"');
    expect(html).toContain("padding:12px 28px");
  });

  it("escapes HTML-significant characters in text and link", () => {
    const html = buildButtonHtml({ text: '<script>alert("x")</script>', href: 'https://e.com/?a="b"' });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&quot;b&quot;");
  });

  it("falls back to safe defaults for blank or invalid input", () => {
    const html = buildButtonHtml({ text: " ", href: "", color: "red;background:url(x)" });
    expect(html).toContain(`>${EMAIL_BUTTON_DEFAULTS.text}</a>`);
    expect(html).toContain('href="#"');
    expect(html).toContain(`bgcolor="${EMAIL_BUTTON_DEFAULTS.color}"`);
    expect(html).not.toContain("url(x)");
  });

  it("applies the requested alignment to the button cell", () => {
    const spec = JSON.stringify(buildButtonSpec({ align: "right" }));
    expect(spec).toContain('"align":"right"');
  });
});

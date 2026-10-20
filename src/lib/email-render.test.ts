import { describe, expect, it } from "vitest";
import { renderEmailDocument, renderPersonalizedEmail, styleEmailBody } from "@/lib/email-render";
import { buildButtonHtml } from "@/lib/email-button";

describe("styleEmailBody", () => {
  it("adds inline styles to every supported element", () => {
    const html = styleEmailBody("<h1>Title</h1><p>Body</p><ul><li><p>One</p></li></ul><hr>");
    expect(html).toMatch(/<h1 style="[^"]*font-size:28px/);
    expect(html).toMatch(/<p style="[^"]*font-size:16px/);
    expect(html).toMatch(/<ul style="[^"]*padding:0 0 0 24px/);
    expect(html).toMatch(/<hr style="[^"]*border-top:1px solid/);
  });

  it("keeps the element's own styles after (so they override) the defaults", () => {
    const html = styleEmailBody('<p style="text-align: center">Hi</p>');
    expect(html).toMatch(/<p style="margin:0 0 16px 0;[^"]*text-align: center">/);
  });

  it("does not break attributes containing '>' characters", () => {
    const html = styleEmailBody('<p><a href="https://e.com/?q=a>b">Link</a></p>');
    expect(html).toContain('href="https://e.com/?q=a>b"');
    expect(html).toMatch(/<a href="[^"]*" style="color:/);
  });

  it("preserves empty paragraphs as visible spacing", () => {
    expect(styleEmailBody("<p></p>")).toContain(">&nbsp;</p>");
  });

  it("unwraps single paragraphs inside list items", () => {
    const html = styleEmailBody("<ul><li><p>One</p></li><li><p>Two</p></li></ul>");
    expect(html).toMatch(/<li style="[^"]*">One<\/li>/);
    expect(html).toMatch(/<li style="[^"]*">Two<\/li>/);
  });

  it("keeps the CTA button's own white text color over the default link color", () => {
    const html = styleEmailBody(buildButtonHtml({ text: "Go", href: "https://e.com" }));
    const anchorStyle = html.match(/<a [^>]*style="([^"]*)"/)?.[1] ?? "";
    expect(anchorStyle.lastIndexOf("color:#ffffff")).toBeGreaterThan(anchorStyle.indexOf("color:#2a78d6"));
  });
});

describe("renderEmailDocument", () => {
  it("wraps content in a 600px table layout with a hidden preheader", () => {
    const html = renderEmailDocument({ subject: "Hello", previewText: "Peek", bodyHtml: "<p>Hi</p>" });
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain('width="600"');
    expect(html).toContain("<title>Hello</title>");
    expect(html).toMatch(/display:none[^>]*>Peek/);
  });

  it("escapes subject and preview text", () => {
    const html = renderEmailDocument({
      subject: "</title><script>x</script>",
      previewText: "<img src=x onerror=alert(1)>",
      bodyHtml: "",
    });
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img src=x");
  });

  it("omits the preheader when there is no preview text", () => {
    const html = renderEmailDocument({ subject: "S", bodyHtml: "<p>Hi</p>" });
    expect(html).not.toContain("mso-hide:all");
  });
});

describe("renderPersonalizedEmail", () => {
  it("fills variables in subject, preview text, and body", () => {
    const { subject, html } = renderPersonalizedEmail(
      { subject: "Hi {{first_name}}", previewText: "For {{company}}", htmlContent: "<p>{{industry}}</p>" },
      { first_name: "Ann", company: "Acme", industry: "Energy" }
    );
    expect(subject).toBe("Hi Ann");
    expect(html).toContain("For Acme");
    expect(html).toContain(">Energy</p>");
  });

  it("escapes contact data inserted into the HTML body", () => {
    const { html } = renderPersonalizedEmail(
      { subject: "S", htmlContent: "<p>{{company}}</p>" },
      { company: "<b>Evil</b>" }
    );
    expect(html).toContain("&lt;b&gt;Evil&lt;/b&gt;");
  });
});

import { describe, expect, it } from "vitest";
import { buildStarterTemplateHtml } from "@/lib/starter-template";
import { sanitizeEmailHtml } from "@/lib/email-sanitize";

describe("buildStarterTemplateHtml", () => {
  it("follows the header → content → CTA → footer structure", () => {
    const html = buildStarterTemplateHtml({ companyName: "Acme Energy" });
    const header = html.indexOf("<h2");
    const content = html.indexOf("{{first_name}}");
    const cta = html.indexOf('data-type="email-button"');
    const footer = html.lastIndexOf("<hr>");
    expect(header).toBeGreaterThanOrEqual(0);
    expect(header).toBeLessThan(content);
    expect(content).toBeLessThan(cta);
    expect(cta).toBeLessThan(footer);
  });

  it("uses the organization's company name instead of hard-coded branding", () => {
    const html = buildStarterTemplateHtml({ companyName: "Acme Energy" });
    expect(html).toContain("Acme Energy");
    expect(html).not.toMatch(/boil/i);
  });

  it("falls back to a neutral placeholder name and escapes the company name", () => {
    expect(buildStarterTemplateHtml()).toContain("Your Company");
    expect(buildStarterTemplateHtml({ companyName: "<b>X</b>" })).toContain("&lt;b&gt;X&lt;/b&gt;");
  });

  it("includes personalization variables", () => {
    const html = buildStarterTemplateHtml();
    for (const token of ["{{first_name}}", "{{company}}", "{{industry}}"]) {
      expect(html).toContain(token);
    }
  });

  it("survives sanitization with its button and footer styling intact", () => {
    const sanitized = sanitizeEmailHtml(buildStarterTemplateHtml());
    expect(sanitized).toContain('data-type="email-button"');
    expect(sanitized).toContain("padding:12px 28px");
    expect(sanitized).toContain("font-size:13px");
  });
});

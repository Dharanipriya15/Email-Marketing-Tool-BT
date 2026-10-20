import { buildButtonHtml } from "@/lib/email-button";
import { escapeHtml } from "@/lib/email-html";
import { SMALL_TEXT_STYLE } from "@/lib/email-styles";

const FALLBACK_COMPANY_NAME = "Your Company";

// Starter content following Header → Main Content → CTA → Footer. The
// company name is passed in (from the organization's settings), so the copy
// is never hard-coded to one organization and stays reusable across tenants.
export function buildStarterTemplateHtml({ companyName }: { companyName?: string } = {}): string {
  const company = escapeHtml(companyName?.trim() || FALLBACK_COMPANY_NAME);

  const header = [
    `<h2 style="text-align: center">${company}</h2>`,
    `<hr>`,
  ].join("");

  const mainContent = [
    `<h1>A smarter solution for {{company}}</h1>`,
    `<p>Hi {{first_name}},</p>`,
    `<p>We would like to introduce our latest industrial solution for {{company}}. It is designed to help teams in {{industry}} reduce costs, improve reliability, and keep operations running smoothly.</p>`,
    `<ul><li><p><strong>Lower operating costs</strong> through better efficiency</p></li><li><p><strong>Reliable performance</strong> you can plan around</p></li><li><p><strong>Expert support</strong> from installation to maintenance</p></li></ul>`,
    `<p>We would be glad to walk you through how it could work for your team.</p>`,
  ].join("");

  const cta = buildButtonHtml({ text: "Book a Consultation", href: "https://example.com" });

  const signOff = `<p>Best regards,<br>The ${company} Team</p>`;

  const footer = [
    `<hr>`,
    `<p style="text-align: center; ${SMALL_TEXT_STYLE}">${company}<br>You are receiving this email because you are a valued contact of ${company}.</p>`,
  ].join("");

  return [header, mainContent, cta, signOff, footer].join("");
}

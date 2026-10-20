import { describe, expect, it } from "vitest";
import { htmlToPlainText } from "@/lib/email-text";
import { buildButtonHtml } from "@/lib/email-button";

describe("htmlToPlainText", () => {
  it("converts paragraphs and headings into separated lines", () => {
    expect(htmlToPlainText("<h1>Title</h1><p>First</p><p>Second</p>")).toBe("Title\n\nFirst\n\nSecond");
  });

  it("writes links as 'text (url)'", () => {
    expect(htmlToPlainText('<p>See <a href="https://e.com">our site</a></p>')).toBe(
      "See our site (https://e.com)"
    );
  });

  it("renders the CTA button as its label and link", () => {
    expect(htmlToPlainText(buildButtonHtml({ text: "Book now", href: "https://e.com/b" }))).toBe(
      "Book now (https://e.com/b)"
    );
  });

  it("renders list items, line breaks, and decodes entities", () => {
    const text = htmlToPlainText("<ul><li><p>One</p></li><li><p>Two &amp; three</p></li></ul><p>A<br>B</p>");
    expect(text).toContain("- One");
    expect(text).toContain("- Two & three");
    expect(text).toContain("A\nB");
  });

  it("keeps personalization tokens", () => {
    expect(htmlToPlainText("<p>Hi {{first_name}},</p>")).toBe("Hi {{first_name}},");
  });
});

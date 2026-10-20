import { describe, expect, it } from "vitest";
import {
  applyPersonalization,
  personalizeHtml,
  PERSONALIZATION_VARIABLES,
  SAMPLE_PERSONALIZATION_DATA,
} from "@/lib/personalization";

describe("applyPersonalization", () => {
  it("substitutes known variables with sample data by default", () => {
    const result = applyPersonalization("Hi {{first_name}}, welcome to {{company}}!");
    expect(result).toBe(
      `Hi ${SAMPLE_PERSONALIZATION_DATA.first_name}, welcome to ${SAMPLE_PERSONALIZATION_DATA.company}!`
    );
  });

  it("substitutes with custom data when provided", () => {
    const result = applyPersonalization("Hi {{first_name}}", { first_name: "Alex" });
    expect(result).toBe("Hi Alex");
  });

  it("leaves unrecognized tokens untouched", () => {
    const result = applyPersonalization("Hi {{unknown_field}}");
    expect(result).toBe("Hi {{unknown_field}}");
  });

  it("is case-insensitive and tolerates internal whitespace", () => {
    const result = applyPersonalization("Hi {{ First_Name }}", { first_name: "Sam" });
    expect(result).toBe("Hi Sam");
  });

  it("preserves the literal token in the untouched source (no mutation)", () => {
    const source = "Hi {{first_name}}, from {{company}}";
    applyPersonalization(source);
    expect(source).toBe("Hi {{first_name}}, from {{company}}");
  });

  it("substitutes every occurrence of a repeated variable", () => {
    const result = applyPersonalization("{{first_name}} {{first_name}}", { first_name: "Jo" });
    expect(result).toBe("Jo Jo");
  });
});

describe("personalizeHtml", () => {
  it("HTML-escapes substituted values", () => {
    expect(personalizeHtml("<p>{{company}}</p>", { company: "A & <B>" })).toBe("<p>A &amp; &lt;B&gt;</p>");
  });

  it("leaves unknown tokens untouched", () => {
    expect(personalizeHtml("<p>{{nope}}</p>", {})).toBe("<p>{{nope}}</p>");
  });
});

describe("PERSONALIZATION_VARIABLES", () => {
  it("offers every supported variable, each with sample data for previews", () => {
    const tokens = PERSONALIZATION_VARIABLES.map((v) => v.token);
    expect(tokens).toEqual([
      "{{first_name}}",
      "{{last_name}}",
      "{{company}}",
      "{{industry}}",
      "{{location}}",
    ]);
    for (const token of tokens) {
      expect(applyPersonalization(token)).not.toBe(token);
    }
  });
});

import { describe, expect, it } from "vitest";
import { sendTestEmailSchema, templateFormSchema } from "@/schemas/template";
import { buildButtonHtml } from "@/lib/email-button";

const valid = {
  name: "Welcome",
  subject: "Hello {{first_name}}",
  previewText: "",
  htmlContent: "<p>Hi {{first_name}}</p>",
};

function errorFor(input: unknown, field: string) {
  const result = templateFormSchema.safeParse(input);
  if (result.success) return undefined;
  return result.error.issues.find((issue) => issue.path[0] === field)?.message;
}

describe("templateFormSchema", () => {
  it("accepts a complete template and keeps personalization variables", () => {
    const result = templateFormSchema.safeParse(valid);
    expect(result.success).toBe(true);
    expect(result.success && result.data.subject).toBe("Hello {{first_name}}");
  });

  it("requires a template name, subject, and content with clear messages", () => {
    expect(errorFor({ ...valid, name: "  " }, "name")).toBe("Template name is required");
    expect(errorFor({ ...valid, subject: "" }, "subject")).toBe("Subject line is required");
    expect(errorFor({ ...valid, htmlContent: "<p></p>" }, "htmlContent")).toBe("Email content is required");
    expect(errorFor({ ...valid, htmlContent: "<p>&nbsp;</p>" }, "htmlContent")).toBe(
      "Email content is required"
    );
  });

  it("treats image-only or button-only content as valid", () => {
    expect(templateFormSchema.safeParse({ ...valid, htmlContent: '<p><img src="https://e.com/a.png"></p>' }).success).toBe(true);
    expect(templateFormSchema.safeParse({ ...valid, htmlContent: buildButtonHtml({}) }).success).toBe(true);
  });

  it("enforces length limits", () => {
    expect(errorFor({ ...valid, name: "x".repeat(151) }, "name")).toMatch(/150 characters/);
    expect(errorFor({ ...valid, subject: "x".repeat(201) }, "subject")).toMatch(/200 characters/);
    expect(errorFor({ ...valid, previewText: "x".repeat(201) }, "previewText")).toMatch(/200 characters/);
  });
});

describe("sendTestEmailSchema", () => {
  it("validates the recipient address", () => {
    const base = { subject: "S", htmlContent: "<p>Hi</p>" };
    expect(sendTestEmailSchema.safeParse({ ...base, testEmail: "me@example.com" }).success).toBe(true);
    const bad = sendTestEmailSchema.safeParse({ ...base, testEmail: "not-an-email" });
    expect(bad.success).toBe(false);
    expect(!bad.success && bad.error.issues[0].message).toBe("Enter a valid email address");
  });
});

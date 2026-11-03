import { describe, expect, it } from "vitest";
import { companySettingsSchema } from "@/schemas/company-settings";

describe("companySettingsSchema", () => {
  it("trims values and turns empty optional fields into null", () => {
    const parsed = companySettingsSchema.parse({
      companyName: "  BoilerTech  ",
      companyAddress: " 12 Main Road, Chennai 600001 ",
      unsubscribeFooterText: "   ",
    });
    expect(parsed).toEqual({
      companyName: "BoilerTech",
      companyAddress: "12 Main Road, Chennai 600001",
      unsubscribeFooterText: null,
    });
  });

  it("requires a company address", () => {
    const result = companySettingsSchema.safeParse({ companyName: "X", companyAddress: "  ", unsubscribeFooterText: "" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toMatch(/mailing address/);
  });

  it("enforces max lengths", () => {
    expect(
      companySettingsSchema.safeParse({ companyName: "a".repeat(121), companyAddress: "12 Main Road", unsubscribeFooterText: "" }).success
    ).toBe(false);
    expect(
      companySettingsSchema.safeParse({ companyName: "", companyAddress: "12 Main Road", unsubscribeFooterText: "a".repeat(501) }).success
    ).toBe(false);
  });
});

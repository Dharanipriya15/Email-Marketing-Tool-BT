import { describe, expect, it } from "vitest";
import { campaignFormSchema, scheduleCampaignSchema } from "@/schemas/campaign";

describe("campaignFormSchema", () => {
  it("trims fields and turns empty ids into undefined", () => {
    const result = campaignFormSchema.parse({
      name: "  Spring Sale ",
      subject: " Hi {{first_name}} ",
      contactListId: "",
      templateId: "",
    });
    expect(result).toEqual({ name: "Spring Sale", subject: "Hi {{first_name}}", contactListId: undefined, templateId: undefined });
  });

  it("keeps selected list and template ids", () => {
    const result = campaignFormSchema.parse({ name: "A", subject: "B", contactListId: "l1", templateId: "t1" });
    expect(result.contactListId).toBe("l1");
    expect(result.templateId).toBe("t1");
  });

  it("requires a name and subject", () => {
    const result = campaignFormSchema.safeParse({ name: " ", subject: "" });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((i) => i.message)).toEqual([
      "Campaign name is required",
      "Subject line is required",
    ]);
  });

  it("rejects overly long names and subjects", () => {
    expect(campaignFormSchema.safeParse({ name: "x".repeat(151), subject: "s" }).success).toBe(false);
    expect(campaignFormSchema.safeParse({ name: "n", subject: "x".repeat(201) }).success).toBe(false);
  });
});

describe("scheduleCampaignSchema", () => {
  it("accepts a future ISO date string", () => {
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const result = scheduleCampaignSchema.parse({ scheduledAt: future });
    expect(result.scheduledAt).toBeInstanceOf(Date);
  });

  it("rejects past dates", () => {
    const past = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const result = scheduleCampaignSchema.safeParse({ scheduledAt: past });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("Scheduled time must be in the future");
  });

  it("rejects invalid dates", () => {
    expect(scheduleCampaignSchema.safeParse({ scheduledAt: "not a date" }).success).toBe(false);
  });
});
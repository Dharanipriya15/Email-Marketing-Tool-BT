import { describe, expect, it } from "vitest";
import { isAllowedTestRecipient } from "@/lib/test-email-recipients";

describe("isAllowedTestRecipient", () => {
  it("allows users of the same organization (case-insensitive)", () => {
    expect(isAllowedTestRecipient(" Admin@BoilTech.com ", [], ["admin@boiltech.com"])).toBe(true);
  });

  it("allows allowlisted addresses and domains", () => {
    expect(isAllowedTestRecipient("me@team.com", ["me@team.com"], [])).toBe(true);
    expect(isAllowedTestRecipient("anyone@safe.org", ["safe.org"], [])).toBe(true);
    expect(isAllowedTestRecipient("boss@team.com", ["me@team.com"], [])).toBe(false);
  });

  it("does NOT allow everyone when the allowlist is empty", () => {
    expect(isAllowedTestRecipient("stranger@example.com", [], ["admin@boiltech.com"])).toBe(false);
  });

  it("rejects malformed input", () => {
    expect(isAllowedTestRecipient("not-an-email", ["safe.org"], [])).toBe(false);
  });
});

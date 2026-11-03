import { describe, expect, it } from "vitest";
import { changePasswordSchema } from "./change-password";

const base = {
  currentPassword: "old-password-123",
  newPassword: "brand-new-password-1",
  confirmPassword: "brand-new-password-1",
};

describe("changePasswordSchema", () => {
  it("accepts a valid change", () => {
    expect(changePasswordSchema.safeParse(base).success).toBe(true);
  });
  it("rejects a new password shorter than 12 chars", () => {
    const r = changePasswordSchema.safeParse({ ...base, newPassword: "short-pass1", confirmPassword: "short-pass1" });
    expect(r.success).toBe(false);
  });
  it("accepts exactly 12 chars", () => {
    const p = "a".repeat(12);
    expect(changePasswordSchema.safeParse({ ...base, newPassword: p, confirmPassword: p }).success).toBe(true);
  });
  it("rejects mismatched confirmation", () => {
    const r = changePasswordSchema.safeParse({ ...base, confirmPassword: "something-else-1" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].path).toEqual(["confirmPassword"]);
  });
  it("rejects empty current password", () => {
    expect(changePasswordSchema.safeParse({ ...base, currentPassword: "" }).success).toBe(false);
  });
  it("rejects reusing the current password", () => {
    const p = "same-password-123";
    expect(changePasswordSchema.safeParse({ currentPassword: p, newPassword: p, confirmPassword: p }).success).toBe(false);
  });
});
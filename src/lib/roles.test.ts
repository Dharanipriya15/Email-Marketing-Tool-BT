import { describe, expect, it } from "vitest";
import { isAdminRole } from "@/lib/roles";

describe("isAdminRole", () => {
  it("only accepts ADMIN", () => {
    expect(isAdminRole("ADMIN")).toBe(true);
    expect(isAdminRole("MEMBER")).toBe(false);
    expect(isAdminRole("admin")).toBe(false);
    expect(isAdminRole(null)).toBe(false);
    expect(isAdminRole(undefined)).toBe(false);
  });
});

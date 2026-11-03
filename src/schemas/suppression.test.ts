import { describe, expect, it } from "vitest";
import { normalizeSuppressionEmails, pickEmailColumn } from "@/schemas/suppression";

describe("normalizeSuppressionEmails", () => {
  it("lowercases, trims, de-duplicates and separates invalid values", () => {
    expect(normalizeSuppressionEmails([" A@X.com", "a@x.com", "bad", "", "b@y.org"])).toEqual({
      valid: ["a@x.com", "b@y.org"],
      invalid: ["bad"],
    });
  });
});

describe("pickEmailColumn", () => {
  it("prefers a header named email", () => {
    expect(pickEmailColumn(["Name", "E-mail"], [{ Name: "x", "E-mail": "a@x.com" }])).toBe("E-mail");
    expect(pickEmailColumn(["Name", "Email Address"], [])).toBe("Email Address");
  });
  it("falls back to the first column that contains an address", () => {
    expect(pickEmailColumn(["who", "addr"], [{ who: "Ada", addr: "a@x.com" }])).toBe("addr");
    expect(pickEmailColumn(["who"], [{ who: "Ada" }])).toBeNull();
  });
});

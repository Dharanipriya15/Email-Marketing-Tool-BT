import { describe, expect, it } from "vitest";
import { detectColumnMapping, parseCsvText, rowsToCsv } from "@/lib/csv";

describe("parseCsvText", () => {
  it("parses a valid CSV with headers and rows", () => {
    const { data, error } = parseCsvText(
      "First Name,Email\nJane,jane@example.com\nJohn,john@example.com"
    );
    expect(error).toBeNull();
    expect(data?.headers).toEqual(["First Name", "Email"]);
    expect(data?.rows).toHaveLength(2);
    expect(data?.rows[0]).toEqual({ "First Name": "Jane", Email: "jane@example.com" });
  });

  it("reports an error for a completely empty file", () => {
    const { data, error } = parseCsvText("");
    expect(data).toBeNull();
    expect(error).not.toBeNull();
  });

  it("reports 'empty' when headers exist but there are no data rows", () => {
    const { data, error } = parseCsvText("First Name,Email\n");
    expect(data).toBeNull();
    expect(error).toEqual({ type: "empty" });
  });

  it("skips blank lines rather than treating them as rows", () => {
    const { data } = parseCsvText("Email\njane@example.com\n\njohn@example.com\n");
    expect(data?.rows).toHaveLength(2);
  });

  it("handles a large CSV without error", () => {
    const rows = Array.from({ length: 5000 }, (_, i) => `person${i}@example.com`).join("\n");
    const { data, error } = parseCsvText(`Email\n${rows}`);
    expect(error).toBeNull();
    expect(data?.rows).toHaveLength(5000);
  });
});

describe("detectColumnMapping", () => {
  it("auto-detects common email header variants", () => {
    for (const header of ["email", "Email Address", "email_address", "E-Mail", "emailaddress"]) {
      expect(detectColumnMapping([header])[header]).toBe("email");
    }
  });

  it("auto-detects common name header variants", () => {
    for (const header of ["First Name", "first_name", "firstname"]) {
      expect(detectColumnMapping([header])[header]).toBe("firstName");
    }
    for (const header of ["Last Name", "last_name", "lastname", "surname"]) {
      expect(detectColumnMapping([header])[header]).toBe("lastName");
    }
  });

  it("leaves unrecognized columns unmapped", () => {
    const mapping = detectColumnMapping(["Favorite Color"]);
    expect(mapping["Favorite Color"]).toBeNull();
  });

  it("does not map two different columns to the same field", () => {
    const mapping = detectColumnMapping(["Email", "Email Address"]);
    const mappedFields = Object.values(mapping).filter(Boolean);
    expect(mappedFields).toEqual(["email"]);
  });
});

describe("rowsToCsv", () => {
  it("produces a downloadable CSV string from rows", () => {
    const csv = rowsToCsv(
      [{ Row: "1", Email: "jane@example.com", Problem: "Invalid email format" }],
      ["Row", "Email", "Problem"]
    );
    expect(csv).toContain("Row,Email,Problem");
    expect(csv).toContain("jane@example.com");
  });
});

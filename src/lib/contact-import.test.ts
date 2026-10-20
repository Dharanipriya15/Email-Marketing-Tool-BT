import { describe, expect, it } from "vitest";
import { detectColumnMapping, type ParsedCsv } from "@/lib/csv";
import { applyExistingEmails, buildImportRows, summarizeRows } from "@/lib/contact-import";

function csvFrom(headers: string[], rows: Record<string, string>[]): ParsedCsv {
  return { headers, rows };
}

describe("buildImportRows — scenario: valid CSV", () => {
  it("marks every row valid when emails are well-formed and unique", () => {
    const csv = csvFrom(
      ["First Name", "Email"],
      [
        { "First Name": "Jane", Email: "jane@example.com" },
        { "First Name": "John", Email: "john@example.com" },
      ]
    );
    const mapping = detectColumnMapping(csv.headers);
    const rows = buildImportRows(csv, mapping);

    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.outcome === "valid")).toBe(true);
    expect(rows[0].data.firstName).toBe("Jane");
    expect(rows[0].data.status).toBe("ACTIVE");
  });
});

describe("buildImportRows — scenario: missing Email column", () => {
  it("flags every row as missing email when no column maps to email", () => {
    const csv = csvFrom(["First Name"], [{ "First Name": "Jane" }]);
    const mapping = detectColumnMapping(csv.headers); // no email column present
    const rows = buildImportRows(csv, mapping);

    expect(rows[0].outcome).toBe("invalid");
    expect(rows[0].problem).toBe("Missing email");
  });
});

describe("buildImportRows — scenario: invalid emails", () => {
  it("flags malformed emails as invalid", () => {
    const csv = csvFrom(["Email"], [{ Email: "not-an-email" }, { Email: "" }]);
    const mapping = { Email: "email" as const };
    const rows = buildImportRows(csv, mapping);

    expect(rows[0].outcome).toBe("invalid");
    expect(rows[0].problem).toBe("Invalid email format");
    expect(rows[1].outcome).toBe("invalid");
    expect(rows[1].problem).toBe("Missing email");
  });
});

describe("buildImportRows — scenario: duplicate emails within the CSV", () => {
  it("marks the first occurrence valid and later ones as duplicates", () => {
    const csv = csvFrom(
      ["Email"],
      [{ Email: "jane@example.com" }, { Email: "JANE@example.com" }, { Email: "jane@example.com" }]
    );
    const mapping = { Email: "email" as const };
    const rows = buildImportRows(csv, mapping);

    expect(rows[0].outcome).toBe("valid");
    expect(rows[1].outcome).toBe("duplicate"); // case-insensitive match
    expect(rows[2].outcome).toBe("duplicate");
  });
});

describe("applyExistingEmails — scenario: existing contacts", () => {
  it("downgrades valid rows whose email already exists in the database", () => {
    const csv = csvFrom(["Email"], [{ Email: "jane@example.com" }, { Email: "new@example.com" }]);
    const mapping = { Email: "email" as const };
    const rows = buildImportRows(csv, mapping);
    const finalRows = applyExistingEmails(rows, new Set(["jane@example.com"]));

    expect(finalRows[0].outcome).toBe("existing");
    expect(finalRows[1].outcome).toBe("valid");
  });

  it("does not affect rows that are already invalid or duplicate", () => {
    const csv = csvFrom(["Email"], [{ Email: "bad" }]);
    const mapping = { Email: "email" as const };
    const rows = buildImportRows(csv, mapping);
    const finalRows = applyExistingEmails(rows, new Set(["bad"]));

    expect(finalRows[0].outcome).toBe("invalid");
  });
});

describe("buildImportRows + summarizeRows — scenario: mixed valid/invalid CSV", () => {
  it("produces counts that add up to the total row count", () => {
    const csv = csvFrom(
      ["Email"],
      [
        { Email: "valid1@example.com" },
        { Email: "valid2@example.com" },
        { Email: "not-an-email" },
        { Email: "" },
        { Email: "valid1@example.com" }, // duplicate of row 1
      ]
    );
    const mapping = { Email: "email" as const };
    const rows = buildImportRows(csv, mapping);
    const finalRows = applyExistingEmails(rows, new Set(["valid2@example.com"]));
    const summary = summarizeRows(finalRows);

    expect(summary.total).toBe(5);
    expect(summary.valid).toBe(1); // valid1
    expect(summary.existing).toBe(1); // valid2
    expect(summary.invalid).toBe(2); // not-an-email, empty
    expect(summary.duplicate).toBe(1); // second valid1
    expect(summary.valid + summary.existing + summary.invalid + summary.duplicate).toBe(
      summary.total
    );
  });
});

describe("buildImportRows — scenario: large CSV", () => {
  it("correctly classifies thousands of rows without error", () => {
    const rows = Array.from({ length: 5000 }, (_, i) => ({
      Email: i % 500 === 0 && i > 0 ? "person0@example.com" : `person${i}@example.com`,
    }));
    const csv = csvFrom(["Email"], rows);
    const mapping = { Email: "email" as const };
    const result = buildImportRows(csv, mapping);
    const summary = summarizeRows(result);

    expect(summary.total).toBe(5000);
    expect(summary.duplicate).toBeGreaterThan(0);
    expect(summary.valid + summary.duplicate).toBe(5000);
  });
});

describe("buildImportRows — status normalization", () => {
  it("maps recognized status text case-insensitively and defaults unrecognized/blank to ACTIVE", () => {
    const csv = csvFrom(
      ["Email", "Status"],
      [
        { Email: "a@example.com", Status: "unsubscribed" },
        { Email: "b@example.com", Status: "BOUNCED" },
        { Email: "c@example.com", Status: "not-a-status" },
        { Email: "d@example.com", Status: "" },
      ]
    );
    const mapping = { Email: "email" as const, Status: "status" as const };
    const rows = buildImportRows(csv, mapping);

    expect(rows[0].data.status).toBe("UNSUBSCRIBED");
    expect(rows[1].data.status).toBe("BOUNCED");
    expect(rows[2].data.status).toBe("ACTIVE");
    expect(rows[3].data.status).toBe("ACTIVE");
  });
});

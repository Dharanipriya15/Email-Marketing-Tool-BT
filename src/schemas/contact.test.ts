import { describe, expect, it } from "vitest";
import { bulkContactIdsSchema, listIdSchema } from "./contact";

describe("bulkContactIdsSchema", () => {
  it("accepts a non-empty array of ids", () => {
    expect(bulkContactIdsSchema.safeParse(["a", "b"]).success).toBe(true);
  });

  it("rejects an empty array", () => {
    expect(bulkContactIdsSchema.safeParse([]).success).toBe(false);
  });

  it("rejects non-array input", () => {
    expect(bulkContactIdsSchema.safeParse("abc").success).toBe(false);
  });

  it("rejects blank ids", () => {
    expect(bulkContactIdsSchema.safeParse(["a", "  "]).success).toBe(false);
  });

  it("rejects oversized batches", () => {
    const ids = Array.from({ length: 1001 }, (_, i) => `id-${i}`);
    expect(bulkContactIdsSchema.safeParse(ids).success).toBe(false);
  });
});

describe("listIdSchema", () => {
  it("rejects an empty list id", () => {
    expect(listIdSchema.safeParse("").success).toBe(false);
  });
});

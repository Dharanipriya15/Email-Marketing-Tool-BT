import { describe, expect, it, vi } from "vitest";
vi.mock("@/db/client", () => ({ prisma: {} }));
import { rate } from "@/services/dashboard-service";

describe("rate", () => {
  it("uses delivered, falling back to sent", () => {
    expect(rate(5, 10, 20)).toBe(50);
    expect(rate(5, 0, 20)).toBe(25);
    expect(rate(5, 0, 0)).toBe(0);
  });
});

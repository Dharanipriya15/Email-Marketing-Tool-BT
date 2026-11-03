import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  suppression: { findMany: vi.fn(), count: vi.fn(), createMany: vi.fn(), deleteMany: vi.fn() },
}));
vi.mock("@/db/client", () => ({ prisma: prismaMock }));

import { addManualSuppression, importSuppressions, listSuppressions, removeSuppression } from "@/services/suppression-service";

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.suppression.findMany.mockResolvedValue([]);
  prismaMock.suppression.count.mockResolvedValue(0);
});

describe("suppression-service", () => {
  it("lists org-scoped with search and pagination", async () => {
    await listSuppressions({ organizationId: "org", search: " Foo ", page: 3, pageSize: 10 });
    const args = prismaMock.suppression.findMany.mock.calls[0][0];
    expect(args.where).toEqual({ organizationId: "org", email: { contains: "foo", mode: "insensitive" } });
    expect(args.skip).toBe(20);
    expect(args.take).toBe(10);
  });

  it("adds a manual suppression idempotently", async () => {
    prismaMock.suppression.createMany.mockResolvedValue({ count: 0 });
    expect(await addManualSuppression("org", "A@X.com")).toBe(false);
    expect(prismaMock.suppression.createMany.mock.calls[0][0]).toEqual({
      data: [{ organizationId: "org", email: "a@x.com", reason: "MANUAL", source: "manual" }],
      skipDuplicates: true,
    });
  });

  it("imports in chunks of 1000 and reports duplicates", async () => {
    prismaMock.suppression.createMany.mockResolvedValueOnce({ count: 1000 }).mockResolvedValueOnce({ count: 400 });
    const emails = Array.from({ length: 1500 }, (_, i) => `u${i}@x.com`);
    expect(await importSuppressions("org", emails)).toEqual({ added: 1400, alreadySuppressed: 100 });
    expect(prismaMock.suppression.createMany.mock.calls.map((c) => c[0].data.length)).toEqual([1000, 500]);
  });

  it("removes only within the organization", async () => {
    prismaMock.suppression.deleteMany.mockResolvedValue({ count: 1 });
    expect(await removeSuppression("org", "s1")).toBe(true);
    expect(prismaMock.suppression.deleteMany).toHaveBeenCalledWith({ where: { id: "s1", organizationId: "org" } });
  });
});

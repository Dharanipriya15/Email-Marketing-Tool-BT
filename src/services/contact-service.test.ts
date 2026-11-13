import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  contactList: { findFirst: vi.fn() },
  contact: { findMany: vi.fn() },
  suppression: { findMany: vi.fn() },
  contactListMember: { createMany: vi.fn() },
}));
vi.mock("@/db/client", () => ({ prisma: prismaMock }));

import { addContactsToList } from "@/services/contact-service";
import { formatAddToListResult } from "@/lib/list-membership";

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.contactList.findFirst.mockResolvedValue({ id: "list1" });
  prismaMock.suppression.findMany.mockResolvedValue([]);
  prismaMock.contactListMember.createMany.mockImplementation(({ data }) =>
    Promise.resolve({ count: data.length })
  );
});

describe("addContactsToList", () => {
  it("throws when the list is not in the org", async () => {
    prismaMock.contactList.findFirst.mockResolvedValue(null);
    await expect(addContactsToList("org", ["c1"], "list1")).rejects.toThrow("List not found.");
    expect(prismaMock.contactList.findFirst.mock.calls[0][0].where).toEqual({
      id: "list1",
      organizationId: "org",
    });
  });

  it("only adds ACTIVE, non-suppressed org contacts and reports counts", async () => {
    // c3 is inactive (filtered by query), c2 is suppressed (case-insensitive).
    prismaMock.contact.findMany.mockResolvedValue([
      { id: "c1", email: "a@x.com" },
      { id: "c2", email: "b@x.com" },
    ]);
    prismaMock.suppression.findMany.mockResolvedValue([{ email: "B@x.com" }]);

    const result = await addContactsToList("org", ["c1", "c2", "c3", "c1"], "list1");

    expect(prismaMock.contact.findMany.mock.calls[0][0].where).toEqual({
      id: { in: ["c1", "c2", "c3"] },
      organizationId: "org",
      status: "ACTIVE",
    });
    expect(prismaMock.suppression.findMany.mock.calls[0][0].where.organizationId).toBe("org");
    expect(prismaMock.contactListMember.createMany).toHaveBeenCalledWith({
      data: [{ contactId: "c1", contactListId: "list1" }],
      skipDuplicates: true,
    });
    expect(result).toEqual({ added: 1, skipped: 2, alreadyInList: 0 });
  });

  it("counts existing members as alreadyInList", async () => {
    prismaMock.contact.findMany.mockResolvedValue([
      { id: "c1", email: "a@x.com" },
      { id: "c2", email: "b@x.com" },
    ]);
    prismaMock.contactListMember.createMany.mockResolvedValue({ count: 1 });

    const result = await addContactsToList("org", ["c1", "c2"], "list1");
    expect(result).toEqual({ added: 1, skipped: 0, alreadyInList: 1 });
  });

  it("skips the insert when nothing is eligible", async () => {
    prismaMock.contact.findMany.mockResolvedValue([]);
    const result = await addContactsToList("org", ["c1"], "list1");
    expect(prismaMock.contactListMember.createMany).not.toHaveBeenCalled();
    expect(result).toEqual({ added: 0, skipped: 1, alreadyInList: 0 });
  });
});

describe("formatAddToListResult", () => {
  it("formats the toast message", () => {
    expect(formatAddToListResult({ added: 3, skipped: 1, alreadyInList: 0 })).toBe(
      "Added 3, skipped 1 (suppressed/inactive)"
    );
    expect(formatAddToListResult({ added: 2, skipped: 0, alreadyInList: 0 })).toBe("Added 2");
  });
});

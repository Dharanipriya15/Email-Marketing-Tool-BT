import { prisma } from "@/db/client";
import type { ContactListFormInput } from "@/schemas/contact-list";

export const LIST_CONTACTS_PAGE_SIZE = 20;

export type ContactListRow = {
  id: string;
  name: string;
  description: string | null;
  contactCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export async function listContactLists(organizationId: string): Promise<ContactListRow[]> {
  const lists = await prisma.contactList.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { members: true } } },
  });

  return lists.map((list) => ({
    id: list.id,
    name: list.name,
    description: list.description,
    contactCount: list._count.members,
    createdAt: list.createdAt,
    updatedAt: list.updatedAt,
  }));
}

export type ContactListSummary = {
  totalLists: number;
  totalContactsAcrossLists: number;
};

export async function getContactListSummary(
  organizationId: string
): Promise<ContactListSummary> {
  const [totalLists, totalContactsAcrossLists] = await Promise.all([
    prisma.contactList.count({ where: { organizationId } }),
    prisma.contactListMember.count({ where: { contactList: { organizationId } } }),
  ]);

  return { totalLists, totalContactsAcrossLists };
}

export async function getContactListDetail(organizationId: string, id: string) {
  const list = await prisma.contactList.findFirst({
    where: { id, organizationId },
    include: { _count: { select: { members: true } } },
  });
  if (!list) return null;

  return {
    id: list.id,
    name: list.name,
    description: list.description,
    contactCount: list._count.members,
    createdAt: list.createdAt,
    updatedAt: list.updatedAt,
  };
}

export async function listContactsInList(
  organizationId: string,
  listId: string,
  page = 1
) {
  const where = {
    organizationId,
    listMemberships: { some: { contactListId: listId } },
  };

  const [contacts, total] = await Promise.all([
    prisma.contact.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (Math.max(1, page) - 1) * LIST_CONTACTS_PAGE_SIZE,
      take: LIST_CONTACTS_PAGE_SIZE,
    }),
    prisma.contact.count({ where }),
  ]);

  return { contacts, total };
}

function normalizeInput(input: ContactListFormInput) {
  return {
    name: input.name.trim(),
    description: input.description || null,
  };
}

export async function createContactList(organizationId: string, input: ContactListFormInput) {
  return prisma.contactList.create({
    data: { organizationId, ...normalizeInput(input) },
  });
}

export async function updateContactList(
  organizationId: string,
  id: string,
  input: ContactListFormInput
) {
  const result = await prisma.contactList.updateMany({
    where: { id, organizationId },
    data: normalizeInput(input),
  });
  if (result.count === 0) {
    throw new Error("List not found.");
  }
}

export async function deleteContactList(organizationId: string, id: string) {
  const result = await prisma.contactList.deleteMany({ where: { id, organizationId } });
  if (result.count === 0) {
    throw new Error("List not found.");
  }
}

import { prisma } from "@/db/client";
import type { Contact, ContactStatus, Prisma } from "@prisma/client";
import type { ContactFormInput } from "@/schemas/contact";

export const CONTACTS_PAGE_SIZE = 20;

export type ContactSortField = "name" | "email" | "company" | "status" | "createdAt";
export type SortDirection = "asc" | "desc";

export type ListContactsParams = {
  organizationId: string;
  search?: string;
  status?: ContactStatus;
  industry?: string;
  location?: string;
  listId?: string;
  sort?: ContactSortField;
  dir?: SortDirection;
  page?: number;
};

export type ContactListRow = Contact & {
  listMemberships: { contactList: { id: string; name: string } }[];
};

function buildWhere(params: ListContactsParams): Prisma.ContactWhereInput {
  const { organizationId, search, status, industry, location, listId } = params;

  const where: Prisma.ContactWhereInput = { organizationId };

  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { company: { contains: search, mode: "insensitive" } },
    ];
  }

  if (status) where.status = status;
  if (industry) where.industry = industry;
  if (location) where.location = location;
  if (listId) where.listMemberships = { some: { contactListId: listId } };

  return where;
}

function buildOrderBy(
  sort: ContactSortField = "createdAt",
  dir: SortDirection = "desc"
): Prisma.ContactOrderByWithRelationInput | Prisma.ContactOrderByWithRelationInput[] {
  switch (sort) {
    case "name":
      return [{ firstName: dir }, { lastName: dir }];
    case "email":
      return { email: dir };
    case "company":
      return { company: dir };
    case "status":
      return { status: dir };
    case "createdAt":
    default:
      return { createdAt: dir };
  }
}

export async function listContacts(
  params: ListContactsParams
): Promise<{ contacts: ContactListRow[]; total: number }> {
  const where = buildWhere(params);
  const orderBy = buildOrderBy(params.sort, params.dir);
  const page = Math.max(1, params.page ?? 1);

  const [contacts, total] = await Promise.all([
    prisma.contact.findMany({
      where,
      orderBy,
      skip: (page - 1) * CONTACTS_PAGE_SIZE,
      take: CONTACTS_PAGE_SIZE,
      include: {
        listMemberships: {
          select: { contactList: { select: { id: true, name: true } } },
        },
      },
    }),
    prisma.contact.count({ where }),
  ]);

  return { contacts, total };
}

export async function getContactCount(organizationId: string): Promise<number> {
  return prisma.contact.count({ where: { organizationId } });
}

export type ContactFilterOptions = {
  industries: string[];
  locations: string[];
  lists: { id: string; name: string }[];
};

export async function getContactFilterOptions(
  organizationId: string
): Promise<ContactFilterOptions> {
  const [industryRows, locationRows, lists] = await Promise.all([
    prisma.contact.findMany({
      where: { organizationId, industry: { not: null } },
      select: { industry: true },
      distinct: ["industry"],
      orderBy: { industry: "asc" },
    }),
    prisma.contact.findMany({
      where: { organizationId, location: { not: null } },
      select: { location: true },
      distinct: ["location"],
      orderBy: { location: "asc" },
    }),
    prisma.contactList.findMany({
      where: { organizationId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return {
    industries: industryRows.map((r) => r.industry).filter((v): v is string => !!v),
    locations: locationRows.map((r) => r.location).filter((v): v is string => !!v),
    lists,
  };
}

export async function getContactDetail(organizationId: string, id: string) {
  return prisma.contact.findFirst({
    where: { id, organizationId },
    include: {
      listMemberships: {
        include: { contactList: { select: { id: true, name: true } } },
      },
      campaignRecipients: {
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { campaign: { select: { id: true, name: true } } },
      },
      unsubscribes: { orderBy: { createdAt: "desc" }, take: 5 },
    },
  });
}

export async function getContactRecentEvents(organizationId: string, contactId: string) {
  return prisma.emailEvent.findMany({
    where: { organizationId, campaignRecipient: { contactId } },
    orderBy: { occurredAt: "desc" },
    take: 15,
    include: { campaign: { select: { id: true, name: true } } },
  });
}

function normalizeInput(input: ContactFormInput) {
  return {
    firstName: input.firstName || null,
    lastName: input.lastName || null,
    email: input.email.toLowerCase().trim(),
    company: input.company || null,
    phone: input.phone || null,
    industry: input.industry || null,
    location: input.location || null,
    status: input.status,
  };
}

export async function createContact(organizationId: string, input: ContactFormInput) {
  return prisma.contact.create({
    data: { organizationId, ...normalizeInput(input) },
  });
}

export async function updateContact(
  organizationId: string,
  id: string,
  input: ContactFormInput
) {
  const result = await prisma.contact.updateMany({
    where: { id, organizationId },
    data: normalizeInput(input),
  });
  if (result.count === 0) {
    throw new Error("Contact not found.");
  }
}

export async function deleteContacts(organizationId: string, ids: string[]) {
  await prisma.contact.deleteMany({ where: { id: { in: ids }, organizationId } });
}

export async function addContactsToList(
  organizationId: string,
  contactIds: string[],
  contactListId: string
) {
  const list = await prisma.contactList.findFirst({
    where: { id: contactListId, organizationId },
    select: { id: true },
  });
  if (!list) throw new Error("List not found.");

  const contacts = await prisma.contact.findMany({
    where: { id: { in: contactIds }, organizationId },
    select: { id: true },
  });

  await prisma.contactListMember.createMany({
    data: contacts.map((c) => ({ contactId: c.id, contactListId })),
    skipDuplicates: true,
  });
}

export async function removeContactsFromList(
  organizationId: string,
  contactIds: string[],
  contactListId: string
) {
  const list = await prisma.contactList.findFirst({
    where: { id: contactListId, organizationId },
    select: { id: true },
  });
  if (!list) throw new Error("List not found.");

  await prisma.contactListMember.deleteMany({
    where: { contactListId, contactId: { in: contactIds } },
  });
}

export type SelectableContact = Pick<
  Contact,
  "id" | "firstName" | "lastName" | "email" | "company"
>;

// For the "Add Contacts to List" picker: contacts not already in the given
// list, optionally filtered by search, so duplicate membership is impossible
// by construction rather than relying solely on the DB unique constraint.
export async function searchContactsNotInList(
  organizationId: string,
  listId: string,
  search: string | undefined,
  limit = 50
): Promise<SelectableContact[]> {
  const where: Prisma.ContactWhereInput = {
    organizationId,
    listMemberships: { none: { contactListId: listId } },
  };

  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { company: { contains: search, mode: "insensitive" } },
    ];
  }

  return prisma.contact.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, firstName: true, lastName: true, email: true, company: true },
  });
}

"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { requireAdmin, requireUser } from "@/lib/auth";
import {
  bulkContactIdsSchema,
  contactFormSchema,
  listIdSchema,
  type ContactFormInput,
} from "@/schemas/contact";
import * as contactService from "@/services/contact-service";
import type { ActionResult } from "@/types/action";

const DUPLICATE_EMAIL_ERROR = "A contact with this email already exists.";
const GENERIC_ERROR = "Something went wrong. Please try again.";

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
  );
}

function revalidateListMembershipPaths(listId: string) {
  revalidatePath("/contacts");
  revalidatePath("/contacts/[id]", "page");
  revalidatePath("/lists");
  revalidatePath(`/lists/${listId}`);
}

export async function createContactAction(
  input: ContactFormInput
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const parsed = contactFormSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: GENERIC_ERROR };
  }

  try {
    const contact = await contactService.createContact(user.organizationId, parsed.data);
    revalidatePath("/contacts");
    return { success: true, data: { id: contact.id } };
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { success: false, error: DUPLICATE_EMAIL_ERROR };
    }
    console.error("Failed to create contact:", error);
    return { success: false, error: GENERIC_ERROR };
  }
}

export async function updateContactAction(
  id: string,
  input: ContactFormInput
): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = contactFormSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: GENERIC_ERROR };
  }

  try {
    await contactService.updateContact(user.organizationId, id, parsed.data);
    revalidatePath("/contacts");
    revalidatePath(`/contacts/${id}`);
    return { success: true, data: undefined };
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { success: false, error: DUPLICATE_EMAIL_ERROR };
    }
    console.error("Failed to update contact:", error);
    return { success: false, error: GENERIC_ERROR };
  }
}

export async function deleteContactsAction(ids: string[]): Promise<ActionResult> {
  const { user, error: adminError } = await requireAdmin();
  if (!user) return { success: false, error: adminError };
  const parsedIds = bulkContactIdsSchema.safeParse(ids);
  if (!parsedIds.success) {
    return { success: false, error: "No contacts selected." };
  }

  try {
    await contactService.deleteContacts(user.organizationId, parsedIds.data);
    revalidatePath("/contacts");
    return { success: true, data: undefined };
  } catch (error) {
    console.error("Failed to delete contacts:", error);
    return { success: false, error: GENERIC_ERROR };
  }
}

export async function addContactsToListAction(
  contactIds: string[],
  listId: string
): Promise<ActionResult<contactService.AddToListResult>> {
  const user = await requireUser();
  const parsedIds = bulkContactIdsSchema.safeParse(contactIds);
  const parsedListId = listIdSchema.safeParse(listId);
  if (!parsedIds.success || !parsedListId.success) {
    return { success: false, error: "Select contacts and a list." };
  }

  try {
    const result = await contactService.addContactsToList(
      user.organizationId,
      parsedIds.data,
      parsedListId.data
    );
    revalidateListMembershipPaths(parsedListId.data);
    return { success: true, data: result };
  } catch (error) {
    console.error("Failed to add contacts to list:", error);
    return { success: false, error: GENERIC_ERROR };
  }
}

export async function removeContactsFromListAction(
  contactIds: string[],
  listId: string
): Promise<ActionResult> {
  const user = await requireUser();
  const parsedIds = bulkContactIdsSchema.safeParse(contactIds);
  const parsedListId = listIdSchema.safeParse(listId);
  if (!parsedIds.success || !parsedListId.success) {
    return { success: false, error: "Select contacts and a list." };
  }

  try {
    await contactService.removeContactsFromList(user.organizationId, parsedIds.data, parsedListId.data);
    revalidateListMembershipPaths(parsedListId.data);
    return { success: true, data: undefined };
  } catch (error) {
    console.error("Failed to remove contacts from list:", error);
    return { success: false, error: GENERIC_ERROR };
  }
}

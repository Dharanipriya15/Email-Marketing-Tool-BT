"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { contactListFormSchema, type ContactListFormInput } from "@/schemas/contact-list";
import * as contactListService from "@/services/contact-list-service";
import { searchContactsNotInList, type SelectableContact } from "@/services/contact-service";
import type { ActionResult } from "@/types/action";

const GENERIC_ERROR = "Something went wrong. Please try again.";

function isForeignKeyConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003"
  );
}

export async function createContactListAction(
  input: ContactListFormInput
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const parsed = contactListFormSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: GENERIC_ERROR };
  }

  try {
    const list = await contactListService.createContactList(user.organizationId, parsed.data);
    revalidatePath("/lists");
    return { success: true, data: { id: list.id } };
  } catch (error) {
    console.error("Failed to create list:", error);
    return { success: false, error: GENERIC_ERROR };
  }
}

export async function updateContactListAction(
  id: string,
  input: ContactListFormInput
): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = contactListFormSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: GENERIC_ERROR };
  }

  try {
    await contactListService.updateContactList(user.organizationId, id, parsed.data);
    revalidatePath("/lists");
    revalidatePath(`/lists/${id}`);
    return { success: true, data: undefined };
  } catch (error) {
    console.error("Failed to update list:", error);
    return { success: false, error: GENERIC_ERROR };
  }
}

export async function deleteContactListAction(id: string): Promise<ActionResult> {
  const user = await requireUser();

  try {
    await contactListService.deleteContactList(user.organizationId, id);
    revalidatePath("/lists");
    return { success: true, data: undefined };
  } catch (error) {
    if (isForeignKeyConstraintError(error)) {
      return {
        success: false,
        error: "This list is used by a campaign and can't be deleted.",
      };
    }
    console.error("Failed to delete list:", error);
    return { success: false, error: GENERIC_ERROR };
  }
}

export async function searchContactsForListAction(
  listId: string,
  search: string
): Promise<ActionResult<SelectableContact[]>> {
  const user = await requireUser();

  try {
    const contacts = await searchContactsNotInList(user.organizationId, listId, search);
    return { success: true, data: contacts };
  } catch (error) {
    console.error("Failed to search contacts:", error);
    return { success: false, error: GENERIC_ERROR };
  }
}

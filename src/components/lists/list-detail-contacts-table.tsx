"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Users, X } from "lucide-react";
import type { Contact } from "@prisma/client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ContactStatusBadge } from "@/components/shared/status-badge";
import { removeContactsFromListAction } from "@/app/(app)/contacts/actions";
import { LIST_CONTACTS_PAGE_SIZE } from "@/services/contact-list-service";

type ListDetailContactsTableProps = {
  listId: string;
  contacts: Contact[];
  total: number;
  page: number;
};

function contactName(contact: Contact) {
  return [contact.firstName, contact.lastName].filter(Boolean).join(" ") || "—";
}

export function ListDetailContactsTable({
  listId,
  contacts,
  total,
  page,
}: ListDetailContactsTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [removingContact, setRemovingContact] = useState<Contact | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / LIST_CONTACTS_PAGE_SIZE));

  function goToPage(targetPage: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(targetPage));
    router.push(`${pathname}?${params.toString()}`);
  }

  async function handleRemove() {
    if (!removingContact) return;
    const result = await removeContactsFromListAction([removingContact.id], listId);
    if (result.success) {
      toast.success("Removed from list");
    } else {
      toast.error(result.error);
    }
  }

  if (contacts.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No contacts in this list yet"
        description="Add contacts to this list to get started."
        className="border-0 py-10"
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Industry</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-10 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contacts.map((contact) => (
              <TableRow key={contact.id}>
                <TableCell className="font-medium">
                  <Link href={`/contacts/${contact.id}`} className="hover:underline">
                    {contactName(contact)}
                  </Link>
                </TableCell>
                <TableCell>{contact.email}</TableCell>
                <TableCell>{contact.company || "—"}</TableCell>
                <TableCell>{contact.industry || "—"}</TableCell>
                <TableCell>{contact.location || "—"}</TableCell>
                <TableCell>
                  <ContactStatusBadge status={contact.status} />
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Remove from list"
                    onClick={() => setRemovingContact(contact)}
                  >
                    <X className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {(page - 1) * LIST_CONTACTS_PAGE_SIZE + 1}–
          {Math.min(page * LIST_CONTACTS_PAGE_SIZE, total)} of {total.toLocaleString()} contacts
        </p>
        {totalPages > 1 && (
          <Pagination className="mx-0 w-auto">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => page > 1 && goToPage(page - 1)}
                  className={page <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
              <PaginationItem>
                <span className="px-2 text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
              </PaginationItem>
              <PaginationItem>
                <PaginationNext
                  onClick={() => page < totalPages && goToPage(page + 1)}
                  className={page >= totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        )}
      </div>

      {removingContact && (
        <ConfirmDialog
          open={!!removingContact}
          onOpenChange={(open) => !open && setRemovingContact(null)}
          title="Remove from list?"
          description={`${contactName(removingContact)} will be removed from this list. This contact will not be deleted.`}
          confirmLabel="Remove"
          onConfirm={handleRemove}
        />
      )}
    </div>
  );
}

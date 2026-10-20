"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Eye,
  Pencil,
  Trash2,
  MoreHorizontal,
  Users,
} from "lucide-react";
import { format } from "date-fns";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ContactStatusBadge } from "@/components/shared/status-badge";
import { ContactFormDialog } from "@/components/contacts/contact-form-dialog";
import { BulkActionsBar } from "@/components/contacts/bulk-actions-bar";
import { deleteContactsAction } from "@/app/(app)/contacts/actions";
import type { ContactListRow, ContactSortField } from "@/services/contact-service";
import { CONTACTS_PAGE_SIZE } from "@/services/contact-service";

type ContactsTableProps = {
  contacts: ContactListRow[];
  total: number;
  page: number;
  sort: ContactSortField;
  dir: "asc" | "desc";
  lists: { id: string; name: string }[];
  hasFilters: boolean;
};

const SORTABLE_COLUMNS: { field: ContactSortField; label: string }[] = [
  { field: "name", label: "Name" },
  { field: "email", label: "Email" },
  { field: "company", label: "Company" },
  { field: "status", label: "Status" },
  { field: "createdAt", label: "Added" },
];

function contactName(contact: ContactListRow) {
  const name = [contact.firstName, contact.lastName].filter(Boolean).join(" ");
  return name || "—";
}

export function ContactsTable({
  contacts,
  total,
  page,
  sort,
  dir,
  lists,
  hasFilters,
}: ContactsTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editingContact, setEditingContact] = useState<ContactListRow | null>(null);
  const [deletingContact, setDeletingContact] = useState<ContactListRow | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / CONTACTS_PAGE_SIZE));
  const allSelected = contacts.length > 0 && selected.size === contacts.length;
  const someSelected = selected.size > 0 && !allSelected;

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(contacts.map((c) => c.id)));
    }
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set(key, value);
    router.push(`${pathname}?${params.toString()}`);
  }

  function goToPage(targetPage: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(targetPage));
    router.push(`${pathname}?${params.toString()}`);
  }

  function handleSort(field: ContactSortField) {
    if (sort === field) {
      updateParam("dir", dir === "asc" ? "desc" : "asc");
    } else {
      const params = new URLSearchParams(searchParams.toString());
      params.set("sort", field);
      params.set("dir", "asc");
      params.delete("page");
      router.push(`${pathname}?${params.toString()}`);
    }
  }

  async function handleSingleDelete() {
    if (!deletingContact) return;
    const result = await deleteContactsAction([deletingContact.id]);
    if (result.success) {
      toast.success("Contact deleted");
    } else {
      toast.error(result.error);
    }
  }

  const pageNumbers = useMemo(() => {
    return Array.from({ length: totalPages }, (_, i) => i + 1).filter(
      (p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1
    );
  }, [totalPages, page]);

  if (contacts.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title={hasFilters ? "No contacts match your filters" : "No contacts yet"}
        description={
          hasFilters
            ? "Try adjusting your search or filters."
            : "Import your contacts to get started."
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {selected.size > 0 && (
        <BulkActionsBar
          selectedIds={Array.from(selected)}
          lists={lists}
          onDone={() => setSelected(new Set())}
        />
      )}

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={allSelected ? true : someSelected ? "indeterminate" : false}
                  onCheckedChange={toggleAll}
                  aria-label="Select all contacts"
                />
              </TableHead>
              {SORTABLE_COLUMNS.map((col) => (
                <TableHead key={col.field}>
                  <button
                    type="button"
                    onClick={() => handleSort(col.field)}
                    className="flex items-center gap-1 hover:text-foreground"
                  >
                    {col.label}
                    {sort === col.field ? (
                      dir === "asc" ? (
                        <ArrowUp className="size-3.5" />
                      ) : (
                        <ArrowDown className="size-3.5" />
                      )
                    ) : (
                      <ArrowUpDown className="size-3.5 text-muted-foreground/50" />
                    )}
                  </button>
                </TableHead>
              ))}
              <TableHead>Industry</TableHead>
              <TableHead>Location</TableHead>
              <TableHead className="w-10 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contacts.map((contact) => (
              <TableRow key={contact.id} data-state={selected.has(contact.id) ? "selected" : undefined}>
                <TableCell>
                  <Checkbox
                    checked={selected.has(contact.id)}
                    onCheckedChange={() => toggleOne(contact.id)}
                    aria-label={`Select ${contactName(contact)}`}
                  />
                </TableCell>
                <TableCell className="font-medium">
                  <Link href={`/contacts/${contact.id}`} className="hover:underline">
                    {contactName(contact)}
                  </Link>
                </TableCell>
                <TableCell>{contact.email}</TableCell>
                <TableCell>{contact.company || "—"}</TableCell>
                <TableCell>
                  <ContactStatusBadge status={contact.status} />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {format(contact.createdAt, "MMM d, yyyy")}
                </TableCell>
                <TableCell>{contact.industry || "—"}</TableCell>
                <TableCell>{contact.location || "—"}</TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label="Row actions">
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onSelect={() => router.push(`/contacts/${contact.id}`)}
                      >
                        <Eye />
                        View
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setEditingContact(contact)}>
                        <Pencil />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() => setDeletingContact(contact)}
                      >
                        <Trash2 />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {(page - 1) * CONTACTS_PAGE_SIZE + 1}–
          {Math.min(page * CONTACTS_PAGE_SIZE, total)} of {total.toLocaleString()} contacts
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
              {pageNumbers.map((p, idx) => (
                <PaginationItem key={p}>
                  {idx > 0 && pageNumbers[idx - 1] !== p - 1 ? (
                    <span className="px-2 text-muted-foreground">…</span>
                  ) : null}
                  <PaginationLink isActive={p === page} onClick={() => goToPage(p)} className="cursor-pointer">
                    {p}
                  </PaginationLink>
                </PaginationItem>
              ))}
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

      {editingContact && (
        <ContactFormDialog
          mode="edit"
          contactId={editingContact.id}
          defaultValues={{
            firstName: editingContact.firstName ?? "",
            lastName: editingContact.lastName ?? "",
            email: editingContact.email,
            company: editingContact.company ?? "",
            phone: editingContact.phone ?? "",
            industry: editingContact.industry ?? "",
            location: editingContact.location ?? "",
            status: editingContact.status,
          }}
          open={!!editingContact}
          onOpenChange={(open) => !open && setEditingContact(null)}
        />
      )}

      {deletingContact && (
        <ConfirmDialog
          open={!!deletingContact}
          onOpenChange={(open) => !open && setDeletingContact(null)}
          title="Delete this contact?"
          description={`${contactName(deletingContact)} will be permanently removed. This action cannot be undone.`}
          onConfirm={handleSingleDelete}
        />
      )}
    </div>
  );
}

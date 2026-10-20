"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import { Eye, Pencil, Trash2, MoreHorizontal } from "lucide-react";

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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ContactListFormDialog } from "@/components/lists/contact-list-form-dialog";
import { deleteContactListAction } from "@/app/(app)/lists/actions";
import type { ContactListRow } from "@/services/contact-list-service";

export function ListsTable({ lists }: { lists: ContactListRow[] }) {
  const router = useRouter();
  const [editingList, setEditingList] = useState<ContactListRow | null>(null);
  const [deletingList, setDeletingList] = useState<ContactListRow | null>(null);

  async function handleDelete() {
    if (!deletingList) return;
    const result = await deleteContactListAction(deletingList.id);
    if (result.success) {
      toast.success("List deleted");
    } else {
      toast.error(result.error);
    }
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>List Name</TableHead>
            <TableHead>Description</TableHead>
            <TableHead className="text-right">Contacts</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Updated</TableHead>
            <TableHead className="w-10 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lists.map((list) => (
            <TableRow key={list.id}>
              <TableCell className="font-medium">
                <Link href={`/lists/${list.id}`} className="hover:underline">
                  {list.name}
                </Link>
              </TableCell>
              <TableCell className="max-w-xs truncate text-muted-foreground">
                {list.description || "—"}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {list.contactCount.toLocaleString()}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {format(list.createdAt, "MMM d, yyyy")}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {format(list.updatedAt, "MMM d, yyyy")}
              </TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label="Row actions">
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => router.push(`/lists/${list.id}`)}>
                      <Eye />
                      View
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setEditingList(list)}>
                      <Pencil />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={() => setDeletingList(list)}
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

      {editingList && (
        <ContactListFormDialog
          mode="edit"
          listId={editingList.id}
          defaultValues={{
            name: editingList.name,
            description: editingList.description ?? "",
          }}
          open={!!editingList}
          onOpenChange={(open) => !open && setEditingList(null)}
        />
      )}

      {deletingList && (
        <ConfirmDialog
          open={!!deletingList}
          onOpenChange={(open) => !open && setDeletingList(null)}
          title="Delete this list?"
          description={`"${deletingList.name}" will be removed along with its memberships. The contacts themselves will not be deleted.`}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}

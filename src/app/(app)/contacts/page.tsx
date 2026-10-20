import { Upload, UserPlus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { ContactsFilterBar } from "@/components/contacts/contacts-filter-bar";
import { ContactsTable } from "@/components/contacts/contacts-table";
import { ContactFormDialog } from "@/components/contacts/contact-form-dialog";
import {
  listContacts,
  getContactCount,
  getContactFilterOptions,
  type ContactSortField,
} from "@/services/contact-service";
import Link from "next/link";

const SORT_FIELDS: ContactSortField[] = ["name", "email", "company", "status", "createdAt"];

type ContactsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ContactsPage({ searchParams }: ContactsPageProps) {
  const user = await requireUser();
  const params = await searchParams;

  const search = firstParam(params.q);
  const status = firstParam(params.status) as
    | "ACTIVE"
    | "UNSUBSCRIBED"
    | "BOUNCED"
    | "SUPPRESSED"
    | undefined;
  const industry = firstParam(params.industry);
  const location = firstParam(params.location);
  const listId = firstParam(params.list);
  const sortParam = firstParam(params.sort);
  const sort: ContactSortField = SORT_FIELDS.includes(sortParam as ContactSortField)
    ? (sortParam as ContactSortField)
    : "createdAt";
  const dir = firstParam(params.dir) === "asc" ? "asc" : "desc";
  const page = Math.max(1, Number(firstParam(params.page)) || 1);

  const hasFilters = Boolean(search || status || industry || location || listId);

  const [{ contacts, total }, totalOrgContacts, filterOptions] = await Promise.all([
    listContacts({
      organizationId: user.organizationId,
      search,
      status,
      industry,
      location,
      listId,
      sort,
      dir,
      page,
    }),
    getContactCount(user.organizationId),
    getContactFilterOptions(user.organizationId),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Contacts"
        description={`${totalOrgContacts.toLocaleString()} total contacts`}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/contacts/import">
                <Upload />
                Import CSV
              </Link>
            </Button>
            <ContactFormDialog
              mode="create"
              trigger={
                <Button>
                  <UserPlus />
                  Add Contact
                </Button>
              }
            />
          </>
        }
      />

      {totalOrgContacts === 0 ? (
        <EmptyState
          icon={UserPlus}
          title="Import your contacts to get started"
          description="Bring your contact list in via CSV, or add contacts one at a time."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="outline" asChild>
                <Link href="/contacts/import">
                  <Upload />
                  Import CSV
                </Link>
              </Button>
              <ContactFormDialog
                mode="create"
                trigger={
                  <Button>
                    <UserPlus />
                    Add Contact
                  </Button>
                }
              />
            </div>
          }
        />
      ) : (
        <>
          <ContactsFilterBar options={filterOptions} />
          <ContactsTable
            contacts={contacts}
            total={total}
            page={page}
            sort={sort}
            dir={dir}
            lists={filterOptions.lists}
            hasFilters={hasFilters}
          />
        </>
      )}
    </div>
  );
}

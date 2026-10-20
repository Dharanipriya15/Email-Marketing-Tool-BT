import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { ListDetailActions } from "@/components/lists/list-detail-actions";
import { ListDetailContactsTable } from "@/components/lists/list-detail-contacts-table";
import {
  getContactListDetail,
  listContactsInList,
} from "@/services/contact-list-service";

type ListDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ListDetailPage({
  params,
  searchParams,
}: ListDetailPageProps) {
  const user = await requireUser();
  const { id } = await params;
  const search = await searchParams;
  const page = Math.max(1, Number(search.page) || 1);

  const list = await getContactListDetail(user.organizationId, id);
  if (!list) {
    notFound();
  }

  const { contacts, total } = await listContactsInList(user.organizationId, id, page);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={list.name}
        description={
          list.description
            ? `${list.description} · ${list.contactCount.toLocaleString()} contacts`
            : `${list.contactCount.toLocaleString()} contacts`
        }
        actions={
          <ListDetailActions
            listId={list.id}
            listName={list.name}
            defaultValues={{ name: list.name, description: list.description ?? "" }}
          />
        }
      />

      <ListDetailContactsTable
        listId={list.id}
        contacts={contacts}
        total={total}
        page={page}
      />
    </div>
  );
}

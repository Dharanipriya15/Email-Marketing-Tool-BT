import { ListChecks, Plus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { ContactListFormDialog } from "@/components/lists/contact-list-form-dialog";
import { ListsTable } from "@/components/lists/lists-table";
import {
  listContactLists,
  getContactListSummary,
} from "@/services/contact-list-service";

export default async function ListsPage() {
  const user = await requireUser();

  const [lists, summary] = await Promise.all([
    listContactLists(user.organizationId),
    getContactListSummary(user.organizationId),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Contact Lists"
        description={`${summary.totalLists.toLocaleString()} lists · ${summary.totalContactsAcrossLists.toLocaleString()} contacts across lists`}
        actions={
          <ContactListFormDialog
            mode="create"
            trigger={
              <Button>
                <Plus />
                Create List
              </Button>
            }
          />
        }
      />

      {lists.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="No contact lists yet"
          description="Create lists to organize contacts for targeted email campaigns."
          action={
            <ContactListFormDialog
              mode="create"
              trigger={
                <Button>
                  <Plus />
                  Create List
                </Button>
              }
            />
          }
        />
      ) : (
        <ListsTable lists={lists} />
      )}
    </div>
  );
}

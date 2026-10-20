import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { ImportWizard } from "@/components/contacts/import/import-wizard";
import { listContactLists } from "@/services/contact-list-service";

export default async function ContactsImportPage() {
  const user = await requireUser();
  const lists = await listContactLists(user.organizationId);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Import Contacts"
        description="Upload a CSV file to bulk-import contacts"
      />
      <ImportWizard lists={lists} />
    </div>
  );
}

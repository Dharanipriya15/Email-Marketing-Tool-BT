import { format } from "date-fns";
import { Search } from "lucide-react";
import { requireAdminPage } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { SimplePager } from "@/components/shared/simple-pager";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AddSuppressionForm, ImportSuppressionsButton, RemoveSuppressionButton } from "@/components/suppressions/suppression-controls";
import { listSuppressions } from "@/services/suppression-service";

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const REASON_LABELS: Record<string, string> = {
  UNSUBSCRIBED: "Unsubscribed",
  BOUNCED: "Bounced",
  COMPLAINED: "Complained",
  MANUAL: "Manual",
};

export default async function SuppressionsPage({ searchParams }: PageProps) {
  const user = await requireAdminPage();
  const params = await searchParams;
  const q = first(params.q)?.slice(0, 200) ?? "";
  const page = Math.max(1, Number(first(params.page)) || 1);
  const { rows, total, pageSize } = await listSuppressions({ organizationId: user.organizationId, search: q, page });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Suppression list"
        description="These addresses never receive campaign email. Bounces and complaints are added automatically."
        actions={<ImportSuppressionsButton />}
      />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <form method="get" className="flex items-center gap-2">
          <Input name="q" defaultValue={q} placeholder="Search email" className="w-64" aria-label="Search email" />
          <Button type="submit" variant="outline">
            <Search />
            Search
          </Button>
        </form>
        <AddSuppressionForm />
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Added</TableHead>
              <TableHead className="w-10 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  {q ? "No suppressed addresses match your search." : "No suppressed addresses yet."}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.email}</TableCell>
                  <TableCell>{REASON_LABELS[row.reason] ?? row.reason}</TableCell>
                  <TableCell className="text-muted-foreground">{row.source ?? "\u2014"}</TableCell>
                  <TableCell className="text-muted-foreground">{format(row.createdAt, "MMM d, yyyy h:mm a")}</TableCell>
                  <TableCell className="text-right">
                    <RemoveSuppressionButton id={row.id} email={row.email} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <SimplePager basePath="/settings/suppressions" params={{ q }} page={page} pageSize={pageSize} total={total} />
    </div>
  );
}

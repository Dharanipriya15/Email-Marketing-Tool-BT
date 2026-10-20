import { Skeleton } from "@/components/ui/skeleton";

export default function ContactsImportLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-2 h-4 w-64" />
      </div>
      <Skeleton className="h-6 w-full" />
      <Skeleton className="h-64 w-full rounded-lg" />
    </div>
  );
}

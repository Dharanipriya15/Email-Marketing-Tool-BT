import { Skeleton } from "@/components/ui/skeleton";

export function TemplateEditorSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-2 h-4 w-64" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-28" />
        </div>
      </div>
      <Skeleton className="h-52 w-full rounded-xl" />
      <Skeleton className="h-[28rem] w-full rounded-lg" />
    </div>
  );
}

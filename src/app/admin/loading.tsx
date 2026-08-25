import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="container max-w-7xl space-y-6 py-2" aria-busy="true" aria-label="Loading content">
      <Skeleton className="h-9 w-64" />
      <Skeleton className="h-44 w-full rounded-xl" />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Skeleton className="h-40 w-full" />
          <div className="grid gap-4 sm:grid-cols-2"><Skeleton className="h-36" /><Skeleton className="h-36" /></div>
        </div>
        <div className="space-y-4"><Skeleton className="h-32" /><Skeleton className="h-48" /></div>
      </div>
    </div>
  );
}

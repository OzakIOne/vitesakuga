import { Skeleton } from "src/components/ui/feedback";

export function CardGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <output
      aria-label="Loading cards"
      aria-live="polite"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
    >
      {Array.from({ length: count }, (_, index) => (
        <div className="space-y-3" key={index}>
          <Skeleton className="aspect-video w-full" />
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ))}
    </output>
  );
}

export function ListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <output aria-label="Loading list" aria-live="polite">
      <span className="sr-only">Loading list…</span>
      <div className="space-y-2">
        {Array.from({ length: count }, (_, index) => (
          <div className="space-y-2 rounded-md border p-4" key={index}>
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        ))}
      </div>
    </output>
  );
}

export function AdminSkeleton() {
  return <ListSkeleton count={3} />;
}

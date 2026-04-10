interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div className={`animate-pulse bg-gray-800 rounded ${className}`} />
  );
}

export function TicketCardSkeleton() {
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 space-y-2">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <div className="flex gap-2 pt-1">
        <Skeleton className="h-5 w-14 rounded" />
        <Skeleton className="h-5 w-8 rounded" />
      </div>
    </div>
  );
}

export function BoardColumnSkeleton() {
  return (
    <div className="flex-shrink-0 w-72">
      <div className="flex items-center gap-2 mb-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-5 w-6 rounded-full" />
      </div>
      <div className="space-y-3">
        <TicketCardSkeleton />
        <TicketCardSkeleton />
        <TicketCardSkeleton />
      </div>
    </div>
  );
}

export function BoardSkeleton() {
  return (
    <div className="flex gap-4 p-6 h-full overflow-hidden">
      <BoardColumnSkeleton />
      <BoardColumnSkeleton />
      <BoardColumnSkeleton />
      <BoardColumnSkeleton />
      <BoardColumnSkeleton />
      <BoardColumnSkeleton />
    </div>
  );
}

export function ProjectCardSkeleton() {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-2">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-4 w-56" />
      <Skeleton className="h-3 w-24 mt-1" />
    </div>
  );
}

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div className={`animate-shimmer rounded ${className}`} />
  );
}

export function TicketCardSkeleton() {
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 space-y-2 animate-in fade-in duration-300">
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
    <div className="flex-shrink-0 w-72 animate-in fade-in duration-300">
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
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-2 animate-in fade-in duration-300 hover:shadow-md hover:shadow-gray-900/10 transition-shadow">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-4 w-56" />
      <Skeleton className="h-3 w-24 mt-1" />
    </div>
  );
}

export function LoadingSpinner({ size = 'md', className = '' }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  return (
    <svg
      className={`animate-spin ${sizeClasses[size]} ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

export function ButtonLoader() {
  return <LoadingSpinner size="sm" className="text-white" />;
}

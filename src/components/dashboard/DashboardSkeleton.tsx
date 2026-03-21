import { cn } from '@/lib/utils';

/**
 * Base shimmer skeleton block. DD-9/RC-9: amber at very low opacity for ambient warmth.
 */
function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-amber-500/5 relative overflow-hidden',
        className,
      )}
    >
      <div className="absolute inset-0 -translate-x-full animate-[skeleton-shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-amber-400/5 to-transparent" />
    </div>
  );
}

export function AgentCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SkeletonBlock className="h-2 w-2 rounded-full" />
          <SkeletonBlock className="h-4 w-32" />
        </div>
        <SkeletonBlock className="h-3 w-12" />
      </div>
      <SkeletonBlock className="h-3 w-3/4" />
      <div className="space-y-1.5">
        <SkeletonBlock className="h-3 w-full" />
        <SkeletonBlock className="h-3 w-5/6" />
        <SkeletonBlock className="h-3 w-4/6" />
      </div>
      <SkeletonBlock className="h-2 w-full rounded-full" />
    </div>
  );
}

export function ApprovalCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <SkeletonBlock className="h-5 w-20 rounded-full" />
        <SkeletonBlock className="h-3 w-12" />
      </div>
      <div className="space-y-2">
        <SkeletonBlock className="h-4 w-full" />
        <SkeletonBlock className="h-4 w-5/6" />
        <SkeletonBlock className="h-4 w-4/6" />
      </div>
      <SkeletonBlock className="h-24 w-full rounded-lg" />
      <SkeletonBlock className="h-3 w-1/2" />
      <div className="flex gap-2">
        <SkeletonBlock className="h-9 w-24 rounded-lg" />
        <SkeletonBlock className="h-9 w-16 rounded-lg" />
        <SkeletonBlock className="h-9 w-18 rounded-lg" />
      </div>
    </div>
  );
}

export function TaskCardSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2">
      <SkeletonBlock className="h-4 w-full" />
      <SkeletonBlock className="h-3 w-3/4" />
    </div>
  );
}

export function KanbanSkeleton() {
  return (
    <div className="grid grid-cols-4 gap-4 min-h-[400px]">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border bg-card/50 p-4 space-y-3">
          <SkeletonBlock className="h-4 w-24" />
          {Array.from({ length: 2 + (i % 2) }).map((_, j) => (
            <TaskCardSkeleton key={j} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function RunRowSkeleton() {
  return (
    <div className="flex items-center gap-4 px-4 py-3 border-b border-border last:border-0">
      <SkeletonBlock className="h-4 w-4 rounded-full" />
      <SkeletonBlock className="h-4 w-40 flex-1" />
      <SkeletonBlock className="h-3 w-12" />
      <SkeletonBlock className="h-3 w-12" />
      <SkeletonBlock className="h-3 w-16" />
    </div>
  );
}

export function RunHistorySkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {Array.from({ length: 5 }).map((_, i) => (
        <RunRowSkeleton key={i} />
      ))}
    </div>
  );
}

export function HomeSkeleton() {
  return (
    <div className="space-y-6">
      <SkeletonBlock className="h-24 w-full rounded-xl" />
      <div className="grid grid-cols-2 gap-4">
        <AgentCardSkeleton />
        <AgentCardSkeleton />
      </div>
      <SkeletonBlock className="h-32 w-full rounded-xl" />
    </div>
  );
}

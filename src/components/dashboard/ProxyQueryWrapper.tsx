import type { UseQueryResult } from '@tanstack/react-query';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props<T> {
  query: UseQueryResult<T, Error>;
  skeleton: React.ReactNode;
  children: (data: T) => React.ReactNode;
  /** Optional label shown in the error card */
  errorLabel?: string;
}

/**
 * Wraps a TanStack Query result with consistent loading + error states.
 * - Loading → renders skeleton
 * - Error → renders error card with retry button
 * - Success → renders children(data)
 */
export function ProxyQueryWrapper<T>({
  query,
  skeleton,
  children,
  errorLabel = 'data',
}: Props<T>) {
  if (query.isLoading) return <>{skeleton}</>;

  if (query.isError) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">Failed to load {errorLabel}</p>
          <p className="text-xs text-muted-foreground mt-1 break-words">
            {query.error?.message ?? 'Unknown error'}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => query.refetch()}
          className="shrink-0 text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  if (!query.data) return <>{skeleton}</>;

  return <>{children(query.data)}</>;
}

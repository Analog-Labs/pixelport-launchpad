import React from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

interface State {
  hasError: boolean;
  message?: string;
}

/**
 * One error boundary wrapping <Outlet /> in Dashboard.tsx.
 * Per spec: does not wrap individual views — views handle their own
 * loading/error states via TanStack Query.
 */
export class DashboardErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: unknown): State {
    const message =
      error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { hasError: true, message };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.error('[DashboardErrorBoundary]', error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, message: undefined });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 text-center px-4">
          <div className="rounded-xl border border-border bg-card p-8 max-w-md w-full">
            <AlertTriangle className="h-10 w-10 text-amber-400 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-foreground mb-2">Something went wrong</h2>
            {this.state.message && (
              <p className="text-sm text-muted-foreground mb-4">{this.state.message}</p>
            )}
            <Button onClick={this.handleRetry} variant="outline" size="sm">
              Try again
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

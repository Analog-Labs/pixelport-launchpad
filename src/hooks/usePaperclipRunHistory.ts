import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { paperclipFetch } from '@/lib/paperclipFetch';
import type { HeartbeatRun, HeartbeatRunEvent, HeartbeatRunsResponse } from '@/lib/paperclip-types';

export function usePaperclipRunHistory() {
  const { session } = useAuth();
  const token = session?.access_token ?? '';

  return useQuery<HeartbeatRunsResponse>({
    queryKey: ['paperclip', 'heartbeat-runs'],
    queryFn: () => paperclipFetch<HeartbeatRunsResponse>('companies/heartbeat-runs', {}, token),
    enabled: !!token,
    refetchOnWindowFocus: false,
  });
}

export function usePaperclipRunDetail(runId: string) {
  const { session } = useAuth();
  const token = session?.access_token ?? '';

  return useQuery<HeartbeatRun>({
    queryKey: ['paperclip', 'heartbeat-run', runId],
    queryFn: () => paperclipFetch<HeartbeatRun>(`heartbeat-runs/${runId}`, {}, token),
    enabled: !!token && !!runId,
    refetchOnWindowFocus: false,
  });
}

/** 5s polling when viewing run detail — per spec. */
export function usePaperclipRunEvents(runId: string) {
  const { session } = useAuth();
  const token = session?.access_token ?? '';

  return useQuery<{ events: HeartbeatRunEvent[] }>({
    queryKey: ['paperclip', 'heartbeat-run-events', runId],
    queryFn: () =>
      paperclipFetch<{ events: HeartbeatRunEvent[] }>(`heartbeat-runs/${runId}/events`, {}, token),
    enabled: !!token && !!runId,
    refetchInterval: 5_000,
    refetchOnWindowFocus: false,
  });
}

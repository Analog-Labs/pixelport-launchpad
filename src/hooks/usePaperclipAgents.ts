import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { paperclipFetch } from '@/lib/paperclipFetch';
import {
  normalizeAgentListResponse,
  normalizeHeartbeatRunsResponse,
  normalizeLiveRunsResponse,
} from '@/lib/paperclip-normalize';
import type { AgentListResponse, HeartbeatRunsResponse, LiveRunsResponse } from '@/lib/paperclip-types';

/** 15s polling — agent status + live run info. ED-8: console.error on failure. */
export function usePaperclipAgents() {
  const { session } = useAuth();
  const token = session?.access_token ?? '';

  return useQuery<AgentListResponse>({
    queryKey: ['paperclip', 'agents'],
    queryFn: async () =>
      normalizeAgentListResponse(await paperclipFetch<unknown>('companies/agents', {}, token)),
    enabled: !!token,
    refetchInterval: 15_000,
    refetchOnWindowFocus: false,
  });
}

/** 15s polling — live (in-flight) runs for current task descriptions on agent cards. */
export function usePaperclipLiveRuns() {
  const { session } = useAuth();
  const token = session?.access_token ?? '';

  return useQuery<LiveRunsResponse>({
    queryKey: ['paperclip', 'live-runs'],
    queryFn: async () =>
      normalizeLiveRunsResponse(await paperclipFetch<unknown>('companies/live-runs', {}, token)),
    enabled: !!token,
    refetchInterval: 15_000,
    refetchOnWindowFocus: false,
  });
}

/** Fetch last N heartbeat runs for a specific agent (mini activity timeline). */
export function usePaperclipAgentRuns(agentId: string, limit = 3) {
  const { session } = useAuth();
  const token = session?.access_token ?? '';

  return useQuery<HeartbeatRunsResponse>({
    queryKey: ['paperclip', 'agent-runs', agentId],
    queryFn: async () =>
      normalizeHeartbeatRunsResponse(
        await paperclipFetch<unknown>(
          `companies/heartbeat-runs?agentId=${agentId}&limit=${limit}`,
          {},
          token,
        ),
      ),
    enabled: !!token && !!agentId,
    refetchOnWindowFocus: false,
  });
}

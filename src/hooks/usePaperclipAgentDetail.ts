import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { PaperclipFetchError, paperclipFetch } from '@/lib/paperclipFetch';
import { normalizeAgentDetail, normalizeIssuesResponse } from '@/lib/paperclip-normalize';
import type { IssuesResponse, PaperclipAgentDetail } from '@/lib/paperclip-types';

export function usePaperclipAgentDetail(agentId: string) {
  const { session } = useAuth();
  const token = session?.access_token ?? '';

  return useQuery<PaperclipAgentDetail>({
    queryKey: ['paperclip', 'agent-detail', agentId],
    queryFn: async () => {
      try {
        return normalizeAgentDetail(await paperclipFetch<unknown>(`agents/${agentId}`, {}, token))
        ?? {
          id: agentId,
          name: 'Agent',
          status: 'offline',
        };
      } catch (error) {
        if (error instanceof PaperclipFetchError && (error.status === 403 || error.status === 404)) {
          return {
            id: agentId,
            name: 'Agent',
            status: 'offline',
          };
        }
        throw error;
      }
    },
    enabled: !!token && !!agentId,
    refetchOnWindowFocus: false,
  });
}

export function usePaperclipAgentIssues(agentId: string) {
  const { session } = useAuth();
  const token = session?.access_token ?? '';

  return useQuery<IssuesResponse>({
    queryKey: ['paperclip', 'agent-issues', agentId],
    queryFn: async () =>
      normalizeIssuesResponse(
        await paperclipFetch<unknown>(`companies/issues?assigneeAgentId=${agentId}`, {}, token),
      ),
    enabled: !!token && !!agentId,
    refetchOnWindowFocus: false,
  });
}

export function useWakeAgent() {
  const { session } = useAuth();
  const token = session?.access_token ?? '';
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ agentId }: { agentId: string }) =>
      paperclipFetch<unknown>(
        `agents/${agentId}/wakeup`,
        { method: 'POST', body: JSON.stringify({}) },
        token,
      ),
    onSettled: (_data, _error, { agentId }) => {
      queryClient.invalidateQueries({ queryKey: ['paperclip', 'agents'] });
      queryClient.invalidateQueries({ queryKey: ['paperclip', 'agent-runs', agentId] });
      queryClient.invalidateQueries({ queryKey: ['paperclip', 'heartbeat-runs'] });
    },
  });
}

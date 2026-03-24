import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { paperclipFetch } from '@/lib/paperclipFetch';
import { normalizeAgentCostsResponse } from '@/lib/paperclip-normalize';
import type { AgentCostsResponse } from '@/lib/paperclip-types';

export function usePaperclipCostsByAgent() {
  const { session } = useAuth();
  const token = session?.access_token ?? '';

  return useQuery<AgentCostsResponse>({
    queryKey: ['paperclip', 'costs', 'by-agent'],
    queryFn: async () =>
      normalizeAgentCostsResponse(
        await paperclipFetch<unknown>('companies/costs/by-agent', {}, token),
      ),
    enabled: !!token,
    refetchOnWindowFocus: false,
  });
}

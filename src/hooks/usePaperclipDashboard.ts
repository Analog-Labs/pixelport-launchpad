import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { paperclipFetch } from '@/lib/paperclipFetch';
import { normalizeDashboardSummary } from '@/lib/paperclip-normalize';
import type { DashboardSummary } from '@/lib/paperclip-types';

export function usePaperclipDashboard() {
  const { session } = useAuth();
  const token = session?.access_token ?? '';

  return useQuery<DashboardSummary>({
    queryKey: ['paperclip', 'dashboard'],
    queryFn: async () =>
      normalizeDashboardSummary(await paperclipFetch<unknown>('companies/dashboard', {}, token)),
    enabled: !!token,
    refetchOnWindowFocus: false,
  });
}

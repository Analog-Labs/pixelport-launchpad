import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { paperclipFetch } from '@/lib/paperclipFetch';
import type { DashboardSummary } from '@/lib/paperclip-types';

export function usePaperclipDashboard() {
  const { session } = useAuth();
  const token = session?.access_token ?? '';

  return useQuery<DashboardSummary>({
    queryKey: ['paperclip', 'dashboard'],
    queryFn: () => paperclipFetch<DashboardSummary>('companies/dashboard', {}, token),
    enabled: !!token,
    refetchOnWindowFocus: false,
  });
}

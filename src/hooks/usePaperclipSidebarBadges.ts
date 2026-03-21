import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { paperclipFetch } from '@/lib/paperclipFetch';
import type { SidebarBadges } from '@/lib/paperclip-types';

/** 30s polling — keeps sidebar badge counts fresh. RC-5: single cache entry for badge counts. */
export function usePaperclipSidebarBadges() {
  const { session } = useAuth();
  const token = session?.access_token ?? '';

  return useQuery<SidebarBadges>({
    queryKey: ['paperclip', 'sidebar-badges'],
    queryFn: () => paperclipFetch<SidebarBadges>('companies/sidebar-badges', {}, token),
    enabled: !!token,
    refetchInterval: 30_000,
  });
}

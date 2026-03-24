import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { paperclipFetch } from '@/lib/paperclipFetch';
import { normalizeActivityResponse } from '@/lib/paperclip-normalize';
import type { ActivityResponse } from '@/lib/paperclip-types';

export function usePaperclipActivity(limit = 8) {
  const { session } = useAuth();
  const token = session?.access_token ?? '';

  return useQuery<ActivityResponse>({
    queryKey: ['paperclip', 'activity', limit],
    queryFn: async () =>
      normalizeActivityResponse(
        await paperclipFetch<unknown>(`companies/activity?limit=${limit}`, {}, token),
      ),
    enabled: !!token,
    refetchOnWindowFocus: false,
  });
}

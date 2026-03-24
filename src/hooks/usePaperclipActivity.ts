import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { PaperclipFetchError, paperclipFetch } from '@/lib/paperclipFetch';
import { normalizeActivityResponse } from '@/lib/paperclip-normalize';
import type { ActivityResponse } from '@/lib/paperclip-types';

export function usePaperclipActivity(limit = 8) {
  const { session } = useAuth();
  const token = session?.access_token ?? '';

  return useQuery<ActivityResponse>({
    queryKey: ['paperclip', 'activity', limit],
    queryFn: async () => {
      try {
        return normalizeActivityResponse(
          await paperclipFetch<unknown>(`companies/activity?limit=${limit}`, {}, token),
        );
      } catch (error) {
        if (error instanceof PaperclipFetchError && (error.status === 403 || error.status === 404)) {
          return normalizeActivityResponse([]);
        }
        throw error;
      }
    },
    enabled: !!token,
    refetchOnWindowFocus: false,
  });
}

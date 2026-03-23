import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { paperclipFetch } from '@/lib/paperclipFetch';
import {
  normalizeCommentsResponse,
  normalizeIssuesResponse,
  normalizeTaskDetail,
} from '@/lib/paperclip-normalize';
import type { IssueComment, IssueStatus, IssuesResponse, PaperclipIssue } from '@/lib/paperclip-types';

const QUERY_KEY = ['paperclip', 'issues'] as const;

export function usePaperclipTasks() {
  const { session } = useAuth();
  const token = session?.access_token ?? '';

  return useQuery<IssuesResponse>({
    queryKey: QUERY_KEY,
    queryFn: async () =>
      normalizeIssuesResponse(await paperclipFetch<unknown>('companies/issues', {}, token)),
    enabled: !!token,
    refetchOnWindowFocus: false,
  });
}

export function usePaperclipTaskDetail(issueId: string) {
  const { session } = useAuth();
  const token = session?.access_token ?? '';

  return useQuery<PaperclipIssue>({
    queryKey: ['paperclip', 'issue', issueId],
    queryFn: async () =>
      normalizeTaskDetail(await paperclipFetch<unknown>(`issues/${issueId}`, {}, token))
      ?? {
        id: issueId,
        title: 'Task',
        status: 'todo',
      },
    enabled: !!token && !!issueId,
    refetchOnWindowFocus: false,
  });
}

export function usePaperclipTaskComments(issueId: string) {
  const { session } = useAuth();
  const token = session?.access_token ?? '';

  return useQuery<{ comments: IssueComment[] }>({
    queryKey: ['paperclip', 'issue-comments', issueId],
    queryFn: async () =>
      normalizeCommentsResponse(
        await paperclipFetch<unknown>(`issues/${issueId}/comments`, {}, token),
      ),
    enabled: !!token && !!issueId,
    refetchOnWindowFocus: false,
  });
}

/** ED-5: Drag-and-drop triggers PATCH /issues/:id with new status. Revert on error. */
export function useUpdateTaskStatus() {
  const { session } = useAuth();
  const token = session?.access_token ?? '';
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ issueId, status }: { issueId: string; status: IssueStatus }) =>
      paperclipFetch<PaperclipIssue>(
        `issues/${issueId}`,
        { method: 'PATCH', body: JSON.stringify({ status }) },
        token,
      ),
    onMutate: async ({ issueId, status }) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });
      const previous = queryClient.getQueryData<IssuesResponse>(QUERY_KEY);
      queryClient.setQueryData<IssuesResponse>(QUERY_KEY, (old) => ({
        issues: old?.issues.map((i) => (i.id === issueId ? { ...i, status } : i)) ?? [],
      }));
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(QUERY_KEY, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

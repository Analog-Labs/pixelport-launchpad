import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { paperclipFetch } from '@/lib/paperclipFetch';
import type { IssueComment, IssueStatus, IssuesResponse, PaperclipIssue } from '@/lib/paperclip-types';

const QUERY_KEY = ['paperclip', 'issues'] as const;

export function usePaperclipTasks() {
  const { session } = useAuth();
  const token = session?.access_token ?? '';

  return useQuery<IssuesResponse>({
    queryKey: QUERY_KEY,
    queryFn: () => paperclipFetch<IssuesResponse>('companies/issues', {}, token),
    enabled: !!token,
  });
}

export function usePaperclipTaskDetail(issueId: string) {
  const { session } = useAuth();
  const token = session?.access_token ?? '';

  return useQuery<PaperclipIssue>({
    queryKey: ['paperclip', 'issue', issueId],
    queryFn: () => paperclipFetch<PaperclipIssue>(`issues/${issueId}`, {}, token),
    enabled: !!token && !!issueId,
  });
}

export function usePaperclipTaskComments(issueId: string) {
  const { session } = useAuth();
  const token = session?.access_token ?? '';

  return useQuery<{ comments: IssueComment[] }>({
    queryKey: ['paperclip', 'issue-comments', issueId],
    queryFn: () =>
      paperclipFetch<{ comments: IssueComment[] }>(`issues/${issueId}/comments`, {}, token),
    enabled: !!token && !!issueId,
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

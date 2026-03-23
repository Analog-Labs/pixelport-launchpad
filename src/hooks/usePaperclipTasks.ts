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
const issueCommentsQueryKey = (issueId: string) => ['paperclip', 'issue-comments', issueId] as const;

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
    queryKey: issueCommentsQueryKey(issueId),
    queryFn: async () =>
      normalizeCommentsResponse(
        await paperclipFetch<unknown>(`issues/${issueId}/comments`, {}, token),
      ),
    enabled: !!token && !!issueId,
    refetchOnWindowFocus: false,
  });
}

export function useCreateTaskComment(issueId: string) {
  const { session } = useAuth();
  const token = session?.access_token ?? '';
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ body }: { body: string }) => {
      const response = await paperclipFetch<unknown>(
        `issues/${issueId}/comments`,
        { method: 'POST', body: JSON.stringify({ body }) },
        token,
      );
      return normalizeCommentsResponse([response]).comments[0]
        ?? {
          id: `comment-${Date.now()}`,
          body,
          author: 'You',
          createdAt: new Date().toISOString(),
        };
    },
    onMutate: async ({ body }) => {
      const queryKey = issueCommentsQueryKey(issueId);
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<{ comments: IssueComment[] }>(queryKey);
      const optimisticComment: IssueComment = {
        id: `optimistic-${Date.now()}`,
        body,
        author: 'You',
        createdAt: new Date().toISOString(),
      };
      queryClient.setQueryData<{ comments: IssueComment[] }>(queryKey, (old) => ({
        comments: [...(old?.comments ?? []), optimisticComment],
      }));
      return { previous };
    },
    onError: (_err, _vars, context) => {
      const rollback = context?.previous ?? { comments: [] };
      queryClient.setQueryData(issueCommentsQueryKey(issueId), rollback);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: issueCommentsQueryKey(issueId) });
      queryClient.invalidateQueries({ queryKey: ['paperclip', 'issue', issueId] });
    },
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

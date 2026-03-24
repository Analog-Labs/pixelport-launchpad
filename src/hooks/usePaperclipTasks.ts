import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { paperclipFetch } from '@/lib/paperclipFetch';
import {
  normalizeCommentsResponse,
  normalizeIssue,
  normalizeIssuesResponse,
  normalizeTaskDetail,
} from '@/lib/paperclip-normalize';
import type {
  CreateTaskRequest,
  IssueComment,
  IssuePriority,
  IssueStatus,
  IssuesResponse,
  PaperclipIssue,
} from '@/lib/paperclip-types';

const ISSUE_QUERY_PREFIX = ['paperclip', 'issues'] as const;
const issueCommentsQueryKey = (issueId: string) => ['paperclip', 'issue-comments', issueId] as const;
const issueDetailQueryKey = (issueId: string) => ['paperclip', 'issue', issueId] as const;

export interface UsePaperclipTasksOptions {
  assigneeAgentId?: string;
  unreadForUserId?: string;
}

function buildIssuesPath(options: UsePaperclipTasksOptions = {}): string {
  const params = new URLSearchParams();
  if (options.assigneeAgentId) {
    params.set('assigneeAgentId', options.assigneeAgentId);
  }
  if (options.unreadForUserId) {
    params.set('unreadForUserId', options.unreadForUserId);
  }

  const query = params.toString();
  return query ? `companies/issues?${query}` : 'companies/issues';
}

export function usePaperclipTasks(options: UsePaperclipTasksOptions = {}) {
  const { session } = useAuth();
  const token = session?.access_token ?? '';
  const path = buildIssuesPath(options);

  return useQuery<IssuesResponse>({
    queryKey: [...ISSUE_QUERY_PREFIX, options],
    queryFn: async () =>
      normalizeIssuesResponse(await paperclipFetch<unknown>(path, {}, token)),
    enabled: !!token,
    refetchOnWindowFocus: false,
  });
}

export function usePaperclipTaskDetail(issueId: string) {
  const { session } = useAuth();
  const token = session?.access_token ?? '';

  return useQuery<PaperclipIssue>({
    queryKey: issueDetailQueryKey(issueId),
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

function patchIssueInCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  issueId: string,
  patch: Partial<PaperclipIssue>,
) {
  queryClient.setQueriesData<IssuesResponse>({ queryKey: ISSUE_QUERY_PREFIX }, (old) => {
    if (!old) return old;
    return {
      issues: old.issues.map((issue) => (issue.id === issueId ? { ...issue, ...patch } : issue)),
    };
  });
  queryClient.setQueryData<PaperclipIssue>(issueDetailQueryKey(issueId), (old) => {
    if (!old) return old;
    return { ...old, ...patch };
  });
}

export function useCreateTask() {
  const { session } = useAuth();
  const token = session?.access_token ?? '';
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateTaskRequest) =>
      normalizeIssue(
        await paperclipFetch<unknown>(
          'companies/issues',
          { method: 'POST', body: JSON.stringify(payload) },
          token,
        ),
      )
      ?? {
        id: `issue-${Date.now()}`,
        title: payload.title,
        description: payload.description,
        status: 'todo',
        priority: payload.priority,
      },
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: ISSUE_QUERY_PREFIX });
      const previous = queryClient.getQueriesData<IssuesResponse>({ queryKey: ISSUE_QUERY_PREFIX });

      const optimisticIssue: PaperclipIssue = {
        id: `optimistic-${Date.now()}`,
        title: payload.title,
        description: payload.description,
        status: 'todo',
        priority: payload.priority,
        assigneeAgentId: payload.assigneeAgentId,
        updatedAt: new Date().toISOString(),
      };

      queryClient.setQueriesData<IssuesResponse>({ queryKey: ISSUE_QUERY_PREFIX }, (old) => {
        if (!old) {
          return { issues: [optimisticIssue] };
        }
        return { issues: [optimisticIssue, ...old.issues] };
      });

      return { previous };
    },
    onError: (_error, _payload, context) => {
      for (const [key, value] of context?.previous ?? []) {
        queryClient.setQueryData(key, value);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ISSUE_QUERY_PREFIX });
      queryClient.invalidateQueries({ queryKey: ['paperclip', 'sidebar-badges'] });
    },
  });
}

export function useAssignTask() {
  const { session } = useAuth();
  const token = session?.access_token ?? '';
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      issueId,
      assigneeAgentId,
    }: {
      issueId: string;
      assigneeAgentId?: string;
    }) =>
      normalizeIssue(
        await paperclipFetch<unknown>(
          `issues/${issueId}`,
          { method: 'PATCH', body: JSON.stringify({ assigneeAgentId }) },
          token,
        ),
      )
      ?? { id: issueId, title: 'Task', status: 'todo', assigneeAgentId },
    onMutate: async ({ issueId, assigneeAgentId }) => {
      await queryClient.cancelQueries({ queryKey: ISSUE_QUERY_PREFIX });
      await queryClient.cancelQueries({ queryKey: issueDetailQueryKey(issueId) });

      const previousIssues = queryClient.getQueriesData<IssuesResponse>({ queryKey: ISSUE_QUERY_PREFIX });
      const previousDetail = queryClient.getQueryData<PaperclipIssue>(issueDetailQueryKey(issueId));

      patchIssueInCaches(queryClient, issueId, { assigneeAgentId });

      return { previousIssues, previousDetail, issueId };
    },
    onError: (_error, _payload, context) => {
      for (const [key, value] of context?.previousIssues ?? []) {
        queryClient.setQueryData(key, value);
      }
      if (context?.previousDetail) {
        queryClient.setQueryData(issueDetailQueryKey(context.issueId), context.previousDetail);
      }
    },
    onSettled: (_data, _error, { issueId }) => {
      queryClient.invalidateQueries({ queryKey: ISSUE_QUERY_PREFIX });
      queryClient.invalidateQueries({ queryKey: issueDetailQueryKey(issueId) });
      queryClient.invalidateQueries({ queryKey: ['paperclip', 'sidebar-badges'] });
    },
  });
}

export function useUpdateTaskPriority() {
  const { session } = useAuth();
  const token = session?.access_token ?? '';
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      issueId,
      priority,
    }: {
      issueId: string;
      priority: IssuePriority;
    }) =>
      normalizeIssue(
        await paperclipFetch<unknown>(
          `issues/${issueId}`,
          { method: 'PATCH', body: JSON.stringify({ priority }) },
          token,
        ),
      )
      ?? { id: issueId, title: 'Task', status: 'todo', priority },
    onMutate: async ({ issueId, priority }) => {
      await queryClient.cancelQueries({ queryKey: ISSUE_QUERY_PREFIX });
      await queryClient.cancelQueries({ queryKey: issueDetailQueryKey(issueId) });

      const previousIssues = queryClient.getQueriesData<IssuesResponse>({ queryKey: ISSUE_QUERY_PREFIX });
      const previousDetail = queryClient.getQueryData<PaperclipIssue>(issueDetailQueryKey(issueId));

      patchIssueInCaches(queryClient, issueId, { priority });

      return { previousIssues, previousDetail, issueId };
    },
    onError: (_error, _payload, context) => {
      for (const [key, value] of context?.previousIssues ?? []) {
        queryClient.setQueryData(key, value);
      }
      if (context?.previousDetail) {
        queryClient.setQueryData(issueDetailQueryKey(context.issueId), context.previousDetail);
      }
    },
    onSettled: (_data, _error, { issueId }) => {
      queryClient.invalidateQueries({ queryKey: ISSUE_QUERY_PREFIX });
      queryClient.invalidateQueries({ queryKey: issueDetailQueryKey(issueId) });
      queryClient.invalidateQueries({ queryKey: ['paperclip', 'sidebar-badges'] });
    },
  });
}

export function useCreateTaskComment(issueId: string) {
  const { session } = useAuth();
  const token = session?.access_token ?? '';
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      body,
      interrupt,
    }: {
      body: string;
      interrupt?: boolean;
    }) => {
      const response = await paperclipFetch<unknown>(
        `issues/${issueId}/comments`,
        { method: 'POST', body: JSON.stringify({ body, interrupt }) },
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
      queryClient.invalidateQueries({ queryKey: issueDetailQueryKey(issueId) });
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
      await queryClient.cancelQueries({ queryKey: ISSUE_QUERY_PREFIX });
      const previous = queryClient.getQueriesData<IssuesResponse>({ queryKey: ISSUE_QUERY_PREFIX });
      queryClient.setQueriesData<IssuesResponse>({ queryKey: ISSUE_QUERY_PREFIX }, (old) => {
        if (!old) return old;
        return {
          issues: old.issues.map((issue) => (issue.id === issueId ? { ...issue, status } : issue)),
        };
      });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      for (const [key, value] of context?.previous ?? []) {
        queryClient.setQueryData(key, value);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ISSUE_QUERY_PREFIX });
    },
  });
}

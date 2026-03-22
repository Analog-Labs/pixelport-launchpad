import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { paperclipFetch } from '@/lib/paperclipFetch';
import type { ApprovalsResponse, PaperclipApproval } from '@/lib/paperclip-types';

const QUERY_KEY = ['paperclip', 'approvals'] as const;

export function usePaperclipApprovals() {
  const { session } = useAuth();
  const token = session?.access_token ?? '';

  return useQuery<ApprovalsResponse>({
    queryKey: QUERY_KEY,
    queryFn: () =>
      paperclipFetch<ApprovalsResponse>('companies/approvals?status=pending&limit=20&offset=0', {}, token),
    enabled: !!token,
    refetchOnWindowFocus: false,
  });
}

/** Approve an approval item. RC-6: optimistic removal from list on success. */
export function useApproveApproval() {
  const { session } = useAuth();
  const token = session?.access_token ?? '';
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (approvalId: string) =>
      paperclipFetch<void>(`approvals/${approvalId}/approve`, { method: 'POST' }, token),
    onMutate: async (approvalId) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });
      const previous = queryClient.getQueryData<ApprovalsResponse>(QUERY_KEY);
      queryClient.setQueryData<ApprovalsResponse>(QUERY_KEY, (old) => ({
        approvals: old?.approvals.filter((a) => a.id !== approvalId) ?? [],
      }));
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) queryClient.setQueryData(QUERY_KEY, context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['paperclip', 'sidebar-badges'] });
    },
  });
}

/** Reject an approval item. RC-6: same optimistic removal pattern. */
export function useRejectApproval() {
  const { session } = useAuth();
  const token = session?.access_token ?? '';
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ approvalId, note }: { approvalId: string; note?: string }) =>
      paperclipFetch<void>(
        `approvals/${approvalId}/reject`,
        { method: 'POST', body: JSON.stringify({ decisionNote: note ?? 'Rejected' }) },
        token,
      ),
    onMutate: async ({ approvalId }) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });
      const previous = queryClient.getQueryData<ApprovalsResponse>(QUERY_KEY);
      queryClient.setQueryData<ApprovalsResponse>(QUERY_KEY, (old) => ({
        approvals: old?.approvals.filter((a) => a.id !== approvalId) ?? [],
      }));
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(QUERY_KEY, context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['paperclip', 'sidebar-badges'] });
    },
  });
}

/**
 * ED-1: 3-call inline edit flow:
 * 1. POST /approvals/:id/request-revision  { decisionNote }
 * 2. POST /approvals/:id/resubmit          { payload: { ...original, content: editedText } }
 * 3. (only if approving) POST /approvals/:id/approve
 */
export function useEditApproval() {
  const { session } = useAuth();
  const token = session?.access_token ?? '';
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      approval,
      editedContent,
      approve,
    }: {
      approval: PaperclipApproval;
      editedContent: string;
      approve: boolean;
    }) => {
      // Call 1: request-revision
      await paperclipFetch<void>(
        `approvals/${approval.id}/request-revision`,
        { method: 'POST', body: JSON.stringify({ decisionNote: 'User edited content' }) },
        token,
      );

      // Call 2: resubmit with edited content
      const revisedPayload = {
        ...(approval.payload ?? {}),
        content: editedContent,
      };
      await paperclipFetch<void>(
        `approvals/${approval.id}/resubmit`,
        { method: 'POST', body: JSON.stringify({ payload: revisedPayload }) },
        token,
      );

      // Call 3: approve (only if the user clicked "Approve" not "Save Draft")
      if (approve) {
        await paperclipFetch<void>(`approvals/${approval.id}/approve`, { method: 'POST' }, token);
      }
    },
    onMutate: async ({ approval, approve }) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });
      const previous = queryClient.getQueryData<ApprovalsResponse>(QUERY_KEY);
      if (approve) {
        queryClient.setQueryData<ApprovalsResponse>(QUERY_KEY, (old) => ({
          approvals: old?.approvals.filter((a) => a.id !== approval.id) ?? [],
        }));
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(QUERY_KEY, context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['paperclip', 'sidebar-badges'] });
    },
  });
}

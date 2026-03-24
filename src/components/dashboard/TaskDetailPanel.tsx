import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { formatDistanceToNow, isValid, parseISO } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { usePaperclipActivity } from '@/hooks/usePaperclipActivity';
import {
  useAssignTask,
  useCreateTaskComment,
  usePaperclipTaskComments,
  usePaperclipTaskDetail,
  useUpdateTaskPriority,
  useUpdateTaskStatus,
} from '@/hooks/usePaperclipTasks';
import { ActivityTimeline } from '@/components/dashboard/ActivityTimeline';
import { AgentInvokeButton } from '@/components/dashboard/AgentInvokeButton';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import type { IssuePriority, IssueStatus, PaperclipAgent } from '@/lib/paperclip-types';
import { toast } from 'sonner';

const STATUS_OPTIONS: IssueStatus[] = ['todo', 'in_progress', 'in_review', 'done'];
const PRIORITY_OPTIONS: IssuePriority[] = ['critical', 'high', 'medium', 'low'];

function formatTime(value?: string): string {
  if (!value) return '—';
  const parsed = parseISO(value);
  return isValid(parsed) ? formatDistanceToNow(parsed, { addSuffix: true }) : '—';
}

export function TaskDetailPanel({
  issueId,
  onClose,
  agents,
}: {
  issueId: string;
  onClose: () => void;
  agents: PaperclipAgent[];
}) {
  const detailQuery = usePaperclipTaskDetail(issueId);
  const commentsQuery = usePaperclipTaskComments(issueId);
  const activityQuery = usePaperclipActivity(25);
  const createComment = useCreateTaskComment(issueId);
  const assignTask = useAssignTask();
  const updatePriority = useUpdateTaskPriority();
  const updateStatus = useUpdateTaskStatus();
  const [commentBody, setCommentBody] = useState('');

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const detail = detailQuery.data;

  const relatedActivity = useMemo(() => {
    return (activityQuery.data?.entries ?? []).filter((entry) => {
      if (entry.entityId === issueId) return true;
      const details = entry.details ?? {};
      return (
        details.issueId === issueId
        || details.issue_id === issueId
        || details.entityId === issueId
      );
    });
  }, [activityQuery.data?.entries, issueId]);

  const onStatusChange = (status: IssueStatus) => {
    updateStatus.mutate(
      { issueId, status },
      {
        onSuccess: () => toast.success('Status updated'),
        onError: (error) => toast.error(error instanceof Error ? error.message : 'Failed to update status'),
      },
    );
  };

  const onPriorityChange = (priority: IssuePriority) => {
    updatePriority.mutate(
      { issueId, priority },
      {
        onSuccess: () => toast.success('Priority updated'),
        onError: (error) => toast.error(error instanceof Error ? error.message : 'Failed to update priority'),
      },
    );
  };

  const onAssigneeChange = (assigneeAgentId: string) => {
    assignTask.mutate(
      { issueId, assigneeAgentId: assigneeAgentId || undefined },
      {
        onSuccess: () => toast.success('Assignee updated'),
        onError: (error) => toast.error(error instanceof Error ? error.message : 'Failed to update assignee'),
      },
    );
  };

  const submitComment = (interrupt = false) => {
    const body = commentBody.trim() || (interrupt ? 'Please continue this task.' : '');
    if (!body) {
      toast.error('Comment cannot be empty');
      return;
    }
    createComment.mutate(
      { body, interrupt },
      {
        onSuccess: () => {
          setCommentBody('');
          toast.success(interrupt ? 'Agent invoked' : 'Comment added');
        },
        onError: (error) => {
          toast.error(error instanceof Error ? error.message : 'Failed to post comment');
        },
      },
    );
  };

  return (
    <div
      className="fixed inset-y-0 right-0 z-50 w-full max-w-[760px] border-l border-border bg-card shadow-2xl"
      role="dialog"
      aria-label="Task detail"
    >
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div>
          <p className="font-satoshi text-lg font-bold text-foreground">Task Detail</p>
          {detail?.identifier ? (
            <p className="font-mono text-[11px] text-muted-foreground">{detail.identifier}</p>
          ) : null}
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close task detail panel">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {detailQuery.isLoading ? (
        <div className="space-y-3 p-5 animate-pulse">
          <div className="h-6 w-3/4 rounded bg-amber-500/5" />
          <div className="h-4 w-1/2 rounded bg-amber-500/5" />
          <div className="h-40 rounded bg-amber-500/5" />
        </div>
      ) : detailQuery.isError || !detail ? (
        <div className="p-5">
          <p className="text-sm text-red-300">Failed to load task detail.</p>
        </div>
      ) : (
        <div className="grid h-[calc(100%-72px)] grid-cols-1 overflow-hidden md:grid-cols-[1fr_260px]">
          <div className="flex h-full flex-col overflow-hidden border-b border-border md:border-b-0 md:border-r">
            <div className="space-y-3 border-b border-border px-5 py-4">
              <h2 className="font-satoshi text-xl font-bold text-foreground">{detail.title}</h2>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={detail.status} />
                {detail.priority ? <StatusBadge status={detail.priority} /> : null}
                {detail.assignee ? (
                  <span className="font-mono text-[11px] text-muted-foreground">
                    Assigned: {detail.assignee.name}
                  </span>
                ) : null}
              </div>
              {detail.description ? (
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{detail.description}</p>
              ) : null}
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              <Tabs defaultValue="comments" className="w-full">
                <TabsList className="bg-zinc-900/70">
                  <TabsTrigger value="comments">Comments</TabsTrigger>
                  <TabsTrigger value="activity">Activity</TabsTrigger>
                </TabsList>

                <TabsContent value="comments" className="space-y-4">
                  {commentsQuery.isLoading ? (
                    <div className="h-16 rounded bg-amber-500/5 animate-pulse" />
                  ) : commentsQuery.data?.comments?.length ? (
                    <div className="space-y-3">
                      {commentsQuery.data.comments.map((comment) => (
                        <div key={comment.id} className="rounded-lg border border-border bg-card/60 p-3">
                          <div className="mb-1 flex items-center gap-2">
                            <span className="text-sm font-medium text-foreground">{comment.author ?? 'Agent'}</span>
                            <span className="font-mono text-[10px] text-muted-foreground/60">
                              {formatTime(comment.createdAt)}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{comment.body}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No comments yet.</p>
                  )}

                  <div className="space-y-2">
                    <Textarea
                      value={commentBody}
                      onChange={(event) => setCommentBody(event.target.value)}
                      placeholder="Add context or ask your agent to act on this task."
                      rows={4}
                    />
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button
                        size="sm"
                        onClick={() => submitComment(false)}
                        disabled={createComment.isPending}
                        className="min-h-[40px] sm:min-h-0"
                      >
                        {createComment.isPending ? 'Posting...' : 'Post comment'}
                      </Button>
                      <AgentInvokeButton
                        label={`Ask ${detail.assignee?.name ?? 'Agent'}`}
                        onClick={() => submitComment(true)}
                        pending={createComment.isPending}
                      />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="activity" className="space-y-2">
                  {activityQuery.isLoading ? (
                    <div className="h-16 rounded bg-amber-500/5 animate-pulse" />
                  ) : (
                    <ActivityTimeline
                      entries={relatedActivity}
                      emptyLabel="No activity yet — your Chief will start soon."
                    />
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </div>

          <aside className="h-full overflow-y-auto px-4 py-4">
            <p className="mb-3 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Properties</p>
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Status</label>
                <select
                  value={detail.status}
                  onChange={(event) => onStatusChange(event.target.value as IssueStatus)}
                  className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/40"
                >
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {status.replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Priority</label>
                <select
                  value={detail.priority ?? 'medium'}
                  onChange={(event) => onPriorityChange(event.target.value as IssuePriority)}
                  className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/40"
                >
                  {PRIORITY_OPTIONS.map((priority) => (
                    <option key={priority} value={priority}>
                      {priority}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Assignee</label>
                <select
                  value={detail.assigneeAgentId ?? detail.assignee?.id ?? ''}
                  onChange={(event) => onAssigneeChange(event.target.value)}
                  className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/40"
                >
                  <option value="">Unassigned</option>
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1 pt-2 text-xs text-muted-foreground">
                <p>Project: {detail.projectId ?? '—'}</p>
                <p>Created by: {detail.createdByUserId ?? detail.createdByAgentId ?? '—'}</p>
                <p>Created: {formatTime(detail.createdAt)}</p>
                <p>Updated: {formatTime(detail.updatedAt)}</p>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

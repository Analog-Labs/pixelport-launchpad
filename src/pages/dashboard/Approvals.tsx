import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Pencil, X } from 'lucide-react';
import {
  usePaperclipApprovals,
  useApproveApproval,
  useRejectApproval,
  useEditApproval,
} from '@/hooks/usePaperclipApprovals';
import { ProxyQueryWrapper } from '@/components/dashboard/ProxyQueryWrapper';
import { ApprovalCardSkeleton } from '@/components/dashboard/DashboardSkeleton';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { sanitizeContent } from '@/lib/sanitizeContent';
import type { PaperclipApproval } from '@/lib/paperclip-types';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

// ── Approval card ──────────────────────────────────────────────────────────────

function ApprovalCard({ approval }: { approval: PaperclipApproval }) {
  const [editing, setEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(approval.content);
  const [expanded, setExpanded] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const approveMutation = useApproveApproval();
  const rejectMutation = useRejectApproval();
  const editMutation = useEditApproval();

  const isDirty = editing && editedContent !== approval.content;

  // ED-6: warn on navigation if edit is dirty
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const handleEdit = () => {
    setEditing(true);
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const handleCancelEdit = () => {
    setEditing(false);
    setEditedContent(approval.content);
  };

  const handleSaveDraft = () => {
    editMutation.mutate(
      { approval, editedContent, approve: false },
      {
        onSuccess: () => {
          toast.success('Draft saved');
          setEditing(false);
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to save draft'),
      },
    );
  };

  const handleApproveEdited = () => {
    editMutation.mutate(
      { approval, editedContent, approve: true },
      {
        onSuccess: () => {
          toast.success('Approved');
          setEditing(false);
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to approve'),
      },
    );
  };

  const handleApprove = useCallback(() => {
    approveMutation.mutate(approval.id, {
      onSuccess: () => toast.success('Approved'),
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to approve'),
    });
  }, [approveMutation, approval.id]);

  const handleReject = useCallback(() => {
    rejectMutation.mutate(
      { approvalId: approval.id },
      {
        onSuccess: () => toast.success('Rejected'),
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to reject'),
      },
    );
  }, [rejectMutation, approval.id]);

  const isLoading =
    approveMutation.isPending || rejectMutation.isPending || editMutation.isPending;

  const safeHtml = sanitizeContent(approval.content);

  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-card p-5 space-y-4',
        'transition-all duration-200',
        'hover:border-amber-400/40 hover:shadow-[0_0_20px_rgba(212,168,83,0.08)]',
        'focus-within:shadow-[0_0_0_3px_rgba(212,168,83,0.1)]',
      )}
    >
      {/* Header: type badge + timestamp */}
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center rounded-full border border-amber-400/30 bg-amber-500/10 px-2.5 py-0.5 text-xs font-mono text-amber-400">
          {approval.type}
        </span>
        <span className="font-mono text-[11px] text-muted-foreground">
          {formatDistanceToNow(new Date(approval.createdAt), { addSuffix: true })}
        </span>
      </div>

      {/* Content body — editable or display */}
      {editing ? (
        <textarea
          ref={textareaRef}
          value={editedContent}
          onChange={(e) => setEditedContent(e.target.value)}
          className={cn(
            'w-full rounded-lg border border-amber-400/40 bg-zinc-900 px-3 py-2',
            'text-sm text-foreground resize-none focus:outline-none',
            'min-h-[120px]',
          )}
          rows={6}
        />
      ) : (
        <div
          className={cn(
            'text-sm font-satoshi font-medium text-foreground leading-relaxed',
            !expanded && 'line-clamp-4',
          )}
          dangerouslySetInnerHTML={{ __html: safeHtml }}
          onClick={() => setExpanded((v) => !v)}
        />
      )}

      {/* Media placeholder — stays visible during edit per Full Wedge spec */}
      <div className="aspect-video rounded-lg bg-zinc-800/60 flex items-center justify-center">
        <span className="font-mono text-[11px] text-zinc-600">Media · Coming in T5</span>
      </div>

      {/* Metadata row */}
      <div className="font-mono text-[11px] text-muted-foreground flex gap-3">
        {approval.platform && <span>Platform: {approval.platform}</span>}
        {approval.createdBy && <span>By: {approval.createdBy}</span>}
      </div>

      {/* Action buttons */}
      {editing ? (
        <div className="flex gap-2 flex-wrap">
          <Button
            size="sm"
            onClick={handleApproveEdited}
            disabled={isLoading}
            className="min-h-[44px] sm:min-h-0"
          >
            <Check className="h-3.5 w-3.5 mr-1.5" />
            Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleSaveDraft}
            disabled={isLoading}
            className="min-h-[44px] sm:min-h-0"
          >
            Save Draft
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleCancelEdit}
            disabled={isLoading}
            className="min-h-[44px] sm:min-h-0"
          >
            Cancel
          </Button>
        </div>
      ) : (
        <div className="flex gap-2 flex-wrap">
          {/* Approve — primary amber shimmer */}
          <Button
            size="sm"
            onClick={handleApprove}
            disabled={isLoading}
            className="min-h-[44px] sm:min-h-0 bg-amber-500 hover:bg-amber-400 text-black font-semibold"
          >
            <Check className="h-3.5 w-3.5 mr-1.5" />
            Approve
          </Button>
          {/* Edit — outline */}
          <Button
            size="sm"
            variant="outline"
            onClick={handleEdit}
            disabled={isLoading}
            className="min-h-[44px] sm:min-h-0"
          >
            <Pencil className="h-3.5 w-3.5 mr-1.5" />
            Edit
          </Button>
          {/* Reject — ghost/subtle */}
          <Button
            size="sm"
            variant="ghost"
            onClick={handleReject}
            disabled={isLoading}
            className="min-h-[44px] sm:min-h-0 text-muted-foreground hover:text-red-400"
          >
            <X className="h-3.5 w-3.5 mr-1.5" />
            Reject
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Approval queue page ────────────────────────────────────────────────────────

export default function Approvals() {
  const approvalsQuery = usePaperclipApprovals();

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <h1 className="text-2xl font-satoshi font-bold text-foreground">Approval Queue</h1>

      <ProxyQueryWrapper
        query={approvalsQuery}
        skeleton={
          <div className="space-y-4">
            <ApprovalCardSkeleton />
            <ApprovalCardSkeleton />
          </div>
        }
        errorLabel="approvals"
      >
        {(data) => {
          if (!data.approvals.length) {
            return (
              <div className="rounded-xl border border-border bg-card p-10 text-center space-y-2">
                <Check className="h-8 w-8 text-emerald-400 mx-auto" />
                <p className="text-muted-foreground">
                  Inbox zero — your Chief handled everything
                </p>
              </div>
            );
          }

          return (
            <div className="space-y-4">
              {data.approvals.map((approval) => (
                <ApprovalCard key={approval.id} approval={approval} />
              ))}
            </div>
          );
        }}
      </ProxyQueryWrapper>
    </div>
  );
}

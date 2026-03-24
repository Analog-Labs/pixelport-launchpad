import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useCreateTask } from '@/hooks/usePaperclipTasks';
import type { IssuePriority, PaperclipAgent, PaperclipIssue } from '@/lib/paperclip-types';
import { toast } from 'sonner';

const PRIORITY_OPTIONS: IssuePriority[] = ['critical', 'high', 'medium', 'low'];

export function CreateTaskPanel({
  open,
  onClose,
  agents,
  defaultAssigneeAgentId,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  agents: PaperclipAgent[];
  defaultAssigneeAgentId?: string;
  onCreated?: (issue: PaperclipIssue) => void;
}) {
  const createTask = useCreateTask();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<IssuePriority>('medium');
  const [assigneeAgentId, setAssigneeAgentId] = useState('');

  useEffect(() => {
    if (!open) return;
    setAssigneeAgentId(defaultAssigneeAgentId ?? '');
  }, [defaultAssigneeAgentId, open]);

  useEffect(() => {
    if (!open) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose, open]);

  if (!open) return null;

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setPriority('medium');
    setAssigneeAgentId(defaultAssigneeAgentId ?? '');
  };

  const handleSubmit = () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      toast.error('Task title is required');
      return;
    }

    createTask.mutate(
      {
        title: trimmedTitle,
        description: description.trim() || undefined,
        priority,
        assigneeAgentId: assigneeAgentId || undefined,
      },
      {
        onSuccess: (createdIssue) => {
          toast.success('Task created');
          onCreated?.(createdIssue);
          resetForm();
          onClose();
        },
        onError: (error) => {
          toast.error(error instanceof Error ? error.message : 'Failed to create task');
        },
      },
    );
  };

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="fixed inset-y-0 right-0 z-50 w-full max-w-[400px] border-l border-border bg-card shadow-2xl"
        role="dialog"
        aria-label="Create task"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="font-satoshi text-lg font-bold text-foreground">Create Task</h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close create task panel">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="space-y-1.5">
            <label className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              Title
            </label>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Draft next week content plan"
              maxLength={200}
            />
          </div>

          <div className="space-y-1.5">
            <label className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              Description
            </label>
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Optional context for the assigned agent."
              rows={5}
            />
          </div>

          <div className="space-y-1.5">
            <label className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              Priority
            </label>
            <select
              value={priority}
              onChange={(event) => setPriority(event.target.value as IssuePriority)}
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/40"
            >
              {PRIORITY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              Assign To Agent
            </label>
            <select
              value={assigneeAgentId}
              onChange={(event) => setAssigneeAgentId(event.target.value)}
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/40"
            >
              <option value="">Unassigned</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={onClose} className="min-h-[44px] sm:min-h-0">
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createTask.isPending}
              className="min-h-[44px] sm:min-h-0 shimmer-btn"
            >
              {createTask.isPending ? 'Creating...' : 'Create'}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

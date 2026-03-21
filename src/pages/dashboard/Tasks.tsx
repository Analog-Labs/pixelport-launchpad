import { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { X } from 'lucide-react';
import { usePaperclipTasks, usePaperclipTaskDetail, usePaperclipTaskComments, useUpdateTaskStatus } from '@/hooks/usePaperclipTasks';
import { ProxyQueryWrapper } from '@/components/dashboard/ProxyQueryWrapper';
import { KanbanSkeleton } from '@/components/dashboard/DashboardSkeleton';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import type { IssueStatus, PaperclipIssue } from '@/lib/paperclip-types';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

const COLUMNS: { status: IssueStatus; label: string }[] = [
  { status: 'backlog', label: 'Backlog' },
  { status: 'in_progress', label: 'In Progress' },
  { status: 'in_review', label: 'In Review' },
  { status: 'done', label: 'Done' },
];

// ── Draggable task card ────────────────────────────────────────────────────────

function DraggableTaskCard({
  task,
  onClick,
}: {
  task: PaperclipIssue;
  onClick: (task: PaperclipIssue) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { task },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    rotate: isDragging ? '2deg' : '0deg',
  };

  const agentColor =
    task.assignee?.status === 'running'
      ? 'bg-amber-500'
      : task.assignee?.status === 'online'
        ? 'bg-emerald-500'
        : 'bg-zinc-500';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'rounded-lg border border-border bg-card p-3 cursor-grab select-none',
        'transition-all duration-150',
        'hover:border-amber-400/40 hover:shadow-[0_0_20px_rgba(212,168,83,0.08)]',
        isDragging && 'shadow-xl border-amber-400/30',
      )}
      onClick={() => onClick(task)}
      {...listeners}
      {...attributes}
    >
      <p className="font-satoshi font-semibold text-sm text-foreground truncate">{task.title}</p>
      <div className="flex items-center justify-between mt-1">
        <span className="font-mono text-[11px] text-muted-foreground">
          {task.number ? `#${task.number}` : task.id.slice(0, 6)}
        </span>
        {task.assignee && (
          <div className="flex items-center gap-1">
            <span className={cn('h-1.5 w-1.5 rounded-full', agentColor)} />
            <span className="font-mono text-[11px] text-muted-foreground truncate max-w-[80px]">
              {task.assignee.name}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Droppable column ───────────────────────────────────────────────────────────

function KanbanColumn({
  status,
  label,
  tasks,
  onCardClick,
}: {
  status: IssueStatus;
  label: string;
  tasks: PaperclipIssue[];
  onCardClick: (task: PaperclipIssue) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'rounded-xl border bg-card/50 p-4 flex flex-col gap-3 min-h-[300px] transition-all duration-150',
        isOver ? 'border-amber-400/30 bg-amber-500/5' : 'border-border',
      )}
    >
      <h3 className="font-mono text-xs uppercase tracking-widest text-muted-foreground font-semibold">
        {label}
        <span className="ml-2 text-zinc-600">{tasks.length}</span>
      </h3>
      {tasks.map((task) => (
        <DraggableTaskCard key={task.id} task={task} onClick={onCardClick} />
      ))}
      {!tasks.length && (
        <p className="text-xs text-zinc-600 text-center pt-6">No tasks</p>
      )}
    </div>
  );
}

// ── Task detail panel ──────────────────────────────────────────────────────────

function TaskDetailPanel({
  issueId,
  onClose,
}: {
  issueId: string;
  onClose: () => void;
}) {
  const detailQuery = usePaperclipTaskDetail(issueId);
  const commentsQuery = usePaperclipTaskComments(issueId);

  return (
    <div
      className="fixed inset-y-0 right-0 w-full max-w-[400px] bg-card border-l border-border shadow-2xl z-50 flex flex-col"
      style={{ animation: 'slideInRight 200ms ease-out' }}
      role="dialog"
      aria-label="Task detail"
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <span className="font-satoshi font-semibold text-foreground">Task Detail</span>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close panel">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {detailQuery.isLoading ? (
          <div className="space-y-3 animate-pulse">
            <div className="h-5 bg-amber-500/5 rounded w-3/4" />
            <div className="h-4 bg-amber-500/5 rounded w-1/2" />
            <div className="h-24 bg-amber-500/5 rounded" />
          </div>
        ) : detailQuery.isError ? (
          <p className="text-sm text-red-400">Failed to load task detail.</p>
        ) : detailQuery.data ? (
          <>
            <div>
              <h2 className="font-satoshi font-bold text-lg text-foreground">
                {detailQuery.data.title}
              </h2>
              <div className="flex items-center gap-3 mt-1 font-mono text-[11px] text-muted-foreground">
                {detailQuery.data.number && <span>#{detailQuery.data.number}</span>}
                <span className="capitalize">{detailQuery.data.status.replace('_', ' ')}</span>
                {detailQuery.data.assignee && <span>{detailQuery.data.assignee.name}</span>}
              </div>
            </div>
            {detailQuery.data.description && (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {detailQuery.data.description}
              </p>
            )}

            {/* Comments */}
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-600 mb-2">
                Comments
              </p>
              {commentsQuery.isLoading ? (
                <div className="h-12 bg-amber-500/5 rounded animate-pulse" />
              ) : commentsQuery.data?.comments.length ? (
                <div className="space-y-3">
                  {commentsQuery.data.comments.map((c) => (
                    <div key={c.id} className="text-sm">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-medium text-foreground">{c.author ?? 'Agent'}</span>
                        <span className="font-mono text-[10px] text-zinc-600">
                          {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                      <p className="text-muted-foreground">{c.body}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-zinc-600">No comments yet.</p>
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

// ── Main Kanban board ──────────────────────────────────────────────────────────

export default function Tasks() {
  const tasksQuery = usePaperclipTasks();
  const updateStatus = useUpdateTaskStatus();
  const [activeTask, setActiveTask] = useState<PaperclipIssue | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    const task = event.active.data.current?.task as PaperclipIssue | undefined;
    setActiveTask(task ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const task = active.data.current?.task as PaperclipIssue | undefined;
    const newStatus = over.id as IssueStatus;

    if (!task || task.status === newStatus) return;

    updateStatus.mutate(
      { issueId: task.id, status: newStatus },
      {
        onSuccess: () => toast.success(`Task moved to ${newStatus.replace('_', ' ')}`),
        onError: () => toast.error('Failed to update task status'),
      },
    );
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <h1 className="text-2xl font-satoshi font-bold text-foreground">Tasks</h1>

      <ProxyQueryWrapper
        query={tasksQuery}
        skeleton={<KanbanSkeleton />}
        errorLabel="tasks"
      >
        {(data) => {
          if (!data.issues.length) {
            return (
              <div className="rounded-xl border border-border bg-card p-10 text-center space-y-2">
                <p className="text-muted-foreground">No tasks yet — Chief is working on it.</p>
                <a href="/dashboard/approvals" className="text-sm text-amber-400 underline">
                  Check approvals
                </a>
              </div>
            );
          }

          const byStatus = (status: IssueStatus) =>
            data.issues.filter((i) => i.status === status);

          return (
            <>
              {/* Mobile: horizontal scroll with snap */}
              <div className="md:hidden flex gap-4 overflow-x-auto snap-x snap-mandatory pb-4">
                {COLUMNS.map((col) => (
                  <div key={col.status} className="snap-center min-w-[85vw] flex-shrink-0">
                    <KanbanColumn
                      status={col.status}
                      label={col.label}
                      tasks={byStatus(col.status)}
                      onCardClick={(t) => setSelectedTaskId(t.id)}
                    />
                  </div>
                ))}
              </div>

              {/* Desktop: drag-and-drop grid */}
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              >
                <div className="hidden md:grid grid-cols-4 gap-4">
                  {COLUMNS.map((col) => (
                    <KanbanColumn
                      key={col.status}
                      status={col.status}
                      label={col.label}
                      tasks={byStatus(col.status)}
                      onCardClick={(t) => setSelectedTaskId(t.id)}
                    />
                  ))}
                </div>

                <DragOverlay>
                  {activeTask ? (
                    <div className="rounded-lg border border-amber-400/40 bg-card p-3 shadow-2xl rotate-2 opacity-90">
                      <p className="font-satoshi font-semibold text-sm text-foreground">
                        {activeTask.title}
                      </p>
                    </div>
                  ) : null}
                </DragOverlay>
              </DndContext>
            </>
          );
        }}
      </ProxyQueryWrapper>

      {/* Task detail slide-out */}
      {selectedTaskId && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setSelectedTaskId(null)}
            aria-hidden="true"
          />
          <TaskDetailPanel
            issueId={selectedTaskId}
            onClose={() => setSelectedTaskId(null)}
          />
        </>
      )}
    </div>
  );
}

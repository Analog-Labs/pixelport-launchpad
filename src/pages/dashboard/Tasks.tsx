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
import { usePaperclipAgents } from '@/hooks/usePaperclipAgents';
import { usePaperclipTasks, useUpdateTaskStatus } from '@/hooks/usePaperclipTasks';
import { ProxyQueryWrapper } from '@/components/dashboard/ProxyQueryWrapper';
import { CreateTaskPanel } from '@/components/dashboard/CreateTaskPanel';
import { TaskDetailPanel } from '@/components/dashboard/TaskDetailPanel';
import { KanbanSkeleton } from '@/components/dashboard/DashboardSkeleton';
import { Button } from '@/components/ui/button';
import type { IssueStatus, PaperclipIssue } from '@/lib/paperclip-types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const COLUMNS: { status: IssueStatus; label: string }[] = [
  { status: 'todo', label: 'Backlog' },
  { status: 'in_progress', label: 'In Progress' },
  { status: 'in_review', label: 'In Review' },
  { status: 'done', label: 'Done' },
];

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
        'cursor-grab select-none rounded-lg border border-border bg-card p-3',
        'transition-all duration-150',
        'hover:border-amber-400/40 hover:shadow-[0_0_20px_rgba(212,168,83,0.08)]',
        isDragging && 'border-amber-400/30 shadow-xl',
      )}
      onClick={() => onClick(task)}
      {...listeners}
      {...attributes}
    >
      <p className="truncate font-satoshi text-sm font-semibold text-foreground">{task.title}</p>
      <div className="mt-1 flex items-center justify-between">
        <span className="font-mono text-[11px] text-muted-foreground">
          {task.identifier ?? (task.number ? `#${task.number}` : task.id.slice(0, 6))}
        </span>
        {task.assignee ? (
          <div className="flex max-w-[120px] items-center gap-1">
            <span className={cn('h-1.5 w-1.5 rounded-full', agentColor)} />
            <span className="truncate font-mono text-[11px] text-muted-foreground">{task.assignee.name}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

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
        'min-h-[300px] rounded-xl border bg-card/50 p-4',
        'flex flex-col gap-3 transition-all duration-150',
        isOver ? 'border-amber-400/30 bg-amber-500/5' : 'border-border',
      )}
    >
      <h3 className="font-mono text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
        <span className="ml-2 text-muted-foreground/60">{tasks.length}</span>
      </h3>
      {tasks.map((task) => (
        <DraggableTaskCard key={task.id} task={task} onClick={onCardClick} />
      ))}
      {!tasks.length ? (
        <p className="pt-6 text-center text-xs text-muted-foreground/60">No tasks</p>
      ) : null}
    </div>
  );
}

export default function Tasks() {
  const tasksQuery = usePaperclipTasks();
  const agentsQuery = usePaperclipAgents();
  const updateStatus = useUpdateTaskStatus();
  const [activeTask, setActiveTask] = useState<PaperclipIssue | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [createPanelOpen, setCreatePanelOpen] = useState(false);

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
        onError: (error) =>
          toast.error(error instanceof Error ? error.message : 'Failed to update task status'),
      },
    );
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-satoshi font-bold text-foreground">Tasks</h1>
        <Button
          onClick={() => setCreatePanelOpen(true)}
          className="min-h-[44px] sm:min-h-0"
        >
          New Task
        </Button>
      </div>

      <ProxyQueryWrapper
        query={tasksQuery}
        skeleton={<KanbanSkeleton />}
        errorLabel="tasks"
      >
        {(data) => {
          if (!data.issues.length) {
            return (
              <div className="space-y-2 rounded-xl border border-border bg-card p-10 text-center">
                <p className="text-muted-foreground">No tasks yet — create your first.</p>
                <Button variant="outline" onClick={() => setCreatePanelOpen(true)}>
                  Create Task
                </Button>
              </div>
            );
          }

          const byStatus = (status: IssueStatus) =>
            data.issues.filter((issue) => issue.status === status);

          return (
            <>
              <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 md:hidden">
                {COLUMNS.map((column) => (
                  <div key={column.status} className="min-w-[85vw] flex-shrink-0 snap-center">
                    <KanbanColumn
                      status={column.status}
                      label={column.label}
                      tasks={byStatus(column.status)}
                      onCardClick={(task) => setSelectedTaskId(task.id)}
                    />
                  </div>
                ))}
              </div>

              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              >
                <div className="hidden grid-cols-4 gap-4 md:grid">
                  {COLUMNS.map((column) => (
                    <KanbanColumn
                      key={column.status}
                      status={column.status}
                      label={column.label}
                      tasks={byStatus(column.status)}
                      onCardClick={(task) => setSelectedTaskId(task.id)}
                    />
                  ))}
                </div>

                <DragOverlay>
                  {activeTask ? (
                    <div className="rotate-2 rounded-lg border border-amber-400/40 bg-card p-3 shadow-2xl opacity-90">
                      <p className="font-satoshi text-sm font-semibold text-foreground">{activeTask.title}</p>
                    </div>
                  ) : null}
                </DragOverlay>
              </DndContext>
            </>
          );
        }}
      </ProxyQueryWrapper>

      <CreateTaskPanel
        open={createPanelOpen}
        onClose={() => setCreatePanelOpen(false)}
        agents={agentsQuery.data?.agents ?? []}
      />

      {selectedTaskId ? (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick={() => setSelectedTaskId(null)}
            aria-hidden="true"
          />
          <TaskDetailPanel
            issueId={selectedTaskId}
            onClose={() => setSelectedTaskId(null)}
            agents={agentsQuery.data?.agents ?? []}
          />
        </>
      ) : null}
    </div>
  );
}

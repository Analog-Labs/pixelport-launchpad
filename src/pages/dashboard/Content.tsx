import { useState, useEffect } from "react";
import { FileText, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getAgentName } from "@/lib/avatars";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

type Filter = "all" | "pending" | "approved" | "published";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "published", label: "Published" },
];

function getPlatformBadge(platform: string | null) {
  if (platform === "linkedin") return { label: "LinkedIn", cls: "bg-blue-500/15 text-blue-400" };
  if (platform === "twitter" || platform === "x") return { label: "X", cls: "bg-zinc-500/15 text-zinc-300" };
  return { label: "General", cls: "bg-zinc-500/15 text-zinc-400" };
}

function getStatusChip(task: any) {
  if (task.requires_approval && task.approval_status === "pending") return { label: "Pending Review", cls: "bg-amber-500/15 text-amber-400" };
  if (task.approval_status === "approved") return { label: "Approved", cls: "bg-emerald-500/15 text-emerald-400" };
  if (task.approval_status === "rejected") return { label: "Rejected", cls: "bg-red-500/15 text-red-400" };
  if (task.status === "completed") return { label: "Published", cls: "bg-blue-500/15 text-blue-400" };
  return { label: task.status, cls: "bg-zinc-500/15 text-zinc-400" };
}

function matchesFilter(task: any, filter: Filter) {
  if (filter === "all") return true;
  if (filter === "pending") return task.approval_status === "pending";
  if (filter === "approved") return task.approval_status === "approved";
  if (filter === "published") return task.status === "completed" && !task.requires_approval;
  return true;
}

const Content = () => {
  const { session } = useAuth();
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const agentName = getAgentName();

  useEffect(() => {
    if (!session?.access_token) return;
    (async () => {
      try {
        const res = await fetch("/api/tasks?task_type=draft_content&limit=50", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!res.ok) throw new Error();
        const data = await res.json();
        setTasks(data.tasks ?? []);
      } catch {
        setTasks([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [session?.access_token]);

  const handleAction = async (taskId: string, action: "approve" | "reject") => {
    if (!session?.access_token) return;
    setActionLoading(taskId);
    try {
      const res = await fetch(`/api/tasks/${action}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ task_id: taskId }),
      });
      if (!res.ok) throw new Error();
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, approval_status: action === "approve" ? "approved" : "rejected" } : t))
      );
      toast.success(action === "approve" ? "Content approved" : "Content rejected");
    } catch {
      toast.error(`Failed to ${action} content`);
    } finally {
      setActionLoading(null);
    }
  };

  const filtered = tasks.filter((t) => matchesFilter(t, filter));

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-zinc-100">Content Pipeline</h1>
        <p className="text-zinc-400 text-sm mt-1">Review and approve content drafts from your agent.</p>
      </header>

      <div className="flex gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              filter === f.key ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] text-center">
          <div className="rounded-2xl bg-primary/10 p-4 mb-4">
            <FileText className="h-10 w-10 text-primary" />
          </div>
          <p className="text-zinc-400 text-sm max-w-sm">
            {agentName} is analyzing your brand and will suggest content soon.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((task) => {
            const platform = getPlatformBadge(task.platform);
            const status = getStatusChip(task);
            return (
              <div key={task.id} className="border border-zinc-800 bg-zinc-900 rounded-lg p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${platform.cls}`}>
                        {platform.label}
                      </span>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${status.cls}`}>
                        {status.label}
                      </span>
                    </div>
                    <h3 className="text-sm font-medium text-zinc-100">{task.task_description}</h3>
                    <p className="text-xs text-zinc-500 mt-1">
                      Created {formatDistanceToNow(new Date(task.created_at), { addSuffix: true })}
                    </p>
                  </div>

                  {task.approval_status === "pending" && (
                    <div className="flex gap-2 shrink-0">
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        disabled={actionLoading === task.id}
                        onClick={() => handleAction(task.id, "approve")}
                      >
                        {actionLoading === task.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Approve"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-400 border-red-500/20 hover:bg-red-500/10"
                        disabled={actionLoading === task.id}
                        onClick={() => handleAction(task.id, "reject")}
                      >
                        Reject
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Content;

import { useState, useEffect, useMemo } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getAgentName } from "@/lib/avatars";
import { toast } from "sonner";
import {
  format,
  startOfMonth,
  startOfWeek,
  addDays,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
} from "date-fns";

interface Task {
  id: string;
  task_description: string;
  platform: string | null;
  scheduled_for: string | null;
  status: string;
  task_type: string;
}

function getPlatformDot(platform: string | null): string {
  const p = (platform ?? "").toLowerCase();
  if (p.includes("linkedin")) return "bg-blue-500";
  if (p.includes("twitter") || p === "x") return "bg-zinc-400";
  return "bg-amber-500";
}

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const CalendarPage = () => {
  const { session } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.access_token) return;
    fetch("/api/tasks?scheduled_for=true&sort=scheduled_for&order=asc&limit=100", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((r) => r.json())
      .then((data) => setTasks(data.tasks ?? []))
      .catch(() => {
        toast.error("Failed to load calendar");
        setTasks([]);
      })
      .finally(() => setLoading(false));
  }, [session?.access_token]);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const weekStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    return Array.from({ length: 42 }, (_, i) => addDays(weekStart, i));
  }, [currentMonth]);

  const tasksByDate = useMemo(() => {
    const map: Record<string, Task[]> = {};
    tasks.forEach((t) => {
      if (!t.scheduled_for) return;
      const key = format(new Date(t.scheduled_for), "yyyy-MM-dd");
      (map[key] ??= []).push(t);
    });
    return map;
  }, [tasks]);

  const today = new Date();
  const agentName = getAgentName();
  const selectedTasks = selectedDate ? tasksByDate[selectedDate] ?? [] : [];

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[400px] rounded-lg" />
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
          <div className="rounded-2xl bg-primary/10 p-4 mb-5">
            <CalendarDays className="h-12 w-12 text-primary" />
          </div>
          <p className="text-zinc-400">{agentName} is building your content calendar... Scheduled posts will appear here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Content Calendar</h1>
        <p className="text-sm text-zinc-400 mt-1">Scheduled content from your agent. Click a day to see details.</p>
      </header>

      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={() => setCurrentMonth((m) => subMonths(m, 1))}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Prev
        </Button>
        <h2 className="text-lg font-semibold">{format(currentMonth, "MMMM yyyy")}</h2>
        <Button variant="outline" size="sm" onClick={() => setCurrentMonth((m) => addMonths(m, 1))}>
          Next <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>

      <div className="border border-zinc-800 bg-zinc-900 rounded-lg overflow-hidden">
        <div className="grid grid-cols-7 border-b border-zinc-800">
          {DAY_NAMES.map((d) => (
            <div key={d} className="p-2 text-center text-xs font-medium text-zinc-500">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {calendarDays.map((day) => {
            const dateKey = format(day, "yyyy-MM-dd");
            const dayTasks = tasksByDate[dateKey] ?? [];
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isToday = isSameDay(day, today);
            const isSelected = selectedDate === dateKey;

            return (
              <div
                key={dateKey}
                className={`min-h-[80px] p-2 border-r border-b border-zinc-800 cursor-pointer hover:bg-zinc-800/50 transition-colors ${isSelected ? "bg-zinc-800" : ""}`}
                onClick={() => setSelectedDate(isSelected ? null : dateKey)}
              >
                <span
                  className={`text-xs ${
                    isToday
                      ? "text-amber-400 font-bold"
                      : isCurrentMonth
                      ? "text-zinc-400"
                      : "text-zinc-600"
                  }`}
                >
                  {format(day, "d")}
                </span>
                {dayTasks.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {dayTasks.slice(0, 2).map((t) => (
                      <span key={t.id} className={`w-2 h-2 rounded-full ${getPlatformDot(t.platform)}`} />
                    ))}
                    {dayTasks.length > 2 && (
                      <span className="text-[10px] text-zinc-500">+{dayTasks.length - 2}</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {selectedDate && selectedTasks.length > 0 && (
        <div className="border border-zinc-800 bg-zinc-900 rounded-lg p-5 space-y-3">
          <h3 className="text-sm font-semibold text-zinc-100">
            {format(new Date(selectedDate + "T00:00:00"), "EEEE, MMMM d, yyyy")}
          </h3>
          {selectedTasks.map((task) => (
            <div key={task.id} className="flex items-center gap-3 text-sm">
              <span className={`w-2 h-2 rounded-full shrink-0 ${getPlatformDot(task.platform)}`} />
              <span className="text-zinc-300">{task.task_description}</span>
              {task.scheduled_for && (
                <span className="text-xs text-zinc-500 ml-auto shrink-0">
                  {format(new Date(task.scheduled_for), "HH:mm")}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CalendarPage;

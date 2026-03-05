import { useState, useEffect } from "react";
import { Search, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { getAgentName } from "@/lib/avatars";
import { toast } from "sonner";

interface Competitor {
  id: string;
  company_name: string;
  website_url: string | null;
  summary: string | null;
  threat_level: string | null;
  recent_activity: string | null;
  created_at: string | null;
}

const THREAT_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  high: { bg: "bg-red-500/15", text: "text-red-400", label: "High Threat" },
  medium: { bg: "bg-amber-500/15", text: "text-amber-400", label: "Medium" },
  low: { bg: "bg-emerald-500/15", text: "text-emerald-400", label: "Low" },
};

function getHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

const Competitors = () => {
  const { session } = useAuth();
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.access_token) return;

    fetch("/api/competitors", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((r) => r.json())
      .then((data) => setCompetitors(data.competitors ?? []))
      .catch(() => {
        toast.error("Failed to load competitors");
        setCompetitors([]);
      })
      .finally(() => setLoading(false));
  }, [session?.access_token]);

  const agentName = getAgentName();

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Competitor Intelligence</h1>
        <p className="text-sm text-zinc-400 mt-1">Competitors discovered and monitored by your agent.</p>
      </header>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-40 rounded-lg" />
          ))}
        </div>
      ) : competitors.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
          <div className="rounded-2xl bg-primary/10 p-4 mb-5">
            <Search className="h-12 w-12 text-primary" />
          </div>
          <p className="text-zinc-400">{agentName} is identifying your competitors... Check back shortly.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {competitors.map((c) => {
            const threat = THREAT_STYLES[c.threat_level ?? ""] ?? null;
            return (
              <div key={c.id} className="border border-zinc-800 bg-zinc-900 rounded-lg p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-zinc-100">{c.company_name}</h3>
                    {c.website_url && (
                      <a
                        href={c.website_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-zinc-500 hover:text-amber-400"
                      >
                        {getHostname(c.website_url)}
                      </a>
                    )}
                  </div>
                  {threat && (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${threat.bg} ${threat.text}`}>
                      {threat.label}
                    </span>
                  )}
                </div>
                {c.summary && <p className="text-sm text-zinc-300">{c.summary}</p>}
                {c.recent_activity && (
                  <div className="pt-3 border-t border-zinc-800">
                    <p className="text-xs font-medium text-zinc-500 mb-1">Recent Activity</p>
                    <p className="text-sm text-zinc-400">{c.recent_activity}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Competitors;

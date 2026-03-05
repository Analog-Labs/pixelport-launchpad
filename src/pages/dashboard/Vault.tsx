import { useState, useEffect } from "react";
import { Building2, MessageSquare, Users, Search, Package, ChevronDown, Loader2, Pencil } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { getAgentName } from "@/lib/avatars";
import { toast } from "sonner";

interface VaultSection {
  id: string;
  section_key: string;
  section_title: string;
  content: string | null;
  status: "pending" | "populating" | "ready";
  last_updated_by: string | null;
}

const SECTION_CONFIG: Record<string, { icon: typeof Building2; title: string }> = {
  company_profile: { icon: Building2, title: "Company Profile" },
  brand_voice: { icon: MessageSquare, title: "Brand Voice" },
  icp: { icon: Users, title: "Target Audience" },
  competitors: { icon: Search, title: "Competitors" },
  products: { icon: Package, title: "Products" },
};

const Vault = () => {
  const { session } = useAuth();
  const [sections, setSections] = useState<VaultSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);
  const agentName = getAgentName();

  useEffect(() => {
    if (!session?.access_token) return;
    fetch("/api/vault", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => setSections(data))
      .catch(() => setSections([]))
      .finally(() => setLoading(false));
  }, [session?.access_token]);

  const handleEdit = (section: VaultSection) => {
    setEditingKey(section.section_key);
    setEditContent(section.content || "");
  };

  const handleCancel = () => {
    setEditingKey(null);
    setEditContent("");
  };

  const handleSave = async (sectionKey: string) => {
    if (!session?.access_token) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/vault/${sectionKey}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content: editContent }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setSections((prev) =>
        prev.map((s) => (s.section_key === sectionKey ? { ...s, ...updated } : s))
      );
      setEditingKey(null);
      setEditContent("");
      toast.success("Section saved");
    } catch {
      toast.error("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const renderStatusBadge = (status: string) => {
    const styles = {
      ready: "bg-emerald-500/15 text-emerald-400",
      populating: "bg-amber-500/15 text-amber-400",
      pending: "bg-zinc-500/15 text-zinc-400",
    }[status] || "bg-zinc-500/15 text-zinc-400";
    return (
      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${styles}`}>
        {status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-80" />
        </div>
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (sections.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <Loader2 className="h-8 w-8 text-amber-400 animate-spin mb-4" />
        <p className="text-muted-foreground">
          {agentName} is setting up your Knowledge Vault. Check back in a few minutes.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-foreground">Knowledge Vault</h1>
        <p className="text-muted-foreground mt-1">
          Your agent's understanding of your business. Edit any section to refine.
        </p>
      </header>

      {sections.map((section) => {
        const config = SECTION_CONFIG[section.section_key];
        const Icon = config?.icon || Package;
        const isEditing = editingKey === section.section_key;

        return (
          <Collapsible key={section.id} defaultOpen={section.status === "ready"}>
            <div className="border border-border bg-card rounded-lg overflow-hidden">
              <CollapsibleTrigger className="w-full flex items-center gap-3 p-4 hover:bg-accent/50 transition-colors">
                <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
                <span className="text-base font-semibold text-foreground flex-1 text-left">
                  {config?.title || section.section_title}
                </span>
                {renderStatusBadge(section.status)}
                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
              </CollapsibleTrigger>

              <CollapsibleContent>
                <div className="px-4 pb-4 pt-0">
                  {section.status === "pending" && (
                    <p className="text-sm text-muted-foreground animate-pulse">
                      {agentName} is researching this...
                    </p>
                  )}

                  {section.status === "populating" && (
                    <div className="flex items-center gap-2 text-sm text-amber-400">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {agentName} is writing this section...
                    </div>
                  )}

                  {section.status === "ready" && !isEditing && (
                    <div>
                      <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                        {section.content || "No content yet."}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3"
                        onClick={() => handleEdit(section)}
                      >
                        <Pencil className="h-3.5 w-3.5 mr-1.5" />
                        Edit
                      </Button>
                    </div>
                  )}

                  {isEditing && (
                    <div className="space-y-3">
                      <Textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="min-h-[200px] bg-background border-border focus:border-amber-500/50 resize-y text-sm"
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="bg-amber-500 text-zinc-950 hover:bg-amber-400"
                          onClick={() => handleSave(section.section_key)}
                          disabled={saving}
                        >
                          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
                          Save
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleCancel} disabled={saving}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        );
      })}
    </div>
  );
};

export default Vault;

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  ChevronDown,
  Loader2,
  MessageSquare,
  Package,
  Pencil,
  RefreshCw,
  Search,
  Users,
  XCircle,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { getAgentName } from "@/lib/avatars";
import {
  clearStoredVaultRefreshCommandId,
  getStoredVaultRefreshCommandId,
  setStoredVaultRefreshCommandId,
} from "@/lib/pixelport-storage";
import { getVaultSectionTitle, type VaultSectionKey } from "../../../api/lib/vault-contract";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

interface VaultSection {
  id: string;
  section_key: VaultSectionKey;
  section_title: string;
  content: string | null;
  status: "pending" | "populating" | "ready";
  last_updated_by: string | null;
}

type CommandStatus =
  | "pending"
  | "dispatched"
  | "acknowledged"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

type SectionCommandState = {
  commandId: string | null;
  status: CommandStatus;
  lastError: string | null;
  summary: string | null;
};

type CommandDetailsResponse = {
  command: {
    id: string;
    status: CommandStatus;
    last_error: string | null;
  };
  events?: Array<{
    message?: string | null;
  }>;
  workspace_events?: Array<{
    payload?: {
      summary?: string | null;
      message?: string | null;
      error?: string | null;
    } | null;
  }>;
};

const SECTION_ICONS: Record<VaultSectionKey, typeof Building2> = {
  company_profile: Building2,
  brand_voice: MessageSquare,
  icp: Users,
  competitors: Search,
  products: Package,
};

const TERMINAL_COMMAND_STATUSES: CommandStatus[] = ["completed", "failed", "cancelled"];

function isTerminalCommandStatus(status: CommandStatus): boolean {
  return TERMINAL_COMMAND_STATUSES.includes(status);
}

function buildVaultRefreshIdempotencyKey(tenantId: string, sectionKey: VaultSectionKey): string {
  const uniquePart =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}`;

  return `vault-refresh:${tenantId}:${sectionKey}:${uniquePart}`;
}

async function fetchVaultSections(accessToken: string): Promise<VaultSection[]> {
  const response = await fetch("/api/vault", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error("Failed to load vault sections");
  }

  return (await response.json()) as VaultSection[];
}

async function fetchCommandDetails(accessToken: string, commandId: string): Promise<CommandDetailsResponse> {
  const response = await fetch(`/api/commands/${commandId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error("Failed to load command details");
  }

  return (await response.json()) as CommandDetailsResponse;
}

function getLatestCommandSummary(details: CommandDetailsResponse): string | null {
  const workspaceSummary = [...(details.workspace_events ?? [])]
    .reverse()
    .find(
      (event) =>
        typeof event.payload?.summary === "string" ||
        typeof event.payload?.message === "string" ||
        typeof event.payload?.error === "string"
    );

  if (workspaceSummary?.payload?.error) {
    return workspaceSummary.payload.error;
  }

  if (workspaceSummary?.payload?.summary) {
    return workspaceSummary.payload.summary;
  }

  if (workspaceSummary?.payload?.message) {
    return workspaceSummary.payload.message;
  }

  const eventSummary = [...(details.events ?? [])]
    .reverse()
    .find((event) => typeof event.message === "string" && event.message.trim().length > 0);

  return eventSummary?.message ?? null;
}

function getCommandStateFromDetails(details: CommandDetailsResponse): SectionCommandState {
  return {
    commandId: details.command.id,
    status: details.command.status,
    lastError: details.command.last_error,
    summary: getLatestCommandSummary(details),
  };
}

function getCommandStatusLabel(status: CommandStatus): string {
  switch (status) {
    case "pending":
    case "dispatched":
      return "Refresh requested";
    case "acknowledged":
      return "Chief accepted refresh";
    case "running":
      return "Chief is refreshing";
    case "completed":
      return "Refresh completed";
    case "failed":
      return "Refresh failed";
    case "cancelled":
      return "Refresh cancelled";
    default:
      return "Refresh update";
  }
}

const Vault = () => {
  const { session, tenant } = useAuth();
  const [sections, setSections] = useState<VaultSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingKey, setEditingKey] = useState<VaultSectionKey | null>(null);
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [dispatchingSections, setDispatchingSections] = useState<Record<string, boolean>>({});
  const [sectionCommands, setSectionCommands] = useState<Record<string, SectionCommandState>>({});
  const sectionCommandsRef = useRef<Record<string, SectionCommandState>>({});
  const agentName = getAgentName();

  const loadSections = useCallback(async (accessToken: string) => {
    const data = await fetchVaultSections(accessToken);
    setSections(data);
    return data;
  }, []);

  useEffect(() => {
    if (!session?.access_token) {
      setSections([]);
      setSectionCommands({});
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void (async () => {
      try {
        const data = await fetchVaultSections(session.access_token);
        if (!cancelled) {
          setSections(data);
        }
      } catch {
        if (!cancelled) {
          setSections([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session?.access_token, tenant?.id]);

  useEffect(() => {
    sectionCommandsRef.current = sectionCommands;
  }, [sectionCommands]);

  useEffect(() => {
    if (!tenant?.id) {
      setSectionCommands({});
      return;
    }

    setSectionCommands((previous) => {
      const restoredCommands: Record<string, SectionCommandState> = {};

      for (const [sectionKey, commandState] of Object.entries(previous)) {
        if (isTerminalCommandStatus(commandState.status)) {
          restoredCommands[sectionKey] = commandState;
        }
      }

      for (const section of sections) {
        const commandId = getStoredVaultRefreshCommandId(tenant.id, section.section_key);
        if (!commandId) {
          continue;
        }

        const existingState = previous[section.section_key];
        if (existingState?.commandId === commandId) {
          restoredCommands[section.section_key] = existingState;
          continue;
        }

        restoredCommands[section.section_key] = {
          commandId,
          status: "dispatched",
          lastError: null,
          summary: "Resuming section refresh status...",
        };
      }

      return restoredCommands;
    });
  }, [tenant?.id, sections]);

  const activeCommandPollKey = Object.entries(sectionCommands)
    .filter(([, commandState]) => !!commandState.commandId && !isTerminalCommandStatus(commandState.status))
    .map(([sectionKey, commandState]) => `${sectionKey}:${commandState.commandId}`)
    .sort()
    .join("|");

  useEffect(() => {
    if (!session?.access_token || !tenant?.id) {
      return;
    }

    const activeSectionEntries = Object.entries(sectionCommandsRef.current).filter(
      ([, commandState]) =>
        !!commandState.commandId && !isTerminalCommandStatus(commandState.status)
    );

    if (activeSectionEntries.length === 0) {
      return;
    }

    let cancelled = false;

    const pollCommands = async () => {
      const currentEntries = Object.entries(sectionCommandsRef.current).filter(
        ([, commandState]) =>
          !!commandState.commandId && !isTerminalCommandStatus(commandState.status)
      );

      const results = await Promise.all(
        currentEntries.map(async ([sectionKey, commandState]) => {
          try {
            const details = await fetchCommandDetails(session.access_token!, commandState.commandId!);
            return {
              sectionKey: sectionKey as VaultSectionKey,
              details,
              previousStatus: commandState.status,
            };
          } catch {
            return null;
          }
        })
      );

      if (cancelled) {
        return;
      }

      for (const result of results) {
        if (!result) {
          continue;
        }

        const nextState = getCommandStateFromDetails(result.details);

        if (
          result.previousStatus !== nextState.status &&
          (nextState.status === "acknowledged" || nextState.status === "running")
        ) {
          try {
            await loadSections(session.access_token!);
          } catch {
            /* keep polling even if vault refetch fails */
          }
        }

        if (nextState.status === "completed") {
          clearStoredVaultRefreshCommandId(tenant.id, result.sectionKey);

          try {
            await loadSections(session.access_token!);
          } catch {
            /* best-effort refetch */
          }

          if (result.previousStatus !== "completed") {
            toast.success(`${getVaultSectionTitle(result.sectionKey)} refreshed`);
          }

          setSectionCommands((previous) => {
            const nextCommands = { ...previous };
            delete nextCommands[result.sectionKey];
            return nextCommands;
          });
          continue;
        }

        if (nextState.status === "failed" || nextState.status === "cancelled") {
          clearStoredVaultRefreshCommandId(tenant.id, result.sectionKey);

          try {
            await loadSections(session.access_token!);
          } catch {
            /* best-effort refetch */
          }

          if (!isTerminalCommandStatus(result.previousStatus)) {
            toast.error(nextState.lastError || nextState.summary || "Refresh did not complete");
          }
        }

        setSectionCommands((previous) => ({
          ...previous,
          [result.sectionKey]: nextState,
        }));
      }
    };

    void pollCommands();
    const interval = window.setInterval(() => {
      void pollCommands();
    }, 4000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [activeCommandPollKey, loadSections, session?.access_token, tenant?.id]);

  const handleEdit = (section: VaultSection) => {
    setEditingKey(section.section_key);
    setEditContent(section.content || "");
  };

  const handleCancel = () => {
    setEditingKey(null);
    setEditContent("");
  };

  const handleSave = async (sectionKey: VaultSectionKey) => {
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

      if (!res.ok) {
        throw new Error("Failed to save vault section");
      }

      const updated = (await res.json()) as VaultSection;
      setSections((prev) =>
        prev.map((section) =>
          section.section_key === sectionKey ? { ...section, ...updated } : section
        )
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

  const handleRefresh = async (section: VaultSection) => {
    if (!session?.access_token || !tenant?.id) {
      return;
    }

    setDispatchingSections((prev) => ({ ...prev, [section.section_key]: true }));

    try {
      const response = await fetch("/api/commands", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          command_type: "vault_refresh",
          target_entity_type: "vault_section",
          target_entity_id: section.section_key,
          idempotency_key: buildVaultRefreshIdempotencyKey(tenant.id, section.section_key),
        }),
      });

      const payload = await response.json();
      const command = payload?.command as
        | {
            id: string;
            status: CommandStatus;
            last_error?: string | null;
          }
        | undefined;

      if (!command) {
        throw new Error(payload?.error || "Failed to start refresh");
      }

      const nextCommandState: SectionCommandState = {
        commandId: command.id,
        status: command.status,
        lastError: command.last_error ?? null,
        summary:
          payload?.reuse_reason === "active_target"
            ? "Using the current refresh already in progress for this section."
            : "Refresh requested. Waiting for Chief progress...",
      };

      setSectionCommands((prev) => ({
        ...prev,
        [section.section_key]: nextCommandState,
      }));

      if (!isTerminalCommandStatus(command.status)) {
        setStoredVaultRefreshCommandId(tenant.id, section.section_key, command.id);
      } else {
        clearStoredVaultRefreshCommandId(tenant.id, section.section_key);
      }

      if (!response.ok) {
        toast.error(nextCommandState.lastError || payload?.error || "Refresh could not be started");
        return;
      }

      if (payload?.reuse_reason === "active_target") {
        toast.message("Using the active refresh for this section");
      } else {
        toast.success(`Refresh started for ${getVaultSectionTitle(section.section_key)}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to start refresh";

      setSectionCommands((prev) => ({
        ...prev,
        [section.section_key]: {
          commandId: null,
          status: "failed",
          lastError: message,
          summary: message,
        },
      }));
      toast.error(message);
    } finally {
      setDispatchingSections((prev) => {
        const next = { ...prev };
        delete next[section.section_key];
        return next;
      });
    }
  };

  const renderStatusBadge = (status: VaultSection["status"]) => {
    const styles = {
      ready: "bg-emerald-500/15 text-emerald-400",
      populating: "bg-amber-500/15 text-amber-400",
      pending: "bg-zinc-500/15 text-zinc-400",
    }[status];

    return (
      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${styles}`}>
        {status}
      </span>
    );
  };

  const renderCommandStatus = (commandState: SectionCommandState | undefined) => {
    if (!commandState) {
      return null;
    }

    const isBusy = !isTerminalCommandStatus(commandState.status);
    const isFailure = commandState.status === "failed" || commandState.status === "cancelled";
    const Icon = isFailure ? XCircle : isBusy ? Loader2 : CheckCircle2;
    const iconClassName = isBusy ? "h-4 w-4 animate-spin" : "h-4 w-4";
    const textClassName = isFailure
      ? "border-red-500/30 bg-red-500/10 text-red-300"
      : isBusy
        ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
        : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";

    return (
      <div className={`mb-4 flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${textClassName}`}>
        <Icon className={iconClassName} />
        <div className="min-w-0">
          <p className="font-medium">{getCommandStatusLabel(commandState.status)}</p>
          {(commandState.lastError || commandState.summary) && (
            <p className="mt-1 text-xs leading-relaxed">
              {commandState.lastError || commandState.summary}
            </p>
          )}
        </div>
      </div>
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
          Your agent&apos;s understanding of your business. Edit any section to refine.
        </p>
      </header>

      {sections.map((section) => {
        const Icon = SECTION_ICONS[section.section_key] || Package;
        const isEditing = editingKey === section.section_key;
        const commandState = sectionCommands[section.section_key];
        const isCommandBusy =
          !!commandState && !isTerminalCommandStatus(commandState.status);
        const isDispatching = dispatchingSections[section.section_key] === true;
        const canRefresh = section.status === "ready" && !isEditing && !isCommandBusy && !isDispatching;
        const canEdit = section.status === "ready" && !isCommandBusy && !isDispatching;
        const hasContent = typeof section.content === "string" && section.content.trim().length > 0;

        return (
          <Collapsible key={section.id} defaultOpen={section.status === "ready"}>
            <div className="border border-border bg-card rounded-lg overflow-hidden">
              <CollapsibleTrigger className="w-full flex items-center gap-3 p-4 hover:bg-accent/50 transition-colors">
                <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
                <span className="text-base font-semibold text-foreground flex-1 text-left">
                  {section.section_title || getVaultSectionTitle(section.section_key)}
                </span>
                {renderStatusBadge(section.status)}
                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
              </CollapsibleTrigger>

              <CollapsibleContent>
                <div className="px-4 pb-4 pt-0">
                  {renderCommandStatus(commandState)}

                  {!hasContent && section.status === "pending" && (
                    <p className="text-sm text-muted-foreground animate-pulse">
                      {agentName} is researching this...
                    </p>
                  )}

                  {!hasContent && section.status === "populating" && (
                    <div className="flex items-center gap-2 text-sm text-amber-400">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {agentName} is writing this section...
                    </div>
                  )}

                  {!isEditing && hasContent && (
                    <div className="prose prose-invert prose-sm max-w-none text-muted-foreground prose-headings:text-foreground prose-strong:text-foreground prose-li:text-muted-foreground prose-p:text-muted-foreground prose-a:text-primary">
                      <ReactMarkdown>{section.content ?? ""}</ReactMarkdown>
                    </div>
                  )}

                  {!isEditing && !hasContent && section.status === "ready" && (
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      No content yet.
                    </p>
                  )}

                  {!isEditing && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(section)}
                        disabled={!canEdit || saving}
                      >
                        <Pencil className="h-3.5 w-3.5 mr-1.5" />
                        Edit
                      </Button>
                      {section.status === "ready" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRefresh(section)}
                          disabled={!canRefresh}
                        >
                          {(isDispatching || isCommandBusy) ? (
                            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                          ) : (
                            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                          )}
                          Refresh with Chief
                        </Button>
                      )}
                    </div>
                  )}

                  {isEditing && (
                    <div className="space-y-3">
                      <Textarea
                        value={editContent}
                        onChange={(event) => setEditContent(event.target.value)}
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

                  {section.status === "populating" && !commandState && hasContent && (
                    <div className="mt-4 flex items-start gap-2 rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-200">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <p>
                        {agentName} is updating this section. The latest published content stays visible until the next
                        ready write lands.
                      </p>
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

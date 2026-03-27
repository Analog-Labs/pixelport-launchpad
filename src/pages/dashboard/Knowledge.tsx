import { useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Loader2,
  Pencil,
  RefreshCw,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useKnowledgeMirror, KnowledgeConflictError } from '@/hooks/useKnowledgeMirror';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { KnowledgeFileKey } from '@/lib/knowledge-mirror';
import { cn } from '@/lib/utils';

function asErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return fallback;
}

function formatDateTime(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toLocaleString();
}

export default function Knowledge() {
  const {
    tenantLoading,
    mirror,
    sections,
    syncSummary,
    statusQuery,
    saveSection,
    retrySync,
    retryMutation,
    refresh,
  } = useKnowledgeMirror();
  const [editingKey, setEditingKey] = useState<KnowledgeFileKey | null>(null);
  const [draftContent, setDraftContent] = useState('');
  const [savingKey, setSavingKey] = useState<KnowledgeFileKey | null>(null);
  const [sectionErrors, setSectionErrors] = useState<Partial<Record<KnowledgeFileKey, string>>>(
    {},
  );
  const [retryError, setRetryError] = useState<string | null>(null);

  const editingSection = useMemo(
    () => sections.find((section) => section.key === editingKey) ?? null,
    [sections, editingKey],
  );
  const isDirty = editingSection ? draftContent !== editingSection.content : false;

  const clearSectionError = (key: KnowledgeFileKey) => {
    setSectionErrors((previous) => {
      if (!(key in previous)) {
        return previous;
      }
      const next = { ...previous };
      delete next[key];
      return next;
    });
  };

  const setSectionError = (key: KnowledgeFileKey, message: string) => {
    setSectionErrors((previous) => ({
      ...previous,
      [key]: message,
    }));
  };

  const handleStartEdit = (section: { key: KnowledgeFileKey; content: string }) => {
    setEditingKey(section.key);
    setDraftContent(section.content);
    clearSectionError(section.key);
  };

  const handleCancelEdit = () => {
    setEditingKey(null);
    setDraftContent('');
  };

  const handleSave = async () => {
    if (!editingSection) {
      return;
    }

    if (!isDirty) {
      return;
    }

    setSavingKey(editingSection.key);
    clearSectionError(editingSection.key);

    try {
      await saveSection({
        fileKey: editingSection.key,
        content: draftContent,
        expectedRevision: mirror.revision,
      });
      setEditingKey(null);
      setDraftContent('');
    } catch (error) {
      if (error instanceof KnowledgeConflictError) {
        await refresh();
        setSectionError(
          editingSection.key,
          'This section changed elsewhere. We reloaded the latest version. Review and save again.',
        );
      } else {
        setSectionError(
          editingSection.key,
          asErrorMessage(error, 'Could not save this section. Please try again.'),
        );
      }
    } finally {
      setSavingKey(null);
    }
  };

  const handleRetry = async () => {
    setRetryError(null);
    try {
      await retrySync(mirror.revision);
    } catch (error) {
      if (error instanceof KnowledgeConflictError) {
        await refresh();
        setRetryError('Knowledge changed elsewhere. Latest data is loaded. Try retrying sync again.');
        return;
      }

      setRetryError(asErrorMessage(error, 'Could not retry sync. Please try again.'));
    }
  };

  const syncStatusLabel =
    syncSummary.status === 'pending'
      ? 'Sync in progress'
      : syncSummary.status === 'failed'
      ? 'Sync failed'
      : 'Synced';
  const syncTimestamp = formatDateTime(syncSummary.last_synced_at ?? syncSummary.updated_at);

  if (tenantLoading || (statusQuery.isLoading && !statusQuery.data)) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-6" data-testid="knowledge-loading">
        <div className="space-y-2">
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-4 w-80" />
        </div>
        <Skeleton className="h-24 w-full rounded-xl" />
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (statusQuery.isError && !statusQuery.data) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <h1 className="text-2xl font-satoshi font-bold text-foreground">Knowledge</h1>
        <div className="rounded-xl border border-red-500/40 bg-red-500/5 p-5">
          <p className="text-sm font-medium text-red-200">Could not load Knowledge right now.</p>
          <p className="mt-1 text-sm text-red-100/80">
            {asErrorMessage(statusQuery.error, 'Please retry in a moment.')}
          </p>
          <Button
            variant="outline"
            className="mt-4 min-h-[44px] border-red-500/40 text-red-100 hover:bg-red-500/10"
            onClick={() => {
              void statusQuery.refetch();
            }}
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <header>
        <h1 className="text-2xl font-satoshi font-bold text-foreground">Knowledge</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Edit the five core knowledge sections that shape your Chief&apos;s context.
        </p>
      </header>

      <section
        className={cn(
          'rounded-xl border p-4 sm:p-5',
          syncSummary.status === 'failed'
            ? 'border-red-500/30 bg-red-500/5'
            : syncSummary.status === 'pending'
            ? 'border-amber-500/30 bg-amber-500/5'
            : 'border-emerald-500/25 bg-emerald-500/5',
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-[220px] flex-1 space-y-1">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              {syncSummary.status === 'pending' ? (
                <Loader2 className="h-4 w-4 animate-spin text-amber-400" />
              ) : syncSummary.status === 'failed' ? (
                <AlertCircle className="h-4 w-4 text-red-300" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              )}
              <span>{syncStatusLabel}</span>
              <span className="rounded-full border border-current/30 px-2 py-0.5 text-[11px] uppercase tracking-wide">
                {syncSummary.status}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {syncSummary.status === 'pending'
                ? 'Saving is complete. Workspace sync is still running.'
                : syncSummary.status === 'failed'
                ? 'Your edits are saved, but workspace sync failed. Retry sync to push this revision.'
                : syncTimestamp
                ? `Last synced: ${syncTimestamp}`
                : 'Last synced successfully.'}
            </p>
            {syncSummary.status === 'failed' && syncSummary.last_error && (
              <p className="text-xs text-red-200/90">Error: {syncSummary.last_error}</p>
            )}
            {statusQuery.isError && statusQuery.data && (
              <p className="text-xs text-amber-200/90">
                Sync status refresh failed. Showing last known status.
              </p>
            )}
            {retryError && <p className="text-xs text-red-200/90">{retryError}</p>}
          </div>

          {syncSummary.status === 'failed' && (
            <Button
              variant="outline"
              className="min-h-[44px] border-red-500/40 text-red-100 hover:bg-red-500/10"
              onClick={() => {
                void handleRetry();
              }}
              disabled={retryMutation.isPending}
            >
              {retryMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Retry Sync
            </Button>
          )}
        </div>
      </section>

      <section className="space-y-3">
        {sections.map((section, index) => {
          const isEditing = editingKey === section.key;
          const isSaving = savingKey === section.key;
          const canStartEdit = editingKey === null || isEditing;
          const hasContent = section.content.trim().length > 0;

          return (
            <Collapsible key={section.key} defaultOpen={index === 0}>
              <div className="overflow-hidden rounded-xl border border-border bg-card">
                <CollapsibleTrigger className="group flex w-full items-center gap-3 p-4 text-left hover:bg-accent/30">
                  <span className="flex-1 text-base font-semibold text-foreground">{section.title}</span>
                  {isEditing && (
                    <span className="rounded-full border border-amber-400/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-amber-300">
                      Editing
                    </span>
                  )}
                  <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <div className="space-y-3 px-4 pb-4 pt-0">
                    {!isEditing && (
                      <>
                        {hasContent ? (
                          <div className="prose prose-invert prose-sm max-w-none text-muted-foreground prose-headings:text-foreground prose-strong:text-foreground prose-p:text-muted-foreground prose-li:text-muted-foreground prose-a:text-amber-300">
                            <ReactMarkdown>{section.content}</ReactMarkdown>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            Starter content is ready for this section. Open edit mode to fill it in.
                          </p>
                        )}

                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="min-h-[44px] sm:min-h-0"
                            onClick={() => handleStartEdit(section)}
                            disabled={!canStartEdit || retryMutation.isPending}
                          >
                            <Pencil className="mr-1.5 h-3.5 w-3.5" />
                            Edit
                          </Button>
                        </div>
                      </>
                    )}

                    {isEditing && (
                      <div className="space-y-3">
                        <Textarea
                          value={draftContent}
                          onChange={(event) => {
                            setDraftContent(event.target.value);
                            clearSectionError(section.key);
                          }}
                          className="min-h-[220px] resize-y border-border bg-background text-sm"
                        />

                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            className="min-h-[44px] sm:min-h-0 bg-amber-500 text-zinc-950 hover:bg-amber-400"
                            onClick={() => {
                              void handleSave();
                            }}
                            disabled={!isDirty || isSaving}
                          >
                            {isSaving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                            Save
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="min-h-[44px] sm:min-h-0"
                            onClick={handleCancelEdit}
                            disabled={isSaving}
                          >
                            Cancel
                          </Button>
                        </div>

                        {sectionErrors[section.key] && (
                          <p className="text-sm text-red-300">{sectionErrors[section.key]}</p>
                        )}
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          );
        })}
      </section>
    </div>
  );
}

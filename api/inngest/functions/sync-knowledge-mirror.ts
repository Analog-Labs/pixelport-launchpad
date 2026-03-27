import { createClient } from '@supabase/supabase-js';
import { Inngest } from 'inngest';
import { sshExec } from '../../lib/droplet-ssh';
import {
  KNOWLEDGE_SYNC_REQUESTED_EVENT,
  KNOWLEDGE_WORKSPACE_HOST_DIR,
  markKnowledgeMirrorSyncFailed,
  markKnowledgeMirrorSynced,
  normalizeKnowledgeMirror,
  withKnowledgeMirror,
  type KnowledgeMirrorFiles,
  type KnowledgeMirrorState,
} from '../../lib/knowledge-mirror';
import { isTenantProvisioningComplete } from '../../lib/tenant-status';
import { WORKSPACE_KNOWLEDGE_FILES } from '../../lib/workspace-contract';

const inngest = new Inngest({
  id: 'pixelport',
  eventKey: process.env.INNGEST_EVENT_KEY,
});

const SUPABASE_PROJECT_URL = process.env.SUPABASE_PROJECT_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

type JsonRecord = Record<string, unknown>;

type EventData = {
  tenantId?: string;
  revision?: number;
};

type TenantRow = {
  id: string;
  name: string;
  status: string;
  droplet_ip: string | null;
  onboarding_data: JsonRecord | null;
};

function isRecord(value: unknown): value is JsonRecord {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function normalizeFileName(relativePath: string): string {
  return relativePath.replace(/^knowledge\//, '');
}

function getSupabaseClient() {
  if (!SUPABASE_PROJECT_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing SUPABASE_PROJECT_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  return createClient(SUPABASE_PROJECT_URL, SUPABASE_SERVICE_ROLE_KEY);
}

export function buildAtomicKnowledgeSyncScript(params: {
  files: KnowledgeMirrorFiles;
  revision: number;
}): string {
  const lines: string[] = [
    'set -euo pipefail',
    `KNOWLEDGE_DIR='${KNOWLEDGE_WORKSPACE_HOST_DIR}'`,
    '# Host path mounted into the OpenClaw container as /home/node/.openclaw/workspace-main',
    'mkdir -p "$KNOWLEDGE_DIR"',
  ];

  let index = 0;
  for (const relativePath of WORKSPACE_KNOWLEDGE_FILES) {
    const fileName = normalizeFileName(relativePath);
    const encoded = Buffer.from(params.files[relativePath], 'utf8').toString('base64');
    const tempPath = `$KNOWLEDGE_DIR/${fileName}.tmp.r${params.revision}.${index}`;
    const finalPath = `$KNOWLEDGE_DIR/${fileName}`;
    const marker = `PIXELPORT_KNOWLEDGE_${index}`;
    lines.push(`cat << '${marker}' | base64 --decode > "${tempPath}"`);
    lines.push(encoded);
    lines.push(marker);
    lines.push(`sync -f "${tempPath}" >/dev/null 2>&1 || true`);
    lines.push(`mv "${tempPath}" "${finalPath}"`);
    index += 1;
  }

  lines.push('echo "KNOWLEDGE_SYNC_COMPLETE"');
  return lines.join('\n');
}

async function loadTenant(params: { supabase: ReturnType<typeof createClient>; tenantId: string }): Promise<TenantRow> {
  const { data, error } = await params.supabase
    .from('tenants')
    .select('id, name, status, droplet_ip, onboarding_data')
    .eq('id', params.tenantId)
    .single();

  if (error || !data) {
    throw new Error(`Tenant not found: ${params.tenantId}`);
  }

  return data as TenantRow;
}

async function persistMirror(params: {
  supabase: ReturnType<typeof createClient>;
  tenantId: string;
  onboardingData: JsonRecord;
  mirror: KnowledgeMirrorState;
}): Promise<void> {
  const nextOnboardingData = withKnowledgeMirror(params.onboardingData, params.mirror);
  const { error } = await params.supabase
    .from('tenants')
    .update({ onboarding_data: nextOnboardingData })
    .eq('id', params.tenantId);

  if (error) {
    throw new Error(`Failed to persist knowledge mirror sync state: ${error.message}`);
  }
}

export const syncKnowledgeMirror = inngest.createFunction(
  {
    id: 'sync-knowledge-mirror',
    name: 'Sync knowledge mirror files to tenant workspace',
    retries: 2,
  },
  { event: KNOWLEDGE_SYNC_REQUESTED_EVENT },
  async ({ event, step }) => {
    const { tenantId, revision } = (event.data || {}) as EventData;
    if (!tenantId || typeof revision !== 'number' || !Number.isFinite(revision)) {
      throw new Error('Missing tenantId or revision in event payload');
    }

    const supabase = getSupabaseClient();
    const tenant = await step.run('load-tenant', async () => {
      return await loadTenant({ supabase, tenantId });
    });

    const onboardingData = isRecord(tenant.onboarding_data) ? tenant.onboarding_data : {};
    const mirror = normalizeKnowledgeMirror({
      raw: onboardingData.knowledge_mirror,
      tenantName: tenant.name,
      onboardingData,
    });

    if (revision < mirror.revision) {
      return {
        success: true,
        skipped: true,
        reason: 'stale_revision',
        tenantId,
        eventRevision: revision,
        currentRevision: mirror.revision,
      };
    }

    if (revision > mirror.revision) {
      return {
        success: true,
        skipped: true,
        reason: 'future_revision',
        tenantId,
        eventRevision: revision,
        currentRevision: mirror.revision,
      };
    }

    try {
      if (!isTenantProvisioningComplete(tenant.status) || !tenant.droplet_ip) {
        throw new Error(
          `Runtime host unavailable for knowledge sync (status=${tenant.status || 'unknown'}, ` +
          `droplet_ip=${tenant.droplet_ip || 'missing'})`,
        );
      }

      const script = buildAtomicKnowledgeSyncScript({
        files: mirror.files,
        revision,
      });

      await step.run('write-knowledge-files-atomically', async () => {
        return await sshExec(tenant.droplet_ip as string, script);
      });
    } catch (error) {
      const failureReason = `Knowledge mirror sync failed for revision ${revision}: ${toErrorMessage(error)}`;

      await step.run('persist-sync-failure', async () => {
        const latest = await loadTenant({ supabase, tenantId });
        const latestOnboardingData = isRecord(latest.onboarding_data) ? latest.onboarding_data : {};
        const latestMirror = normalizeKnowledgeMirror({
          raw: latestOnboardingData.knowledge_mirror,
          tenantName: latest.name,
          onboardingData: latestOnboardingData,
        });

        if (latestMirror.revision !== revision) {
          return;
        }

        await persistMirror({
          supabase,
          tenantId,
          onboardingData: latestOnboardingData,
          mirror: markKnowledgeMirrorSyncFailed({
            mirror: latestMirror,
            error: failureReason,
          }),
        });
      });

      throw new Error(failureReason);
    }

    return await step.run('persist-sync-success', async () => {
      const latest = await loadTenant({ supabase, tenantId });
      const latestOnboardingData = isRecord(latest.onboarding_data) ? latest.onboarding_data : {};
      const latestMirror = normalizeKnowledgeMirror({
        raw: latestOnboardingData.knowledge_mirror,
        tenantName: latest.name,
        onboardingData: latestOnboardingData,
      });

      if (latestMirror.revision !== revision) {
        return {
          success: true,
          skipped: true,
          reason: 'stale_after_write',
          tenantId,
          eventRevision: revision,
          currentRevision: latestMirror.revision,
        };
      }

      const syncedMirror = markKnowledgeMirrorSynced({
        mirror: latestMirror,
        syncedRevision: revision,
      });
      await persistMirror({
        supabase,
        tenantId,
        onboardingData: latestOnboardingData,
        mirror: syncedMirror,
      });

      return {
        success: true,
        skipped: false,
        tenantId,
        revision,
      };
    });
  },
);

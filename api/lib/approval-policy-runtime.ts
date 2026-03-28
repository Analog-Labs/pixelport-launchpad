type JsonRecord = Record<string, unknown>;

export const APPROVAL_POLICY_APPLY_REQUESTED_EVENT = 'pixelport/policy.apply.requested';
export const APPROVAL_POLICY_BEGIN_MARKER = '<!-- PIXELPORT:BEGIN approval-policy -->';
export const APPROVAL_POLICY_END_MARKER = '<!-- PIXELPORT:END approval-policy -->';
export const APPROVAL_POLICY_WORKSPACE_HOST_DIR = '/opt/openclaw/workspace-main';

const APPROVAL_MODE_VALUES = ['strict', 'balanced', 'autonomous'] as const;
const APPROVAL_GUARDRAIL_KEYS = [
  'publish',
  'paid_spend',
  'outbound_messages',
  'major_strategy_changes',
] as const;
const APPROVAL_POLICY_APPLY_STATUS_VALUES = ['pending', 'applied', 'failed'] as const;
const MAX_AUDIT_ENTRIES = 25;

export type ApprovalMode = (typeof APPROVAL_MODE_VALUES)[number];
export type ApprovalGuardrailKey = (typeof APPROVAL_GUARDRAIL_KEYS)[number];
export type ApprovalPolicyApplyStatus = (typeof APPROVAL_POLICY_APPLY_STATUS_VALUES)[number];
export type ApprovalManagedTarget = 'agents' | 'tools';

export interface ApprovalPolicy {
  mode: ApprovalMode;
  guardrails: Record<ApprovalGuardrailKey, boolean>;
}

export interface ApprovalPolicyApplyState {
  status: ApprovalPolicyApplyStatus;
  last_error: string | null;
  last_applied_revision: number | null;
  last_applied_at: string | null;
  updated_at: string | null;
}

export interface ApprovalPolicyAuditEntry {
  revision: number;
  actor: string | null;
  timestamp: string;
  change_type: 'policy_update' | 'retry';
  changed_fields: string[];
  before: ApprovalPolicy;
  after: ApprovalPolicy;
  apply_outcome: ApprovalPolicyApplyStatus;
  apply_error: string | null;
}

export interface ApprovalPolicyRuntimeState {
  revision: number;
  apply: ApprovalPolicyApplyState;
  audit: ApprovalPolicyAuditEntry[];
}

export interface ApprovalPolicyApplySummary {
  status: ApprovalPolicyApplyStatus;
  revision: number;
  last_error: string | null;
  last_applied_revision: number | null;
  last_applied_at: string | null;
  updated_at: string | null;
}

export const DEFAULT_APPROVAL_POLICY: ApprovalPolicy = {
  mode: 'balanced',
  guardrails: {
    publish: true,
    paid_spend: true,
    outbound_messages: true,
    major_strategy_changes: true,
  },
};

function isRecord(value: unknown): value is JsonRecord {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function readPositiveInt(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  const normalized = Math.trunc(value);
  return normalized >= 1 ? normalized : null;
}

function readTimestamp(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeMode(value: unknown): ApprovalMode | null {
  const normalized = readString(value).toLowerCase();
  return APPROVAL_MODE_VALUES.includes(normalized as ApprovalMode)
    ? (normalized as ApprovalMode)
    : null;
}

function normalizeApplyStatus(value: unknown): ApprovalPolicyApplyStatus | null {
  const normalized = readString(value).toLowerCase();
  return APPROVAL_POLICY_APPLY_STATUS_VALUES.includes(normalized as ApprovalPolicyApplyStatus)
    ? (normalized as ApprovalPolicyApplyStatus)
    : null;
}

function readGuardrail(raw: JsonRecord, key: ApprovalGuardrailKey, fallback: boolean): boolean {
  return typeof raw[key] === 'boolean' ? (raw[key] as boolean) : fallback;
}

function cloneApprovalPolicy(policy: ApprovalPolicy): ApprovalPolicy {
  return {
    mode: policy.mode,
    guardrails: {
      publish: policy.guardrails.publish,
      paid_spend: policy.guardrails.paid_spend,
      outbound_messages: policy.guardrails.outbound_messages,
      major_strategy_changes: policy.guardrails.major_strategy_changes,
    },
  };
}

function parseApprovalPolicy(value: unknown): ApprovalPolicy | null {
  if (!isRecord(value)) {
    return null;
  }

  const mode = normalizeMode(value.mode);
  if (!mode) {
    return null;
  }

  const rawGuardrails = isRecord(value.guardrails) ? value.guardrails : {};
  return {
    mode,
    guardrails: {
      publish: readGuardrail(rawGuardrails, 'publish', DEFAULT_APPROVAL_POLICY.guardrails.publish),
      paid_spend: readGuardrail(rawGuardrails, 'paid_spend', DEFAULT_APPROVAL_POLICY.guardrails.paid_spend),
      outbound_messages: readGuardrail(
        rawGuardrails,
        'outbound_messages',
        DEFAULT_APPROVAL_POLICY.guardrails.outbound_messages,
      ),
      major_strategy_changes: readGuardrail(
        rawGuardrails,
        'major_strategy_changes',
        DEFAULT_APPROVAL_POLICY.guardrails.major_strategy_changes,
      ),
    },
  };
}

function normalizeAuditEntry(value: unknown): ApprovalPolicyAuditEntry | null {
  if (!isRecord(value)) {
    return null;
  }

  const revision = readPositiveInt(value.revision);
  if (!revision) {
    return null;
  }

  const before = parseApprovalPolicy(value.before) ?? cloneApprovalPolicy(DEFAULT_APPROVAL_POLICY);
  const after = parseApprovalPolicy(value.after) ?? cloneApprovalPolicy(DEFAULT_APPROVAL_POLICY);
  const rawChangedFields = Array.isArray(value.changed_fields)
    ? value.changed_fields.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
  const applyOutcome = normalizeApplyStatus(value.apply_outcome) ?? 'pending';
  const changeType = readString(value.change_type) === 'retry' ? 'retry' : 'policy_update';

  return {
    revision,
    actor: readString(value.actor) || null,
    timestamp: readTimestamp(value.timestamp) ?? new Date().toISOString(),
    change_type: changeType,
    changed_fields: rawChangedFields,
    before,
    after,
    apply_outcome: applyOutcome,
    apply_error: readTimestamp(value.apply_error),
  };
}

function toModeLabel(mode: ApprovalMode): string {
  if (mode === 'strict') {
    return 'Strict';
  }
  if (mode === 'autonomous') {
    return 'Autonomous';
  }
  return 'Balanced';
}

function toGuardrailLabel(key: ApprovalGuardrailKey): string {
  if (key === 'publish') {
    return 'Publishing content';
  }
  if (key === 'paid_spend') {
    return 'Paid spend changes';
  }
  if (key === 'outbound_messages') {
    return 'Outbound messages';
  }
  return 'Major strategy changes';
}

function toGuardrailState(value: boolean): string {
  return value ? 'approval required' : 'no approval required';
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function getDefaultApprovalPolicy(): ApprovalPolicy {
  return cloneApprovalPolicy(DEFAULT_APPROVAL_POLICY);
}

export function readApprovalPolicyFromOnboardingData(onboardingData: unknown): ApprovalPolicy {
  if (!isRecord(onboardingData)) {
    return cloneApprovalPolicy(DEFAULT_APPROVAL_POLICY);
  }

  const nestedTask =
    isRecord(onboardingData.v2) && isRecord(onboardingData.v2.task)
      ? onboardingData.v2.task
      : null;

  const candidates: unknown[] = [onboardingData.approval_policy, nestedTask?.approval_policy];
  for (const candidate of candidates) {
    const parsed = parseApprovalPolicy(candidate);
    if (parsed) {
      return parsed;
    }
  }

  return cloneApprovalPolicy(DEFAULT_APPROVAL_POLICY);
}

export function approvalPoliciesEqual(left: ApprovalPolicy, right: ApprovalPolicy): boolean {
  if (left.mode !== right.mode) {
    return false;
  }

  return APPROVAL_GUARDRAIL_KEYS.every((key) => left.guardrails[key] === right.guardrails[key]);
}

export function summarizeApprovalPolicyChanges(params: {
  before: ApprovalPolicy;
  after: ApprovalPolicy;
}): string[] {
  const changed: string[] = [];

  if (params.before.mode !== params.after.mode) {
    changed.push('mode');
  }

  for (const key of APPROVAL_GUARDRAIL_KEYS) {
    if (params.before.guardrails[key] !== params.after.guardrails[key]) {
      changed.push(`guardrails.${key}`);
    }
  }

  return changed;
}

export function normalizeApprovalPolicyRuntimeState(params: {
  raw: unknown;
  now?: string;
}): ApprovalPolicyRuntimeState {
  const nowIso = params.now ?? new Date().toISOString();
  const rawRuntime = isRecord(params.raw) ? params.raw : {};
  const rawApply = isRecord(rawRuntime.apply) ? rawRuntime.apply : {};
  const rawAudit = Array.isArray(rawRuntime.audit) ? rawRuntime.audit : [];

  const revision = readPositiveInt(rawRuntime.revision) ?? 1;
  const lastAppliedRevision = readPositiveInt(rawApply.last_applied_revision);
  let status = normalizeApplyStatus(rawApply.status) ?? 'pending';

  if (status === 'applied' && lastAppliedRevision !== revision) {
    status = 'pending';
  }

  const auditEntries = rawAudit
    .map((entry) => normalizeAuditEntry(entry))
    .filter((entry): entry is ApprovalPolicyAuditEntry => !!entry)
    .slice(-MAX_AUDIT_ENTRIES);

  return {
    revision,
    apply: {
      status,
      last_error: readTimestamp(rawApply.last_error),
      last_applied_revision: lastAppliedRevision,
      last_applied_at: readTimestamp(rawApply.last_applied_at),
      updated_at: readTimestamp(rawApply.updated_at) ?? nowIso,
    },
    audit: auditEntries,
  };
}

export function markApprovalPolicyPending(params: {
  runtime: ApprovalPolicyRuntimeState;
  revision?: number;
  clearError?: boolean;
  now?: string;
}): ApprovalPolicyRuntimeState {
  const nowIso = params.now ?? new Date().toISOString();
  const revision = params.revision ?? params.runtime.revision;

  return {
    ...params.runtime,
    revision,
    apply: {
      ...params.runtime.apply,
      status: 'pending',
      last_error: params.clearError ? null : params.runtime.apply.last_error,
      updated_at: nowIso,
    },
  };
}

export function markApprovalPolicyApplied(params: {
  runtime: ApprovalPolicyRuntimeState;
  appliedRevision?: number;
  now?: string;
}): ApprovalPolicyRuntimeState {
  const nowIso = params.now ?? new Date().toISOString();
  const appliedRevision = params.appliedRevision ?? params.runtime.revision;

  return {
    ...params.runtime,
    apply: {
      ...params.runtime.apply,
      status: 'applied',
      last_error: null,
      last_applied_revision: appliedRevision,
      last_applied_at: nowIso,
      updated_at: nowIso,
    },
  };
}

export function markApprovalPolicyApplyFailed(params: {
  runtime: ApprovalPolicyRuntimeState;
  error: string;
  now?: string;
}): ApprovalPolicyRuntimeState {
  const nowIso = params.now ?? new Date().toISOString();

  return {
    ...params.runtime,
    apply: {
      ...params.runtime.apply,
      status: 'failed',
      last_error: params.error,
      updated_at: nowIso,
    },
  };
}

export function appendApprovalPolicyAuditEntry(params: {
  runtime: ApprovalPolicyRuntimeState;
  entry: ApprovalPolicyAuditEntry;
  maxEntries?: number;
}): ApprovalPolicyRuntimeState {
  const maxEntries = Math.max(1, params.maxEntries ?? MAX_AUDIT_ENTRIES);
  return {
    ...params.runtime,
    audit: [...params.runtime.audit, params.entry].slice(-maxEntries),
  };
}

export function setLatestApprovalPolicyAuditOutcome(params: {
  runtime: ApprovalPolicyRuntimeState;
  outcome: ApprovalPolicyApplyStatus;
  error?: string | null;
}): ApprovalPolicyRuntimeState {
  if (params.runtime.audit.length === 0) {
    return params.runtime;
  }

  const latest = params.runtime.audit[params.runtime.audit.length - 1];
  const updated: ApprovalPolicyAuditEntry = {
    ...latest,
    apply_outcome: params.outcome,
    apply_error: params.error ?? null,
  };

  return {
    ...params.runtime,
    audit: [...params.runtime.audit.slice(0, -1), updated],
  };
}

export function createApprovalPolicyAuditEntry(params: {
  revision: number;
  actor: string | null;
  timestamp?: string;
  changeType: 'policy_update' | 'retry';
  before: ApprovalPolicy;
  after: ApprovalPolicy;
  changedFields: string[];
  applyOutcome: ApprovalPolicyApplyStatus;
  applyError?: string | null;
}): ApprovalPolicyAuditEntry {
  return {
    revision: params.revision,
    actor: params.actor,
    timestamp: params.timestamp ?? new Date().toISOString(),
    change_type: params.changeType,
    changed_fields: [...params.changedFields],
    before: cloneApprovalPolicy(params.before),
    after: cloneApprovalPolicy(params.after),
    apply_outcome: params.applyOutcome,
    apply_error: params.applyError ?? null,
  };
}

export function withApprovalPolicyRuntime(
  onboardingData: JsonRecord,
  runtime: ApprovalPolicyRuntimeState,
): JsonRecord {
  return {
    ...onboardingData,
    approval_policy_runtime: runtime as unknown as JsonRecord,
  };
}

export function readApprovalPolicyRevision(onboardingData: unknown): number {
  if (!isRecord(onboardingData)) {
    return 1;
  }

  const runtime = normalizeApprovalPolicyRuntimeState({ raw: onboardingData.approval_policy_runtime });
  return runtime.revision;
}

export function projectApprovalPolicyApplySummary(onboardingData: unknown): ApprovalPolicyApplySummary | null {
  if (!isRecord(onboardingData)) {
    return null;
  }

  if (!isRecord(onboardingData.approval_policy_runtime)) {
    return null;
  }

  const runtime = normalizeApprovalPolicyRuntimeState({ raw: onboardingData.approval_policy_runtime });
  return {
    status: runtime.apply.status,
    revision: runtime.revision,
    last_error: runtime.apply.last_error,
    last_applied_revision: runtime.apply.last_applied_revision,
    last_applied_at: runtime.apply.last_applied_at,
    updated_at: runtime.apply.updated_at,
  };
}

export function renderApprovalPolicyManagedBody(params: {
  policy: ApprovalPolicy;
  target: ApprovalManagedTarget;
}): string {
  const lines = [
    '## PixelPort Approval Policy (Managed)',
    '',
    `Current mode: **${toModeLabel(params.policy.mode)}**`,
    '',
    'Guardrails:',
  ];

  for (const key of APPROVAL_GUARDRAIL_KEYS) {
    lines.push(`- ${toGuardrailLabel(key)}: ${toGuardrailState(params.policy.guardrails[key])}`);
  }

  lines.push('');
  lines.push('This section is managed by PixelPort Governance settings.');
  if (params.target === 'agents') {
    lines.push('If a guardrail requires approval, request approval before executing that action.');
  } else {
    lines.push('Tool actions that match an approval-required guardrail must be escalated before execution.');
  }

  return `${lines.join('\n')}\n`;
}

export function renderApprovalPolicyManagedSection(params: {
  policy: ApprovalPolicy;
  target: ApprovalManagedTarget;
}): string {
  const body = renderApprovalPolicyManagedBody(params).trimEnd();
  return `${APPROVAL_POLICY_BEGIN_MARKER}\n${body}\n${APPROVAL_POLICY_END_MARKER}`;
}

export function upsertApprovalPolicyManagedSection(params: {
  fileContent: string;
  policy: ApprovalPolicy;
  target: ApprovalManagedTarget;
}): string {
  const section = renderApprovalPolicyManagedSection({
    policy: params.policy,
    target: params.target,
  });
  const hasBegin = params.fileContent.includes(APPROVAL_POLICY_BEGIN_MARKER);
  const hasEnd = params.fileContent.includes(APPROVAL_POLICY_END_MARKER);

  if (hasBegin && hasEnd) {
    const pattern = new RegExp(
      `${escapeRegExp(APPROVAL_POLICY_BEGIN_MARKER)}[\\s\\S]*?${escapeRegExp(APPROVAL_POLICY_END_MARKER)}`,
      'm',
    );
    return params.fileContent.replace(pattern, section).replace(/\s*$/, '\n');
  }

  const trimmed = params.fileContent.trimEnd();
  return `${trimmed}\n\n${section}\n`;
}

export function buildAtomicApprovalPolicyApplyScript(params: {
  policy: ApprovalPolicy;
  revision: number;
}): string {
  const agentsBodyBase64 = Buffer.from(
    renderApprovalPolicyManagedBody({ policy: params.policy, target: 'agents' }),
    'utf8',
  ).toString('base64');
  const toolsBodyBase64 = Buffer.from(
    renderApprovalPolicyManagedBody({ policy: params.policy, target: 'tools' }),
    'utf8',
  ).toString('base64');

  const lines = [
    'set -euo pipefail',
    `WORKSPACE_DIR='${APPROVAL_POLICY_WORKSPACE_HOST_DIR}'`,
    `BEGIN_MARKER='${APPROVAL_POLICY_BEGIN_MARKER}'`,
    `END_MARKER='${APPROVAL_POLICY_END_MARKER}'`,
    'AGENTS_FILE="$WORKSPACE_DIR/AGENTS.md"',
    'TOOLS_FILE="$WORKSPACE_DIR/TOOLS.md"',
    '',
    'for required_file in "$AGENTS_FILE" "$TOOLS_FILE"; do',
    '  if [ ! -f "$required_file" ]; then',
    '    echo "approval-policy apply failed: missing file $required_file" >&2',
    '    exit 41',
    '  fi',
    'done',
    '',
    'update_managed_block() {',
    '  local source_file="$1"',
    '  local temp_file="$2"',
    '  local content_file="$3"',
    '  local begin_count=0',
    '  local end_count=0',
    '  local in_block=0',
    '',
    '  : > "$temp_file"',
    '  while IFS= read -r line || [ -n "$line" ]; do',
    '    if [ "$line" = "$BEGIN_MARKER" ]; then',
    '      begin_count=$((begin_count + 1))',
    '      if [ "$begin_count" -gt 1 ]; then',
    '        echo "approval-policy apply failed: duplicate begin marker in $source_file" >&2',
    '        return 42',
    '      fi',
    '      if [ "$in_block" -ne 0 ]; then',
    '        echo "approval-policy apply failed: nested begin marker in $source_file" >&2',
    '        return 43',
    '      fi',
    '      in_block=1',
    '      printf "%s\\n" "$line" >> "$temp_file"',
    '      cat "$content_file" >> "$temp_file"',
    '      continue',
    '    fi',
    '',
    '    if [ "$line" = "$END_MARKER" ]; then',
    '      end_count=$((end_count + 1))',
    '      if [ "$end_count" -gt 1 ]; then',
    '        echo "approval-policy apply failed: duplicate end marker in $source_file" >&2',
    '        return 44',
    '      fi',
    '      if [ "$in_block" -ne 1 ]; then',
    '        echo "approval-policy apply failed: end marker before begin marker in $source_file" >&2',
    '        return 45',
    '      fi',
    '      in_block=0',
    '      printf "%s\\n" "$line" >> "$temp_file"',
    '      continue',
    '    fi',
    '',
    '    if [ "$in_block" -eq 0 ]; then',
    '      printf "%s\\n" "$line" >> "$temp_file"',
    '    fi',
    '  done < "$source_file"',
    '',
    '  if [ "$begin_count" -ne 1 ] || [ "$end_count" -ne 1 ] || [ "$in_block" -ne 0 ]; then',
    '    echo "approval-policy apply failed: managed markers missing or malformed in $source_file" >&2',
    '    return 46',
    '  fi',
    '}',
    '',
    `tmp_root="$(mktemp -d \"$WORKSPACE_DIR/.policy-apply-r${params.revision}.XXXXXX\")"`,
    'trap "rm -rf \"$tmp_root\"" EXIT',
    '',
    'agents_content="$tmp_root/agents.content"',
    'tools_content="$tmp_root/tools.content"',
    "cat << 'PIXELPORT_POLICY_AGENTS' | base64 --decode > \"$agents_content\"",
    agentsBodyBase64,
    'PIXELPORT_POLICY_AGENTS',
    "cat << 'PIXELPORT_POLICY_TOOLS' | base64 --decode > \"$tools_content\"",
    toolsBodyBase64,
    'PIXELPORT_POLICY_TOOLS',
    '',
    'tmp_agents="$tmp_root/AGENTS.md.next"',
    'tmp_tools="$tmp_root/TOOLS.md.next"',
    'update_managed_block "$AGENTS_FILE" "$tmp_agents" "$agents_content"',
    'update_managed_block "$TOOLS_FILE" "$tmp_tools" "$tools_content"',
    '',
    'backup_agents="$tmp_root/AGENTS.md.bak"',
    'backup_tools="$tmp_root/TOOLS.md.bak"',
    'cp "$AGENTS_FILE" "$backup_agents"',
    'cp "$TOOLS_FILE" "$backup_tools"',
    '',
    'rollback_needed=1',
    'rollback() {',
    '  if [ "$rollback_needed" -ne 1 ]; then',
    '    return 0',
    '  fi',
    '  if [ -f "$backup_agents" ]; then',
    '    mv "$backup_agents" "$AGENTS_FILE"',
    '  fi',
    '  if [ -f "$backup_tools" ]; then',
    '    mv "$backup_tools" "$TOOLS_FILE"',
    '  fi',
    '}',
    'trap "rollback" ERR',
    '',
    'mv "$tmp_agents" "$AGENTS_FILE"',
    'mv "$tmp_tools" "$TOOLS_FILE"',
    'rollback_needed=0',
    'rm -f "$backup_agents" "$backup_tools"',
    'trap - ERR',
    '',
    'echo "POLICY_APPLY_COMPLETE"',
  ];

  return lines.join('\n');
}

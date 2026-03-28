import { beforeEach, describe, expect, it, vi } from "vitest";

const sshExec = vi.fn();
const createClientMock = vi.fn();

vi.mock("../../api/lib/droplet-ssh", () => ({
  sshExec: (...args: unknown[]) => sshExec(...args),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: (...args: unknown[]) => createClientMock(...args),
}));

vi.mock("inngest", () => ({
  Inngest: class {
    createFunction(_config: unknown, _trigger: unknown, handler: unknown) {
      return handler;
    }
  },
}));

type TenantState = {
  id: string;
  name: string;
  status: string;
  droplet_ip: string | null;
  onboarding_data: Record<string, unknown>;
};

function createSupabaseStub(tenantState: TenantState) {
  const updatePayloads: Array<Record<string, unknown>> = [];

  const from = vi.fn((_table: string) => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn(async () => ({
          data: {
            id: tenantState.id,
            name: tenantState.name,
            status: tenantState.status,
            droplet_ip: tenantState.droplet_ip,
            onboarding_data: tenantState.onboarding_data,
          },
          error: null,
        })),
      })),
    })),
    update: vi.fn((payload: Record<string, unknown>) => ({
      eq: vi.fn(async () => {
        updatePayloads.push(payload);
        if (payload.onboarding_data && typeof payload.onboarding_data === "object") {
          tenantState.onboarding_data = payload.onboarding_data as Record<string, unknown>;
        }
        return { error: null };
      }),
    })),
  }));

  return {
    client: {
      from,
    },
    updatePayloads,
  };
}

describe("approval policy apply worker", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.SUPABASE_PROJECT_URL = "https://supabase.test";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
    process.env.INNGEST_EVENT_KEY = "inngest-key";
  });

  it("builds fail-closed atomic apply script for AGENTS.md and TOOLS.md", async () => {
    const { buildAtomicApprovalPolicyApplyScript } = await import(
      "../../api/lib/approval-policy-runtime"
    );

    const script = buildAtomicApprovalPolicyApplyScript({
      revision: 5,
      policy: {
        mode: "strict",
        guardrails: {
          publish: true,
          paid_spend: true,
          outbound_messages: true,
          major_strategy_changes: true,
        },
      },
    });

    expect(script).toContain("WORKSPACE_DIR='/opt/openclaw/workspace-main'");
    expect(script).toContain('AGENTS_FILE="$WORKSPACE_DIR/AGENTS.md"');
    expect(script).toContain('TOOLS_FILE="$WORKSPACE_DIR/TOOLS.md"');
    expect(script).toContain("PIXELPORT:BEGIN approval-policy");
    expect(script).toContain("managed markers missing or malformed");
    expect(script).toContain('cp "$AGENTS_FILE" "$backup_agents"');
    expect(script).toContain('cp "$TOOLS_FILE" "$backup_tools"');
    expect(script).toContain('mv "$tmp_agents" "$AGENTS_FILE"');
    expect(script).toContain('mv "$tmp_tools" "$TOOLS_FILE"');
    expect(script).toContain("POLICY_APPLY_COMPLETE");
  });

  it("skips stale revisions without patching runtime or mutating onboarding data", async () => {
    const tenantState: TenantState = {
      id: "tenant-policy-stale",
      name: "Acme",
      status: "active",
      droplet_ip: "127.0.0.1",
      onboarding_data: {
        approval_policy: {
          mode: "balanced",
          guardrails: {
            publish: true,
            paid_spend: true,
            outbound_messages: true,
            major_strategy_changes: true,
          },
        },
        approval_policy_runtime: {
          revision: 3,
          apply: {
            status: "pending",
            last_applied_revision: 2,
          },
        },
      },
    };
    const supabaseStub = createSupabaseStub(tenantState);
    createClientMock.mockReturnValue(supabaseStub.client);
    sshExec.mockResolvedValue("ok");

    const { applyApprovalPolicy } = await import(
      "../../api/inngest/functions/apply-approval-policy"
    );

    const step = {
      run: async (_name: string, fn: () => Promise<unknown>) => await fn(),
    };

    const result = await applyApprovalPolicy({
      event: { data: { tenantId: tenantState.id, revision: 2 } },
      step,
    } as never);

    expect(result).toMatchObject({
      success: true,
      skipped: true,
      reason: "stale_revision",
      currentRevision: 3,
    });
    expect(sshExec).not.toHaveBeenCalled();
    expect(supabaseStub.updatePayloads).toHaveLength(0);
  });

  it("fails closed and persists failed status when markers are missing", async () => {
    const tenantState: TenantState = {
      id: "tenant-policy-failure",
      name: "Acme",
      status: "active",
      droplet_ip: "142.93.117.18",
      onboarding_data: {
        approval_policy: {
          mode: "strict",
          guardrails: {
            publish: true,
            paid_spend: true,
            outbound_messages: true,
            major_strategy_changes: true,
          },
        },
        approval_policy_runtime: {
          revision: 2,
          apply: {
            status: "pending",
            last_applied_revision: 1,
          },
          audit: [
            {
              revision: 2,
              actor: "user-1",
              timestamp: "2026-03-27T20:00:00.000Z",
              change_type: "policy_update",
              changed_fields: ["mode"],
              before: {
                mode: "balanced",
                guardrails: {
                  publish: true,
                  paid_spend: true,
                  outbound_messages: true,
                  major_strategy_changes: true,
                },
              },
              after: {
                mode: "strict",
                guardrails: {
                  publish: true,
                  paid_spend: true,
                  outbound_messages: true,
                  major_strategy_changes: true,
                },
              },
              apply_outcome: "pending",
              apply_error: null,
            },
          ],
        },
      },
    };
    const supabaseStub = createSupabaseStub(tenantState);
    createClientMock.mockReturnValue(supabaseStub.client);
    sshExec.mockRejectedValue(
      new Error("approval-policy apply failed: managed markers missing or malformed in AGENTS.md"),
    );

    const { applyApprovalPolicy } = await import(
      "../../api/inngest/functions/apply-approval-policy"
    );

    const step = {
      run: async (_name: string, fn: () => Promise<unknown>) => await fn(),
    };

    await expect(
      applyApprovalPolicy({
        event: { data: { tenantId: tenantState.id, revision: 2 } },
        step,
      } as never),
    ).rejects.toThrow("Approval policy apply failed for revision 2");

    const runtime = tenantState.onboarding_data.approval_policy_runtime as Record<string, unknown>;
    const apply = runtime.apply as Record<string, unknown>;
    expect(apply.status).toBe("failed");
    expect(String(apply.last_error)).toContain("managed markers missing");

    const audit = runtime.audit as Array<Record<string, unknown>>;
    expect(audit[0].apply_outcome).toBe("failed");
    expect(String(audit[0].apply_error)).toContain("managed markers missing");
  });
});

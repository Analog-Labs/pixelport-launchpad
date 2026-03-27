import { beforeEach, describe, expect, it, vi } from "vitest";
import { WORKSPACE_KNOWLEDGE_FILES } from "../../api/lib/workspace-contract";

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
        if (typeof payload.status === "string") {
          tenantState.status = payload.status;
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

describe("knowledge sync worker", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.SUPABASE_PROJECT_URL = "https://supabase.test";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
    process.env.INNGEST_EVENT_KEY = "inngest-key";
  });

  it("builds atomic host-path write script for knowledge files", async () => {
    const { buildAtomicKnowledgeSyncScript } = await import(
      "../../api/inngest/functions/sync-knowledge-mirror"
    );

    const script = buildAtomicKnowledgeSyncScript({
      revision: 5,
      files: {
        "knowledge/company-overview.md": "A",
        "knowledge/products-and-offers.md": "B",
        "knowledge/audience-and-icp.md": "C",
        "knowledge/brand-voice.md": "D",
        "knowledge/competitors.md": "E",
      },
    });

    expect(script).toContain("KNOWLEDGE_DIR='/opt/openclaw/workspace-main/knowledge'");
    expect(script).toContain("workspace-main");
    expect(script).toContain(".tmp.r5.0");
    expect(script).toContain('mv "$KNOWLEDGE_DIR/company-overview.md.tmp.r5.0" "$KNOWLEDGE_DIR/company-overview.md"');
    expect(script).toContain("base64 --decode");
    for (const relativePath of WORKSPACE_KNOWLEDGE_FILES) {
      const name = relativePath.replace("knowledge/", "");
      expect(script).toContain(`"$KNOWLEDGE_DIR/${name}.tmp.r5`);
      expect(script).toContain(`"$KNOWLEDGE_DIR/${name}"`);
    }
  });

  it("skips stale revisions without writing to runtime or mutating onboarding data", async () => {
    const tenantState: TenantState = {
      id: "tenant-stale",
      name: "Acme",
      status: "active",
      droplet_ip: "127.0.0.1",
      onboarding_data: {
        company_name: "Acme",
        knowledge_mirror: {
          revision: 3,
          files: {
            "knowledge/company-overview.md": "r3",
          },
          sync: {
            status: "pending",
            synced_revision: 2,
            seeded_revision: 2,
          },
        },
      },
    };
    const supabaseStub = createSupabaseStub(tenantState);
    createClientMock.mockReturnValue(supabaseStub.client);
    sshExec.mockResolvedValue("ok");

    const { syncKnowledgeMirror } = await import(
      "../../api/inngest/functions/sync-knowledge-mirror"
    );

    const step = {
      run: async (_name: string, fn: () => Promise<unknown>) => await fn(),
    };

    const result = await syncKnowledgeMirror({
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

  it("marks sync failed when runtime host is unreachable and preserves mirror content", async () => {
    const tenantState: TenantState = {
      id: "tenant-failure",
      name: "Acme",
      status: "active",
      droplet_ip: "142.93.117.18",
      onboarding_data: {
        company_name: "Acme",
        knowledge_mirror: {
          revision: 2,
          files: {
            "knowledge/company-overview.md": "source-of-truth",
          },
          sync: {
            status: "pending",
            synced_revision: 1,
            seeded_revision: 1,
          },
        },
      },
    };
    const supabaseStub = createSupabaseStub(tenantState);
    createClientMock.mockReturnValue(supabaseStub.client);
    sshExec.mockRejectedValue(new Error("connect ECONNREFUSED 142.93.117.18:22"));

    const { syncKnowledgeMirror } = await import(
      "../../api/inngest/functions/sync-knowledge-mirror"
    );

    const step = {
      run: async (_name: string, fn: () => Promise<unknown>) => await fn(),
    };

    await expect(
      syncKnowledgeMirror({
        event: { data: { tenantId: tenantState.id, revision: 2 } },
        step,
      } as never),
    ).rejects.toThrow("Knowledge mirror sync failed for revision 2");

    const mirror = tenantState.onboarding_data.knowledge_mirror as Record<string, unknown>;
    expect((mirror.sync as Record<string, unknown>).status).toBe("failed");
    expect(String((mirror.sync as Record<string, unknown>).last_error)).toContain("ECONNREFUSED");
    expect(((mirror.files as Record<string, unknown>)["knowledge/company-overview.md"] as string)).toBe(
      "source-of-truth",
    );
  });
});

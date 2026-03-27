import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticateRequest = vi.fn();
const errorResponse = vi.fn((res: MockResponse, error: unknown) =>
  res.status(500).json({
    error: error instanceof Error ? error.message : "Internal server error",
  })
);
const sendMock = vi.fn();

let fromMock: ReturnType<typeof vi.fn>;

vi.mock("../../api/lib/auth", () => ({
  authenticateRequest,
  errorResponse,
}));

vi.mock("../../api/lib/supabase", () => ({
  supabase: {
    from: (...args: unknown[]) => fromMock(...args),
  },
}));

vi.mock("inngest", () => ({
  Inngest: class {
    send(...args: unknown[]) {
      return sendMock(...args);
    }
  },
}));

type MockResponse = {
  statusCode: number;
  body: unknown;
  status: (code: number) => MockResponse;
  json: (payload: unknown) => MockResponse;
};

function createMockResponse(): MockResponse {
  return {
    statusCode: 200,
    body: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
}

describe("POST /api/tenants/onboarding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    fromMock = vi.fn();
  });

  it("rejects schema mismatch payloads with actionable validation errors", async () => {
    authenticateRequest.mockResolvedValue({
      tenant: {
        id: "tenant-1",
        onboarding_data: {},
      },
    });

    const { default: handler } = await import("../../api/tenants/onboarding");

    const req = {
      method: "POST",
      body: {
        mission_goals: 123,
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual(
      expect.objectContaining({
        error: expect.stringContaining("mission_goals"),
      })
    );
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("safe-merges partial updates and preserves system-managed onboarding metadata", async () => {
    authenticateRequest.mockResolvedValue({
      tenant: {
        id: "tenant-1",
        onboarding_data: {
          company_name: "Acme Labs",
          bootstrap: {
            status: "accepted",
            last_error: null,
          },
          runtime_url: "https://runtime.acme.test",
          v2: {
            company: {
              name: "Acme Labs",
            },
          },
        },
      },
    });

    let updatePayload: Record<string, unknown> | null = null;
    const updateChain: Record<string, unknown> = {
      update: vi.fn((payload: Record<string, unknown>) => {
        updatePayload = payload;
        return updateChain;
      }),
      eq: vi.fn(() => updateChain),
      select: vi.fn(() => updateChain),
      maybeSingle: vi.fn(async () => ({
        data: {
          onboarding_data: (updatePayload as { onboarding_data: Record<string, unknown> }).onboarding_data,
        },
        error: null,
      })),
    };

    fromMock.mockReturnValue(updateChain);

    const { default: handler } = await import("../../api/tenants/onboarding");

    const req = {
      method: "POST",
      body: {
        goals: ["Increase qualified pipeline"],
        products_services: ["Growth advisory"],
        starter_tasks: ["Create a 14-day sprint plan"],
        approval_policy: {
          mode: "balanced",
          guardrails: {
            publish: true,
            paid_spend: false,
            outbound_messages: true,
            major_strategy_changes: true,
          },
        },
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(updatePayload).toBeTruthy();

    const onboarding = (updatePayload as { onboarding_data: Record<string, unknown> }).onboarding_data;
    expect(onboarding.bootstrap).toEqual({
      status: "accepted",
      last_error: null,
    });
    expect(onboarding.runtime_url).toBe("https://runtime.acme.test");

    expect(onboarding.schema_version).toBe(2);
    expect(onboarding.render_version).toBe(1);
    expect(onboarding.mission_goals).toBe("Increase qualified pipeline");
    expect(onboarding.company_name).toBe("Acme Labs");
    expect(onboarding.starter_tasks).toEqual(["Create a 14-day sprint plan"]);
    expect(onboarding.starter_task).toBe("Create a 14-day sprint plan");

    const v2 = onboarding.v2 as Record<string, unknown>;
    const strategy = v2.strategy as Record<string, unknown>;
    const task = v2.task as Record<string, unknown>;
    expect(strategy.mission_goals).toBe("Increase qualified pipeline");
    expect(strategy.products_services).toEqual(["Growth advisory"]);
    expect(task.starter_tasks).toEqual(["Create a 14-day sprint plan"]);
    expect((task.approval_policy as Record<string, unknown>).mode).toBe("balanced");
  });

  it("returns 409 conflict when expected revision is stale", async () => {
    authenticateRequest.mockResolvedValue({
      tenant: {
        id: "tenant-conflict-1",
        status: "active",
        droplet_ip: "127.0.0.1",
        onboarding_data: {
          knowledge_mirror: {
            revision: 4,
          },
        },
      },
    });

    const { default: handler } = await import("../../api/tenants/onboarding");
    const req = {
      method: "POST",
      body: {
        knowledge_mirror_expected_revision: 3,
        knowledge_mirror: {
          files: {
            "knowledge/company-overview.md": "# Company Overview\n\nConflicting content",
          },
        },
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual(
      expect.objectContaining({
        code: "knowledge_conflict",
        expected_revision: 3,
        current_revision: 4,
      }),
    );
    expect(fromMock).not.toHaveBeenCalled();
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("returns 409 when atomic save guard detects a concurrent update", async () => {
    authenticateRequest.mockResolvedValue({
      tenant: {
        id: "tenant-conflict-2",
        status: "active",
        droplet_ip: "127.0.0.1",
        updated_at: "2026-03-27T05:00:00.000Z",
        onboarding_data: {
          knowledge_mirror: {
            revision: 4,
          },
        },
      },
    });

    const staleUpdateChain: Record<string, unknown> = {
      update: vi.fn(() => staleUpdateChain),
      eq: vi.fn(() => staleUpdateChain),
      select: vi.fn(() => staleUpdateChain),
      maybeSingle: vi.fn(async () => ({
        data: null,
        error: null,
      })),
    };
    const latestTenantChain: Record<string, unknown> = {
      select: vi.fn(() => latestTenantChain),
      eq: vi.fn(() => latestTenantChain),
      maybeSingle: vi.fn(async () => ({
        data: {
          onboarding_data: {
            knowledge_mirror: {
              revision: 5,
            },
          },
        },
        error: null,
      })),
    };

    fromMock
      .mockReturnValueOnce(staleUpdateChain)
      .mockReturnValueOnce(latestTenantChain);

    const { default: handler } = await import("../../api/tenants/onboarding");
    const req = {
      method: "POST",
      body: {
        knowledge_mirror_expected_revision: 4,
        knowledge_mirror: {
          files: {
            "knowledge/company-overview.md": "# Company Overview\n\nConcurrent write test",
          },
        },
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual(
      expect.objectContaining({
        code: "knowledge_conflict",
        expected_revision: 4,
        current_revision: 5,
      }),
    );
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("queues knowledge sync for runtime-ready tenants when mirror files are edited", async () => {
    authenticateRequest.mockResolvedValue({
      tenant: {
        id: "tenant-knowledge-1",
        status: "active",
        droplet_ip: "127.0.0.1",
        onboarding_data: {
          company_name: "Acme Labs",
        },
      },
    });

    let updatePayload: Record<string, unknown> | null = null;
    const updateChain: Record<string, unknown> = {
      update: vi.fn((payload: Record<string, unknown>) => {
        updatePayload = payload;
        return updateChain;
      }),
      eq: vi.fn(() => updateChain),
      select: vi.fn(() => updateChain),
      maybeSingle: vi.fn(async () => ({
        data: {
          onboarding_data: (updatePayload as { onboarding_data: Record<string, unknown> }).onboarding_data,
        },
        error: null,
      })),
    };

    fromMock.mockReturnValue(updateChain);
    sendMock.mockResolvedValue(undefined);

    const { default: handler } = await import("../../api/tenants/onboarding");
    const req = {
      method: "POST",
      body: {
        knowledge_mirror: {
          files: {
            "knowledge/company-overview.md": "# Company Overview\n\nFresh runtime mirror content",
          },
        },
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(sendMock).toHaveBeenCalledWith({
      name: "pixelport/knowledge.sync.requested",
      data: {
        tenantId: "tenant-knowledge-1",
        revision: 2,
      },
    });
    expect(res.body).toEqual(
      expect.objectContaining({
        success: true,
        knowledge_sync: {
          queued: true,
          revision: 2,
        },
      }),
    );
  });

  it("queues force sync for runtime-ready tenants without requiring file edits", async () => {
    authenticateRequest.mockResolvedValue({
      tenant: {
        id: "tenant-force-sync-1",
        status: "active",
        droplet_ip: "127.0.0.1",
        onboarding_data: {
          company_name: "Acme Labs",
          knowledge_mirror: {
            revision: 6,
            files: {
              "knowledge/company-overview.md": "# Company Overview\n\nAcme Labs",
            },
            sync: {
              status: "failed",
              last_error: "Old failure",
            },
          },
        },
      },
    });

    let updatePayload: Record<string, unknown> | null = null;
    const updateChain: Record<string, unknown> = {
      update: vi.fn((payload: Record<string, unknown>) => {
        updatePayload = payload;
        return updateChain;
      }),
      eq: vi.fn(() => updateChain),
      select: vi.fn(() => updateChain),
      maybeSingle: vi.fn(async () => ({
        data: {
          onboarding_data: (updatePayload as { onboarding_data: Record<string, unknown> }).onboarding_data,
        },
        error: null,
      })),
    };

    fromMock.mockReturnValue(updateChain);
    sendMock.mockResolvedValue(undefined);

    const { default: handler } = await import("../../api/tenants/onboarding");
    const req = {
      method: "POST",
      body: {
        knowledge_mirror_expected_revision: 6,
        force_knowledge_sync: true,
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(sendMock).toHaveBeenCalledWith({
      name: "pixelport/knowledge.sync.requested",
      data: {
        tenantId: "tenant-force-sync-1",
        revision: 6,
      },
    });
    expect(res.body).toEqual(
      expect.objectContaining({
        success: true,
        knowledge_sync: {
          queued: true,
          revision: 6,
        },
      }),
    );
  });

  it("returns non-queued force sync state when runtime is not ready", async () => {
    authenticateRequest.mockResolvedValue({
      tenant: {
        id: "tenant-force-sync-2",
        status: "draft",
        droplet_ip: null,
        onboarding_data: {
          company_name: "Acme Labs",
          knowledge_mirror: {
            revision: 2,
          },
        },
      },
    });

    let updatePayload: Record<string, unknown> | null = null;
    const updateChain: Record<string, unknown> = {
      update: vi.fn((payload: Record<string, unknown>) => {
        updatePayload = payload;
        return updateChain;
      }),
      eq: vi.fn(() => updateChain),
      select: vi.fn(() => updateChain),
      maybeSingle: vi.fn(async () => ({
        data: {
          onboarding_data: (updatePayload as { onboarding_data: Record<string, unknown> }).onboarding_data,
        },
        error: null,
      })),
    };

    fromMock.mockReturnValue(updateChain);
    sendMock.mockResolvedValue(undefined);

    const { default: handler } = await import("../../api/tenants/onboarding");
    const req = {
      method: "POST",
      body: {
        force_knowledge_sync: true,
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(sendMock).not.toHaveBeenCalled();
    expect(res.body).toEqual(
      expect.objectContaining({
        success: true,
        knowledge_sync: expect.objectContaining({
          queued: false,
          reason: "runtime_not_ready",
        }),
      }),
    );
  });

  it("marks sync as failed when enqueue fails after mirror save", async () => {
    authenticateRequest.mockResolvedValue({
      tenant: {
        id: "tenant-knowledge-2",
        status: "active",
        droplet_ip: "127.0.0.1",
        onboarding_data: {
          company_name: "Acme Labs",
        },
      },
    });

    let firstPayload: Record<string, unknown> | null = null;
    const firstUpdateChain: Record<string, unknown> = {
      update: vi.fn((payload: Record<string, unknown>) => {
        firstPayload = payload;
        return firstUpdateChain;
      }),
      eq: vi.fn(() => firstUpdateChain),
      select: vi.fn(() => firstUpdateChain),
      maybeSingle: vi.fn(async () => ({
        data: {
          onboarding_data: (firstPayload as { onboarding_data: Record<string, unknown> }).onboarding_data,
        },
        error: null,
      })),
    };

    let secondPayload: Record<string, unknown> | null = null;
    const secondUpdateChain: Record<string, unknown> = {
      update: vi.fn((payload: Record<string, unknown>) => {
        secondPayload = payload;
        return secondUpdateChain;
      }),
      eq: vi.fn(() => secondUpdateChain),
      select: vi.fn(() => secondUpdateChain),
      maybeSingle: vi.fn(async () => ({
        data: {
          onboarding_data: (secondPayload as { onboarding_data: Record<string, unknown> }).onboarding_data,
        },
        error: null,
      })),
    };

    fromMock.mockReturnValueOnce(firstUpdateChain).mockReturnValueOnce(secondUpdateChain);
    sendMock.mockRejectedValue(new Error("queue unavailable"));

    const { default: handler } = await import("../../api/tenants/onboarding");
    const req = {
      method: "POST",
      body: {
        knowledge_mirror: {
          files: {
            "knowledge/brand-voice.md": "# Brand Voice\n\nCrisp and direct.",
          },
        },
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(secondPayload).toBeTruthy();
    const secondOnboarding = (secondPayload as { onboarding_data: Record<string, unknown> }).onboarding_data;
    const sync = (((secondOnboarding.knowledge_mirror as Record<string, unknown>).sync) as Record<string, unknown>);
    expect(sync.status).toBe("failed");
    expect(String(sync.last_error)).toContain("queue unavailable");
    expect(res.body).toEqual(
      expect.objectContaining({
        success: true,
        knowledge_sync: expect.objectContaining({
          queued: false,
          revision: 2,
        }),
      }),
    );
  });
});

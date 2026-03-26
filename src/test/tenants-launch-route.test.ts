import { beforeEach, describe, expect, it, vi } from "vitest";
import { TENANT_STATUS } from "@/lib/tenant-status";

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

describe("POST /api/tenants/launch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    fromMock = vi.fn();
  });

  it("returns idempotent success when tenant is already provisioning", async () => {
    authenticateRequest.mockResolvedValue({
      tenant: {
        id: "tenant-1",
        status: TENANT_STATUS.PROVISIONING,
        onboarding_data: {},
      },
    });

    const { default: handler } = await import("../../api/tenants/launch");

    const req = { method: "POST" };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      launched: true,
      status: TENANT_STATUS.PROVISIONING,
      idempotent: true,
    });
    expect(fromMock).not.toHaveBeenCalled();
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("transitions draft to provisioning once and dispatches provisioning event", async () => {
    authenticateRequest.mockResolvedValue({
      tenant: {
        id: "tenant-2",
        status: TENANT_STATUS.DRAFT,
        onboarding_data: {
          company_name: "Acme Labs",
        },
      },
    });

    let transitionUpdatePayload: Record<string, unknown> | null = null;
    const transitionChain: Record<string, unknown> = {
      update: vi.fn((payload: Record<string, unknown>) => {
        transitionUpdatePayload = payload;
        return transitionChain;
      }),
      eq: vi.fn(() => transitionChain),
      select: vi.fn(() => transitionChain),
      maybeSingle: vi.fn(async () => ({
        data: {
          id: "tenant-2",
          status: TENANT_STATUS.PROVISIONING,
          onboarding_data: (transitionUpdatePayload as { onboarding_data: Record<string, unknown> }).onboarding_data,
        },
        error: null,
      })),
    };

    fromMock.mockReturnValueOnce(transitionChain);
    sendMock.mockResolvedValue(undefined);

    const { default: handler } = await import("../../api/tenants/launch");

    const req = { method: "POST" };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(202);
    expect(res.body).toEqual({
      launched: true,
      status: TENANT_STATUS.PROVISIONING,
      idempotent: false,
    });

    expect(transitionUpdatePayload).toBeTruthy();
    expect((transitionUpdatePayload as { status: string }).status).toBe(TENANT_STATUS.PROVISIONING);

    const onboardingData = (transitionUpdatePayload as { onboarding_data: Record<string, unknown> }).onboarding_data;
    expect(typeof onboardingData.launch_started_at).toBe("string");
    expect(onboardingData.schema_version).toBe(2);
    expect(onboardingData.render_version).toBe(1);

    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock).toHaveBeenCalledWith({
      name: "pixelport/tenant.created",
      data: {
        tenantId: "tenant-2",
        trialMode: true,
      },
    });
  });

  it("rolls status back to draft when event dispatch fails", async () => {
    authenticateRequest.mockResolvedValue({
      tenant: {
        id: "tenant-3",
        status: TENANT_STATUS.DRAFT,
        onboarding_data: {
          company_name: "Acme Labs",
        },
      },
    });

    let transitionUpdatePayload: Record<string, unknown> | null = null;
    const transitionChain: Record<string, unknown> = {
      update: vi.fn((payload: Record<string, unknown>) => {
        transitionUpdatePayload = payload;
        return transitionChain;
      }),
      eq: vi.fn(() => transitionChain),
      select: vi.fn(() => transitionChain),
      maybeSingle: vi.fn(async () => ({
        data: {
          id: "tenant-3",
          status: TENANT_STATUS.PROVISIONING,
          onboarding_data: (transitionUpdatePayload as { onboarding_data: Record<string, unknown> }).onboarding_data,
        },
        error: null,
      })),
    };

    let rollbackPayload: Record<string, unknown> | null = null;
    const rollbackChain: Record<string, unknown> = {
      error: null,
      update: vi.fn((payload: Record<string, unknown>) => {
        rollbackPayload = payload;
        return rollbackChain;
      }),
      eq: vi.fn(() => rollbackChain),
    };

    fromMock.mockReturnValueOnce(transitionChain).mockReturnValueOnce(rollbackChain);
    sendMock.mockRejectedValue(new Error("queue unavailable"));

    const { default: handler } = await import("../../api/tenants/launch");

    const req = { method: "POST" };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual({
      error: "Failed to queue provisioning launch. The tenant was reset to draft so you can retry safely.",
    });

    expect(rollbackPayload).toBeTruthy();
    expect((rollbackPayload as { status: string }).status).toBe(TENANT_STATUS.DRAFT);
    const rollbackOnboarding = (rollbackPayload as { onboarding_data: Record<string, unknown> }).onboarding_data;
    expect(rollbackOnboarding.launch_started_at).toBeNull();
  });

  it("handles duplicate launch races idempotently after atomic transition miss", async () => {
    authenticateRequest.mockResolvedValue({
      tenant: {
        id: "tenant-4",
        status: TENANT_STATUS.DRAFT,
        onboarding_data: {},
      },
    });

    const transitionMissChain: Record<string, unknown> = {
      update: vi.fn(() => transitionMissChain),
      eq: vi.fn(() => transitionMissChain),
      select: vi.fn(() => transitionMissChain),
      maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    };

    const latestStatusChain: Record<string, unknown> = {
      select: vi.fn(() => latestStatusChain),
      eq: vi.fn(() => latestStatusChain),
      single: vi.fn(async () => ({
        data: {
          status: TENANT_STATUS.PROVISIONING,
        },
        error: null,
      })),
    };

    fromMock.mockReturnValueOnce(transitionMissChain).mockReturnValueOnce(latestStatusChain);

    const { default: handler } = await import("../../api/tenants/launch");

    const req = { method: "POST" };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      launched: true,
      status: TENANT_STATUS.PROVISIONING,
      idempotent: true,
    });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("supports retry after event-dispatch failure by launching successfully on next attempt", async () => {
    authenticateRequest.mockResolvedValue({
      tenant: {
        id: "tenant-5",
        status: TENANT_STATUS.DRAFT,
        onboarding_data: {
          company_name: "Acme Labs",
        },
      },
    });

    let firstTransitionPayload: Record<string, unknown> | null = null;
    const firstTransitionChain: Record<string, unknown> = {
      update: vi.fn((payload: Record<string, unknown>) => {
        firstTransitionPayload = payload;
        return firstTransitionChain;
      }),
      eq: vi.fn(() => firstTransitionChain),
      select: vi.fn(() => firstTransitionChain),
      maybeSingle: vi.fn(async () => ({
        data: {
          id: "tenant-5",
          status: TENANT_STATUS.PROVISIONING,
          onboarding_data: (firstTransitionPayload as { onboarding_data: Record<string, unknown> }).onboarding_data,
        },
        error: null,
      })),
    };

    const rollbackChain: Record<string, unknown> = {
      error: null,
      update: vi.fn(() => rollbackChain),
      eq: vi.fn(() => rollbackChain),
    };

    let secondTransitionPayload: Record<string, unknown> | null = null;
    const secondTransitionChain: Record<string, unknown> = {
      update: vi.fn((payload: Record<string, unknown>) => {
        secondTransitionPayload = payload;
        return secondTransitionChain;
      }),
      eq: vi.fn(() => secondTransitionChain),
      select: vi.fn(() => secondTransitionChain),
      maybeSingle: vi.fn(async () => ({
        data: {
          id: "tenant-5",
          status: TENANT_STATUS.PROVISIONING,
          onboarding_data: (secondTransitionPayload as { onboarding_data: Record<string, unknown> }).onboarding_data,
        },
        error: null,
      })),
    };

    fromMock
      .mockReturnValueOnce(firstTransitionChain)
      .mockReturnValueOnce(rollbackChain)
      .mockReturnValueOnce(secondTransitionChain);

    sendMock.mockRejectedValueOnce(new Error("queue unavailable")).mockResolvedValueOnce(undefined);

    const { default: handler } = await import("../../api/tenants/launch");

    const firstRes = createMockResponse();
    await handler({ method: "POST" } as never, firstRes as never);
    expect(firstRes.statusCode).toBe(503);

    const retryRes = createMockResponse();
    await handler({ method: "POST" } as never, retryRes as never);
    expect(retryRes.statusCode).toBe(202);
    expect(retryRes.body).toEqual({
      launched: true,
      status: TENANT_STATUS.PROVISIONING,
      idempotent: false,
    });
    expect(sendMock).toHaveBeenCalledTimes(2);
  });
});

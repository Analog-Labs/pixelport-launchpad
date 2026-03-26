import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticateRequest = vi.fn();
const errorResponse = vi.fn((res: MockResponse, error: unknown) =>
  res.status(500).json({
    error: error instanceof Error ? error.message : "Internal server error",
  })
);

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
      single: vi.fn(async () => ({
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
        mission_goals: "Increase qualified pipeline",
        products_services: ["Growth advisory"],
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

    const v2 = onboarding.v2 as Record<string, unknown>;
    const strategy = v2.strategy as Record<string, unknown>;
    expect(strategy.mission_goals).toBe("Increase qualified pipeline");
    expect(strategy.products_services).toEqual(["Growth advisory"]);
  });
});

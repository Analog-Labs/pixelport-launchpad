import { beforeEach, describe, expect, it, vi } from "vitest";
import { TENANT_STATUS } from "@/lib/tenant-status";

const createClientMock = vi.fn();
const inngestCtorMock = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: (...args: unknown[]) => createClientMock(...args),
}));

vi.mock("inngest", () => ({
  Inngest: class {
    constructor(...args: unknown[]) {
      inngestCtorMock(...args);
    }

    send = vi.fn();
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

describe("POST /api/tenants", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    process.env.SUPABASE_PROJECT_URL = "https://supabase.test";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
    process.env.TENANT_PROVISIONING_ALLOWLIST = "founder@example.com";
  });

  it("creates a draft tenant with canonical schema metadata and no provisioning dispatch", async () => {
    const tenantsQuery: Record<string, unknown> = {
      select: vi.fn(() => tenantsQuery),
      eq: vi.fn(() => tenantsQuery),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      insert: vi.fn(() => tenantsQuery),
      single: vi.fn().mockResolvedValue({
        data: {
          id: "tenant-1",
          name: "Acme Labs",
          slug: "acme-labs",
          plan: "trial",
          status: TENANT_STATUS.DRAFT,
          onboarding_data: {
            company_name: "Acme Labs",
          },
          settings: {},
        },
        error: null,
      }),
    };

    const getUserMock = vi.fn().mockResolvedValue({
      data: {
        user: {
          id: "user-1",
          email: "founder@example.com",
        },
      },
      error: null,
    });

    createClientMock.mockReturnValue({
      auth: {
        getUser: getUserMock,
      },
      from: vi.fn(() => tenantsQuery),
    });

    const { default: handler } = await import("../../api/tenants/index");

    const req = {
      method: "POST",
      headers: {
        authorization: "Bearer token-123",
      },
      body: {
        company_name: "Acme Labs",
        company_url: "https://acme.test",
        agent_name: "Luna",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(201);
    expect(res.body).toMatchObject({
      created: true,
      tenant: {
        status: TENANT_STATUS.DRAFT,
      },
    });

    expect(tenantsQuery.insert).toHaveBeenCalledTimes(1);
    const insertPayload = (tenantsQuery.insert as ReturnType<typeof vi.fn>).mock.calls[0][0] as {
      status: string;
      onboarding_data: Record<string, unknown>;
    };

    expect(insertPayload.status).toBe(TENANT_STATUS.DRAFT);
    expect(insertPayload.onboarding_data.schema_version).toBe(2);
    expect(insertPayload.onboarding_data.render_version).toBe(1);
    expect(insertPayload.onboarding_data.v2).toBeTruthy();
    expect(insertPayload.onboarding_data.company_name).toBe("Acme Labs");

    // Draft creation should not instantiate or send any Inngest provisioning client/event.
    expect(inngestCtorMock).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const createClientMock = vi.fn();
const getUserMock = vi.fn();
const lookupMock = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: (...args: unknown[]) => createClientMock(...args),
}));

vi.mock("dns/promises", () => ({
  lookup: (...args: unknown[]) => lookupMock(...args),
  default: {
    lookup: (...args: unknown[]) => lookupMock(...args),
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

function htmlFetchResponse(html: string) {
  return {
    ok: true,
    status: 200,
    headers: {
      get: (name: string) => (name.toLowerCase() === "content-type" ? "text/html" : null),
    },
    text: async () => html,
  };
}

function createAbortError() {
  return Object.assign(new Error("The operation was aborted"), {
    name: "AbortError",
  });
}

describe("POST /api/tenants/scan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    process.env.SUPABASE_PROJECT_URL = "https://supabase.test";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
    delete process.env.OPENAI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    lookupMock.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
    getUserMock.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    createClientMock.mockReturnValue({
      auth: {
        getUser: getUserMock,
      },
    });
  });

  it("uses OpenAI when available", async () => {
    process.env.OPENAI_API_KEY = "openai-test-key";
    process.env.GEMINI_API_KEY = "gemini-test-key";

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        htmlFetchResponse("<html><head><title>Acme</title></head><body>Acme helps founders ship.</body></html>")
      )
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  company_description: "OpenAI summary",
                }),
              },
            },
          ],
        }),
      });

    global.fetch = fetchMock as typeof fetch;

    const { default: handler } = await import("../../api/tenants/scan");

    const req = {
      method: "POST",
      headers: { authorization: "Bearer token" },
      body: { company_url: "https://example.com" },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(200);
    expect((res.body as { scan_results: { company_description: string } }).scan_results.company_description).toBe(
      "OpenAI summary"
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.openai.com/v1/chat/completions",
      expect.any(Object)
    );
  });

  it("falls back to Gemini when OpenAI request fails", async () => {
    process.env.OPENAI_API_KEY = "openai-test-key";
    process.env.GEMINI_API_KEY = "gemini-test-key";

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        htmlFetchResponse("<html><head><title>Acme</title></head><body>Acme helps founders ship.</body></html>")
      )
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({}),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      company_description: "Gemini fallback summary",
                    }),
                  },
                ],
              },
            },
          ],
        }),
      });

    global.fetch = fetchMock as typeof fetch;

    const { default: handler } = await import("../../api/tenants/scan");

    const req = {
      method: "POST",
      headers: { authorization: "Bearer token" },
      body: { company_url: "https://example.com" },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(200);
    expect((res.body as { scan_results: { company_description: string } }).scan_results.company_description).toBe(
      "Gemini fallback summary"
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=gemini-test-key",
      expect.any(Object)
    );
  });

  it("falls back to Gemini when the OpenAI request times out", async () => {
    process.env.OPENAI_API_KEY = "openai-test-key";
    process.env.GEMINI_API_KEY = "gemini-test-key";

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        htmlFetchResponse("<html><head><title>Acme</title></head><body>Acme helps founders ship.</body></html>")
      )
      .mockRejectedValueOnce(createAbortError())
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      company_description: "Gemini timeout fallback summary",
                    }),
                  },
                ],
              },
            },
          ],
        }),
      });

    global.fetch = fetchMock as typeof fetch;

    const { default: handler } = await import("../../api/tenants/scan");

    const req = {
      method: "POST",
      headers: { authorization: "Bearer token" },
      body: { company_url: "https://example.com" },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(200);
    expect((res.body as { scan_results: { company_description: string } }).scan_results.company_description).toBe(
      "Gemini timeout fallback summary"
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=gemini-test-key",
      expect.any(Object)
    );
  });

  it("returns timeout provider errors when both LLM calls time out", async () => {
    process.env.OPENAI_API_KEY = "openai-test-key";
    process.env.GEMINI_API_KEY = "gemini-test-key";

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        htmlFetchResponse("<html><head><title>Acme</title></head><body>Acme helps founders ship.</body></html>")
      )
      .mockRejectedValueOnce(createAbortError())
      .mockRejectedValueOnce(createAbortError());

    global.fetch = fetchMock as typeof fetch;

    const { default: handler } = await import("../../api/tenants/scan");

    const req = {
      method: "POST",
      headers: { authorization: "Bearer token" },
      body: { company_url: "https://example.com" },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(200);
    const scanResults = (res.body as { scan_results: { error: string; provider_errors: string[] } }).scan_results;
    expect(scanResults.error).toBe("LLM processing failed");
    expect(scanResults.provider_errors).toEqual(["openai_timeout_12000ms", "gemini_timeout_12000ms"]);
  });
});

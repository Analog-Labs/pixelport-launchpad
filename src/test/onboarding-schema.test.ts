import { describe, expect, it } from "vitest";
import { buildOnboardingData, ONBOARDING_RENDER_VERSION, ONBOARDING_SCHEMA_VERSION } from "../../api/lib/onboarding-schema";

describe("onboarding schema normalizer", () => {
  it("builds canonical v2 data and legacy mirror fields", () => {
    const result = buildOnboardingData({}, {
      company_name: "Acme Labs",
      company_url: "https://acme.test",
      mission_goals: "Increase pipeline",
      goals: ["Increase pipeline"],
      agent_name: "Luna",
      products_services: ["Growth advisory"],
      starter_task: "Create a 14-day GTM sprint plan.",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.onboardingData.schema_version).toBe(ONBOARDING_SCHEMA_VERSION);
    expect(result.onboardingData.render_version).toBe(ONBOARDING_RENDER_VERSION);
    expect(result.onboardingData.company_name).toBe("Acme Labs");
    expect(result.onboardingData.mission_goals).toBe("Increase pipeline");

    const v2 = result.onboardingData.v2 as Record<string, unknown>;
    const company = v2.company as Record<string, unknown>;
    const strategy = v2.strategy as Record<string, unknown>;

    expect(company.name).toBe("Acme Labs");
    expect(company.website).toBe("https://acme.test");
    expect(strategy.mission_goals).toBe("Increase pipeline");
    expect(strategy.products_services).toEqual(["Growth advisory"]);
  });

  it("safe-merges onboarding updates without dropping system-managed keys", () => {
    const existing = {
      company_name: "Acme Labs",
      bootstrap: {
        status: "accepted",
        last_error: null,
      },
      runtime_url: "https://runtime.acme.test",
    };

    const result = buildOnboardingData(existing, {
      mission_goals: "Increase qualified leads",
      products_services: ["AI chief of staff"],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.onboardingData.bootstrap).toEqual(existing.bootstrap);
    expect(result.onboardingData.runtime_url).toBe("https://runtime.acme.test");
    expect(result.onboardingData.mission_goals).toBe("Increase qualified leads");

    const v2 = result.onboardingData.v2 as Record<string, unknown>;
    const strategy = v2.strategy as Record<string, unknown>;
    expect(strategy.products_services).toEqual(["AI chief of staff"]);
  });

  it("rejects schema-mismatched payloads with actionable error text", () => {
    const result = buildOnboardingData({}, {
      mission_goals: 42,
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error).toContain("mission_goals");
  });
});

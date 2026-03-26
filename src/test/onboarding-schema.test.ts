import { describe, expect, it } from "vitest";
import { buildOnboardingData, ONBOARDING_RENDER_VERSION, ONBOARDING_SCHEMA_VERSION } from "../../api/lib/onboarding-schema";

describe("onboarding schema normalizer", () => {
  it("builds canonical v2 data and legacy mirror fields", () => {
    const result = buildOnboardingData({}, {
      company_name: "Acme Labs",
      company_url: "https://acme.test",
      goals: ["Increase pipeline", "Launch founder content"],
      agent_name: "Chief A",
      agent_tone: "analytical",
      agent_avatar_id: "amber-command",
      products_services: ["Growth advisory"],
      starter_tasks: ["Create a 14-day GTM sprint plan.", "Ship weekly KPI review update."],
      approval_policy: {
        mode: "strict",
        guardrails: {
          publish: true,
          paid_spend: true,
          outbound_messages: true,
          major_strategy_changes: true,
        },
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.onboardingData.schema_version).toBe(ONBOARDING_SCHEMA_VERSION);
    expect(result.onboardingData.render_version).toBe(ONBOARDING_RENDER_VERSION);
    expect(result.onboardingData.company_name).toBe("Acme Labs");
    expect(result.onboardingData.mission_goals).toBe("Increase pipeline\nLaunch founder content");
    expect(result.onboardingData.agent_tone).toBe("analytical");
    expect(result.onboardingData.agent_avatar_id).toBe("amber-command");
    expect(result.onboardingData.starter_task).toBe("Create a 14-day GTM sprint plan.");
    expect(result.onboardingData.starter_tasks).toEqual([
      "Create a 14-day GTM sprint plan.",
      "Ship weekly KPI review update.",
    ]);

    const v2 = result.onboardingData.v2 as Record<string, unknown>;
    const company = v2.company as Record<string, unknown>;
    const strategy = v2.strategy as Record<string, unknown>;
    const task = v2.task as Record<string, unknown>;

    expect(company.name).toBe("Acme Labs");
    expect(company.website).toBe("https://acme.test");
    expect(company.tone).toBe("analytical");
    expect(company.avatar_id).toBe("amber-command");
    expect(strategy.mission_goals).toBe("Increase pipeline\nLaunch founder content");
    expect(strategy.products_services).toEqual(["Growth advisory"]);
    expect(task.starter_tasks).toEqual([
      "Create a 14-day GTM sprint plan.",
      "Ship weekly KPI review update.",
    ]);
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
      goals: ["Increase qualified leads"],
      products_services: ["AI chief of staff"],
      approval_policy: {
        mode: "balanced",
        guardrails: {
          publish: true,
          paid_spend: false,
          outbound_messages: true,
          major_strategy_changes: true,
        },
      },
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
    const task = v2.task as Record<string, unknown>;
    expect(strategy.products_services).toEqual(["AI chief of staff"]);
    expect((task.approval_policy as Record<string, unknown>).mode).toBe("balanced");
  });

  it("rejects schema-mismatched payloads with actionable error text", () => {
    const result = buildOnboardingData({}, {
      goals: ["1", "2", "3", "4"],
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error).toContain("goals");
  });
});

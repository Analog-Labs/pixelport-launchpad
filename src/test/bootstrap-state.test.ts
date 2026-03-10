import { describe, expect, it, vi } from "vitest";

vi.mock("../../api/lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

import {
  BOOTSTRAP_ACCEPTED_TIMEOUT_MS,
  BOOTSTRAP_DISPATCH_TIMEOUT_MS,
  deriveBootstrapState,
  type BootstrapDurableProgress,
  type BootstrapState,
} from "../../api/lib/bootstrap-state";

function buildState(overrides: Partial<BootstrapState> = {}): BootstrapState {
  return {
    status: "accepted",
    source: "provisioning",
    requested_at: "2026-03-10T10:00:00.000Z",
    accepted_at: "2026-03-10T10:01:00.000Z",
    completed_at: null,
    last_error: null,
    ...overrides,
  };
}

function buildProgress(overrides: Partial<BootstrapDurableProgress> = {}): BootstrapDurableProgress {
  return {
    taskCount: 0,
    competitorCount: 0,
    totalVaultSectionCount: 5,
    readyVaultSectionCount: 2,
    agentUpdatedVaultCount: 1,
    latestAgentActivityAt: "2026-03-10T10:05:00.000Z",
    hasAgentOutput: true,
    durableComplete: false,
    ...overrides,
  };
}

describe("bootstrap truth evaluation", () => {
  it("keeps bootstrap accepted when partial durable output exists and activity is still fresh", () => {
    const derived = deriveBootstrapState({
      state: buildState(),
      progress: buildProgress(),
      now: new Date(Date.parse("2026-03-10T10:05:00.000Z") + BOOTSTRAP_ACCEPTED_TIMEOUT_MS - 1).toISOString(),
    });

    expect(derived).toEqual({
      status: "accepted",
      last_error: null,
    });
  });

  it("does not treat a stale stored completed state as completed when durable criteria are unmet", () => {
    const derived = deriveBootstrapState({
      state: buildState({
        status: "completed",
        completed_at: "2026-03-10T10:06:00.000Z",
      }),
      progress: buildProgress(),
      now: "2026-03-10T10:08:00.000Z",
    });

    expect(derived).toEqual({
      status: "accepted",
      last_error: null,
    });
  });

  it("marks dispatching bootstrap failed after the dispatch timeout", () => {
    const derived = deriveBootstrapState({
      state: buildState({
        status: "dispatching",
        accepted_at: null,
      }),
      progress: buildProgress({
        latestAgentActivityAt: null,
        hasAgentOutput: false,
        agentUpdatedVaultCount: 0,
      }),
      now: new Date(Date.parse("2026-03-10T10:00:00.000Z") + BOOTSTRAP_DISPATCH_TIMEOUT_MS + 1).toISOString(),
    });

    expect(derived).toEqual({
      status: "failed",
      last_error: "Bootstrap timed out before the Chief acknowledged the run.",
    });
  });

  it("marks accepted bootstrap failed after the accepted timeout when durable truth is still incomplete", () => {
    const derived = deriveBootstrapState({
      state: buildState(),
      progress: buildProgress({
        latestAgentActivityAt: "2026-03-10T10:05:00.000Z",
      }),
      now: new Date(Date.parse("2026-03-10T10:05:00.000Z") + BOOTSTRAP_ACCEPTED_TIMEOUT_MS + 1).toISOString(),
    });

    expect(derived).toEqual({
      status: "failed",
      last_error: "Bootstrap timed out before durable dashboard truth was written.",
    });
  });

  it("marks bootstrap completed only when the full durable criteria are met", () => {
    const derived = deriveBootstrapState({
      state: buildState(),
      progress: buildProgress({
        taskCount: 2,
        competitorCount: 3,
        readyVaultSectionCount: 5,
        durableComplete: true,
      }),
      now: "2026-03-10T10:06:00.000Z",
    });

    expect(derived).toEqual({
      status: "completed",
      last_error: null,
    });
  });
});

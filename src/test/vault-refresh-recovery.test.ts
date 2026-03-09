import { describe, expect, it, vi } from "vitest";
import type { CommandStatus } from "../../api/lib/command-contract";

vi.mock("../../api/lib/commands", () => ({
  appendCommandEvent: vi.fn(),
  markCommandFailedIfStillNonTerminal: vi.fn(),
}));

vi.mock("../../api/lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

import {
  classifyVaultRefreshStaleCommand,
  getCommandLatestActivityAt,
} from "../../api/lib/vault-refresh-recovery";

type CommandRecordLike = {
  id: string;
  tenant_id: string;
  requested_by_user_id: string | null;
  source: string;
  command_type: string;
  title: string;
  instructions: string;
  target_entity_type: string | null;
  target_entity_id: string | null;
  payload: Record<string, unknown> | null;
  idempotency_key: string;
  status: CommandStatus;
  last_error: string | null;
  dispatched_at: string | null;
  acknowledged_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  failed_at: string | null;
  cancelled_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

function buildCommand(overrides: Partial<CommandRecordLike> = {}): CommandRecordLike {
  return {
    id: "cmd-1",
    tenant_id: "tenant-1",
    requested_by_user_id: "user-1",
    source: "dashboard",
    command_type: "vault_refresh",
    title: "Refresh Company Profile with Chief",
    instructions: "Refresh it.",
    target_entity_type: "vault_section",
    target_entity_id: "company_profile",
    payload: {},
    idempotency_key: "vault-refresh:tenant-1:company_profile:1",
    status: "dispatched",
    last_error: null,
    dispatched_at: "2026-03-09T07:35:27.162Z",
    acknowledged_at: null,
    started_at: null,
    completed_at: null,
    failed_at: null,
    cancelled_at: null,
    created_at: "2026-03-09T07:35:26.942Z",
    updated_at: "2026-03-09T07:35:27.232Z",
    ...overrides,
  };
}

describe("vault refresh stale recovery", () => {
  it("marks a dispatched command stale when no acknowledgement arrives after 10 minutes", () => {
    const command = buildCommand();

    const stale = classifyVaultRefreshStaleCommand({
      command,
      now: "2026-03-09T07:45:28.000Z",
      latestWorkspaceEventAt: null,
      targetSectionStatus: "populating",
      targetSectionUpdatedAt: "2026-03-09T07:35:27.232Z",
    });

    expect(stale).toEqual(
      expect.objectContaining({
        is_stale: true,
        reason: "awaiting_runtime_ack",
      })
    );
  });

  it("does not mark a running command stale when recent runtime activity exists", () => {
    const command = buildCommand({
      status: "running",
      acknowledged_at: "2026-03-09T07:35:45.000Z",
      started_at: "2026-03-09T07:36:00.000Z",
      updated_at: "2026-03-09T07:36:00.000Z",
    });

    const stale = classifyVaultRefreshStaleCommand({
      command,
      now: "2026-03-09T07:45:00.000Z",
      latestWorkspaceEventAt: "2026-03-09T07:40:30.000Z",
      targetSectionStatus: "populating",
      targetSectionUpdatedAt: "2026-03-09T07:40:30.000Z",
    });

    expect(stale).toBeNull();
  });

  it("marks an acknowledged or running command stale after 15 minutes of inactivity", () => {
    const command = buildCommand({
      status: "running",
      acknowledged_at: "2026-03-09T07:35:45.000Z",
      started_at: "2026-03-09T07:36:00.000Z",
      updated_at: "2026-03-09T07:36:00.000Z",
    });

    const stale = classifyVaultRefreshStaleCommand({
      command,
      now: "2026-03-09T07:51:01.000Z",
      latestWorkspaceEventAt: "2026-03-09T07:36:00.000Z",
      targetSectionStatus: "populating",
      targetSectionUpdatedAt: "2026-03-09T07:36:00.000Z",
    });

    expect(stale).toEqual(
      expect.objectContaining({
        is_stale: true,
        reason: "runtime_activity_timeout",
      })
    );
  });

  it("marks a command stale when the target section is already ready with newer truth", () => {
    const command = buildCommand({
      status: "dispatched",
      updated_at: "2026-03-09T07:35:27.232Z",
    });

    const stale = classifyVaultRefreshStaleCommand({
      command,
      now: "2026-03-09T07:36:40.000Z",
      latestWorkspaceEventAt: null,
      targetSectionStatus: "ready",
      targetSectionUpdatedAt: "2026-03-09T07:36:35.592Z",
    });

    expect(stale).toEqual(
      expect.objectContaining({
        is_stale: true,
        reason: "target_ready_after_activity",
        target_section_status: "ready",
      })
    );
  });

  it("computes latest activity from command timestamps and workspace events", () => {
    const latestActivityAt = getCommandLatestActivityAt({
      command: buildCommand({
        acknowledged_at: "2026-03-09T07:35:45.000Z",
        updated_at: "2026-03-09T07:35:46.000Z",
      }),
      latestWorkspaceEventAt: "2026-03-09T07:35:47.000Z",
    });

    expect(latestActivityAt).toBe("2026-03-09T07:35:47.000Z");
  });
});

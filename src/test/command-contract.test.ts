import { describe, expect, it } from "vitest";
import {
  buildCommandDispatchMessage,
  getCommandStatusForRuntimeEvent,
  shouldAdvanceCommandStatus,
} from "../../api/lib/command-contract";

describe("command contract", () => {
  it("maps runtime lifecycle events to command statuses", () => {
    expect(getCommandStatusForRuntimeEvent("command.acknowledged")).toBe("acknowledged");
    expect(getCommandStatusForRuntimeEvent("command.completed")).toBe("completed");
    expect(getCommandStatusForRuntimeEvent("runtime.artifact.promoted")).toBeNull();
  });

  it("prevents stale lifecycle regressions after terminal states", () => {
    expect(shouldAdvanceCommandStatus("pending", "dispatched")).toBe(true);
    expect(shouldAdvanceCommandStatus("running", "completed")).toBe(true);
    expect(shouldAdvanceCommandStatus("completed", "running")).toBe(false);
    expect(shouldAdvanceCommandStatus("failed", "completed")).toBe(false);
  });

  it("builds a dispatch message with command id and workspace-event instructions", () => {
    const message = buildCommandDispatchMessage({
      commandId: "cmd-123",
      commandType: "vault_refresh",
      title: "Refresh Company Profile with Chief",
      instructions: "Refresh the company profile vault section only.",
      targetEntityType: "vault_section",
      targetEntityId: "company_profile",
      payload: {
        section_key: "company_profile",
      },
      commandSpecificRequirements: [
        'Set the section to status "populating" through PUT /api/agent/vault/company_profile when execution starts.',
        'Emit runtime.artifact.promoted with entity_type "vault_section" and entity_id "company_profile".',
      ],
    });

    expect(message).toContain("Command ID: cmd-123");
    expect(message).toContain("/api/agent/workspace-events");
    expect(message).toContain("runtime.artifact.promoted");
    expect(message).toContain('PUT /api/agent/vault/company_profile');
    expect(message).toContain('entity_id "company_profile"');
    expect(message).toContain('"section_key": "company_profile"');
  });
});

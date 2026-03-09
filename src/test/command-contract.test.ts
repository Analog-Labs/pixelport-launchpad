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
      commandType: "content_refresh",
      title: "Refresh homepage content",
      instructions: "Audit the homepage copy and produce a tighter draft.",
      targetEntityType: "deliverable",
      targetEntityId: "homepage",
      payload: {
        priority: "high",
      },
    });

    expect(message).toContain("Command ID: cmd-123");
    expect(message).toContain("/api/agent/workspace-events");
    expect(message).toContain("runtime.artifact.promoted");
    expect(message).toContain('"priority": "high"');
  });
});

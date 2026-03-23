import { describe, expect, it } from "vitest";
import {
  THIN_BRIDGE_CONTRACT_VERSION,
  isTaskStepUnlocked,
  resolveTaskStepUnlocked,
} from "@/lib/runtime-bridge-contract";

describe("runtime bridge contract", () => {
  it("keeps a pinned contract version marker", () => {
    expect(THIN_BRIDGE_CONTRACT_VERSION).toBe("pivot-p0-v2");
  });

  it("unlocks task step only for ready and active statuses", () => {
    expect(isTaskStepUnlocked("ready")).toBe(true);
    expect(isTaskStepUnlocked("READY")).toBe(true);
    expect(isTaskStepUnlocked("active")).toBe(true);
    expect(isTaskStepUnlocked("provisioning")).toBe(false);
    expect(isTaskStepUnlocked("failed")).toBe(false);
    expect(isTaskStepUnlocked(null)).toBe(false);
  });

  it("resolves unlock from explicit bridge flag or completed bootstrap state", () => {
    expect(
      resolveTaskStepUnlocked({
        status: "provisioning",
        bootstrapStatus: "completed",
      })
    ).toBe(true);
    expect(
      resolveTaskStepUnlocked({
        status: "provisioning",
        bootstrapStatus: "accepted",
        taskStepUnlocked: true,
      })
    ).toBe(true);
    expect(
      resolveTaskStepUnlocked({
        status: "provisioning",
        bootstrapStatus: "accepted",
      })
    ).toBe(false);
  });
});

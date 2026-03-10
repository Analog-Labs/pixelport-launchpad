import { describe, expect, it } from "vitest";
import {
  WORKSPACE_ROOT_PROMPT_FILES,
  buildWorkspaceScaffold,
} from "../../api/lib/workspace-contract";

describe("workspace contract", () => {
  it("scaffolds all root prompt files and runtime directories", () => {
    const scaffold = buildWorkspaceScaffold({
      tenantName: "PixelPort QA",
      tenantSlug: "pixelport-qa",
      apiBaseUrl: "https://pixelport.test",
      onboardingData: {
        agent_name: "Luna",
        agent_tone: "bold",
      },
    });

    expect(scaffold.directories).toEqual(
      expect.arrayContaining([
        "pixelport/content/deliverables",
        "pixelport/vault/snapshots",
        "pixelport/jobs",
        "pixelport/runtime/snapshots",
        "pixelport/ops/events",
        "pixelport/scratch/subagents",
      ])
    );

    for (const promptFile of WORKSPACE_ROOT_PROMPT_FILES) {
      expect(scaffold.files[promptFile]).toBeTruthy();
    }

    expect(scaffold.files["pixelport/runtime/snapshots/status.json"]).toContain("foundation-spine");
  });

  it("removes permanent Spark and Scout assumptions while preserving current APIs", () => {
    const scaffold = buildWorkspaceScaffold({
      tenantName: "PixelPort QA",
      tenantSlug: "pixelport-qa",
      apiBaseUrl: "https://pixelport.test",
      onboardingData: {
        agent_name: "Luna",
        scan_results: {
          company_description: "AI chief of staff for startup marketing teams.",
          brand_voice: "Direct and practical.",
        },
      },
    });

    const combinedContent = Object.values(scaffold.files).join("\n");

    expect(combinedContent).not.toContain("Spark");
    expect(combinedContent).not.toContain("Scout");
    expect(combinedContent).toContain("/api/agent/tasks");
    expect(combinedContent).toContain("/api/agent/workspace-events");
    expect(combinedContent).toContain("pixelport/scratch/subagents");
    expect(combinedContent).toContain("## Vault Refresh Commands");
    expect(combinedContent).toContain("pixelport/vault/snapshots/<section_key>.md");
    expect(combinedContent).toContain('restore the prior content with `status: "ready"`');
    expect(combinedContent).not.toContain("/opt/openclaw/.env");
    expect(combinedContent).toContain("PIXELPORT_API_KEY must already be injected into the running container");
    expect(combinedContent).toContain("OPENAI_BASE_URL is required for direct model access");
  });
});

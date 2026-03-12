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
        company_url: "https://pixelport.test",
        goals: ["Pipeline growth"],
        scan_results: {
          value_proposition: "AI chief of staff for startup marketing teams.",
          industry: "SaaS",
          brand_voice: "Direct and practical.",
          target_audience: "Startup marketing teams",
          key_products: ["Chief of staff workflows"],
        },
      },
    });

    expect(scaffold.directories).toEqual(
      expect.arrayContaining([
        "memory",
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

    expect(scaffold.files["MEMORY.md"]).toContain("This is Luna's fast recall layer");
    expect(scaffold.files["MEMORY.md"]).toContain("- Website: https://pixelport.test");
    expect(scaffold.files["memory/business-context.md"]).toContain("## Brand Voice Signals");
    expect(scaffold.files["memory/business-context.md"]).toContain("## Products And Services Signals");
    expect(scaffold.files["memory/operating-model.md"]).toContain("## Source Of Truth");
    expect(scaffold.files["memory/active-priorities.md"]).toContain("## Current Operational Signals");
    expect(scaffold.files["pixelport/runtime/snapshots/status.json"]).toContain("foundation-spine");
    expect(scaffold.files["pixelport/runtime/snapshots/status.json"]).toContain('"native_memory": "memory"');
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
    expect(combinedContent).toContain("## Native Memory Workflow");
    expect(combinedContent).toContain("Use native memory for fast recall.");
    expect(combinedContent).toContain("pixelport/vault/snapshots/<section_key>.md");
    expect(combinedContent).toContain('restore the prior content with `status: "ready"`');
    expect(combinedContent).not.toContain("/opt/openclaw/.env");
    expect(combinedContent).toContain("PIXELPORT_API_KEY must already be injected into the running container");
    expect(combinedContent).toContain("OPENAI_BASE_URL is required for direct model access");
    expect(combinedContent).toContain("refresh the relevant native memory artifact in the same work cycle");
  });
});

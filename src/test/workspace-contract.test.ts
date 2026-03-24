import { describe, expect, it } from "vitest";
import {
  WORKSPACE_ROOT_PROMPT_FILES,
  WORKSPACE_CONTRACT_VERSION,
  buildWorkspaceScaffold,
} from "../../api/lib/workspace-contract";

describe("workspace contract", () => {
  it("uses paperclip default templates with chief-of-staff relabeling", () => {
    const scaffold = buildWorkspaceScaffold({
      tenantName: "PixelPort QA",
      tenantSlug: "pixelport-qa",
      apiBaseUrl: "https://pixelport.test",
      onboardingData: {
        company_name: "PixelPort QA",
        company_url: "https://pixelport.test",
        mission: "Scale predictable growth",
        goals: ["Pipeline growth", "Faster campaigns"],
        agent_name: "Luna",
      },
    });

    expect(scaffold.directories).toEqual(
      expect.arrayContaining([
        "memory",
        "life/projects",
        "life/areas/people",
        "life/areas/companies",
        "life/resources",
        "life/archives",
        "plans",
      ])
    );

    for (const promptFile of WORKSPACE_ROOT_PROMPT_FILES) {
      expect(scaffold.files[promptFile]).toBeTruthy();
    }

    const agents = scaffold.files["AGENTS.md"];
    const heartbeat = scaffold.files["HEARTBEAT.md"];
    const soul = scaffold.files["SOUL.md"];

    expect(agents).toContain("You are the Chief of Staff.");
    expect(agents).not.toContain("You are the CEO.");

    expect(heartbeat).toContain("# HEARTBEAT.md -- Chief of Staff Heartbeat Checklist");
    expect(heartbeat).toContain("## Chief of Staff Responsibilities");
    expect(heartbeat).not.toContain("## CEO Responsibilities");

    expect(soul).toContain("# SOUL.md -- Chief of Staff Persona");
    expect(soul).toContain("## PixelPort Additive Onboarding Context");
    expect(soul).toContain("- Company: PixelPort QA");
    expect(soul).toContain("- Website: https://pixelport.test");
    expect(soul).toContain("- Mission: Scale predictable growth");
    expect(soul).toContain("  - Pipeline growth");
    expect(soul).toContain("- Chosen Chief of Staff name: Luna");
  });

  it("keeps onboarding injection scoped to SOUL only", () => {
    const scaffold = buildWorkspaceScaffold({
      tenantName: "Acme",
      tenantSlug: "acme",
      apiBaseUrl: "https://pixelport.test",
      onboardingData: {
        company_name: "Acme Corp",
        company_url: "https://acme.example",
        mission_goals: "Grow ARR",
        goals: ["Grow ARR"],
        agent_name: "Orion",
      },
    });

    const agents = scaffold.files["AGENTS.md"];
    const heartbeat = scaffold.files["HEARTBEAT.md"];
    const tools = scaffold.files["TOOLS.md"];
    const soul = scaffold.files["SOUL.md"];

    for (const fileContent of [agents, heartbeat, tools]) {
      expect(fileContent).not.toContain("Acme Corp");
      expect(fileContent).not.toContain("https://acme.example");
      expect(fileContent).not.toContain("Grow ARR");
      expect(fileContent).not.toContain("Orion");
    }

    expect(soul).toContain("- Company: Acme Corp");
    expect(soul).toContain("- Website: https://acme.example");
    expect(soul).toContain("- Mission: Grow ARR");
    expect(soul).toContain("- Chosen Chief of Staff name: Orion");

    const status = JSON.parse(scaffold.files["pixelport/runtime/snapshots/workspace-contract.json"]);
    expect(status.contract_version).toBe(WORKSPACE_CONTRACT_VERSION);
    expect(status.root_prompt_files).toEqual(WORKSPACE_ROOT_PROMPT_FILES);
    expect(status.required_directories).toEqual(
      expect.arrayContaining(["memory", "life/projects", "plans", "pixelport/runtime/snapshots"]),
    );
    expect(status.memory_contract).toBe("memory-para-v1");
  });
});

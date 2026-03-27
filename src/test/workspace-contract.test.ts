import { describe, expect, it } from "vitest";
import {
  WORKSPACE_ROOT_PROMPT_FILES,
  WORKSPACE_KNOWLEDGE_FILES,
  WORKSPACE_CONTRACT_VERSION,
  WORKSPACE_MEMORY_CONTRACT_VERSION,
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
        "system",
        "knowledge",
        "skills/paperclip",
      ])
    );

    for (const promptFile of WORKSPACE_ROOT_PROMPT_FILES) {
      expect(scaffold.files[promptFile]).toBeTruthy();
    }
    expect(scaffold.files["BOOTSTRAP.md"]).toBeUndefined();

    const agents = scaffold.files["AGENTS.md"];
    const identity = scaffold.files["IDENTITY.md"];
    const user = scaffold.files["USER.md"];
    const heartbeat = scaffold.files["HEARTBEAT.md"];
    const boot = scaffold.files["BOOT.md"];
    const memory = scaffold.files["MEMORY.md"];
    const soul = scaffold.files["SOUL.md"];

    expect(agents).toContain("You are the Chief of Staff.");
    expect(agents).not.toContain("You are the CEO.");

    expect(identity).toContain("# IDENTITY.md");
    expect(identity).toContain("- Name: Luna");
    expect(identity).toContain("- Role: Chief of Staff");

    expect(user).toContain("# USER.md");
    expect(user).toContain("- Company: PixelPort QA");
    expect(user).toContain("- Website: https://pixelport.test");

    expect(heartbeat).toContain("# HEARTBEAT.md -- Chief of Staff Heartbeat Checklist");
    expect(heartbeat).toContain("## Chief of Staff Responsibilities");
    expect(heartbeat).not.toContain("## CEO Responsibilities");

    expect(boot).toContain("# BOOT.md");
    expect(boot).toContain("scaffold only");

    expect(memory).toContain("# MEMORY.md");
    expect(memory).toContain("## Durable Facts");

    expect(soul).toContain("# SOUL.md -- Chief of Staff Persona");
    expect(soul).toContain("## PixelPort Additive Onboarding Context");
    expect(soul).toContain("- Company: PixelPort QA");
    expect(soul).toContain("- Website: https://pixelport.test");
    expect(soul).toContain("- Mission: Scale predictable growth");
    expect(soul).toContain("  - Pipeline growth");
    expect(soul).toContain("- Chosen Chief of Staff name: Luna");

    expect(scaffold.files["knowledge/company-overview.md"]).toContain("Company: PixelPort QA");
    expect(scaffold.files["knowledge/products-and-offers.md"]).toContain("# Products and Offers");
    expect(scaffold.files["knowledge/audience-and-icp.md"]).toContain("# Audience and ICP");
    expect(scaffold.files["knowledge/brand-voice.md"]).toContain("# Brand Voice");
    expect(scaffold.files["knowledge/competitors.md"]).toContain("# Competitors");

    expect(scaffold.files["skills/paperclip/SKILL.md"]).toContain("# Paperclip Workspace Skill");

    const onboardingJson = JSON.parse(scaffold.files["system/onboarding.json"]);
    expect(onboardingJson).toMatchObject({
      agent_name: "Luna",
      company_name: "PixelPort QA",
      company_url: "https://pixelport.test",
      mission: "Scale predictable growth",
    });

    const renderManifest = JSON.parse(scaffold.files["system/render-manifest.json"]);
    expect(renderManifest.contract_version).toBe(WORKSPACE_CONTRACT_VERSION);
    expect(renderManifest.memory_contract).toBe(WORKSPACE_MEMORY_CONTRACT_VERSION);
    expect(renderManifest.root_files).toEqual(WORKSPACE_ROOT_PROMPT_FILES);
    expect(renderManifest.knowledge_files).toEqual(WORKSPACE_KNOWLEDGE_FILES);
    expect(renderManifest.system_files).toEqual(["system/onboarding.json", "system/render-manifest.json"]);
    expect(renderManifest.boot_execution).toBe("scaffold_only");
    expect(renderManifest.paperclip_integration).toBe("runtime_api_wiring_existing");
    expect(renderManifest.skill_files).toEqual(["skills/paperclip/SKILL.md"]);
  });

  it("uses knowledge_mirror file content when present", () => {
    const scaffold = buildWorkspaceScaffold({
      tenantName: "Acme",
      tenantSlug: "acme",
      apiBaseUrl: "https://pixelport.test",
      onboardingData: {
        company_name: "Acme",
        knowledge_mirror: {
          files: {
            "knowledge/company-overview.md": "# Company Overview\n\nCustom mirror content",
            "knowledge/brand-voice.md": "# Brand Voice\n\nUse short confident sentences.",
          },
        },
      },
    });

    expect(scaffold.files["knowledge/company-overview.md"]).toContain("Custom mirror content");
    expect(scaffold.files["knowledge/brand-voice.md"]).toContain("Use short confident sentences.");
    expect(scaffold.files["knowledge/products-and-offers.md"]).toContain("# Products and Offers");
  });

  it("keeps company mission context scoped to SOUL and USER files", () => {
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
    const identity = scaffold.files["IDENTITY.md"];
    const boot = scaffold.files["BOOT.md"];
    const memory = scaffold.files["MEMORY.md"];
    const heartbeat = scaffold.files["HEARTBEAT.md"];
    const tools = scaffold.files["TOOLS.md"];
    const soul = scaffold.files["SOUL.md"];
    const user = scaffold.files["USER.md"];

    for (const fileContent of [agents, identity, heartbeat, tools, boot, memory]) {
      expect(fileContent).not.toContain("Acme Corp");
      expect(fileContent).not.toContain("https://acme.example");
      expect(fileContent).not.toContain("Grow ARR");
    }

    expect(soul).toContain("- Company: Acme Corp");
    expect(soul).toContain("- Website: https://acme.example");
    expect(soul).toContain("- Mission: Grow ARR");
    expect(soul).toContain("- Chosen Chief of Staff name: Orion");

    expect(user).toContain("- Company: Acme Corp");
    expect(user).toContain("- Website: https://acme.example");

    const status = JSON.parse(scaffold.files["pixelport/runtime/snapshots/workspace-contract.json"]);
    expect(status.contract_version).toBe(WORKSPACE_CONTRACT_VERSION);
    expect(status.root_prompt_files).toEqual(WORKSPACE_ROOT_PROMPT_FILES);
    expect(status.required_directories).toEqual(
      expect.arrayContaining([
        "memory",
        "life/projects",
        "plans",
        "pixelport/runtime/snapshots",
        "system",
        "knowledge",
        "skills/paperclip",
      ]),
    );
    expect(status.memory_contract).toBe(WORKSPACE_MEMORY_CONTRACT_VERSION);
    expect(status.applied_at).toBeUndefined();
  });

  it("is deterministic for identical onboarding input", () => {
    const params = {
      tenantName: "Deterministic Co",
      tenantSlug: "deterministic-co",
      apiBaseUrl: "https://pixelport.test",
      onboardingData: {
        company_name: "Deterministic Co",
        company_url: "https://deterministic.example",
        mission_goals: "Ship fast",
        goals: ["Ship fast", "Stay precise"],
        agent_name: "Nova",
      },
    } as const;

    const first = buildWorkspaceScaffold(params);
    const second = buildWorkspaceScaffold(params);

    expect(second).toEqual(first);
  });
});

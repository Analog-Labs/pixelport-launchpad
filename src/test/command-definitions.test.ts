import { describe, expect, it } from "vitest";
import { resolveCommandInput } from "../../api/lib/command-definitions";

describe("command definitions", () => {
  it("resolves vault_refresh into canonical title, payload, and runtime guidance", () => {
    const result = resolveCommandInput({
      commandType: "vault_refresh",
      title: null,
      instructions: null,
      targetEntityType: "vault_section",
      targetEntityId: "products",
      payload: {},
    });

    expect(result).toEqual({
      ok: true,
      command: expect.objectContaining({
        commandType: "vault_refresh",
        title: "Refresh Products & Services with Chief",
        targetEntityType: "vault_section",
        targetEntityId: "products",
        payload: {
          section_key: "products",
          section_title: "Products & Services",
          snapshot_path: "pixelport/vault/snapshots/products.md",
        },
        activeCommandReuseScope: "command_type",
      }),
    });

    if (result.ok) {
      expect(result.command.instructions).toContain('status "populating"');
      expect(result.command.instructions).toContain("restore the prior content");
      expect(result.command.dispatchRequirements).toContain(
        'If you must fail or cancel after setting "populating", restore the previous content with status "ready" first.'
      );
    }
  });

  it("rejects invalid vault_refresh targets", () => {
    const result = resolveCommandInput({
      commandType: "vault_refresh",
      title: null,
      instructions: null,
      targetEntityType: "deliverable",
      targetEntityId: "homepage",
      payload: {},
    });

    expect(result).toEqual({
      ok: false,
      status: 400,
      error: 'vault_refresh requires target_entity_type "vault_section"',
    });
  });

  it("passes through generic commands with explicit title and instructions", () => {
    const result = resolveCommandInput({
      commandType: "content_refresh",
      title: "Refresh homepage",
      instructions: "Rewrite the headline.",
      targetEntityType: "deliverable",
      targetEntityId: "homepage",
      payload: {
        priority: "high",
      },
    });

    expect(result).toEqual({
      ok: true,
      command: {
        commandType: "content_refresh",
        title: "Refresh homepage",
        instructions: "Rewrite the headline.",
        targetEntityType: "deliverable",
        targetEntityId: "homepage",
        payload: {
          priority: "high",
        },
        dispatchRequirements: [],
        activeCommandReuseScope: "none",
      },
    });
  });
});

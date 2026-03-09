import {
  getVaultSectionSnapshotPath,
  getVaultSectionTitle,
  isVaultSectionKey,
  type VaultSectionKey,
} from "../../lib/vault-contract";

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonRecord
  | JsonValue[];

type JsonRecord = Record<string, JsonValue>;

type RawCommandInput = {
  commandType: string;
  title: string | null;
  instructions: string | null;
  targetEntityType: string | null;
  targetEntityId: string | null;
  payload: JsonRecord;
};

export type ResolvedCommandInput = {
  commandType: string;
  title: string;
  instructions: string;
  targetEntityType: string | null;
  targetEntityId: string | null;
  payload: JsonRecord;
  dispatchRequirements: string[];
  reuseActiveTarget: boolean;
};

type ResolvedCommandResult =
  | {
      ok: true;
      command: ResolvedCommandInput;
    }
  | {
      ok: false;
      status: number;
      error: string;
    };

type CommandDefinition = {
  resolve: (input: RawCommandInput) => ResolvedCommandResult;
};

function buildVaultRefreshInstructions(sectionKey: VaultSectionKey): string {
  const sectionTitle = getVaultSectionTitle(sectionKey);
  const snapshotPath = getVaultSectionSnapshotPath(sectionKey);

  return [
    `Refresh the "${sectionTitle}" section of the Knowledge Vault only.`,
    "Read the current vault state first through GET /api/agent/vault so your update stays grounded in existing tenant truth.",
    `As soon as execution begins, call PUT /api/agent/vault/${sectionKey} with status "populating".`,
    `Write your updated working markdown to ${snapshotPath}.`,
    `When the snapshot is ready, emit runtime.artifact.promoted for vault_section:${sectionKey}.`,
    `Then call PUT /api/agent/vault/${sectionKey} with the final markdown content and status "ready".`,
    `If you cannot finish after switching to "populating", restore the prior content with status "ready" before emitting command.failed or command.cancelled.`,
    "Do not edit any other vault section as part of this command.",
  ].join("\n");
}

function buildVaultRefreshDispatchRequirements(sectionKey: VaultSectionKey): string[] {
  const sectionTitle = getVaultSectionTitle(sectionKey);

  return [
    `Work only on the "${sectionTitle}" vault section (${sectionKey}).`,
    `Read the current section context from GET /api/agent/vault before making changes.`,
    `Set the section to status "populating" through PUT /api/agent/vault/${sectionKey} when execution starts.`,
    `Update the durable snapshot at ${getVaultSectionSnapshotPath(sectionKey)} before final promotion.`,
    `Emit runtime.artifact.promoted with entity_type "vault_section" and entity_id "${sectionKey}".`,
    `Finish by writing the final markdown and status "ready" through PUT /api/agent/vault/${sectionKey}.`,
    'If you must fail or cancel after setting "populating", restore the previous content with status "ready" first.',
  ];
}

const commandDefinitions: Record<string, CommandDefinition> = {
  vault_refresh: {
    resolve(input) {
      if (input.targetEntityType !== "vault_section") {
        return {
          ok: false,
          status: 400,
          error: 'vault_refresh requires target_entity_type "vault_section"',
        };
      }

      if (!isVaultSectionKey(input.targetEntityId)) {
        return {
          ok: false,
          status: 400,
          error: "vault_refresh requires a valid target_entity_id vault section key",
        };
      }

      const sectionKey = input.targetEntityId;
      const sectionTitle = getVaultSectionTitle(sectionKey);

      return {
        ok: true,
        command: {
          commandType: "vault_refresh",
          title: `Refresh ${sectionTitle} with Chief`,
          instructions: buildVaultRefreshInstructions(sectionKey),
          targetEntityType: "vault_section",
          targetEntityId: sectionKey,
          payload: {
            section_key: sectionKey,
            section_title: sectionTitle,
            snapshot_path: getVaultSectionSnapshotPath(sectionKey),
          },
          dispatchRequirements: buildVaultRefreshDispatchRequirements(sectionKey),
          reuseActiveTarget: true,
        },
      };
    },
  },
};

export function resolveCommandInput(input: RawCommandInput): ResolvedCommandResult {
  const definition = commandDefinitions[input.commandType];
  if (!definition) {
    if (!input.title || !input.instructions) {
      return {
        ok: false,
        status: 400,
        error: "Missing required fields: command_type, title, instructions, idempotency_key",
      };
    }

    return {
      ok: true,
      command: {
        commandType: input.commandType,
        title: input.title,
        instructions: input.instructions,
        targetEntityType: input.targetEntityType,
        targetEntityId: input.targetEntityId,
        payload: input.payload,
        dispatchRequirements: [],
        reuseActiveTarget: false,
      },
    };
  }

  return definition.resolve(input);
}

import { sshExec } from './droplet-ssh';

const LOCAL_GATEWAY_WS_URL = 'ws://127.0.0.1:18789';

type OpenClawPairingList = {
  pending?: Array<Record<string, unknown>>;
};

export type PairingSshApprovalResult =
  | {
      ok: true;
      approved: boolean;
      requestId: string | null;
      reason: 'approved' | 'no_pending_request';
    }
  | {
      ok: false;
      approved: false;
      requestId: string | null;
      reason: string;
    };

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\"'\"'`)}'`;
}

function readNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parsePairingListOutput(output: string): OpenClawPairingList {
  const trimmed = output.trim();
  if (!trimmed) {
    throw new Error('OpenClaw devices list returned empty output');
  }

  const direct = JSON.parse(trimmed) as OpenClawPairingList;
  if (direct && typeof direct === 'object') {
    return direct;
  }

  throw new Error('OpenClaw devices list returned non-object payload');
}

function selectPairingRequestId(params: {
  pending: Array<Record<string, unknown>>;
  requestId?: string | null;
  expectedDeviceId?: string | null;
}): string | null {
  if (params.requestId) {
    const exact = params.pending.find((entry) => readNonEmptyString(entry.requestId) === params.requestId);
    return exact ? params.requestId : null;
  }

  if (params.expectedDeviceId) {
    const byDevice = params.pending.find((entry) => readNonEmptyString(entry.deviceId) === params.expectedDeviceId);
    return byDevice ? readNonEmptyString(byDevice.requestId) : null;
  }

  if (params.pending.length === 1) {
    return readNonEmptyString(params.pending[0]?.requestId);
  }

  return null;
}

function buildDevicesListCommand(gatewayToken: string): string {
  return [
    'set -euo pipefail',
    `docker exec openclaw-gateway sh -lc ${shellQuote(
      `openclaw devices list --json --url ${LOCAL_GATEWAY_WS_URL} --token ${shellQuote(gatewayToken)}`,
    )}`,
  ].join('\n');
}

function buildDevicesApproveCommand(params: {
  gatewayToken: string;
  requestId: string;
}): string {
  return [
    'set -euo pipefail',
    `docker exec openclaw-gateway sh -lc ${shellQuote(
      `openclaw devices approve --json ${shellQuote(params.requestId)} --url ${LOCAL_GATEWAY_WS_URL} --token ${shellQuote(params.gatewayToken)}`,
    )}`,
  ].join('\n');
}

export async function approveGatewayPairingViaSsh(params: {
  host: string;
  gatewayToken: string;
  requestId?: string | null;
  expectedDeviceId?: string | null;
}): Promise<PairingSshApprovalResult> {
  try {
    const listOutput = await sshExec(params.host, buildDevicesListCommand(params.gatewayToken));
    const pairingList = parsePairingListOutput(listOutput);
    const pending = Array.isArray(pairingList.pending)
      ? pairingList.pending.filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === 'object')
      : [];

    const selectedRequestId = selectPairingRequestId({
      pending,
      requestId: params.requestId ?? null,
      expectedDeviceId: params.expectedDeviceId ?? null,
    });

    if (!selectedRequestId) {
      if (params.requestId) {
        return {
          ok: false,
          approved: false,
          requestId: null,
          reason: `pairing request ${params.requestId} is no longer pending`,
        };
      }

      if (params.expectedDeviceId) {
        return {
          ok: false,
          approved: false,
          requestId: null,
          reason: `no pending pairing request for device ${params.expectedDeviceId}`,
        };
      }

      if (pending.length === 0) {
        return {
          ok: true,
          approved: false,
          requestId: null,
          reason: 'no_pending_request',
        };
      }

      return {
        ok: false,
        approved: false,
        requestId: null,
        reason: 'multiple pending pairing requests; cannot safely auto-approve without identity',
      };
    }

    const approvalOutput = await sshExec(
      params.host,
      buildDevicesApproveCommand({
        gatewayToken: params.gatewayToken,
        requestId: selectedRequestId,
      }),
    );
    const normalizedApprovalOutput = approvalOutput.toLowerCase();

    if (normalizedApprovalOutput.includes('no pending device pairing requests')) {
      return {
        ok: true,
        approved: false,
        requestId: selectedRequestId,
        reason: 'no_pending_request',
      };
    }

    return {
      ok: true,
      approved: true,
      requestId: selectedRequestId,
      reason: 'approved',
    };
  } catch (error) {
    return {
      ok: false,
      approved: false,
      requestId: null,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}


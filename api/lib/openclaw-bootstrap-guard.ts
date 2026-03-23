import { randomUUID } from 'crypto';
import { WebSocket } from 'ws';
import { triggerOnboardingBootstrap } from './onboarding-bootstrap';

const PROTOCOL_VERSION = 3;
const DEFAULT_TIMEOUT_MS = 10_000;

export type GatewayDiagnosticTag =
  | 'pairing_required'
  | 'missing_operator_scope'
  | 'gateway_request_failed'
  | 'droplet_capacity_422'
  | 'readiness_timeout';

export type GatewayDiagnostic = {
  tag: GatewayDiagnosticTag;
  retryable: boolean;
  message: string;
  missingScope: string | null;
  requestId: string | null;
};

export type PairingApprovalResult =
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

export type BootstrapDispatchResult = {
  ok: boolean;
  status: number;
  body: string;
  diagnostics: GatewayDiagnostic | null;
  autoPairAttempted: boolean;
  autoPairApproved: boolean;
  autoPairReason: string | null;
};

type GatewayPendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout> | null;
};

type GatewayResponseError = Error & {
  gatewayDetails?: Record<string, unknown>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), timeoutMs);

    promise
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

function extractErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function extractPairingRequestId(message: string): string | null {
  const direct = message.match(/requestId\s*[:=]\s*([A-Za-z0-9_-]+)/i)?.[1];
  if (direct) {
    return direct;
  }

  const quoted = message.match(/"requestId"\s*:\s*"([A-Za-z0-9_-]+)"/i)?.[1];
  if (quoted) {
    return quoted;
  }

  return null;
}

export function extractMissingScope(message: string): string | null {
  return message.match(/missing scope:\s*([a-z0-9._-]+)/i)?.[1] ?? null;
}

export function classifyGatewayFailure(params: {
  status?: number;
  message: string;
}): GatewayDiagnostic {
  const status = typeof params.status === 'number' ? params.status : 0;
  const message = params.message;
  const lower = message.toLowerCase();

  const missingScope = extractMissingScope(message);
  if (missingScope) {
    return {
      tag: 'missing_operator_scope',
      retryable: false,
      message,
      missingScope,
      requestId: extractPairingRequestId(message),
    };
  }

  if (lower.includes('pairing required') || lower.includes('openclaw_gateway_pairing_required')) {
    return {
      tag: 'pairing_required',
      retryable: true,
      message,
      missingScope: null,
      requestId: extractPairingRequestId(message),
    };
  }

  if (
    status === 422 &&
    (lower.includes('unprocessable_entity') ||
      lower.includes('droplet creation failed') ||
      lower.includes('name is already in use') ||
      lower.includes('insufficient') ||
      lower.includes('not available'))
  ) {
    return {
      tag: 'droplet_capacity_422',
      retryable: false,
      message,
      missingScope: null,
      requestId: null,
    };
  }

  if (
    lower.includes('did not become healthy within') ||
    lower.includes('did not become ready within') ||
    lower.includes('readiness timeout') ||
    lower.includes('wait timeout') ||
    lower.includes('timed out')
  ) {
    return {
      tag: 'readiness_timeout',
      retryable: true,
      message,
      missingScope: null,
      requestId: null,
    };
  }

  return {
    tag: 'gateway_request_failed',
    retryable: true,
    message,
    missingScope: null,
    requestId: extractPairingRequestId(message),
  };
}

export function formatGatewayDiagnostic(diagnostics: GatewayDiagnostic): string {
  const scopeSuffix = diagnostics.missingScope ? ` scope=${diagnostics.missingScope}` : '';
  const requestSuffix = diagnostics.requestId ? ` requestId=${diagnostics.requestId}` : '';
  return `[${diagnostics.tag}]${scopeSuffix}${requestSuffix} ${diagnostics.message}`;
}

class GatewayWsClient {
  private ws: WebSocket | null = null;

  private readonly pending = new Map<string, GatewayPendingRequest>();

  private challengeNonceResolve: ((nonce: string) => void) | null = null;

  private challengeNonceReject: ((error: Error) => void) | null = null;

  constructor(
    private readonly url: string,
    private readonly headers: Record<string, string>,
  ) {}

  async connect(params: {
    token: string;
    role: string;
    scopes: string[];
    timeoutMs?: number;
  }): Promise<void> {
    const timeoutMs = params.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const challengeNoncePromise = new Promise<string>((resolve, reject) => {
      this.challengeNonceResolve = resolve;
      this.challengeNonceReject = reject;
    });

    this.ws = new WebSocket(this.url, {
      headers: this.headers,
      maxPayload: 5 * 1024 * 1024,
    });

    const ws = this.ws;

    ws.on('message', (message) => {
      this.handleMessage(typeof message === 'string' ? message : message.toString('utf8'));
    });

    ws.on('close', (code, reasonBuffer) => {
      const reason = reasonBuffer.toString('utf8');
      const error = new Error(`gateway closed (${code}): ${reason}`);
      this.rejectChallenge(error);
      this.failPending(error);
    });

    ws.on('error', (error) => {
      this.rejectChallenge(error instanceof Error ? error : new Error(String(error)));
    });

    await withTimeout(
      new Promise<void>((resolve, reject) => {
        const onOpen = () => {
          cleanup();
          resolve();
        };
        const onError = (error: Error) => {
          cleanup();
          reject(error);
        };
        const cleanup = () => {
          ws.off('open', onOpen);
          ws.off('error', onError);
        };

        ws.on('open', onOpen);
        ws.on('error', onError);
      }),
      timeoutMs,
      'timed out opening gateway websocket',
    );

    const nonce = await withTimeout(challengeNoncePromise, timeoutMs, 'timed out waiting for gateway challenge');

    await this.request('connect', {
      minProtocol: PROTOCOL_VERSION,
      maxProtocol: PROTOCOL_VERSION,
      client: {
        id: 'pixelport-provisioning',
        version: 'pixelport',
        platform: process.platform,
        mode: 'backend',
      },
      role: params.role,
      scopes: Array.from(new Set(params.scopes)),
      auth: {
        token: params.token,
      },
      challenge: {
        nonce,
      },
    }, timeoutMs);
  }

  async request<T = unknown>(method: string, params: unknown, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
    const ws = this.ws;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      throw new Error('gateway websocket is not connected');
    }

    const id = randomUUID();

    const responsePromise = new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`gateway request timeout: ${method}`));
      }, timeoutMs);

      this.pending.set(id, {
        resolve: (value) => resolve(value as T),
        reject,
        timer,
      });
    });

    ws.send(
      JSON.stringify({
        type: 'req',
        id,
        method,
        params,
      }),
    );

    return responsePromise;
  }

  close(): void {
    for (const request of this.pending.values()) {
      if (request.timer) {
        clearTimeout(request.timer);
      }
      request.reject(new Error('gateway websocket closed'));
    }
    this.pending.clear();

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.close(1000, 'done');
    }
    this.ws = null;
  }

  private rejectChallenge(error: Error): void {
    if (this.challengeNonceReject) {
      this.challengeNonceReject(error);
      this.challengeNonceReject = null;
      this.challengeNonceResolve = null;
    }
  }

  private failPending(error: Error): void {
    for (const request of this.pending.values()) {
      if (request.timer) {
        clearTimeout(request.timer);
      }
      request.reject(error);
    }
    this.pending.clear();
  }

  private handleMessage(raw: string): void {
    let parsed: unknown;

    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }

    if (!isRecord(parsed)) {
      return;
    }

    if (parsed.type === 'event' && parsed.event === 'challenge') {
      const payload = isRecord(parsed.payload) ? parsed.payload : null;
      const nonce = readString(payload?.nonce);
      if (nonce && this.challengeNonceResolve) {
        this.challengeNonceResolve(nonce);
        this.challengeNonceResolve = null;
        this.challengeNonceReject = null;
      }
      return;
    }

    if (parsed.type !== 'res') {
      return;
    }

    const id = readString(parsed.id);
    if (!id) {
      return;
    }

    const pending = this.pending.get(id);
    if (!pending) {
      return;
    }

    if (pending.timer) {
      clearTimeout(pending.timer);
    }
    this.pending.delete(id);

    const ok = parsed.ok === true;
    if (ok) {
      pending.resolve(parsed.payload ?? null);
      return;
    }

    const errorRecord = isRecord(parsed.error) ? parsed.error : null;
    const error = new Error(
      readString(errorRecord?.message) ?? readString(errorRecord?.code) ?? 'gateway request failed',
    ) as GatewayResponseError;

    if (isRecord(errorRecord?.details)) {
      error.gatewayDetails = errorRecord?.details as Record<string, unknown>;
    }

    pending.reject(error);
  }
}

function selectPairingRequest(params: {
  pending: Array<Record<string, unknown>>;
  requestId?: string | null;
  expectedDeviceId?: string | null;
}): string | null {
  if (params.requestId) {
    const exact = params.pending.find((entry) => readString(entry.requestId) === params.requestId);
    return exact ? params.requestId : null;
  }

  if (params.expectedDeviceId) {
    const byDevice = params.pending.find((entry) => readString(entry.deviceId) === params.expectedDeviceId);
    return byDevice ? readString(byDevice.requestId) : null;
  }

  if (params.pending.length === 1) {
    return readString(params.pending[0]?.requestId);
  }

  return null;
}

export async function autoApproveGatewayPairing(params: {
  gatewayWsUrl: string;
  gatewayToken: string;
  requestId?: string | null;
  expectedDeviceId?: string | null;
  timeoutMs?: number;
}): Promise<PairingApprovalResult> {
  const client = new GatewayWsClient(params.gatewayWsUrl, {
    Authorization: `Bearer ${params.gatewayToken}`,
  });

  try {
    await client.connect({
      token: params.gatewayToken,
      role: 'operator',
      scopes: ['operator.read', 'operator.pairing', 'operator.admin'],
      timeoutMs: params.timeoutMs,
    });

    const listPayload = await client.request<Record<string, unknown>>('device.pair.list', {}, params.timeoutMs);
    const pending = Array.isArray(listPayload?.pending)
      ? listPayload.pending.filter((entry): entry is Record<string, unknown> => isRecord(entry))
      : [];

    if (pending.length === 0) {
      return {
        ok: true,
        approved: false,
        requestId: null,
        reason: 'no_pending_request',
      };
    }

    const selectedRequestId = selectPairingRequest({
      pending,
      requestId: params.requestId,
      expectedDeviceId: params.expectedDeviceId,
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

      return {
        ok: false,
        approved: false,
        requestId: null,
        reason: 'multiple pending pairing requests; cannot safely auto-approve without identity',
      };
    }

    await client.request('device.pair.approve', { requestId: selectedRequestId }, params.timeoutMs);

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
      reason: extractErrorMessage(error),
    };
  } finally {
    client.close();
  }
}

export async function dispatchBootstrapWithPairingRecovery(params: {
  gatewayHttpUrl: string;
  gatewayWsUrl: string;
  gatewayToken: string;
  message: string;
  expectedDeviceId?: string | null;
}): Promise<BootstrapDispatchResult> {
  const first = await triggerOnboardingBootstrap({
    gatewayUrl: params.gatewayHttpUrl,
    gatewayToken: params.gatewayToken,
    message: params.message,
  });

  if (first.ok) {
    return {
      ...first,
      diagnostics: null,
      autoPairAttempted: false,
      autoPairApproved: false,
      autoPairReason: null,
    };
  }

  const firstDiagnostics = classifyGatewayFailure({
    status: first.status,
    message: first.body,
  });

  if (firstDiagnostics.tag !== 'pairing_required') {
    return {
      ...first,
      diagnostics: firstDiagnostics,
      autoPairAttempted: false,
      autoPairApproved: false,
      autoPairReason: null,
    };
  }

  const pairingResult = await autoApproveGatewayPairing({
    gatewayWsUrl: params.gatewayWsUrl,
    gatewayToken: params.gatewayToken,
    requestId: firstDiagnostics.requestId,
    expectedDeviceId: params.expectedDeviceId ?? null,
    timeoutMs: DEFAULT_TIMEOUT_MS,
  });

  if (!pairingResult.ok) {
    return {
      ...first,
      diagnostics: firstDiagnostics,
      autoPairAttempted: true,
      autoPairApproved: false,
      autoPairReason: pairingResult.reason,
    };
  }

  const retry = await triggerOnboardingBootstrap({
    gatewayUrl: params.gatewayHttpUrl,
    gatewayToken: params.gatewayToken,
    message: params.message,
  });

  if (retry.ok) {
    return {
      ...retry,
      diagnostics: null,
      autoPairAttempted: true,
      autoPairApproved: pairingResult.approved,
      autoPairReason: pairingResult.reason,
    };
  }

  return {
    ...retry,
    diagnostics: classifyGatewayFailure({
      status: retry.status,
      message: retry.body,
    }),
    autoPairAttempted: true,
    autoPairApproved: pairingResult.approved,
    autoPairReason: pairingResult.reason,
  };
}

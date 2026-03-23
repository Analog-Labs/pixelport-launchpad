import { beforeEach, describe, expect, it, vi } from "vitest";

const sshExec = vi.fn();

vi.mock("../../api/lib/droplet-ssh", () => ({
  sshExec,
}));

describe("openclaw pairing ssh helper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns no_pending_request when the droplet has no pending pairings", async () => {
    const { approveGatewayPairingViaSsh } = await import("../../api/lib/openclaw-pairing-ssh");

    sshExec.mockResolvedValueOnce(
      JSON.stringify({
        pending: [],
        paired: [],
      }),
    );

    const result = await approveGatewayPairingViaSsh({
      host: "127.0.0.1",
      gatewayToken: "gw-token",
    });

    expect(result).toEqual({
      ok: true,
      approved: false,
      requestId: null,
      reason: "no_pending_request",
    });
    expect(sshExec).toHaveBeenCalledTimes(1);
  });

  it("approves an explicit pending request id", async () => {
    const { approveGatewayPairingViaSsh } = await import("../../api/lib/openclaw-pairing-ssh");

    sshExec.mockResolvedValueOnce(
      JSON.stringify({
        pending: [
          {
            requestId: "req-123",
            deviceId: "device-123",
          },
        ],
      }),
    );
    sshExec.mockResolvedValueOnce('Approved device-123 (req-123)');

    const result = await approveGatewayPairingViaSsh({
      host: "127.0.0.1",
      gatewayToken: "gw-token",
      requestId: "req-123",
    });

    expect(result).toEqual({
      ok: true,
      approved: true,
      requestId: "req-123",
      reason: "approved",
    });
    expect(sshExec).toHaveBeenCalledTimes(2);
    expect(sshExec.mock.calls[1]?.[1]).toContain("openclaw devices approve --json");
    expect(sshExec.mock.calls[1]?.[1]).toContain("req-123");
  });

  it("does not approve when expected device is not pending", async () => {
    const { approveGatewayPairingViaSsh } = await import("../../api/lib/openclaw-pairing-ssh");

    sshExec.mockResolvedValueOnce(
      JSON.stringify({
        pending: [
          {
            requestId: "req-456",
            deviceId: "device-456",
          },
        ],
      }),
    );

    const result = await approveGatewayPairingViaSsh({
      host: "127.0.0.1",
      gatewayToken: "gw-token",
      expectedDeviceId: "device-expected",
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toContain("device-expected");
    expect(sshExec).toHaveBeenCalledTimes(1);
  });
});


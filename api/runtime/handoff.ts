import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest, errorResponse } from '../lib/auth';
import { tryRecoverProvisioningTenant } from '../lib/provisioning-recovery';
import {
  buildGatewayControlUiLaunchUrl,
  buildPaperclipHandoffPayload,
  getMissingPaperclipHandoffEnv,
  isPaperclipHandoffReadyStatus,
  PaperclipHandoffConfigError,
  resolvePaperclipHandoffConfig,
  resolvePaperclipRuntimeUrl,
  signPaperclipHandoffPayload,
  PAPERCLIP_HANDOFF_CONTRACT_VERSION,
} from '../lib/paperclip-handoff-contract';

function resolveSource(rawSource: unknown): string {
  if (typeof rawSource !== 'string') {
    return 'launchpad';
  }

  const trimmed = rawSource.trim();
  if (!trimmed) {
    return 'launchpad';
  }

  return trimmed.slice(0, 80);
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<VercelResponse> {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { tenant, userId } = await authenticateRequest(req);
    const recovery = await tryRecoverProvisioningTenant(tenant);
    const effectiveTenant = recovery.tenant;

    const missingEnv = getMissingPaperclipHandoffEnv(process.env);
    if (missingEnv.length > 0) {
      return res.status(503).json({
        error: 'Paperclip runtime handoff is not configured.',
        missing: missingEnv,
      });
    }

    if (!isPaperclipHandoffReadyStatus(effectiveTenant.status)) {
      return res.status(409).json({
        error: 'Tenant is not ready for Paperclip runtime handoff.',
        status: effectiveTenant.status,
      });
    }

    const runtimeUrl = resolvePaperclipRuntimeUrl({
      onboardingData: effectiveTenant.onboarding_data,
      tenantSlug: effectiveTenant.slug,
      dropletIp: effectiveTenant.droplet_ip,
      runtimeBaseDomain: process.env.PAPERCLIP_RUNTIME_BASE_DOMAIN,
    });
    if (!runtimeUrl) {
      return res.status(409).json({
        error: 'Paperclip runtime target unavailable for this tenant.',
        code: 'runtime-target-unavailable',
      });
    }

    const workspaceLaunchUrl = buildGatewayControlUiLaunchUrl(runtimeUrl, effectiveTenant.gateway_token);
    if (!workspaceLaunchUrl) {
      return res.status(409).json({
        error: 'Paperclip runtime auth token unavailable for this tenant.',
        code: 'runtime-auth-unavailable',
      });
    }

    let config;
    try {
      config = resolvePaperclipHandoffConfig(process.env);
    } catch (error) {
      if (error instanceof PaperclipHandoffConfigError) {
        return res.status(503).json({
          error: 'Paperclip runtime handoff is not configured.',
          missing: error.fields,
        });
      }
      throw error;
    }

    const source = resolveSource(req.body?.source);

    const payload = buildPaperclipHandoffPayload({
      userId,
      tenantId: tenant.id,
      tenantSlug: effectiveTenant.slug,
      tenantStatus: effectiveTenant.status,
      tenantPlan: effectiveTenant.plan,
      source,
      ttlSeconds: config.ttlSeconds,
    });
    const handoffToken = signPaperclipHandoffPayload(payload, config.handoffSecret);

    // Runtime URL prefers HTTPS (tenant domain / persisted runtime URL) and falls back to droplet IP HTTP for compatibility.
    return res.status(200).json({
      contract_version: PAPERCLIP_HANDOFF_CONTRACT_VERSION,
      paperclip_runtime_url: runtimeUrl,
      workspace_launch_url: workspaceLaunchUrl,
      launch_auth_mode: 'gateway-token',
      handoff_token: handoffToken,
      expires_at: new Date(payload.exp * 1000).toISOString(),
      tenant: {
        id: effectiveTenant.id,
        slug: effectiveTenant.slug,
        name: effectiveTenant.name,
        status: effectiveTenant.status,
        plan: effectiveTenant.plan,
      },
      user_id: userId,
      source,
    });
  } catch (error) {
    return errorResponse(res, error);
  }
}

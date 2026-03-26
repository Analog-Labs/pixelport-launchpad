import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Inngest } from "inngest";
import { authenticateRequest, errorResponse } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { buildOnboardingData } from "../lib/onboarding-schema";
import {
  TENANT_STATUS,
  isTenantDraft,
  isTenantProvisioningComplete,
  isTenantProvisioningInFlight,
} from "../lib/tenant-status";

const inngest = new Inngest({
  id: "pixelport",
  eventKey: process.env.INNGEST_EVENT_KEY,
});

function successPayload(status: string, idempotent: boolean) {
  return {
    launched: true,
    status,
    idempotent,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<VercelResponse> {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { tenant } = await authenticateRequest(req);
    const currentStatus = tenant.status;

    if (isTenantProvisioningInFlight(currentStatus)) {
      return res.status(200).json(successPayload(TENANT_STATUS.PROVISIONING, true));
    }

    if (isTenantProvisioningComplete(currentStatus)) {
      return res.status(200).json(successPayload(currentStatus, true));
    }

    if (!isTenantDraft(currentStatus)) {
      return res.status(409).json({
        error: `Tenant must be in draft status before launch (current: ${currentStatus || "unknown"})`,
        status: currentStatus || null,
      });
    }

    const launchStartedAt = new Date().toISOString();
    const normalized = buildOnboardingData(tenant.onboarding_data, {
      launch_started_at: launchStartedAt,
      launch_completed_at: null,
      v2: {
        launch: {
          started_at: launchStartedAt,
          completed_at: null,
        },
      },
    });

    if (!normalized.ok) {
      return res.status(400).json({ error: `Invalid onboarding payload: ${normalized.error}` });
    }

    const { data: transitionedTenant, error: transitionError } = await supabase
      .from("tenants")
      .update({
        status: TENANT_STATUS.PROVISIONING,
        onboarding_data: normalized.onboardingData,
      })
      .eq("id", tenant.id)
      .eq("status", TENANT_STATUS.DRAFT)
      .select("id, status, onboarding_data")
      .maybeSingle();

    if (transitionError) {
      console.error("Failed to transition tenant to provisioning:", transitionError);
      return res.status(500).json({ error: "Failed to start provisioning. Please retry." });
    }

    if (!transitionedTenant) {
      const { data: latestTenant, error: latestTenantError } = await supabase
        .from("tenants")
        .select("status")
        .eq("id", tenant.id)
        .single();

      if (latestTenantError) {
        console.error("Failed to read latest tenant status after launch race:", latestTenantError);
        return res.status(500).json({ error: "Failed to verify launch status. Please retry." });
      }

      const latestStatus = latestTenant?.status ?? null;
      if (isTenantProvisioningInFlight(latestStatus) || isTenantProvisioningComplete(latestStatus)) {
        return res.status(200).json(successPayload(latestStatus, true));
      }

      return res.status(409).json({
        error: "Tenant status changed before launch could be applied. Please refresh and retry.",
        status: latestStatus,
      });
    }

    try {
      await inngest.send({
        name: "pixelport/tenant.created",
        data: {
          tenantId: tenant.id,
          trialMode: true,
        },
      });
    } catch (inngestError) {
      console.error("Failed to send provisioning launch event:", inngestError);

      const rollbackOnboarding = buildOnboardingData(transitionedTenant.onboarding_data, {
        launch_started_at: null,
        v2: {
          launch: {
            started_at: null,
          },
        },
      });

      const rollbackPayload = rollbackOnboarding.ok
        ? {
            status: TENANT_STATUS.DRAFT,
            onboarding_data: rollbackOnboarding.onboardingData,
          }
        : { status: TENANT_STATUS.DRAFT };

      const { error: rollbackError } = await supabase
        .from("tenants")
        .update(rollbackPayload)
        .eq("id", tenant.id)
        .eq("status", TENANT_STATUS.PROVISIONING);

      if (rollbackError) {
        console.error("Failed to rollback tenant after launch event failure:", rollbackError);
        return res.status(500).json({
          error: "Provisioning event failed and rollback was incomplete. Please contact support.",
        });
      }

      return res.status(503).json({
        error: "Failed to queue provisioning launch. The tenant was reset to draft so you can retry safely.",
      });
    }

    return res.status(202).json(successPayload(TENANT_STATUS.PROVISIONING, false));
  } catch (error) {
    return errorResponse(res, error);
  }
}

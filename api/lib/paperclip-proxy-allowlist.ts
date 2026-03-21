/**
 * Paperclip proxy route allowlist.
 *
 * Every route the dashboard proxy is permitted to forward to Paperclip is
 * listed here. Anything not listed is blocked (secure by default).
 *
 * Source of truth: docs/paperclip-api-contract.md "Recommended T2 proxy starter allowlist"
 */

export interface AllowlistEntry {
  /** Pattern matched against the path after /api/tenant-proxy/ */
  proxyPattern: string;
  /** Allowed HTTP methods */
  methods: string[];
  /** If true, the target path is /api/companies/{companyId}/{rest after "companies/"} */
  companyScoped: boolean;
}

export const PROXY_ALLOWLIST: readonly AllowlistEntry[] = [
  // ── Company-scoped routes ─────────────────────────────────────────────
  { proxyPattern: 'companies/dashboard', methods: ['GET'], companyScoped: true },
  { proxyPattern: 'companies/sidebar-badges', methods: ['GET'], companyScoped: true },
  { proxyPattern: 'companies/agents', methods: ['GET'], companyScoped: true },
  { proxyPattern: 'companies/issues', methods: ['GET'], companyScoped: true },
  { proxyPattern: 'companies/heartbeat-runs', methods: ['GET'], companyScoped: true },
  { proxyPattern: 'companies/live-runs', methods: ['GET'], companyScoped: true },
  { proxyPattern: 'companies/approvals', methods: ['GET'], companyScoped: true },
  { proxyPattern: 'companies/costs/summary', methods: ['GET'], companyScoped: true },

  // ── Issue routes ──────────────────────────────────────────────────────
  { proxyPattern: 'issues/:id', methods: ['GET', 'PATCH'], companyScoped: false },
  { proxyPattern: 'issues/:id/heartbeat-context', methods: ['GET'], companyScoped: false },
  { proxyPattern: 'issues/:id/comments', methods: ['GET', 'POST'], companyScoped: false },
  { proxyPattern: 'issues/:id/comments/:commentId', methods: ['GET'], companyScoped: false },
  { proxyPattern: 'issues/:id/checkout', methods: ['POST'], companyScoped: false },
  { proxyPattern: 'issues/:id/release', methods: ['POST'], companyScoped: false },
  { proxyPattern: 'issues/:id/active-run', methods: ['GET'], companyScoped: false },
  { proxyPattern: 'issues/:id/live-runs', methods: ['GET'], companyScoped: false },
  { proxyPattern: 'issues/:id/runs', methods: ['GET'], companyScoped: false },

  // ── Heartbeat run routes ──────────────────────────────────────────────
  { proxyPattern: 'heartbeat-runs/:runId', methods: ['GET'], companyScoped: false },
  { proxyPattern: 'heartbeat-runs/:runId/events', methods: ['GET'], companyScoped: false },
  { proxyPattern: 'heartbeat-runs/:runId/log', methods: ['GET'], companyScoped: false },

  // ── Approval routes ───────────────────────────────────────────────────
  { proxyPattern: 'approvals/:id', methods: ['GET'], companyScoped: false },
  { proxyPattern: 'approvals/:id/issues', methods: ['GET'], companyScoped: false },
  { proxyPattern: 'approvals/:id/approve', methods: ['POST'], companyScoped: false },
  { proxyPattern: 'approvals/:id/reject', methods: ['POST'], companyScoped: false },
  { proxyPattern: 'approvals/:id/request-revision', methods: ['POST'], companyScoped: false },
  { proxyPattern: 'approvals/:id/resubmit', methods: ['POST'], companyScoped: false },
  { proxyPattern: 'approvals/:id/comments', methods: ['GET', 'POST'], companyScoped: false },
];

/**
 * Match an incoming proxy request against the allowlist and produce the
 * rewritten Paperclip target path.
 *
 * @param method  HTTP method (uppercase)
 * @param proxyPath  Path after /api/tenant-proxy/ (no leading slash)
 * @param companyId  Tenant's Paperclip company ID for injection
 * @returns  The rewritten target path, or null if not allowed
 */
export function matchProxyRoute(
  method: string,
  proxyPath: string,
  companyId: string,
): { targetPath: string } | null {
  const upperMethod = method.toUpperCase();
  // Normalize: strip leading/trailing slashes
  const normalizedPath = proxyPath.replace(/^\/+|\/+$/g, '');
  const incomingSegments = normalizedPath.split('/');

  for (const entry of PROXY_ALLOWLIST) {
    const patternSegments = entry.proxyPattern.split('/');

    if (incomingSegments.length !== patternSegments.length) continue;

    let matched = true;
    for (let i = 0; i < patternSegments.length; i++) {
      const pat = patternSegments[i];
      const seg = incomingSegments[i];

      if (pat.startsWith(':')) {
        // Dynamic segment — must be non-empty
        if (!seg) {
          matched = false;
          break;
        }
      } else {
        // Literal segment — must match exactly
        if (pat !== seg) {
          matched = false;
          break;
        }
      }
    }

    if (!matched) continue;

    // Check HTTP method
    if (!entry.methods.includes(upperMethod)) continue;

    // Build the target path
    if (entry.companyScoped) {
      // "companies/dashboard" → "/api/companies/{companyId}/dashboard"
      const rest = normalizedPath.slice('companies/'.length);
      return { targetPath: `/api/companies/${companyId}/${rest}` };
    } else {
      // "issues/abc-123/comments" → "/api/issues/abc-123/comments"
      return { targetPath: `/api/${normalizedPath}` };
    }
  }

  return null;
}

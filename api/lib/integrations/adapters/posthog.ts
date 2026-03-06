/**
 * PostHog adapter — handles all agent interactions with a tenant's PostHog instance.
 *
 * The personal API key (phx_*) is used as a Bearer token.
 * Host is read from metadata.posthog_host (defaults to US Cloud).
 * Project ID is read from metadata.project_id (required, collected during connect).
 *
 * Key actions:
 *   read_traffic   — page views and unique visitors over time
 *   read_funnels   — conversion funnel analysis
 *   read_events    — raw event data
 *   query_insights — arbitrary HogQL queries (most flexible)
 */

const DEFAULT_HOST = 'https://us.posthog.com';

interface AdapterCredentials {
  accessToken: string;
  accountId: string | null;
  metadata: Record<string, unknown>;
}

type ActionResult = unknown;

function getHost(metadata: Record<string, unknown>): string {
  const host = metadata.posthog_host as string | undefined;
  if (host) {
    // Normalize: strip trailing slash
    return host.replace(/\/+$/, '');
  }
  return DEFAULT_HOST;
}

function getProjectId(metadata: Record<string, unknown>, params: Record<string, unknown>): string {
  const pid = metadata.project_id || params.project_id;
  if (!pid) {
    throw new Error('PostHog project_id is required. Reconnect the integration and provide your Project ID.');
  }
  return String(pid);
}

export async function handleAction(
  action: string,
  params: Record<string, unknown>,
  credentials: AdapterCredentials
): Promise<ActionResult> {
  const { accessToken, metadata } = credentials;
  const host = getHost(metadata);
  const projectId = getProjectId(metadata, params);

  switch (action) {
    case 'read_traffic':
      return readTraffic(accessToken, host, projectId, params);
    case 'read_funnels':
      return readFunnels(accessToken, host, projectId, params);
    case 'read_events':
      return readEvents(accessToken, host, projectId, params);
    case 'query_insights':
      return queryInsights(accessToken, host, projectId, params);
    default:
      throw new Error(`Unknown PostHog action: ${action}`);
  }
}

/**
 * Read traffic trends — pageviews and unique visitors over a period.
 * Uses TrendsQuery with EventsNode series (PostHog Query API v2 schema).
 */
async function readTraffic(
  token: string,
  host: string,
  projectId: string,
  params: Record<string, unknown>
): Promise<ActionResult> {
  const dateFrom = (params.date_from as string) || '-7d';
  const dateTo = (params.date_to as string) || undefined;
  const interval = (params.interval as string) || 'day';

  const query = {
    kind: 'TrendsQuery',
    series: [
      { kind: 'EventsNode', event: '$pageview', name: 'Page Views', math: 'total' },
      { kind: 'EventsNode', event: '$pageview', name: 'Unique Visitors', math: 'dau' },
    ],
    dateRange: { date_from: dateFrom, date_to: dateTo },
    interval,
    trendsFilter: {},
  };

  return postQuery(token, host, projectId, query);
}

/**
 * Read funnel conversion data.
 * Uses FunnelsQuery with EventsNode series.
 */
async function readFunnels(
  token: string,
  host: string,
  projectId: string,
  params: Record<string, unknown>
): Promise<ActionResult> {
  const steps = params.steps as Array<{ event: string }> | undefined;
  if (!steps || steps.length < 2) {
    throw new Error('Funnels require at least 2 steps. Provide params.steps = [{ event: "$pageview" }, { event: "signup" }]');
  }

  const dateFrom = (params.date_from as string) || '-30d';

  const query = {
    kind: 'FunnelsQuery',
    series: steps.map((s) => ({ kind: 'EventsNode' as const, event: s.event, name: s.event })),
    dateRange: { date_from: dateFrom },
    funnelsFilter: {
      funnelOrderType: 'ordered',
    },
  };

  return postQuery(token, host, projectId, query);
}

/**
 * Read raw events — most recent events matching optional filters.
 */
async function readEvents(
  token: string,
  host: string,
  projectId: string,
  params: Record<string, unknown>
): Promise<ActionResult> {
  const eventName = (params.event as string) || '$pageview';
  const limit = (params.limit as number) || 100;
  const dateFrom = (params.date_from as string) || '-7d';

  const query = {
    kind: 'EventsQuery',
    select: ['*'],
    event: eventName,
    limit,
    after: dateFrom,
  };

  return postQuery(token, host, projectId, query);
}

/**
 * Run an arbitrary HogQL query — the most flexible action.
 *
 * Example params:
 *   { query: "SELECT properties.$current_url, count() FROM events WHERE event = '$pageview' GROUP BY 1 ORDER BY 2 DESC LIMIT 20" }
 */
async function queryInsights(
  token: string,
  host: string,
  projectId: string,
  params: Record<string, unknown>
): Promise<ActionResult> {
  const hogqlQuery = params.query as string | undefined;
  if (!hogqlQuery) {
    throw new Error('query_insights requires params.query (a HogQL SQL string)');
  }

  const query = {
    kind: 'HogQLQuery',
    query: hogqlQuery,
  };

  return postQuery(token, host, projectId, query);
}

/**
 * Post a query to PostHog's Query API.
 */
async function postQuery(
  token: string,
  host: string,
  projectId: string,
  query: Record<string, unknown>
): Promise<ActionResult> {
  const url = `${host}/api/projects/${projectId}/query/`;

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(30000),
  });

  if (!resp.ok) {
    const errorText = await resp.text();
    throw new Error(`PostHog Query API returned ${resp.status}: ${errorText.slice(0, 500)}`);
  }

  return resp.json();
}

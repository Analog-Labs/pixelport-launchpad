/**
 * Integration Registry — single source of truth for all supported integrations.
 *
 * Adding a new integration starts here: define its metadata, auth config,
 * and capabilities. The frontend Connections page renders from this catalog,
 * and the generic OAuth endpoints use the OAuth config to drive the flow.
 */

export interface IntegrationDefinition {
  service: string;
  displayName: string;
  category: 'social' | 'analytics' | 'crm' | 'seo' | 'design' | 'publishing' | 'email_marketing' | 'communication';
  authType: 'oauth' | 'api_key';
  description: string;
  icon: string;
  color: string;
  capabilities: string[];
  tier: 1 | 2 | 3;
  comingSoon?: boolean;

  // OAuth config (only for authType === 'oauth')
  oauth?: {
    authorizationUrl: string;
    tokenUrl: string;
    clientIdEnvVar: string;
    clientSecretEnvVar: string;
    scopes: string[];
    pkce?: boolean;
    additionalParams?: Record<string, string>;
  };

  // API key config (only for authType === 'api_key')
  apiKeyConfig?: {
    instructions: string;
    validationUrl?: string;
    headerName?: string;
    /** Extra fields the user must provide alongside the API key */
    extraFields?: Array<{
      name: string;
      label: string;
      placeholder?: string;
      required?: boolean;
    }>;
  };
}

export const INTEGRATION_REGISTRY: IntegrationDefinition[] = [
  // --- Tier 1: Social ---
  {
    service: 'x',
    displayName: 'X (Twitter)',
    category: 'social',
    authType: 'oauth',
    description: 'Read mentions, engagement metrics, and post content with approval.',
    icon: 'x',
    color: '#000000',
    capabilities: ['read_mentions', 'read_engagement', 'post_content', 'read_followers'],
    tier: 1,
    oauth: {
      authorizationUrl: 'https://twitter.com/i/oauth2/authorize',
      tokenUrl: 'https://api.twitter.com/2/oauth2/token',
      clientIdEnvVar: 'X_CLIENT_ID',
      clientSecretEnvVar: 'X_CLIENT_SECRET',
      scopes: ['tweet.read', 'tweet.write', 'users.read', 'offline.access'],
      pkce: true,
    },
  },
  {
    service: 'linkedin',
    displayName: 'LinkedIn',
    category: 'social',
    authType: 'oauth',
    description: 'Read page analytics, followers, and post content with approval.',
    icon: 'linkedin',
    color: '#0A66C2',
    capabilities: ['read_page_analytics', 'post_content', 'read_followers'],
    tier: 1,
    oauth: {
      authorizationUrl: 'https://www.linkedin.com/oauth/v2/authorization',
      tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
      clientIdEnvVar: 'LINKEDIN_CLIENT_ID',
      clientSecretEnvVar: 'LINKEDIN_CLIENT_SECRET',
      scopes: ['openid', 'profile', 'w_member_social', 'r_organization_social', 'rw_organization_admin'],
    },
  },

  // --- Tier 1: Analytics ---
  {
    service: 'posthog',
    displayName: 'PostHog',
    category: 'analytics',
    authType: 'api_key',
    description: 'Traffic trends, funnels, top pages, referral sources, and campaign performance.',
    icon: 'posthog',
    color: '#F9BD2B',
    capabilities: ['read_traffic', 'read_funnels', 'read_events', 'query_insights'],
    tier: 1,
    apiKeyConfig: {
      instructions: 'Go to PostHog > Settings > Personal API Keys. Create a key with read access and paste it below. You can find your Project ID in PostHog > Settings > Project.',
      headerName: 'Authorization',
      extraFields: [
        { name: 'posthog_host', label: 'PostHog Host', placeholder: 'https://us.posthog.com', required: false },
        { name: 'project_id', label: 'Project ID', placeholder: 'e.g. 12345', required: true },
      ],
    },
  },
  {
    service: 'ga4',
    displayName: 'Google Analytics',
    category: 'analytics',
    authType: 'oauth',
    description: 'Pageviews, sessions, referrals, conversions, and geographic data.',
    icon: 'google-analytics',
    color: '#E37400',
    capabilities: ['read_traffic', 'read_pageviews', 'read_referrals', 'read_conversions'],
    tier: 1,
    oauth: {
      authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      clientIdEnvVar: 'GOOGLE_CLIENT_ID',
      clientSecretEnvVar: 'GOOGLE_CLIENT_SECRET',
      scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
      additionalParams: { access_type: 'offline', prompt: 'consent' },
    },
  },

  // --- Tier 2: CRM ---
  {
    service: 'hubspot',
    displayName: 'HubSpot',
    category: 'crm',
    authType: 'oauth',
    description: 'Contact lists, deal pipeline, email campaigns, and lead scoring.',
    icon: 'hubspot',
    color: '#FF7A59',
    capabilities: ['read_contacts', 'read_deals', 'read_campaigns', 'read_analytics'],
    tier: 2,
    comingSoon: true,
    oauth: {
      authorizationUrl: 'https://app.hubspot.com/oauth/authorize',
      tokenUrl: 'https://api.hubapi.com/oauth/v1/token',
      clientIdEnvVar: 'HUBSPOT_CLIENT_ID',
      clientSecretEnvVar: 'HUBSPOT_CLIENT_SECRET',
      scopes: ['crm.objects.contacts.read', 'crm.objects.deals.read'],
    },
  },

  // --- Tier 2: Ads ---
  {
    service: 'google_ads',
    displayName: 'Google Ads',
    category: 'analytics',
    authType: 'oauth',
    description: 'Campaign spend, CTR, conversions, and keyword performance.',
    icon: 'google-ads',
    color: '#4285F4',
    capabilities: ['read_campaigns', 'read_spend', 'read_conversions'],
    tier: 2,
    comingSoon: true,
    oauth: {
      authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      clientIdEnvVar: 'GOOGLE_CLIENT_ID',
      clientSecretEnvVar: 'GOOGLE_CLIENT_SECRET',
      scopes: ['https://www.googleapis.com/auth/adwords.readonly'],
      additionalParams: { access_type: 'offline', prompt: 'consent' },
    },
  },

  // --- Tier 2: SEO ---
  {
    service: 'semrush',
    displayName: 'SEMrush',
    category: 'seo',
    authType: 'api_key',
    description: 'Keyword rankings, backlinks, and competitor traffic estimates.',
    icon: 'semrush',
    color: '#FF642D',
    capabilities: ['read_keywords', 'read_backlinks', 'read_competitor_traffic'],
    tier: 2,
    comingSoon: true,
    apiKeyConfig: {
      instructions: 'Go to SEMrush > My Profile > API Key. Copy and paste your API key below.',
      headerName: 'key',
    },
  },
  {
    service: 'search_console',
    displayName: 'Google Search Console',
    category: 'seo',
    authType: 'oauth',
    description: 'Search queries, click-through rates, and indexing status.',
    icon: 'google-search-console',
    color: '#4285F4',
    capabilities: ['read_queries', 'read_ctr', 'read_indexing'],
    tier: 2,
    comingSoon: true,
    oauth: {
      authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      clientIdEnvVar: 'GOOGLE_CLIENT_ID',
      clientSecretEnvVar: 'GOOGLE_CLIENT_SECRET',
      scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
      additionalParams: { access_type: 'offline', prompt: 'consent' },
    },
  },
];

/**
 * Get a single integration definition by service name.
 */
export function getIntegrationDef(service: string): IntegrationDefinition | undefined {
  return INTEGRATION_REGISTRY.find((def) => def.service === service);
}

/**
 * Get the public registry (safe to send to frontend — no env var names or internal config).
 */
export function getPublicRegistry(): Array<{
  service: string;
  displayName: string;
  category: string;
  authType: string;
  description: string;
  icon: string;
  color: string;
  capabilities: string[];
  tier: number;
  comingSoon: boolean;
}> {
  return INTEGRATION_REGISTRY.map((def) => ({
    service: def.service,
    displayName: def.displayName,
    category: def.category,
    authType: def.authType,
    description: def.description,
    icon: def.icon,
    color: def.color,
    capabilities: def.capabilities,
    tier: def.tier,
    comingSoon: def.comingSoon ?? false,
  }));
}

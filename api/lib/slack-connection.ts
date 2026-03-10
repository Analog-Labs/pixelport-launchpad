export const REQUIRED_SLACK_BOT_SCOPES = [
  'app_mentions:read',
  'channels:history',
  'channels:read',
  'chat:write',
  'files:read',
  'files:write',
  'groups:history',
  'groups:read',
  'im:history',
  'im:read',
  'im:write',
  'reactions:write',
  'users:read',
] as const;

export type RequiredSlackBotScope = (typeof REQUIRED_SLACK_BOT_SCOPES)[number];

export type SlackConnectionStatus =
  | 'not_connected'
  | 'reauthorization_required'
  | 'activating'
  | 'active';

export type SlackConnectionRecord = {
  team_id: string;
  team_name?: string | null;
  is_active: boolean;
  connected_at?: string | null;
  scopes?: string[] | string | null;
  installer_user_id?: string | null;
};

export type DerivedSlackConnection = {
  connected: boolean;
  active: boolean;
  team_id?: string;
  team_name?: string | null;
  connected_at?: string | null;
  scopes: string[];
  status: SlackConnectionStatus;
  missing_scopes: string[];
  reauthorization_required: boolean;
  installer_user_id?: string | null;
};

export function normalizeSlackScopes(scopes: string[] | string | null | undefined): string[] {
  const source = Array.isArray(scopes)
    ? scopes
    : typeof scopes === 'string'
      ? scopes.split(',')
      : [];

  return [...new Set(source.map((scope) => scope.trim()).filter(Boolean))].sort();
}

export function getMissingSlackScopes(scopes: string[] | string | null | undefined): string[] {
  const normalized = new Set(normalizeSlackScopes(scopes));
  return REQUIRED_SLACK_BOT_SCOPES.filter((scope) => !normalized.has(scope));
}

export function deriveSlackConnection(connection: SlackConnectionRecord | null | undefined): DerivedSlackConnection {
  if (!connection) {
    return {
      connected: false,
      active: false,
      scopes: [],
      status: 'not_connected',
      missing_scopes: [],
      reauthorization_required: false,
    };
  }

  const scopes = normalizeSlackScopes(connection.scopes);
  const missingScopes = getMissingSlackScopes(scopes);
  const reauthorizationRequired = missingScopes.length > 0;
  const active = connection.is_active && !reauthorizationRequired;

  return {
    connected: true,
    active,
    team_id: connection.team_id,
    team_name: connection.team_name ?? null,
    connected_at: connection.connected_at ?? null,
    scopes,
    status: reauthorizationRequired
      ? 'reauthorization_required'
      : active
        ? 'active'
        : 'activating',
    missing_scopes: missingScopes,
    reauthorization_required: reauthorizationRequired,
    installer_user_id: connection.installer_user_id ?? null,
  };
}

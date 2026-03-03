import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_PROJECT_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing SUPABASE_PROJECT_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export interface Tenant {
  id: string;
  supabase_user_id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  droplet_id: string | null;
  droplet_ip: string | null;
  gateway_token: string | null;
  litellm_team_id: string | null;
  agentmail_inbox: string | null;
  onboarding_data: Record<string, unknown>;
  settings: Record<string, unknown>;
  trial_ends_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuthResult {
  tenant: Tenant;
  userId: string;
}

export class AuthError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'AuthError';
    this.statusCode = statusCode;
  }
}

function getBearerToken(req: VercelRequest): string {
  const authHeader = req.headers.authorization;
  const value = Array.isArray(authHeader) ? authHeader[0] : authHeader;

  if (!value || !value.startsWith('Bearer ')) {
    throw new AuthError('Missing or invalid Authorization header', 401);
  }

  return value.slice(7);
}

export async function authenticateRequest(req: VercelRequest): Promise<AuthResult> {
  const token = getBearerToken(req);

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);

  if (authError || !user) {
    throw new AuthError('Invalid or expired token', 401);
  }

  const { data: tenant, error } = await supabase
    .from('tenants')
    .select('*')
    .eq('supabase_user_id', user.id)
    .single();

  if (error || !tenant) {
    throw new AuthError('Tenant not found for this user', 404);
  }

  return {
    tenant: tenant as Tenant,
    userId: user.id,
  };
}

export function errorResponse(res: VercelResponse, error: unknown): VercelResponse {
  if (error instanceof AuthError) {
    return res.status(error.statusCode).json({ error: error.message });
  }

  console.error('Unexpected error:', error);
  return res.status(500).json({ error: 'Internal server error' });
}

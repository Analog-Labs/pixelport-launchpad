import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createCipheriv, randomBytes } from 'crypto';
import { authenticateRequest, errorResponse } from '../lib/auth';
import { supabase } from '../lib/supabase';

const ENCRYPTION_KEY = process.env.API_KEY_ENCRYPTION_KEY;

function getEncryptionKey(): Buffer {
  if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 64) {
    throw new Error('API_KEY_ENCRYPTION_KEY must be a 64-char hex string');
  }
  return Buffer.from(ENCRYPTION_KEY, 'hex');
}

function encrypt(text: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-cbc', getEncryptionKey(), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<VercelResponse> {
  try {
    const { tenant } = await authenticateRequest(req);

    if (req.method === 'GET') {
      const { data: keys, error } = await supabase
        .from('api_keys')
        .select('id, provider, key_alias, key_hint, is_active, created_at')
        .eq('tenant_id', tenant.id);

      if (error) {
        return res.status(500).json({ error: 'Failed to fetch API keys' });
      }

      return res.status(200).json(keys ?? []);
    }

    if (req.method === 'POST') {
      const { provider, key_alias, api_key } = (req.body ?? {}) as {
        provider?: string;
        key_alias?: string;
        api_key?: string;
      };

      if (!provider || !api_key) {
        return res.status(400).json({ error: 'provider and api_key are required' });
      }

      if (!['openai', 'anthropic', 'google'].includes(provider)) {
        return res.status(400).json({ error: 'Invalid provider. Must be: openai, anthropic, or google' });
      }

      const encrypted = encrypt(api_key);
      const hint = `...${api_key.slice(-4)}`;

      const { data, error } = await supabase
        .from('api_keys')
        .upsert(
          {
            tenant_id: tenant.id,
            provider,
            key_alias: key_alias || `${provider} key`,
            encrypted_key: encrypted,
            key_hint: hint,
            is_active: true,
          },
          {
            onConflict: 'tenant_id,provider',
          }
        )
        .select('id, provider, key_alias, key_hint, is_active')
        .single();

      if (error) {
        return res.status(500).json({ error: 'Failed to save API key' });
      }

      return res.status(201).json(data);
    }

    if (req.method === 'DELETE') {
      const { provider } = (req.body ?? {}) as { provider?: string };

      if (!provider) {
        return res.status(400).json({ error: 'provider is required' });
      }

      const { error } = await supabase
        .from('api_keys')
        .delete()
        .eq('tenant_id', tenant.id)
        .eq('provider', provider);

      if (error) {
        return res.status(500).json({ error: 'Failed to delete API key' });
      }

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    return errorResponse(res, error);
  }
}

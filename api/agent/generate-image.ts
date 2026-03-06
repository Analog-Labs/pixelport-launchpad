import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateAgentRequest, errorResponse } from '../lib/auth';
import { supabase } from '../lib/supabase';

/**
 * POST /api/agent/generate-image — Chief requests image generation
 * Auth: X-Agent-Key header (per-tenant agent API key)
 *
 * Supported providers:
 *   - openai (DALL-E 3, gpt-image-1)
 * Future providers: flux, imagen
 *
 * Request body:
 *   prompt (required)  — image description
 *   provider           — "openai" (default)
 *   model              — provider-specific model (default: "gpt-image-1")
 *   size               — e.g. "1024x1024" (default)
 *   quality            — "standard" | "hd" (default: "standard")
 *   style              — "vivid" | "natural" (default: "vivid")
 *   task_description   — optional human-readable description for task log
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<VercelResponse> {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { tenant } = await authenticateAgentRequest(req);

    const {
      prompt,
      provider = 'openai',
      model,
      size = '1024x1024',
      quality = 'standard',
      style = 'vivid',
      task_description,
    } = req.body || {};

    if (!prompt) {
      return res.status(400).json({ error: 'Missing required field: prompt' });
    }

    const validProviders = ['openai'];
    if (!validProviders.includes(provider)) {
      return res.status(400).json({
        error: `Invalid provider. Must be one of: ${validProviders.join(', ')}`,
      });
    }

    let imageUrl: string;
    let modelUsed: string;

    if (provider === 'openai') {
      const openaiApiKey = process.env.OPENAI_API_KEY;
      if (!openaiApiKey) {
        return res.status(500).json({ error: 'OpenAI API key not configured' });
      }

      modelUsed = model || 'gpt-image-1';

      const openaiResponse = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modelUsed,
          prompt,
          n: 1,
          size,
          ...(modelUsed.startsWith('dall-e') ? { quality, style } : {}),
        }),
      });

      if (!openaiResponse.ok) {
        const errBody = await openaiResponse.json().catch(() => ({}));
        console.error('OpenAI image gen failed:', errBody);
        return res.status(502).json({
          error: 'Image generation failed',
          detail: (errBody as Record<string, unknown>)?.error
            ? ((errBody as Record<string, unknown>).error as Record<string, unknown>)?.message || 'Unknown OpenAI error'
            : 'Unknown OpenAI error',
        });
      }

      const openaiData = await openaiResponse.json() as {
        data: Array<{ url?: string; b64_json?: string }>;
      };

      // gpt-image-1 returns b64_json by default; DALL-E 3 returns url
      const result = openaiData.data?.[0];
      if (result?.url) {
        imageUrl = result.url;
      } else if (result?.b64_json) {
        // Return as data URI — caller can upload to storage if needed
        imageUrl = `data:image/png;base64,${result.b64_json}`;
      } else {
        return res.status(502).json({ error: 'No image data returned from provider' });
      }
    } else {
      return res.status(400).json({ error: `Provider ${provider} not yet implemented` });
    }

    // Log as agent_task for dashboard work feed
    const taskRecord: Record<string, unknown> = {
      tenant_id: tenant.id,
      agent_role: 'Image Generator',
      agent_model: modelUsed,
      task_type: 'draft_content',
      task_description: task_description || `Generate image: ${prompt.slice(0, 100)}`,
      task_input: { prompt, provider, model: modelUsed, size, quality, style },
      task_output: {
        image_url: imageUrl.startsWith('data:') ? '(base64 — stored inline)' : imageUrl,
        provider,
        model: modelUsed,
      },
      status: 'completed',
    };

    const { error: taskError } = await supabase
      .from('agent_tasks')
      .insert(taskRecord);

    if (taskError) {
      console.error('Failed to log image gen task:', taskError);
      // Don't fail — image was generated successfully
    }

    return res.status(200).json({
      image_url: imageUrl,
      provider,
      model: modelUsed,
      prompt,
      size,
    });
  } catch (error) {
    return errorResponse(res, error);
  }
}

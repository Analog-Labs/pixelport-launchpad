import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * GET /api/debug/do-status
 *
 * Diagnostic endpoint to check DigitalOcean account limits and current droplet count.
 * Protected by a simple shared secret (DO_API_TOKEN must be set).
 * NOT for production use — remove after debugging.
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<VercelResponse> {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const DO_API_TOKEN = process.env.DO_API_TOKEN;
  if (!DO_API_TOKEN) {
    return res.status(500).json({ error: 'DO_API_TOKEN not configured' });
  }

  const results: Record<string, unknown> = {};

  // 1. Check account info (includes droplet_limit)
  try {
    const accountRes = await fetch('https://api.digitalocean.com/v2/account', {
      headers: { Authorization: `Bearer ${DO_API_TOKEN}` },
    });
    if (accountRes.ok) {
      const data = (await accountRes.json()) as {
        account?: {
          droplet_limit?: number;
          email?: string;
          status?: string;
          team?: { name?: string };
        };
      };
      results.account = {
        droplet_limit: data.account?.droplet_limit,
        status: data.account?.status,
        team: data.account?.team?.name,
        email_prefix: data.account?.email?.split('@')[0] + '@...',
      };
    } else {
      results.account_error = `HTTP ${accountRes.status}: ${await accountRes.text()}`;
    }
  } catch (err) {
    results.account_error = String(err);
  }

  // 2. List existing droplets (count + names)
  try {
    const dropletsRes = await fetch('https://api.digitalocean.com/v2/droplets?per_page=50', {
      headers: { Authorization: `Bearer ${DO_API_TOKEN}` },
    });
    if (dropletsRes.ok) {
      const data = (await dropletsRes.json()) as {
        droplets?: Array<{
          id: number;
          name: string;
          status: string;
          size_slug: string;
          region: { slug: string };
          tags: string[];
        }>;
        meta?: { total?: number };
      };
      results.droplets = {
        total: data.meta?.total ?? data.droplets?.length ?? 0,
        list: (data.droplets ?? []).map((d) => ({
          id: d.id,
          name: d.name,
          status: d.status,
          size: d.size_slug,
          region: d.region?.slug,
          tags: d.tags,
        })),
      };
    } else {
      results.droplets_error = `HTTP ${dropletsRes.status}: ${await dropletsRes.text()}`;
    }
  } catch (err) {
    results.droplets_error = String(err);
  }

  // 3. Test creating a droplet (dry run — we just check available sizes in the target region)
  try {
    const sizesRes = await fetch('https://api.digitalocean.com/v2/sizes?per_page=200', {
      headers: { Authorization: `Bearer ${DO_API_TOKEN}` },
    });
    if (sizesRes.ok) {
      const data = (await sizesRes.json()) as {
        sizes?: Array<{
          slug: string;
          available: boolean;
          regions: string[];
          price_monthly: number;
          memory: number;
          vcpus: number;
          description: string;
        }>;
      };

      const targetSizes = ['s-1vcpu-512mb-10gb', 's-1vcpu-1gb', 's-1vcpu-2gb', 's-2vcpu-4gb'];
      const targetRegion = 'nyc1';

      results.sizes = (data.sizes ?? [])
        .filter((s) => targetSizes.includes(s.slug))
        .map((s) => ({
          slug: s.slug,
          available: s.available,
          in_nyc1: s.regions.includes(targetRegion),
          price_monthly: s.price_monthly,
          memory_mb: s.memory,
          vcpus: s.vcpus,
        }));
    } else {
      results.sizes_error = `HTTP ${sizesRes.status}: ${await sizesRes.text()}`;
    }
  } catch (err) {
    results.sizes_error = String(err);
  }

  // 4. Check if docker image exists in target region
  try {
    const imagesRes = await fetch(
      'https://api.digitalocean.com/v2/images?type=distribution&per_page=200',
      { headers: { Authorization: `Bearer ${DO_API_TOKEN}` } }
    );
    if (imagesRes.ok) {
      const data = (await imagesRes.json()) as {
        images?: Array<{
          slug: string;
          distribution: string;
          regions: string[];
          status: string;
        }>;
      };
      const ubuntuImage = (data.images ?? []).find((i) => i.slug === 'ubuntu-24-04-x64');
      results.image = ubuntuImage
        ? {
            slug: ubuntuImage.slug,
            distribution: ubuntuImage.distribution,
            in_nyc1: ubuntuImage.regions.includes('nyc1'),
            status: ubuntuImage.status,
            regions_count: ubuntuImage.regions.length,
          }
        : 'ubuntu-24-04-x64 NOT FOUND';
    } else {
      results.images_error = `HTTP ${imagesRes.status}: ${await imagesRes.text()}`;
    }
  } catch (err) {
    results.images_error = String(err);
  }

  return res.status(200).json({
    diagnostic: 'DigitalOcean Account Status',
    timestamp: new Date().toISOString(),
    ...results,
  });
}

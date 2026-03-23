interface RuntimeHandoffResponse {
  workspace_launch_url?: string;
  error?: string;
}

export async function launchChiefWorkspace(accessToken: string, source = 'dashboard_agent_card'): Promise<void> {
  const response = await fetch('/api/runtime/handoff', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ source }),
  });

  const payload = (await response.json()) as RuntimeHandoffResponse;

  if (!response.ok) {
    throw new Error(payload.error ?? 'Failed to open runtime workspace');
  }

  if (!payload.workspace_launch_url) {
    throw new Error('Runtime launch URL missing in handoff response');
  }

  window.location.assign(payload.workspace_launch_url);
}

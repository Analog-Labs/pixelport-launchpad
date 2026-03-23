import type { PaperclipAgent } from './paperclip-types';

export function resolveAgentDisplayName(agent: PaperclipAgent, preferredChiefName?: string): string {
  const preferred = preferredChiefName?.trim();
  if (!preferred) return agent.name;
  const canonical = agent.name.trim().toLowerCase();
  if (canonical === 'chief' || canonical === 'chief of staff') {
    return preferred;
  }
  return agent.name;
}

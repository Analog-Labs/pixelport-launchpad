export const SLACK_APP_TOKEN_ENV_REF = '${SLACK_APP_TOKEN}';

export type SlackConfigState = {
  enabled: boolean;
  botTokenPresent: boolean;
  botTokenMatches: boolean;
  appTokenMatches: boolean;
  dmPolicy: string | null;
  groupPolicy: string | null;
  allowFromAll: boolean;
  replyToMode: string | null;
  configWrites: boolean | null;
};

export function buildSlackConfigObject(botToken: string) {
  return {
    enabled: true,
    botToken,
    appToken: SLACK_APP_TOKEN_ENV_REF,
    dmPolicy: 'open',
    groupPolicy: 'open',
    allowFrom: ['*'],
    replyToMode: 'first',
    configWrites: false,
  };
}

export function buildSlackConfig(botToken: string): string {
  return JSON.stringify(buildSlackConfigObject(botToken), null, 2);
}

export function parseSlackConfigState(output: string): SlackConfigState {
  const parsed = JSON.parse(output) as Partial<SlackConfigState>;

  return {
    enabled: parsed.enabled === true,
    botTokenPresent: parsed.botTokenPresent === true,
    botTokenMatches: parsed.botTokenMatches === true,
    appTokenMatches: parsed.appTokenMatches === true,
    dmPolicy: typeof parsed.dmPolicy === 'string' ? parsed.dmPolicy : null,
    groupPolicy: typeof parsed.groupPolicy === 'string' ? parsed.groupPolicy : null,
    allowFromAll: parsed.allowFromAll === true,
    replyToMode: typeof parsed.replyToMode === 'string' ? parsed.replyToMode : null,
    configWrites: typeof parsed.configWrites === 'boolean' ? parsed.configWrites : null,
  };
}

export function isSlackConfigCurrent(state: SlackConfigState): boolean {
  return (
    state.enabled &&
    state.botTokenPresent &&
    state.botTokenMatches &&
    state.appTokenMatches &&
    state.dmPolicy === 'open' &&
    state.groupPolicy === 'open' &&
    state.allowFromAll &&
    state.replyToMode === 'first' &&
    state.configWrites === false
  );
}

export function runtimeLogsSuggestSlackReady(logOutput: string): boolean {
  return /slack|socket mode|apps\.connections\.open|websocket/i.test(logOutput);
}

export function buildSlackWelcomeMessage(agentName: string): string {
  return `Hi, I'm ${agentName}. I'm live in Slack now, so you can DM me here anytime. If you want me in a working channel, invite me there explicitly and I'll keep replies concise.`;
}

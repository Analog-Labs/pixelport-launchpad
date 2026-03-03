export const AVATAR_MAP: Record<string, { bg: string; display: string }> = {
  "amber-l": { bg: "linear-gradient(135deg, hsl(38 60% 58%), hsl(38 60% 48%))", display: "L" },
  "purple-zap": { bg: "linear-gradient(135deg, hsl(270 60% 50%), hsl(290 60% 40%))", display: "⚡" },
  "blue-bot": { bg: "linear-gradient(135deg, hsl(210 80% 50%), hsl(220 70% 40%))", display: "🤖" },
  "green-brain": { bg: "linear-gradient(135deg, hsl(150 60% 40%), hsl(160 50% 30%))", display: "🧠" },
  "pink-sparkle": { bg: "linear-gradient(135deg, hsl(330 70% 55%), hsl(340 60% 45%))", display: "✨" },
  "orange-fire": { bg: "linear-gradient(135deg, hsl(25 90% 55%), hsl(15 80% 45%))", display: "🔥" },
};

export function getAvatarConfig(avatarId?: string | null) {
  return AVATAR_MAP[avatarId || "amber-l"] || AVATAR_MAP["amber-l"];
}

export function getAgentName() {
  return localStorage.getItem("pixelport_agent_name") || "Luna";
}

export function getAgentAvatarId() {
  return localStorage.getItem("pixelport_agent_avatar") || "amber-l";
}

export const AVATAR_MAP: Record<string, { bg: string; display: string }> = {
  "amber-command": {
    bg: "linear-gradient(135deg, hsl(38 60% 58%), hsl(32 68% 46%))",
    display: "CM",
  },
  "steel-operator": {
    bg: "linear-gradient(135deg, hsl(210 8% 55%), hsl(215 12% 38%))",
    display: "OP",
  },
  "teal-orbit": {
    bg: "linear-gradient(135deg, hsl(178 44% 48%), hsl(191 48% 34%))",
    display: "OR",
  },
  "copper-vector": {
    bg: "linear-gradient(135deg, hsl(24 72% 56%), hsl(18 70% 42%))",
    display: "VC",
  },
  "slate-grid": {
    bg: "linear-gradient(135deg, hsl(221 14% 48%), hsl(226 16% 34%))",
    display: "GR",
  },
  "rose-signal": {
    bg: "linear-gradient(135deg, hsl(346 63% 58%), hsl(352 58% 43%))",
    display: "SG",
  },
  "amber-l": { bg: "linear-gradient(135deg, hsl(38 60% 58%), hsl(38 60% 48%))", display: "L" },
  "purple-zap": { bg: "linear-gradient(135deg, hsl(270 60% 50%), hsl(290 60% 40%))", display: "⚡" },
  "blue-bot": { bg: "linear-gradient(135deg, hsl(210 80% 50%), hsl(220 70% 40%))", display: "🤖" },
  "green-brain": { bg: "linear-gradient(135deg, hsl(150 60% 40%), hsl(160 50% 30%))", display: "🧠" },
  "pink-sparkle": { bg: "linear-gradient(135deg, hsl(330 70% 55%), hsl(340 60% 45%))", display: "✨" },
  "orange-fire": { bg: "linear-gradient(135deg, hsl(25 90% 55%), hsl(15 80% 45%))", display: "🔥" },
};

export function getAvatarConfig(avatarId?: string | null) {
  return AVATAR_MAP[avatarId || "amber-command"] || AVATAR_MAP["amber-command"];
}

export function getAgentName() {
  return localStorage.getItem("pixelport_agent_name") || "Chief";
}

export function getAgentAvatarId() {
  return localStorage.getItem("pixelport_agent_avatar") || "amber-command";
}

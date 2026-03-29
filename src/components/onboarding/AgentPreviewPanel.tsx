import { AvatarIllustration } from "./AvatarIllustrations";
import {
  AGENT_AVATAR_OPTIONS,
  AGENT_TONE_OPTIONS,
  TONE_PREVIEW_PHRASES,
  APPROVAL_MODE_OPTIONS,
  type AgentToneId,
} from "@/lib/onboarding-presets";
import { Target, ListChecks, ShieldCheck } from "lucide-react";

interface AgentPreviewPanelProps {
  step: number;
  agentName: string;
  agentTone: AgentToneId;
  agentAvatarId: string;
  companyName: string;
  companyUrl: string;
  goals: string[];
  starterTasks: string[];
  approvalMode: string;
  launched: boolean;
  provisioningReady: boolean;
}

const AgentPreviewPanel = ({
  step,
  agentName,
  agentTone,
  agentAvatarId,
  companyName,
  goals,
  starterTasks,
  approvalMode,
}: AgentPreviewPanelProps) => {
  const avatar = AGENT_AVATAR_OPTIONS.find((a) => a.id === agentAvatarId) ?? AGENT_AVATAR_OPTIONS[0];
  const toneName = AGENT_TONE_OPTIONS.find((t) => t.id === agentTone)?.label ?? "Strategic";
  const previewPhrase = TONE_PREVIEW_PHRASES[agentTone] ?? TONE_PREVIEW_PHRASES.strategic;

  return (
    <div className="hidden lg:flex flex-col items-center justify-center p-8 bg-[hsl(240_6%_5%)] relative overflow-hidden">
      {/* Ambient glow behind avatar — brighter */}
      <div
        className="absolute w-[300px] h-[300px] rounded-full pointer-events-none opacity-50"
        style={{
          background: `radial-gradient(circle, ${avatar.glowColor}, transparent 70%)`,
        }}
      />

      {/* Avatar — larger */}
      <div className="relative z-10 animate-avatar-appear" key={agentAvatarId}>
        <AvatarIllustration id={avatar.svgId} size={120} glowing />
      </div>

      {/* Name + Company — more readable */}
      <h3 className="relative z-10 mt-5 text-2xl font-black text-foreground text-center tracking-tight">
        {agentName || "Chief"}
      </h3>
      {companyName && (
        <p className="relative z-10 mt-1.5 text-sm text-muted-foreground text-center">
          {companyName}
        </p>
      )}

      {/* Tone badge */}
      <div className="relative z-10 mt-4 px-4 py-1.5 rounded-full bg-primary/15 border border-primary/30">
        <span className="text-sm font-medium text-primary">{toneName}</span>
      </div>

      {/* Preview phrase — brighter */}
      <p className="relative z-10 mt-5 text-sm text-muted-foreground/70 text-center leading-relaxed italic max-w-[280px]">
        &ldquo;{previewPhrase}&rdquo;
      </p>

      {/* Contextual info based on step */}
      <div className="relative z-10 mt-8 w-full space-y-4">
        {step >= 2 && goals.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Target className="h-3.5 w-3.5 text-muted-foreground/60" />
              <span className="text-xs uppercase tracking-[0.1em] text-muted-foreground/60 font-semibold">Goals</span>
            </div>
            <div className="space-y-1.5 pl-[22px]">
              {goals.map((goal) => (
                <p key={goal} className="text-xs text-muted-foreground/80 leading-snug truncate">{goal}</p>
              ))}
            </div>
          </div>
        )}

        {step >= 3 && starterTasks.filter(Boolean).length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <ListChecks className="h-3.5 w-3.5 text-muted-foreground/60" />
              <span className="text-xs uppercase tracking-[0.1em] text-muted-foreground/60 font-semibold">Tasks</span>
            </div>
            <p className="text-xs text-muted-foreground/80 pl-[22px]">
              {starterTasks.filter(Boolean).length} configured
            </p>
          </div>
        )}

        {step >= 3 && approvalMode && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground/60" />
              <span className="text-xs uppercase tracking-[0.1em] text-muted-foreground/60 font-semibold">Approval</span>
            </div>
            <p className="text-xs text-muted-foreground/80 pl-[22px] capitalize">
              {APPROVAL_MODE_OPTIONS.find((m) => m.id === approvalMode)?.label ?? approvalMode}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

/* ── Mobile: compact agent bar shown on small screens ── */
interface MobileAgentBarProps {
  agentName: string;
  agentTone: AgentToneId;
  agentAvatarId: string;
  companyName: string;
}

export function MobileAgentBar({ agentName, agentTone, agentAvatarId, companyName }: MobileAgentBarProps) {
  const avatar = AGENT_AVATAR_OPTIONS.find((a) => a.id === agentAvatarId) ?? AGENT_AVATAR_OPTIONS[0];
  const toneName = AGENT_TONE_OPTIONS.find((t) => t.id === agentTone)?.label ?? "Strategic";

  return (
    <div className="lg:hidden flex items-center gap-3 mb-5 pb-4 border-b border-border/20">
      <AvatarIllustration id={avatar.svgId} size={36} />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">{agentName || "Chief"}</p>
        <p className="text-xs text-muted-foreground/70 truncate">
          {companyName ? `${companyName} · ` : ""}{toneName}
        </p>
      </div>
    </div>
  );
}

export default AgentPreviewPanel;

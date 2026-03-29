/**
 * AI Character Avatar illustrations for the 6 Chief personalities.
 * Each avatar is a stylized robot/android face with distinct personality.
 */

interface AvatarProps {
  size?: number;
  glowing?: boolean;
  className?: string;
}

/* ── Command: Authoritative helmeted commander — angular visor, sharp jaw ── */
const CommandSvg = ({ size = 80, glowing, className }: AvatarProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 80 80"
    fill="none"
    className={className}
    style={glowing ? { filter: "drop-shadow(0 0 14px hsla(38, 60%, 58%, 0.55))" } : undefined}
  >
    {/* Head shape — angular helmet */}
    <path
      d="M20 42 L20 28 Q20 14 40 12 Q60 14 60 28 L60 42 Q60 56 50 60 L30 60 Q20 56 20 42Z"
      fill="hsla(38, 60%, 58%, 0.08)"
      stroke="hsl(38 60% 58%)"
      strokeWidth="1.5"
    />
    {/* Visor — wide angular eye band */}
    <path
      d="M24 30 L56 30 L58 36 L22 36Z"
      fill="hsla(38, 60%, 58%, 0.15)"
      stroke="hsl(38 60% 58%)"
      strokeWidth="1"
    />
    {/* Left eye */}
    <rect x="28" y="31" width="8" height="4" rx="1" fill="hsl(38 60% 58%)" opacity="0.9" />
    {/* Right eye */}
    <rect x="44" y="31" width="8" height="4" rx="1" fill="hsl(38 60% 58%)" opacity="0.9" />
    {/* Center forehead gem */}
    <polygon points="40,18 43,22 40,26 37,22" fill="hsl(38 60% 58%)" opacity="0.7" />
    {/* Mouth — minimal line */}
    <line x1="34" y1="48" x2="46" y2="48" stroke="hsl(38 60% 58%)" strokeWidth="1.2" strokeLinecap="round" opacity="0.5" />
    {/* Chin plate */}
    <path d="M32 52 L48 52 L44 58 L36 58Z" fill="hsla(38, 60%, 58%, 0.06)" stroke="hsl(38 60% 58%)" strokeWidth="0.8" opacity="0.4" />
    {/* Antenna nubs */}
    <circle cx="22" cy="24" r="2" fill="hsl(38 60% 58%)" opacity="0.5" />
    <circle cx="58" cy="24" r="2" fill="hsl(38 60% 58%)" opacity="0.5" />
  </svg>
);

/* ── Operator: Industrial worker bot — round goggles, utility look ── */
const OperatorSvg = ({ size = 80, glowing, className }: AvatarProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 80 80"
    fill="none"
    className={className}
    style={glowing ? { filter: "drop-shadow(0 0 14px hsla(210, 14%, 55%, 0.55))" } : undefined}
  >
    {/* Head — rounded rectangle */}
    <rect
      x="18" y="14" width="44" height="48" rx="16"
      fill="hsla(210, 14%, 55%, 0.06)"
      stroke="hsl(210 14% 55%)"
      strokeWidth="1.5"
    />
    {/* Left goggle */}
    <circle cx="32" cy="34" r="8" stroke="hsl(210 14% 55%)" strokeWidth="1.5" fill="hsla(210, 14%, 55%, 0.1)" />
    <circle cx="32" cy="34" r="4" fill="hsl(210 14% 55%)" opacity="0.7" />
    <circle cx="30" cy="32" r="1.5" fill="hsl(210 14% 85%)" opacity="0.6" />
    {/* Right goggle */}
    <circle cx="48" cy="34" r="8" stroke="hsl(210 14% 55%)" strokeWidth="1.5" fill="hsla(210, 14%, 55%, 0.1)" />
    <circle cx="48" cy="34" r="4" fill="hsl(210 14% 55%)" opacity="0.7" />
    <circle cx="46" cy="32" r="1.5" fill="hsl(210 14% 85%)" opacity="0.6" />
    {/* Goggle bridge */}
    <line x1="38" y1="34" x2="42" y2="34" stroke="hsl(210 14% 55%)" strokeWidth="1.5" />
    {/* Mouth — grid/vent */}
    <rect x="32" y="48" width="16" height="6" rx="2" stroke="hsl(210 14% 55%)" strokeWidth="1" fill="hsla(210, 14%, 55%, 0.08)" />
    <line x1="36" y1="48" x2="36" y2="54" stroke="hsl(210 14% 55%)" strokeWidth="0.6" opacity="0.4" />
    <line x1="40" y1="48" x2="40" y2="54" stroke="hsl(210 14% 55%)" strokeWidth="0.6" opacity="0.4" />
    <line x1="44" y1="48" x2="44" y2="54" stroke="hsl(210 14% 55%)" strokeWidth="0.6" opacity="0.4" />
    {/* Top bolts */}
    <circle cx="26" cy="18" r="2" fill="hsl(210 14% 55%)" opacity="0.4" />
    <circle cx="54" cy="18" r="2" fill="hsl(210 14% 55%)" opacity="0.4" />
    {/* Ear rivets */}
    <rect x="14" y="30" width="4" height="8" rx="2" fill="hsla(210, 14%, 55%, 0.3)" />
    <rect x="62" y="30" width="4" height="8" rx="2" fill="hsla(210, 14%, 55%, 0.3)" />
  </svg>
);

/* ── Orbit: Sleek alien-esque — large oval eyes, smooth curves ── */
const OrbitSvg = ({ size = 80, glowing, className }: AvatarProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 80 80"
    fill="none"
    className={className}
    style={glowing ? { filter: "drop-shadow(0 0 14px hsla(178, 44%, 48%, 0.55))" } : undefined}
  >
    {/* Head — smooth egg shape */}
    <ellipse
      cx="40" cy="38" rx="22" ry="26"
      fill="hsla(178, 44%, 48%, 0.06)"
      stroke="hsl(178 44% 48%)"
      strokeWidth="1.5"
    />
    {/* Left eye — large almond */}
    <ellipse cx="32" cy="34" rx="7" ry="5" fill="hsla(178, 44%, 48%, 0.15)" stroke="hsl(178 44% 48%)" strokeWidth="1" />
    <ellipse cx="33" cy="34" rx="3" ry="3.5" fill="hsl(178 44% 48%)" opacity="0.8" />
    <circle cx="31" cy="33" r="1.2" fill="hsl(178 44% 88%)" opacity="0.7" />
    {/* Right eye — large almond */}
    <ellipse cx="48" cy="34" rx="7" ry="5" fill="hsla(178, 44%, 48%, 0.15)" stroke="hsl(178 44% 48%)" strokeWidth="1" />
    <ellipse cx="49" cy="34" rx="3" ry="3.5" fill="hsl(178 44% 48%)" opacity="0.8" />
    <circle cx="47" cy="33" r="1.2" fill="hsl(178 44% 88%)" opacity="0.7" />
    {/* Nose — subtle dot */}
    <circle cx="40" cy="42" r="1" fill="hsl(178 44% 48%)" opacity="0.3" />
    {/* Mouth — gentle curve */}
    <path d="M36 48 Q40 51 44 48" stroke="hsl(178 44% 48%)" strokeWidth="1" fill="none" strokeLinecap="round" opacity="0.5" />
    {/* Forehead marking — third eye */}
    <circle cx="40" cy="22" r="2.5" stroke="hsl(178 44% 48%)" strokeWidth="0.8" fill="hsla(178, 44%, 48%, 0.2)" />
    <circle cx="40" cy="22" r="1" fill="hsl(178 44% 48%)" opacity="0.6" />
    {/* Side markings */}
    <path d="M18 32 Q16 38 18 44" stroke="hsl(178 44% 48%)" strokeWidth="0.8" opacity="0.3" />
    <path d="M62 32 Q64 38 62 44" stroke="hsl(178 44% 48%)" strokeWidth="0.8" opacity="0.3" />
  </svg>
);

/* ── Vector: Sharp tactical bot — V-shaped visor, angular ── */
const VectorSvg = ({ size = 80, glowing, className }: AvatarProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 80 80"
    fill="none"
    className={className}
    style={glowing ? { filter: "drop-shadow(0 0 14px hsla(24, 72%, 56%, 0.55))" } : undefined}
  >
    {/* Head — angular/diamond-like */}
    <path
      d="M40 10 L60 24 L60 48 L50 62 L30 62 L20 48 L20 24Z"
      fill="hsla(24, 72%, 56%, 0.06)"
      stroke="hsl(24 72% 56%)"
      strokeWidth="1.5"
    />
    {/* V-shaped visor */}
    <path
      d="M24 28 L40 36 L56 28"
      stroke="hsl(24 72% 56%)"
      strokeWidth="2"
      fill="none"
      strokeLinecap="round"
    />
    {/* Left eye — sharp triangle */}
    <polygon points="28,30 36,34 28,34" fill="hsl(24 72% 56%)" opacity="0.8" />
    {/* Right eye — sharp triangle */}
    <polygon points="52,30 44,34 52,34" fill="hsl(24 72% 56%)" opacity="0.8" />
    {/* Nose bridge */}
    <line x1="40" y1="36" x2="40" y2="44" stroke="hsl(24 72% 56%)" strokeWidth="0.8" opacity="0.3" />
    {/* Mouth — angular */}
    <path d="M34 50 L40 48 L46 50" stroke="hsl(24 72% 56%)" strokeWidth="1" fill="none" strokeLinecap="round" opacity="0.5" />
    {/* Forehead line */}
    <line x1="32" y1="18" x2="48" y2="18" stroke="hsl(24 72% 56%)" strokeWidth="1" opacity="0.4" />
    {/* Side vents */}
    <line x1="20" y1="30" x2="20" y2="36" stroke="hsl(24 72% 56%)" strokeWidth="1.5" opacity="0.3" />
    <line x1="20" y1="38" x2="20" y2="44" stroke="hsl(24 72% 56%)" strokeWidth="1.5" opacity="0.3" />
    <line x1="60" y1="30" x2="60" y2="36" stroke="hsl(24 72% 56%)" strokeWidth="1.5" opacity="0.3" />
    <line x1="60" y1="38" x2="60" y2="44" stroke="hsl(24 72% 56%)" strokeWidth="1.5" opacity="0.3" />
  </svg>
);

/* ── Grid: Friendly rounded bot — circular face, dot matrix display ── */
const GridSvg = ({ size = 80, glowing, className }: AvatarProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 80 80"
    fill="none"
    className={className}
    style={glowing ? { filter: "drop-shadow(0 0 14px hsla(221, 14%, 55%, 0.55))" } : undefined}
  >
    {/* Head — perfect circle */}
    <circle
      cx="40" cy="38" r="24"
      fill="hsla(221, 14%, 55%, 0.06)"
      stroke="hsl(221 14% 55%)"
      strokeWidth="1.5"
    />
    {/* Left eye — happy curved */}
    <path d="M28 32 Q32 28 36 32" stroke="hsl(221 14% 55%)" strokeWidth="2" fill="none" strokeLinecap="round" />
    {/* Right eye — happy curved */}
    <path d="M44 32 Q48 28 52 32" stroke="hsl(221 14% 55%)" strokeWidth="2" fill="none" strokeLinecap="round" />
    {/* Mouth — wide friendly smile */}
    <path d="M30 44 Q34 50 40 50 Q46 50 50 44" stroke="hsl(221 14% 55%)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
    {/* Cheek dots */}
    <circle cx="26" cy="40" r="2" fill="hsl(221 14% 55%)" opacity="0.2" />
    <circle cx="54" cy="40" r="2" fill="hsl(221 14% 55%)" opacity="0.2" />
    {/* Antenna */}
    <line x1="40" y1="14" x2="40" y2="6" stroke="hsl(221 14% 55%)" strokeWidth="1.2" />
    <circle cx="40" cy="5" r="2.5" fill="hsl(221 14% 55%)" opacity="0.6" />
    {/* Ear modules */}
    <rect x="14" y="33" width="3" height="10" rx="1.5" fill="hsla(221, 14%, 55%, 0.3)" />
    <rect x="63" y="33" width="3" height="10" rx="1.5" fill="hsla(221, 14%, 55%, 0.3)" />
    {/* Forehead dots — status LEDs */}
    <circle cx="36" cy="22" r="1.2" fill="hsl(221 14% 55%)" opacity="0.4" />
    <circle cx="40" cy="21" r="1.2" fill="hsl(221 14% 55%)" opacity="0.5" />
    <circle cx="44" cy="22" r="1.2" fill="hsl(221 14% 55%)" opacity="0.4" />
  </svg>
);

/* ── Signal: Expressive emitter — broadcast dish head, dynamic expression ── */
const SignalSvg = ({ size = 80, glowing, className }: AvatarProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 80 80"
    fill="none"
    className={className}
    style={glowing ? { filter: "drop-shadow(0 0 14px hsla(346, 63%, 58%, 0.55))" } : undefined}
  >
    {/* Head — rounded square */}
    <rect
      x="18" y="16" width="44" height="44" rx="14"
      fill="hsla(346, 63%, 58%, 0.06)"
      stroke="hsl(346 63% 58%)"
      strokeWidth="1.5"
    />
    {/* Left eye — round, expressive */}
    <circle cx="32" cy="34" r="6" stroke="hsl(346 63% 58%)" strokeWidth="1" fill="hsla(346, 63%, 58%, 0.1)" />
    <circle cx="33" cy="33" r="3" fill="hsl(346 63% 58%)" opacity="0.8" />
    <circle cx="31" cy="31.5" r="1.2" fill="hsl(346 63% 88%)" opacity="0.6" />
    {/* Right eye — round, expressive */}
    <circle cx="48" cy="34" r="6" stroke="hsl(346 63% 58%)" strokeWidth="1" fill="hsla(346, 63%, 58%, 0.1)" />
    <circle cx="49" cy="33" r="3" fill="hsl(346 63% 58%)" opacity="0.8" />
    <circle cx="47" cy="31.5" r="1.2" fill="hsl(346 63% 88%)" opacity="0.6" />
    {/* Mouth — small O shape, surprised/alert */}
    <ellipse cx="40" cy="48" rx="4" ry="3" stroke="hsl(346 63% 58%)" strokeWidth="1" fill="hsla(346, 63%, 58%, 0.1)" />
    {/* Signal waves emanating from top */}
    <path d="M34 14 Q40 8 46 14" stroke="hsl(346 63% 58%)" strokeWidth="0.8" fill="none" opacity="0.5" />
    <path d="M30 10 Q40 2 50 10" stroke="hsl(346 63% 58%)" strokeWidth="0.6" fill="none" opacity="0.3" />
    {/* Side signal indicators */}
    <circle cx="14" cy="30" r="1.5" fill="hsl(346 63% 58%)" opacity="0.4" />
    <circle cx="12" cy="36" r="1" fill="hsl(346 63% 58%)" opacity="0.3" />
    <circle cx="66" cy="30" r="1.5" fill="hsl(346 63% 58%)" opacity="0.4" />
    <circle cx="68" cy="36" r="1" fill="hsl(346 63% 58%)" opacity="0.3" />
    {/* Eyebrow curves */}
    <path d="M26 26 Q32 23 38 26" stroke="hsl(346 63% 58%)" strokeWidth="1" fill="none" opacity="0.4" />
    <path d="M42 26 Q48 23 54 26" stroke="hsl(346 63% 58%)" strokeWidth="1" fill="none" opacity="0.4" />
  </svg>
);

/* ── Export: lookup by svgId ── */
const AVATAR_COMPONENTS: Record<string, React.FC<AvatarProps>> = {
  command: CommandSvg,
  operator: OperatorSvg,
  orbit: OrbitSvg,
  vector: VectorSvg,
  grid: GridSvg,
  signal: SignalSvg,
};

interface AvatarIllustrationProps extends AvatarProps {
  id: string;
}

export const AvatarIllustration = ({ id, ...props }: AvatarIllustrationProps) => {
  const Component = AVATAR_COMPONENTS[id] ?? CommandSvg;
  return <Component {...props} />;
};

export default AvatarIllustration;

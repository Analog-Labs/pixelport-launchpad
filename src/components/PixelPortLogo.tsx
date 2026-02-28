const PixelPortLogo = ({ className = "h-10 w-10" }: { className?: string }) => (
  <svg
    viewBox="0 0 48 48"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    {/* Rounded square frame */}
    <rect x="4" y="4" width="40" height="40" rx="10" fill="hsl(230 75% 50%)" />
    {/* Pixel grid pattern */}
    <rect x="10" y="10" width="8" height="8" rx="1.5" fill="hsl(165 60% 88%)" />
    <rect x="20" y="10" width="8" height="8" rx="1.5" fill="hsl(0 0% 100%)" opacity="0.9" />
    <rect x="30" y="10" width="8" height="8" rx="1.5" fill="hsl(200 70% 88%)" />
    <rect x="10" y="20" width="8" height="8" rx="1.5" fill="hsl(0 0% 100%)" opacity="0.7" />
    <rect x="20" y="20" width="8" height="8" rx="1.5" fill="hsl(260 50% 90%)" />
    <rect x="30" y="20" width="8" height="8" rx="1.5" fill="hsl(0 0% 100%)" opacity="0.5" />
    <rect x="10" y="30" width="8" height="8" rx="1.5" fill="hsl(200 70% 88%)" />
    <rect x="20" y="30" width="8" height="8" rx="1.5" fill="hsl(0 0% 100%)" opacity="0.6" />
    <rect x="30" y="30" width="8" height="8" rx="1.5" fill="hsl(165 60% 88%)" />
  </svg>
);

export default PixelPortLogo;

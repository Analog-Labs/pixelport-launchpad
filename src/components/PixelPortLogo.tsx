const PixelPortLogo = ({ className = "h-10 w-10" }: { className?: string }) => (
  <svg
    viewBox="0 0 48 48"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <rect x="4" y="4" width="40" height="40" rx="10" fill="hsl(240 14% 14%)" />
    <rect x="10" y="10" width="8" height="8" rx="1.5" fill="hsl(38 60% 58%)" />
    <rect x="20" y="10" width="8" height="8" rx="1.5" fill="hsl(0 0% 100%)" opacity="0.3" />
    <rect x="30" y="10" width="8" height="8" rx="1.5" fill="hsl(38 60% 48%)" opacity="0.6" />
    <rect x="10" y="20" width="8" height="8" rx="1.5" fill="hsl(0 0% 100%)" opacity="0.2" />
    <rect x="20" y="20" width="8" height="8" rx="1.5" fill="hsl(38 60% 58%)" opacity="0.8" />
    <rect x="30" y="20" width="8" height="8" rx="1.5" fill="hsl(0 0% 100%)" opacity="0.15" />
    <rect x="10" y="30" width="8" height="8" rx="1.5" fill="hsl(38 60% 48%)" opacity="0.5" />
    <rect x="20" y="30" width="8" height="8" rx="1.5" fill="hsl(0 0% 100%)" opacity="0.2" />
    <rect x="30" y="30" width="8" height="8" rx="1.5" fill="hsl(38 60% 58%)" />
  </svg>
);

export default PixelPortLogo;

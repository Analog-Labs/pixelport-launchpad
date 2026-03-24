import { cn } from '@/lib/utils';

export function StatCard({
  value,
  label,
  subtitle,
  onClick,
  className,
}: {
  value: string;
  label: string;
  subtitle?: string;
  onClick?: () => void;
  className?: string;
}) {
  const interactive = typeof onClick === 'function';

  const body = (
    <div
      className={cn(
        'rounded-xl border border-border bg-card p-5',
        'transition-all duration-200',
        interactive && 'cursor-pointer hover:border-amber-400/40 hover:shadow-[0_0_20px_rgba(212,168,83,0.08)]',
        className,
      )}
    >
      <p className="font-satoshi text-2xl font-extrabold text-foreground">{value}</p>
      <p className="mt-1 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">{label}</p>
      {subtitle ? <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p> : null}
    </div>
  );

  if (!interactive) {
    return body;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/40 rounded-xl"
    >
      {body}
    </button>
  );
}

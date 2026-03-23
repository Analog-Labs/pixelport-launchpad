/**
 * Cost coloring logic for Run History rows.
 * Returns a Tailwind class string based on proximity to budget.
 */

export type CostColorResult = {
  /** Tailwind text color class */
  textClass: string;
  /** Tailwind bg color class (subtle) */
  bgClass: string;
};

/**
 * Return color classes based on cost vs budget proximity.
 *
 * Green: < 50% of budget used
 * Amber: 50–80%
 * Red: > 80%
 *
 * If budgetCents is 0 or undefined, falls back to absolute thresholds:
 *   Green: < $0.10, Amber: $0.10–$0.50, Red: > $0.50
 */
export function getCostColor(
  costCents: number,
  budgetCents?: number,
): CostColorResult {
  if (budgetCents && budgetCents > 0) {
    const ratio = costCents / budgetCents;
    if (ratio >= 0.8) return { textClass: 'text-red-400', bgClass: 'bg-red-500/5' };
    if (ratio >= 0.5) return { textClass: 'text-amber-400', bgClass: 'bg-amber-500/5' };
    return { textClass: 'text-emerald-400', bgClass: 'bg-emerald-500/5' };
  }

  // Absolute thresholds (fallback): green < 10¢, amber 10–50¢, red > 50¢
  if (costCents > 50) return { textClass: 'text-red-400', bgClass: 'bg-red-500/5' };
  if (costCents > 10) return { textClass: 'text-amber-400', bgClass: 'bg-amber-500/5' };
  return { textClass: 'text-emerald-400', bgClass: 'bg-emerald-500/5' };
}

/** Format cents as a dollar string: 1234 → "$12.34" */
export function formatCostCents(costCents: number): string {
  return `$${(costCents / 100).toFixed(2)}`;
}

/** Format milliseconds as a human-readable duration: 47000 → "47s", 125000 → "2m 5s" */
export function formatDurationMs(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
}

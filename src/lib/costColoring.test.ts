import { describe, expect, it } from 'vitest';
import { getCostColor, formatCostCents, formatDurationMs } from './costColoring';

describe('getCostColor', () => {
  describe('with budget provided', () => {
    it('returns green when cost < 50% of budget', () => {
      const result = getCostColor(400, 1000);
      expect(result.textClass).toBe('text-emerald-400');
      expect(result.bgClass).toBe('bg-emerald-500/5');
    });

    it('returns amber when cost is 50–80% of budget', () => {
      const result = getCostColor(600, 1000);
      expect(result.textClass).toBe('text-amber-400');
      expect(result.bgClass).toBe('bg-amber-500/5');
    });

    it('returns red when cost >= 80% of budget', () => {
      const result = getCostColor(850, 1000);
      expect(result.textClass).toBe('text-red-400');
      expect(result.bgClass).toBe('bg-red-500/5');
    });

    it('returns red when cost == 100% of budget', () => {
      const result = getCostColor(1000, 1000);
      expect(result.textClass).toBe('text-red-400');
    });

    it('caps at 100% — cost over budget still returns red', () => {
      const result = getCostColor(1500, 1000);
      expect(result.textClass).toBe('text-red-400');
    });
  });

  describe('without budget (absolute thresholds)', () => {
    it('returns green for cost <= 10 cents', () => {
      expect(getCostColor(10).textClass).toBe('text-emerald-400');
      expect(getCostColor(0).textClass).toBe('text-emerald-400');
    });

    it('returns amber for 10–50 cents', () => {
      expect(getCostColor(25).textClass).toBe('text-amber-400');
      expect(getCostColor(50).textClass).toBe('text-amber-400');
    });

    it('returns red for > 50 cents', () => {
      expect(getCostColor(51).textClass).toBe('text-red-400');
      expect(getCostColor(200).textClass).toBe('text-red-400');
    });
  });
});

describe('formatCostCents', () => {
  it('formats 0 as $0.00', () => expect(formatCostCents(0)).toBe('$0.00'));
  it('formats 1234 as $12.34', () => expect(formatCostCents(1234)).toBe('$12.34'));
  it('formats 12 as $0.12', () => expect(formatCostCents(12)).toBe('$0.12'));
});

describe('formatDurationMs', () => {
  it('formats < 60s as seconds', () => expect(formatDurationMs(47000)).toBe('47s'));
  it('formats 60s exactly as 1m', () => expect(formatDurationMs(60000)).toBe('1m'));
  it('formats 125s as 2m 5s', () => expect(formatDurationMs(125000)).toBe('2m 5s'));
  it('formats 120s as 2m', () => expect(formatDurationMs(120000)).toBe('2m'));
});

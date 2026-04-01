/**
 * AssetAllocator.js
 * -----------------------------------------------------------------------------
 * Maps Risk Category to baseline strategic weights (Equities, Bonds, Cash).
 * Weights sum to 1.0 (100%) for Chart.js and reporting.
 *
 * FINANCIAL LOGIC — "uniqueness" / sophistication:
 * - Categories set a center of gravity for equity/bond/cash.
 * - We apply a second pass: if the effective risk score is available, we linearly
 *   interpolate between adjacent category templates so two users in "Moderate"
 *   with scores 42 vs 62 do not get identical weights (finer granularity).
 * - Short-horizon override: even Aggressive investors with horizon under 3 years
 *   get a mandatory cash and bond floor (liquidity and capital preservation),
 *   reflecting that strategic asset allocation must respect funding horizon —
 *   this is independent of "liking risk."
 */

/** @typedef {'Conservative'|'Moderate'|'Aggressive'} RiskCategory */

/**
 * @typedef {Object} AssetAllocation
 * @property {number} equities - Weight 0..1
 * @property {number} bonds - Weight 0..1
 * @property {number} cash - Weight 0..1
 */

export class AssetAllocator {
  /**
   * Base templates by category (starting points before interpolation).
   */
  static BASELINE = {
    Conservative: { equities: 0.25, bonds: 0.55, cash: 0.2 },
    Moderate: { equities: 0.55, bonds: 0.35, cash: 0.1 },
    Aggressive: { equities: 0.8, bonds: 0.15, cash: 0.05 },
  };

  /**
   * Linear interpolation between two allocation objects (component-wise).
   *
   * @param {AssetAllocation} a
   * @param {AssetAllocation} b
   * @param {number} t - 0..1
   * @returns {AssetAllocation}
   */
  static lerpAllocation(a, b, t) {
    const clampT = Math.max(0, Math.min(1, t));
    return {
      equities: a.equities + (b.equities - a.equities) * clampT,
      bonds: a.bonds + (b.bonds - a.bonds) * clampT,
      cash: a.cash + (b.cash - a.cash) * clampT,
    };
  }

  /**
   * Normalize so equities + bonds + cash === 1 (floating-point safe).
   *
   * @param {AssetAllocation} alloc
   * @returns {AssetAllocation}
   */
  static normalize(alloc) {
    const sum = alloc.equities + alloc.bonds + alloc.cash;
    if (sum <= 0) return { equities: 0.34, bonds: 0.33, cash: 0.33 };
    return {
      equities: alloc.equities / sum,
      bonds: alloc.bonds / sum,
      cash: alloc.cash / sum,
    };
  }

  /**
   * Interpolate baseline by risk score within and between category bands.
   * Score 0 → Conservative template; 100 → Aggressive; intermediate scores blend.
   *
   * @param {number} riskScore - 0..100
   * @returns {AssetAllocation}
   */
  static allocationFromScore(riskScore) {
    const s = Math.max(0, Math.min(100, riskScore));
    const C = AssetAllocator.BASELINE.Conservative;
    const M = AssetAllocator.BASELINE.Moderate;
    const A = AssetAllocator.BASELINE.Aggressive;

    if (s < 40) {
      const t = s / 40;
      return AssetAllocator.lerpAllocation(C, M, t);
    }
    if (s < 65) {
      const t = (s - 40) / (65 - 40);
      return AssetAllocator.lerpAllocation(M, A, t);
    }
    return { ...A };
  }

  /**
   * Short-horizon floor: forces minimum defensive assets for goals due within
   * a few years (e.g. house down payment, tuition). Raises cash and bonds.
   *
   * @param {AssetAllocation} alloc
   * @param {number} horizonYears
   * @returns {AssetAllocation}
   */
  static applyHorizonFloor(alloc, horizonYears) {
    if (horizonYears > 3) return { ...alloc };

    // Strength of floor increases as horizon shrinks toward 1 year.
    const strength = (4 - Math.max(1, horizonYears)) / 3; // 1 at h=1, ~0 at h=3+

    const minCash = 0.05 + 0.12 * strength;
    const minBonds = 0.1 + 0.15 * strength;

    let next = { ...alloc };
    next.cash = Math.max(next.cash, minCash);
    next.bonds = Math.max(next.bonds, minBonds);

    // If minimums exceed 1, trim equities first (funding horizon priority).
    let sum = next.equities + next.bonds + next.cash;
    if (sum > 1) {
      const excess = sum - 1;
      next.equities = Math.max(0, next.equities - excess);
    }
    return AssetAllocator.normalize(next);
  }

  /**
   * Primary API: category + score + horizon for a full baseline allocation.
   *
   * @param {RiskCategory} category - Used for documentation; score drives weights.
   * @param {number} riskScore
   * @param {number} investmentHorizonYears
   * @returns {AssetAllocation}
   */
  static getBaselineAllocation(category, riskScore, investmentHorizonYears) {
    void category; // category available for logging or UI labels; score interpolates
    let alloc = AssetAllocator.allocationFromScore(riskScore);
    alloc = AssetAllocator.applyHorizonFloor(alloc, investmentHorizonYears);
    return AssetAllocator.normalize(alloc);
  }

  /**
   * Human-readable percentages for the metrics panel.
   *
   * @param {AssetAllocation} alloc
   * @returns {{ equities: string, bonds: string, cash: string }}
   */
  static formatPercentages(alloc) {
    const fmt = (x) => `${(x * 100).toFixed(1)}%`;
    return {
      equities: fmt(alloc.equities),
      bonds: fmt(alloc.bonds),
      cash: fmt(alloc.cash),
    };
  }
}

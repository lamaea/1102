/**
 * RiskProfiler.js
 * -----------------------------------------------------------------------------
 * Translates UserProfile fields into a standardized Risk Score (0–100) and a
 * discrete Risk Category for downstream AssetAllocator.
 *
 * FINANCIAL LOGIC (not a simple age rule):
 * - We blend three pillars: stated risk tolerance, investment horizon, and a
 *   life-cycle age factor. Horizon is weighted heavily because short horizons
 *   cannot "wait out" equity drawdowns — this dominates when horizon is low even
 *   if the user selects high risk tolerance (behavioral finance: recency and
 *   overconfidence are common; the model caps equity-seeking behavior).
 * - Goal acts as a prior: preservation/income pull the score down; aggressive
 *   growth pulls it up, before horizon/age constraints apply.
 * - The final score is clamped to [0, 100] and mapped to Conservative / Moderate /
 *   Aggressive using fixed thresholds suitable for a teaching prototype.
 */

import { UserProfile } from "../models/UserProfile.js";

/** @typedef {'Conservative'|'Moderate'|'Aggressive'} RiskCategory */

export class RiskProfiler {
  /**
   * Goal priors: additive adjustment to the pre-horizon "willingness" layer.
   * Negative = more defensive; positive = more return-seeking.
   */
  static GOAL_PRIOR = {
    capital_preservation: -18,
    income: -10,
    balanced_growth: 0,
    growth: 10,
    aggressive_growth: 18,
  };

  /**
   * Horizon penalty: non-linear squash for short horizons.
   * Uses a smooth curve so 1–3 years are heavily penalized; 15+ years approach neutral.
   *
   * @param {number} years
   * @returns {number} roughly in [-35, 0]
   */
  static horizonPenalty(years) {
    // Exponential decay: short horizons get large negative adjustments.
    // At 1 year: strong penalty; at 25+ years: near zero penalty.
    const h = Math.max(1, Math.min(40, years));
    return -35 * Math.exp(-h / 6);
  }

  /**
   * Age factor: younger investors can sustain more volatility in theory, but we
   * do not use age alone — it is a modest tilt combined with horizon.
   *
   * @param {number} age
   * @returns {number} small adjustment in roughly [-8, 8]
   */
  static ageTilt(age) {
    const a = Math.max(18, Math.min(85, age));
    // Peak risk capacity in mid-career; very young and very old slightly moderated.
    const normalized = (a - 18) / (85 - 18); // 0..1
    return 8 * Math.sin(normalized * Math.PI) - 2; // slight mid-life bump
  }

  /**
   * Map 1–10 risk tolerance to a 0–100 willingness layer before constraints.
   *
   * @param {number} tol
   * @returns {number}
   */
  static toleranceLayer(tol) {
    const t = Math.max(1, Math.min(10, tol));
    return ((t - 1) / 9) * 100;
  }

  /**
   * Compute composite risk score 0–100.
   *
   * @param {UserProfile} profile
   * @returns {number}
   */
  static computeRiskScore(profile) {
    const willingness = RiskProfiler.toleranceLayer(profile.riskTolerance);
    const goalAdj = RiskProfiler.GOAL_PRIOR[profile.financialGoal] ?? 0;
    const horizonAdj = RiskProfiler.horizonPenalty(profile.investmentHorizonYears);
    const ageAdj = RiskProfiler.ageTilt(profile.age);

    // Weighted blend: horizon dominates (0.45) so short horizons cannot be offset
    // by high tolerance alone; tolerance is 0.35; age is 0.15; goal prior applied
    // before normalization as a shift on the "behavioral" part.
    const behavioral = willingness + goalAdj;
    const raw =
      0.35 * behavioral +
      0.45 * (behavioral + horizonAdj) +
      0.15 * (behavioral + ageAdj) +
      0.05 * (50 + ageAdj);

    // Clamp to [0, 100]
    return Math.round(Math.max(0, Math.min(100, raw)));
  }

  /**
   * Map numeric score to category bands (industry-style buckets for pedagogy).
   *
   * @param {number} score
   * @returns {RiskCategory}
   */
  static categorize(score) {
    if (score < 40) return "Conservative";
    if (score < 65) return "Moderate";
    return "Aggressive";
  }

  /**
   * Full analysis object for UI and downstream modules.
   *
   * @param {UserProfile} profile
   * @returns {{ riskScore: number, category: RiskCategory }}
   */
  static analyze(profile) {
    const riskScore = RiskProfiler.computeRiskScore(profile);
    const category = RiskProfiler.categorize(riskScore);
    return { riskScore, category };
  }
}

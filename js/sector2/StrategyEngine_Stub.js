/**
 * StrategyEngine_Stub.js (Sector 2 — placeholder)
 * -----------------------------------------------------------------------------
 * Stub module for future strategy selection (e.g. factor tilts, ESG overlays).
 * Exports a minimal API so main.js or other sectors can import without errors
 * when the team implements real logic later.
 */

/**
 * @typedef {Object} StrategyContext
 * @property {string} riskCategory
 * @property {number} riskScore
 */

export class StrategyEngine_Stub {
  /**
   * @param {StrategyContext} _ctx
   * @returns {{ strategyId: string, label: string }}
   */
  static selectStrategy(_ctx) {
    return {
      strategyId: "baseline_strategic",
      label: "Strategic baseline (Sector 2 not implemented)",
    };
  }
}

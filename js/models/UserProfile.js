/**
 * UserProfile.js
 * -----------------------------------------------------------------------------
 * Plain data container for questionnaire inputs. Keeps raw fields separate from
 * derived analytics (risk score, allocation) so Sector 1 logic can evolve without
 * breaking the form layer. Team members can extend this class with validation or
 * serialization (e.g. toJSON) without touching UI code.
 */

/**
 * Supported financial goal keys — aligned with the goal dropdown in index.html.
 * @typedef {'capital_preservation'|'income'|'balanced_growth'|'growth'|'aggressive_growth'} FinancialGoalKey
 */

export class UserProfile {
  /**
   * @param {Object} params
   * @param {number} params.age - Investor age in years (slider range 18–85).
   * @param {number} params.investmentHorizonYears - Planned holding period in years.
   * @param {number} params.riskTolerance - Subjective scale 1 (low) to 10 (high).
   * @param {FinancialGoalKey} params.financialGoal - Selected goal from dropdown.
   */
  constructor({ age, investmentHorizonYears, riskTolerance, financialGoal }) {
    this.age = age;
    this.investmentHorizonYears = investmentHorizonYears;
    this.riskTolerance = riskTolerance;
    this.financialGoal = financialGoal;
  }

  /**
   * Factory from DOM form: reads current control values into a UserProfile.
   * Centralizes field names so main.js stays thin.
   *
   * @param {HTMLFormElement} form
   * @returns {UserProfile}
   */
  static fromForm(form) {
    const age = Number(form.querySelector("#age")?.value);
    const investmentHorizonYears = Number(form.querySelector("#horizon")?.value);
    const riskTolerance = Number(form.querySelector("#risk")?.value);
    const financialGoal = /** @type {FinancialGoalKey} */ (
      form.querySelector("#goal")?.value || "balanced_growth"
    );
    return new UserProfile({
      age,
      investmentHorizonYears,
      riskTolerance,
      financialGoal,
    });
  }
}

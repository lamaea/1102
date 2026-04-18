/**
 * simulator-app.js
 * ---------------------------------------------------------------------------
 * Stable, non-module simulator controller for simulator.html.
 * Works in file:// and local HTTP environments.
 */
(function () {
  /** @type {Chart | null} */
  let chart = null;
  // --- INSERT START ---
  /** @type {Chart | null} */
  let comparisonChart = null; 
  // --- INSERT END ---
  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function readProfile(form) {
    return {
      age: Number(form.querySelector("#age")?.value || 35),
      investmentHorizonYears: Number(form.querySelector("#horizon")?.value || 10),
      riskTolerance: Number(form.querySelector("#risk")?.value || 5),
      financialGoal: String(
        form.querySelector("#goal")?.value || "balanced_growth"
      ),
    };
  }

  // ---------- Risk model ----------
  const GOAL_PRIOR = {
    capital_preservation: -18,
    income: -10,
    balanced_growth: 0,
    growth: 10,
    aggressive_growth: 18,
  };

  function toleranceLayer(tol) {
    const t = clamp(tol, 1, 10);
    return ((t - 1) / 9) * 100;
  }

  function horizonPenalty(years) {
    const h = clamp(years, 1, 40);
    return -35 * Math.exp(-h / 6);
  }

  function ageTilt(age) {
    const a = clamp(age, 18, 85);
    const normalized = (a - 18) / (85 - 18);
    return 8 * Math.sin(normalized * Math.PI) - 2;
  }

  function computeRisk(profile) {
    const willingness = toleranceLayer(profile.riskTolerance);
    const goalAdj = GOAL_PRIOR[profile.financialGoal] || 0;
    const horizonAdj = horizonPenalty(profile.investmentHorizonYears);
    const ageAdj = ageTilt(profile.age);
    const behavioral = willingness + goalAdj;

    const raw =
      0.35 * behavioral +
      0.45 * (behavioral + horizonAdj) +
      0.15 * (behavioral + ageAdj) +
      0.05 * (50 + ageAdj);

    const riskScore = Math.round(clamp(raw, 0, 100));
    const category =
      riskScore < 40 ? "Conservative" : riskScore < 65 ? "Moderate" : "Aggressive";

    return { riskScore, category };
  }

  // ---------- Allocation model ----------
  const BASELINE = {
    Conservative: { equities: 0.25, bonds: 0.55, cash: 0.2 },
    Moderate: { equities: 0.55, bonds: 0.35, cash: 0.1 },
    Aggressive: { equities: 0.8, bonds: 0.15, cash: 0.05 },
  };

  function normalize(allocation) {
    const sum = allocation.equities + allocation.bonds + allocation.cash;
    if (sum <= 0) return { equities: 0.34, bonds: 0.33, cash: 0.33 };
    return {
      equities: allocation.equities / sum,
      bonds: allocation.bonds / sum,
      cash: allocation.cash / sum,
    };
  }

  function lerp(a, b, t) {
    const x = clamp(t, 0, 1);
    return {
      equities: a.equities + (b.equities - a.equities) * x,
      bonds: a.bonds + (b.bonds - a.bonds) * x,
      cash: a.cash + (b.cash - a.cash) * x,
    };
  }

  function allocationFromScore(score) {
    const s = clamp(score, 0, 100);
    const C = BASELINE.Conservative;
    const M = BASELINE.Moderate;
    const A = BASELINE.Aggressive;
    if (s < 40) return lerp(C, M, s / 40);
    if (s < 65) return lerp(M, A, (s - 40) / 25);
    return { ...A };
  }

  function applyHorizonFloor(allocation, years) {
    if (years > 3) return { ...allocation };
    const strength = (4 - clamp(years, 1, 3)) / 3;
    const minCash = 0.05 + 0.12 * strength;
    const minBonds = 0.1 + 0.15 * strength;

    const next = { ...allocation };
    next.cash = Math.max(next.cash, minCash);
    next.bonds = Math.max(next.bonds, minBonds);

    const sum = next.equities + next.bonds + next.cash;
    if (sum > 1) {
      next.equities = Math.max(0, next.equities - (sum - 1));
    }
    return normalize(next);
  }

  function getAllocation(riskScore, horizon) {
    return applyHorizonFloor(allocationFromScore(riskScore), horizon);
  }
  // ---------- EQUAL WEIGHTING ANALYSIS (Your Part) ----------
  const ASSET_PERFORMANCE = {
    equities: { return: 0.16, vol: 0.17 },
    bonds:    { return: 0.035, vol: 0.046 },
    cash:     { return: 0.0008, vol: 0.015 }
  };

  function calculateStats(alloc) {
    const r = (alloc.equities * ASSET_PERFORMANCE.equities.return +
               alloc.bonds * ASSET_PERFORMANCE.bonds.return +
               alloc.cash * ASSET_PERFORMANCE.cash.return) * 100;
    
    const v = (alloc.equities * ASSET_PERFORMANCE.equities.vol +
               alloc.bonds * ASSET_PERFORMANCE.bonds.vol +
               alloc.cash * ASSET_PERFORMANCE.cash.vol) * 100;
    
    return { returnPct: r.toFixed(2), volPct: v.toFixed(2) };
  }

  function renderComparison(riskModelAlloc) {
    const eqAlloc = { equities: 1/3, bonds: 1/3, cash: 1/3 };
    const eqStats = calculateStats(eqAlloc);
    const rbStats = calculateStats(riskModelAlloc);

    const update = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    update('eq-return', eqStats.returnPct);
    update('eq-vol', eqStats.volPct);
    update('rb-return', rbStats.returnPct);
    update('rb-vol', rbStats.volPct);

    renderComparisonChart(eqStats, rbStats);
  }

  function renderComparisonChart(eq, rb) {
    const canvas = document.getElementById("comparison-bar-chart");
    if (!canvas || typeof Chart === "undefined") return;

    const chartData = {
      labels: ['Expected Return (%)', 'Annual Volatility (%)'],
      datasets: [
        {
          label: 'Equal Weighting (1/N)',
          data: [eq.returnPct, eq.volPct],
          backgroundColor: '#4A90E2',
          borderRadius: 4
        },
        {
          label: 'Risk-Based Model (Team)',
          data: [rb.returnPct, rb.volPct],
          backgroundColor: '#1e293b',
          borderRadius: 4
        }
      ]
    };

    if (comparisonChart) {
      comparisonChart.data = chartData;
      comparisonChart.update('none');
    } else {
      comparisonChart = new Chart(canvas, {
        type: 'bar',
        data: chartData,
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom' }
          },
          scales: {
            y: { beginAtZero: true, ticks: { callback: v => v + '%' } }
          }
        }
      });
    }
  }
  function pct(n) {
    return `${(n * 100).toFixed(1)}%`;
  }

  function syncSliderOutput(form, inputId, outputId) {
    const input = form.querySelector(`#${inputId}`);
    const output = form.querySelector(`#${outputId}`);
    if (!input || !output) return;
    const update = function () {
      output.textContent = input.value;
      input.setAttribute("aria-valuenow", input.value);
    };
    input.addEventListener("input", update);
    input.addEventListener("change", update);
    update();
  }

  function renderMetrics(riskScore, category) {
    var scoreEl = document.getElementById("metric-risk-score");
    var categoryEl = document.getElementById("metric-category");
    if (scoreEl) scoreEl.textContent = String(riskScore);
    if (categoryEl) categoryEl.textContent = category;
  }

  function renderChart(alloc) {
    var canvas = document.getElementById("allocation-chart");
    var placeholder = document.getElementById("chart-placeholder");
    var chartWrap = canvas ? canvas.closest(".chart-wrap") : null;
    if (!canvas) return;

    if (typeof Chart === "undefined") {
      if (placeholder) {
        placeholder.hidden = false;
        placeholder.textContent = "Chart.js failed to load — check your network.";
      }
      return;
    }

    if (placeholder) placeholder.hidden = true;
    if (chartWrap) chartWrap.classList.add("has-chart");

    var labels = ["Equities", "Bonds", "Cash"];
    var values = [
      Math.round(alloc.equities * 1000) / 10,
      Math.round(alloc.bonds * 1000) / 10,
      Math.round(alloc.cash * 1000) / 10,
    ];
    var bgColors = ["#0284c7", "#1e293b", "#22c55e"];
    var borderColors = ["#0ea5e9", "#334155", "#4ade80"];

    if (chart) {
      chart.data.datasets[0].data = values;
      chart.update("none");
      return;
    }

    chart = new Chart(canvas, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Weight (%)",
            data: values,
            backgroundColor: bgColors,
            borderColor: borderColors,
            borderWidth: 1,
            borderRadius: 6,
            barPercentage: 0.6,
          },
        ],
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            min: 0,
            max: 100,
            ticks: {
              callback: function (v) {
                return v + "%";
              },
              color: "#64748b",
              font: { size: 12 },
            },
            grid: { color: "rgba(0,0,0,0.05)" },
          },
          y: {
            ticks: {
              color: "#1e293b",
              font: { size: 13, weight: "600" },
            },
            grid: { display: false },
          },
        },
        plugins: {
          legend: { display: false },
          title: {
            display: true,
            text: "Baseline strategic weights",
            color: "#1e293b",
            font: { size: 15, weight: "600" },
            padding: { bottom: 16 },
          },
          tooltip: {
            callbacks: {
              label: function (ctx) {
                return ctx.raw + "%";
              },
            },
          },
        },
      },
    });
  }

  function run(form) {
    const profile = readProfile(form);
    const { riskScore, category } = computeRisk(profile);
    const allocation = getAllocation(riskScore, profile.investmentHorizonYears);
    renderMetrics(riskScore, category);
    renderChart(allocation);
    renderComparison(allocation);
  }

  function init() {
    const form = document.getElementById("profile-form");
    if (!(form instanceof HTMLFormElement)) return;

    // Prevent browser navigation caused by form submission.
    form.setAttribute("action", "#");
    form.setAttribute("method", "post");

    syncSliderOutput(form, "age", "age-output");
    syncSliderOutput(form, "horizon", "horizon-output");
    syncSliderOutput(form, "risk", "risk-output");

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      event.stopPropagation();
      run(form);
    });

    const submitBtn = document.getElementById("submit-btn");
    if (submitBtn) {
      submitBtn.addEventListener("click", function (event) {
        event.preventDefault();
        run(form);
      });
    }

    form.addEventListener("input", function () {
      run(form);
    });
    form.addEventListener("change", function () {
      run(form);
    });

    run(form);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();


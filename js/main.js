/**
 * main.js — application entry (ES module)
 * -----------------------------------------------------------------------------
 * Requires a local HTTP server (e.g. Live Server, python -m http.server) so
 * ES module imports resolve. Slider badges are handled by live-bindings.js.
 * Recomputes risk, metrics, and Chart.js when sliders/goal change (debounced).
 */

import { UserProfile } from "./models/UserProfile.js";
import { RiskProfiler } from "./sector1/RiskProfiler.js";
import { AssetAllocator } from "./sector1/AssetAllocator.js";
import { StrategyEngine_Stub } from "./sector2/StrategyEngine_Stub.js";
import { BacktestEngine_Stub } from "./sector3/BacktestEngine_Stub.js";

/** @type {import("chart.js").Chart | null} */
let allocationChart = null;

/** @type {ReturnType<typeof setTimeout> | null} */
let refreshTimer = null;

const REFRESH_DEBOUNCE_MS = 120;

/**
 * Format allocation for the metrics panel weight line.
 *
 * @param {import("./sector1/AssetAllocator.js").AssetAllocation} alloc
 */
function formatWeightsLine(alloc) {
  const p = AssetAllocator.formatPercentages(alloc);
  return `Equities ${p.equities} · Bonds ${p.bonds} · Cash ${p.cash}`;
}

/**
 * Destroy previous Chart.js instance to avoid canvas leaks on repeated submit.
 */
function destroyChartIfAny() {
  if (allocationChart) {
    allocationChart.destroy();
    allocationChart = null;
  }
}

/**
 * Build or update the doughnut chart with three segments: Equities, Bonds, Cash.
 *
 * @param {import("./sector1/AssetAllocator.js").AssetAllocation} alloc
 */
function renderAllocationChart(alloc) {
  const canvas = document.getElementById("allocation-chart");
  const wrap = canvas?.closest(".chart-wrap");
  const placeholder = document.getElementById("chart-placeholder");

  const ChartCtor = globalThis.Chart;
  if (!canvas || typeof ChartCtor === "undefined") {
    console.warn("Chart.js or canvas missing");
    return;
  }

  destroyChartIfAny();
  wrap?.classList.add("has-chart");
  if (placeholder) placeholder.hidden = true;

  const labels = ["Equities", "Bonds", "Cash"];
  const data = [
    Math.round(alloc.equities * 1000) / 10,
    Math.round(alloc.bonds * 1000) / 10,
    Math.round(alloc.cash * 1000) / 10,
  ];

  const colors = [
    "rgba(61, 156, 249, 0.85)",
    "rgba(139, 92, 246, 0.85)",
    "rgba(74, 222, 128, 0.85)",
  ];
  const borderColors = ["#7ec8ff", "#c4b5fd", "#86efac"];

  allocationChart = new ChartCtor(canvas, {
    type: "doughnut",
    data: {
      labels,
      datasets: [
        {
          data,
          backgroundColor: colors,
          borderColor: borderColors,
          borderWidth: 2,
          hoverOffset: 8,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      cutout: "58%",
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            color: "#c8d0dc",
            font: { family: "'DM Sans', sans-serif", size: 12 },
            padding: 14,
          },
        },
        tooltip: {
          callbacks: {
            label(ctx) {
              const label = ctx.label || "";
              const value = ctx.parsed ?? 0;
              return `${label}: ${value}%`;
            },
          },
        },
        title: {
          display: true,
          text: "Baseline strategic weights",
          color: "#f0f3f7",
          font: { size: 15, weight: "600", family: "'DM Sans', sans-serif" },
          padding: { bottom: 12 },
        },
      },
    },
  });
}

/**
 * Show risk metrics in the panel (hidden until first successful submit).
 *
 * @param {number} riskScore
 * @param {string} category
 * @param {import("./sector1/AssetAllocator.js").AssetAllocation} alloc
 */
function updateMetricsPanel(riskScore, category, alloc) {
  const panel = document.getElementById("metrics-panel");
  const elScore = document.getElementById("metric-risk-score");
  const elCat = document.getElementById("metric-category");
  const elWeights = document.getElementById("metric-weights");

  if (panel) panel.hidden = false;
  if (elScore) elScore.textContent = String(riskScore);
  if (elCat) elCat.textContent = category;
  if (elWeights) elWeights.textContent = formatWeightsLine(alloc);
}

/**
 * Run Sector 1 pipeline and refresh metrics + chart.
 *
 * @param {HTMLFormElement} form
 */
function runPipelineAndVisualize(form) {
  const profile = UserProfile.fromForm(form);
  const { riskScore, category } = RiskProfiler.analyze(profile);

  const allocation = AssetAllocator.getBaselineAllocation(
    category,
    riskScore,
    profile.investmentHorizonYears
  );

  updateMetricsPanel(riskScore, category, allocation);
  renderAllocationChart(allocation);

  const strategy = StrategyEngine_Stub.selectStrategy({
    riskCategory: category,
    riskScore,
  });
  const backtest = BacktestEngine_Stub.runBacktest({ allocation });
  console.debug("[Sector2 stub]", strategy, "[Sector3 stub]", backtest);
}

/**
 * Debounced refresh so dragging sliders does not thrash Chart.js.
 *
 * @param {HTMLFormElement} form
 */
function scheduleRefresh(form) {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(function () {
    refreshTimer = null;
    try {
      runPipelineAndVisualize(form);
    } catch (err) {
      console.error(err);
    }
  }, REFRESH_DEBOUNCE_MS);
}

/**
 * @param {SubmitEvent} e
 */
function onSubmit(e) {
  e.preventDefault();
  const form = /** @type {HTMLFormElement} */ (e.target);
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = null;
  runPipelineAndVisualize(form);
}

function init() {
  const form = document.getElementById("profile-form");
  if (!form) return;

  // Live update: any range input, goal select, or custom event from live-bindings.js
  form.addEventListener("input", function () {
    scheduleRefresh(form);
  });
  form.addEventListener("change", function (ev) {
    if (ev.target && ev.target.id === "goal") {
      scheduleRefresh(form);
    }
  });
  form.addEventListener("robo-slider-change", function () {
    scheduleRefresh(form);
  });

  form.addEventListener("submit", onSubmit);

  // Initial chart + metrics from default form values
  runPipelineAndVisualize(form);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

/**
 * main.js — stable simulator controller
 * ---------------------------------------------------------------------------
 * A single, predictable flow:
 * 1) User changes inputs (slider badges update immediately)
 * 2) User submits form (prevent default, no page refresh)
 * 3) Risk + allocation are computed
 * 4) Metrics and donut chart render
 */

import { UserProfile } from "./models/UserProfile.js";
import { RiskProfiler } from "./sector1/RiskProfiler.js";
import { AssetAllocator } from "./sector1/AssetAllocator.js";

/** @type {import("chart.js").Chart | null} */
let chartInstance = null;

/**
 * @param {number} value
 * @returns {number}
 */
function toPct(value) {
  return Math.round(value * 1000) / 10;
}

/**
 * Keep slider numeric labels in sync.
 * @param {HTMLFormElement} form
 */
function bindSliderOutputs(form) {
  const map = [
    { input: "#age", output: "#age-output" },
    { input: "#horizon", output: "#horizon-output" },
    { input: "#risk", output: "#risk-output" },
  ];

  map.forEach(({ input, output }) => {
    const inputEl = form.querySelector(input);
    const outputEl = form.querySelector(output);
    if (!inputEl || !outputEl) return;

    const sync = () => {
      outputEl.textContent = inputEl.value;
      inputEl.setAttribute("aria-valuenow", inputEl.value);
    };

    inputEl.addEventListener("input", sync);
    inputEl.addEventListener("change", sync);
    sync();
  });
}

/**
 * @param {import("./sector1/AssetAllocator.js").AssetAllocation} allocation
 */
function renderChart(allocation) {
  const canvas = document.getElementById("allocation-chart");
  const placeholder = document.getElementById("chart-placeholder");
  const chartWrap = canvas?.closest(".chart-wrap");
  const ChartCtor = globalThis.Chart;

  if (!canvas) return;
  if (placeholder) placeholder.hidden = true;
  if (chartWrap) chartWrap.classList.add("has-chart");

  // If Chart.js CDN fails, keep metrics usable and show a graceful message.
  if (typeof ChartCtor === "undefined") {
    if (placeholder) {
      placeholder.hidden = false;
      placeholder.textContent =
        "Chart.js failed to load. Please refresh and check network/CDN access.";
    }
    return;
  }

  const labels = ["Equities", "Bonds", "Cash"];
  const values = [
    toPct(allocation.equities),
    toPct(allocation.bonds),
    toPct(allocation.cash),
  ];

  if (chartInstance) {
    chartInstance.data.labels = labels;
    chartInstance.data.datasets[0].data = values;
    chartInstance.update();
    return;
  }

  chartInstance = new ChartCtor(canvas, {
    type: "doughnut",
    data: {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: [
            "rgba(2, 132, 199, 0.85)",
            "rgba(30, 41, 59, 0.75)",
            "rgba(74, 222, 128, 0.85)",
          ],
          borderColor: ["#0ea5e9", "#334155", "#22c55e"],
          borderWidth: 2,
          hoverOffset: 8,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: 1,
      cutout: "58%",
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            color: "#64748b",
            font: { family: "'Inter', sans-serif", size: 12 },
            padding: 12,
          },
        },
        title: {
          display: true,
          text: "Baseline strategic weights",
          color: "#1e293b",
          font: { family: "'Inter', sans-serif", size: 15, weight: "600" },
        },
        tooltip: {
          callbacks: {
            label(context) {
              return `${context.label}: ${context.raw}%`;
            },
          },
        },
      },
    },
  });
}

/**
 * @param {number} riskScore
 * @param {string} category
 * @param {import("./sector1/AssetAllocator.js").AssetAllocation} allocation
 */
function renderMetrics(riskScore, category, allocation) {
  const score = document.getElementById("metric-risk-score");
  const riskCategory = document.getElementById("metric-category");
  const weights = document.getElementById("metric-weights");

  const pct = AssetAllocator.formatPercentages(allocation);
  if (score) score.textContent = String(riskScore);
  if (riskCategory) riskCategory.textContent = category;
  if (weights) {
    weights.textContent = `Equities ${pct.equities} · Bonds ${pct.bonds} · Cash ${pct.cash}`;
  }
}

/**
 * @param {HTMLFormElement} form
 */
function runSimulation(form) {
  const profile = UserProfile.fromForm(form);
  const { riskScore, category } = RiskProfiler.analyze(profile);
  const allocation = AssetAllocator.getBaselineAllocation(
    category,
    riskScore,
    profile.investmentHorizonYears
  );

  renderMetrics(riskScore, category, allocation);
  renderChart(allocation);
}

function init() {
  const form = document.getElementById("profile-form");
  if (!(form instanceof HTMLFormElement)) return;

  bindSliderOutputs(form);

  // Real submit event, always intercepted => no browser refresh.
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    runSimulation(form);
  });

  // Optional live recompute while dragging/choosing.
  form.addEventListener("input", () => runSimulation(form));
  form.addEventListener("change", () => runSimulation(form));

  // Initial state render from default values.
  runSimulation(form);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

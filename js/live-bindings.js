/**
 * live-bindings.js — plain script (NOT an ES module)
 * -----------------------------------------------------------------------------
 * Runs even when index.html is opened via file:// where import() fails, so
 * slider badges always reflect the current range values. Dispatches a custom
 * event so main.js (when loaded over HTTP) can refresh metrics and chart.
 */
(function () {
  function syncRange(id, outId) {
    var el = document.getElementById(id);
    var out = document.getElementById(outId);
    if (!el || !out) return;

    function update() {
      out.textContent = String(el.value);
      el.setAttribute("aria-valuenow", String(el.value));
      var form = el.closest("form");
      if (form) {
        form.dispatchEvent(
          new CustomEvent("robo-slider-change", { bubbles: true })
        );
      }
    }

    el.addEventListener("input", update);
    el.addEventListener("change", update);
    update();
  }

  function init() {
    syncRange("age", "age-output");
    syncRange("horizon", "horizon-output");
    syncRange("risk", "risk-output");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

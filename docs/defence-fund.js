"use strict";

// Valstybės gynybos fondo įstatymo 4 straipsnyje nustatytos dalys tūkstantosiomis.
const defenceFundRates = {
  2025: { gpmRate: null, exciseRate: 41 },
  2026: { gpmRate: 20, exciseRate: 80 },
};

function defenceFundParts(year, gpm, excise) {
  const { gpmRate, exciseRate } = defenceFundRates[year];
  const hasGpm = gpm !== null && gpmRate !== null;
  const gpmShare = hasGpm ? toCents(gpm) * gpmRate : 0;
  const exciseShare = excise === null ? 0 : toCents(excise) * exciseRate;
  const total = Math.round((gpmShare + exciseShare) / 1000);
  let gpmCents = Math.floor(gpmShare / 1000);
  let exciseCents = Math.floor(exciseShare / 1000);
  const remainder = total - gpmCents - exciseCents;
  // Apvalinus bendrą sumą, likęs centas tenka didesnei cento daliai.
  if (remainder === 2) {
    gpmCents += 1;
    exciseCents += 1;
  } else if (remainder === 1) {
    if (gpmShare % 1000 >= exciseShare % 1000) gpmCents += 1;
    else exciseCents += 1;
  }
  return {
    gpm: hasGpm ? gpmCents : null,
    excise: excise === null ? null : exciseCents,
  };
}

function parseDefenceAmount(value) {
  const text = value.trim();
  if (!text) return null;
  if (!/^(?:\d+|\d{1,3}(?:[ \u00a0\u202f]\d{3})+)(?:[,.]\d{1,2})?$/.test(text)) return NaN;
  const euros = Number(text.replace(/\s/g, "").replace(",", "."));
  return euros <= 100_000_000 ? euros : NaN;
}

function installDefenceExample(section) {
  const find = (id) => section.querySelector("#defence-" + id);
  const yearSelect = find("year");
  const gpmInput = find("gpm");
  const exciseInput = find("excise");
  const gpmField = find("gpm-field");
  const error = find("error");
  const resultBox = find("result");
  const savedEntries = new Map();
  let year = yearSelect.value;

  function render() {
    const rates = defenceFundRates[year];
    const hasGpm = rates.gpmRate !== null;
    gpmField.hidden = !hasGpm;
    find("guide").textContent = hasGpm
      ? "Įvesk 2026 m. sumokėto GPM ir pirkinių akcizų sumas. Pavyzdys skaičiuojamas pagal čia įvestas sumas."
      : "Įvesk 2025 m. pirkinių akcizų sumą. 2025 m. GPM dalis fondui nustatyta bendra suma visos šalies mastu.";
    find("rates").textContent = hasGpm
      ? "2026 m. fondui skiriama 2 % bendrų valstybės ir savivaldybių GPM įplaukų, atėmus fiksuotą GPM už verslo liudijimus, ir 8 % valstybės akcizų pajamų."
      : "2025 m. fondui skirta 4,1 % valstybės akcizų pajamų.";

    const gpm = hasGpm ? parseDefenceAmount(gpmInput.value) : null;
    const excise = parseDefenceAmount(exciseInput.value);
    const invalidGpm = Number.isNaN(gpm);
    const invalidExcise = Number.isNaN(excise);
    gpmInput.setAttribute("aria-invalid", String(invalidGpm));
    exciseInput.setAttribute("aria-invalid", String(invalidExcise));
    gpmInput.setAttribute("aria-describedby", invalidGpm ? "defence-gpm-help defence-error" : "defence-gpm-help");
    exciseInput.setAttribute("aria-describedby", invalidExcise ? "defence-excise-help defence-error" : "defence-excise-help");
    error.hidden = !invalidGpm && !invalidExcise;
    resultBox.hidden = !error.hidden || (gpm === null && excise === null);
    if (resultBox.hidden) return;

    const parts = defenceFundParts(year, gpm, excise);
    find("amount").textContent = money((parts.gpm ?? 0) + (parts.excise ?? 0));
    const lines = [];
    if (parts.gpm !== null) lines.push("Iš GPM " + money(parts.gpm));
    if (parts.excise !== null) lines.push("Iš akcizų " + money(parts.excise));
    find("breakdown").textContent = lines.join(" · ");
  }

  yearSelect.addEventListener("change", () => {
    savedEntries.set(year, [gpmInput.value, exciseInput.value]);
    year = yearSelect.value;
    [gpmInput.value, exciseInput.value] = savedEntries.get(year) ?? ["", ""];
    render();
  });
  gpmInput.addEventListener("input", render);
  exciseInput.addEventListener("input", render);
  render();
}

if (typeof document !== "undefined") installDefenceExample(document.getElementById("gpm-2025-2026"));

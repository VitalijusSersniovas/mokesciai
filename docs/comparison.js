"use strict";

const comparisonPriceChecked = "2026-11-19";

const monthlyRetailSource = {
  name: "Valstybės duomenų agentūra",
  kind: "Lietuvos vidutinė mažmeninė mėnesio kaina",
  date: "2026 m. spalis",
  url: "https://dataportal.gov.lt/lt/datasets/sd005283",
};

const fuelPriceSource = {
  name: "Lietuvos energetikos agentūra",
  kind: "Lietuvos degalinių mažmeninių kainų vidurkis",
  date: "2026-11-19 iki 10 val.",
  url: "https://www.ena.lt/Naujiena/kdk-20261119/",
};

const electricityPriceSource = {
  name: "Valstybinė energetikos reguliavimo taryba",
  kind: "Visuomeninis tarifas nepažeidžiamiems vartotojams, su PVM",
  date: "2026 m. liepa–gruodis",
  url: "https://vert.lt/Puslapiai/naujienos/2026-metai/2026-05-27/patvirtinti-2026-m--antrojo-pusmecio-visuomeninio-elektros-tiekimo-tarifai.aspx",
};

const referencePrices = [
  { photo: 2, label: "Pienas", detail: "Pasterizuotas, 2,5 % riebumo", type: "Maistas", cents: 106, unit: "l", source: monthlyRetailSource },
  { photo: 4, label: "Elektra", detail: "Visuomeninis tiekimas, vienos zonos planas „Standartinis“", type: "Energija", cents: 24, unit: "kWh", source: electricityPriceSource },
  { photo: 3, label: "Dyzelinas", type: "Degalai", cents: 218.1, unit: "l", source: fuelPriceSource },
  { photo: 5, label: "Danties plombavimas", detail: "Viena helio plomba", type: "Sveikata", cents: 8370, unit: "vnt.", whole: true, source: monthlyRetailSource },
  { photo: 3, label: "Benzinas", type: "Degalai", cents: 174.4, unit: "l", source: fuelPriceSource },
  { photo: 0, label: "Bulvės", type: "Maistas", cents: 64, unit: "kg", source: monthlyRetailSource },
  { photo: 1, label: "Kiaulienos nugarinė", detail: "Be kaulo", type: "Maistas", cents: 484, unit: "kg", source: monthlyRetailSource },
  {
    photo: 9, label: "Skalbyklė", detail: "„Beko BM3WFSU37213WPBB“, 7 kg", type: "Buitis", cents: 32900, unit: "vnt.", whole: true,
    source: { name: "„Senukai“", kind: "Pardavėjo internetinė kaina be lojalumo nuolaidos", date: comparisonPriceChecked, url: "https://www.senukai.lt/p/skalbimo-masina-beko-bm3wfsu37213wpbb-7-kg-balta-sp/xqtq" },
  },
  {
    photo: 12, label: "Išmanusis telefonas", detail: "„Samsung Galaxy A17 LTE“, 128 GB", type: "Technika", cents: 19999, unit: "vnt.", whole: true,
    source: { name: "„Elesen“", kind: "Pardavėjo internetinė kaina be lojalumo nuolaidos", date: comparisonPriceChecked, url: "https://www.elesen.lt/telefonai/mobilieji-telefonai/mobilieji-telefonai/sm-a175fzkbeue/samsung-galaxy-a17-lte-128gb-juodas-ismanusis-telefonas" },
  },
  {
    photo: 13, label: "Namų internetas", detail: "INIT MIDI iki 100 Mb/s", type: "Ryšys", cents: 1270, unit: "mėn.",
    source: { name: "INIT", kind: "Neterminuotos sutarties mėnesio mokestis, vienkartiniai mokesčiai atskirai", date: comparisonPriceChecked, url: "https://init.lt/internetas/sviesolaidinis-internetas/" },
  },
  {
    photo: 10, label: "Žieminiai batai", detail: "Juodi „AM Shoe“ auliniai", type: "Avalynė", cents: 7499, unit: "poros", whole: true,
    source: { name: "„Deichmann“", kind: "Pardavėjo internetinė kaina su PVM", date: comparisonPriceChecked, url: "https://www.deichmann.com/lt-lt/p/am-shoe-zieminiai-auliniai-juoda-163401" },
  },
  {
    photo: 11, label: "Gedimino pilies bokšto bilietas", detail: "Bilietas suaugusiajam", type: "Kultūra", cents: 800, unit: "vnt.", whole: true,
    source: { name: "Lietuvos nacionalinis muziejus", kind: "Pilna bilieto kaina Vilniuje", date: comparisonPriceChecked, url: "https://lnm.lt/muziejai/gedimino-pilies-bokstas/" },
  },
  {
    photo: 6, label: "iPhone 17", detail: "256 GB, juodas", type: "Technika", cents: 114900, unit: "vnt.", whole: true,
    source: { name: "„Elesen“", kind: "Pardavėjo internetinė kaina", date: comparisonPriceChecked, url: "https://www.elesen.lt/telefonai/mobilieji-telefonai/mobilieji-telefonai/mg6j4hxfsa/apple-iphone-17-256-gb-juodas-ismanusis-telefonas" },
  },
];

const comparisonSheets = ["food", "services", "everyday", "household"];
const mvpdBenchmark = {
  cents: 46800, unit: "mėn.", source: "2026 m. dydis pagal įsakymą Nr. A1-730",
  url: "https://www.e-tar.lt/rs/legalact/ab443004d77a11f08918e1adc7c5b1ec/",
};

const quantityFormat = new Intl.NumberFormat("lt-LT", { maximumFractionDigits: 1 });
const unitPriceFormat = new Intl.NumberFormat("lt-LT", { style: "currency", currency: "EUR", maximumFractionDigits: 4 });

function formatUnitPrice(price) {
  return unitPriceFormat.format(price.cents / 100) + " / " + price.unit;
}

function comparePrice(total, price) {
  // Use integer ten-thousandths of a euro so exact price boundaries are kept.
  const scale = price.whole ? 1 : 10;
  const priceUnits = Math.round(price.cents * 100);
  const quantity = Math.floor(total * 100 * scale / priceUnits) / scale;
  return {
    quantity,
    value: (!price.whole && total > 0 && quantity === 0 ? "< 0,1" : quantityFormat.format(quantity)) + " " + price.unit,
    remaining: price.whole ? total - quantity * price.cents : 0,
  };
}

function householdBillComparisons(total, purchases) {
  const rows = [];
  const bills = [["electricity", "Tavo elektros išlaidos"], ["heating", "Tavo šildymo išlaidos"],
    ["hotWater", "Tavo karšto vandens išlaidos"], ["heatAndWater", "Tavo šildymo ir karšto vandens išlaidos"]];
  for (const [key, label] of bills) {
    const annual = purchases.filter((item) => item.productKey === key).reduce((sum, item) => sum + item.price, 0);
    if (annual > 0) rows.push({
      label,
      quantity: comparePrice(total * 12, { cents: annual, unit: "mėn." }).value,
      price: "Vidutiniškai " + money(Math.round(annual / 12)) + " per mėnesį pagal tavo 2025 m. duomenis",
    });
  }
  return rows;
}

function installPriceComparison(section) {
  const list = section.querySelector(".price-grid");
  const totalLabel = section.querySelector("#comparison-total");
  const caption = section.querySelector("#comparison-caption");
  const priceChecked = section.querySelector("#comparison-checked");
  priceChecked.dateTime = comparisonPriceChecked;
  priceChecked.textContent = comparisonPriceChecked;
  const customPrice = section.querySelector("#custom-price");
  const customUnit = section.querySelector("#custom-unit");
  const customOutput = section.querySelector("#custom-equivalent");
  const customHelp = section.querySelector("#custom-price-help");
  const personalList = section.querySelector("#personal-comparisons");
  const mvpdValue = section.querySelector("#mvpd-equivalent");
  const mvpdPrice = section.querySelector("#mvpd-price");
  const mvpdSource = section.querySelector("#mvpd-source");
  mvpdPrice.textContent = formatUnitPrice(mvpdBenchmark);
  mvpdSource.href = mvpdBenchmark.url;
  mvpdSource.textContent = mvpdBenchmark.source;
  let sum = { total: 0, example: true, purchases: [] };

  const more = section.querySelector("#more-prices");
  const featuredCount = 4;
  const cards = referencePrices.map((price, index) => {
    const card = document.createElement("li");
    card.className = "price-card";
    card.dataset.type = price.type;
    card.hidden = index >= featuredCount;
    const photo = document.createElement("div");
    photo.className = "price-photo";
    photo.dataset.sheet = comparisonSheets[Math.floor(price.photo / 4)];
    photo.dataset.tile = String(price.photo % 4);
    photo.setAttribute("aria-hidden", "true");
    const label = document.createElement("h3");
    label.textContent = price.label;
    const detail = document.createElement("p");
    detail.className = "price-detail";
    detail.textContent = price.detail ?? price.type;
    const quantity = document.createElement("p");
    quantity.className = "price-quantity";
    const unitPrice = document.createElement("p");
    unitPrice.className = "unit-price";
    unitPrice.textContent = formatUnitPrice(price);
    const source = document.createElement("p");
    source.className = "price-source";
    const sourceLink = document.createElement("a");
    sourceLink.href = price.source.url;
    sourceLink.textContent = price.source.name;
    sourceLink.setAttribute("aria-label", "Kainos šaltinis: " + price.label + " – " + price.source.name);
    source.append(sourceLink, " · " + price.source.date);
    const kind = document.createElement("p");
    kind.className = "price-kind";
    kind.textContent = price.source.kind;
    const amountNote = document.createElement("p");
    amountNote.className = "price-amount-note";
    amountNote.hidden = true;
    card.append(photo, label, detail, quantity, unitPrice, amountNote, kind, source);
    list.append(card);
    return { price, quantity, amountNote, card };
  });

  function renderPersonal() {
    const rows = householdBillComparisons(sum.total, sum.purchases);
    personalList.hidden = !rows.length;
    personalList.replaceChildren(...rows.map((row) => {
      const item = document.createElement("li");
      const label = document.createElement("span");
      const value = document.createElement("strong");
      const basis = document.createElement("small");
      label.textContent = row.label;
      value.textContent = row.quantity;
      basis.textContent = row.price;
      item.append(label, value, basis);
      return item;
    }));
  }

  function showCustomComparison(total) {
    const raw = customPrice.value.trim();
    if (!raw) {
      customOutput.textContent = "—";
      customPrice.removeAttribute("aria-invalid");
      customHelp.textContent = "Įvesk dabartinę vieneto kainą su mokesčiais.";
      return;
    }
    const value = /^(?:\d+|\d{1,3}(?:[ \u00a0\u202f]\d{3})+)(?:[,.]\d{1,2})?$/.test(raw)
      ? toCents(Number(raw.replace(/\s/g, "").replace(",", "."))) : NaN;
    const valid = Number.isSafeInteger(value) && value > 0 && value <= 1_000_000_000;
    if (valid) customPrice.removeAttribute("aria-invalid");
    else customPrice.setAttribute("aria-invalid", "true");
    const unit = customUnit.selectedOptions[0].textContent;
    customOutput.textContent = valid ? comparePrice(total, { cents: value, unit, whole: customUnit.value === "whole" }).value : "—";
    customHelp.textContent = valid ? "Palyginimas pagal tavo įvestą kainą su mokesčiais." : "Įvesk vieneto kainą nuo 0,01 € iki 10 mln. €.";
  }

  function render(animate) {
    const { total } = sum;
    totalLabel.textContent = money(total);
    caption.textContent = sum.example ? "Metinė suma pagal skaičiuoklės pavyzdį" : "Metinė suma";
    mvpdValue.textContent = comparePrice(total, mvpdBenchmark).value;
    cards.forEach(({ price, quantity, amountNote }) => {
      const result = comparePrice(total, price);
      quantity.textContent = result.value;
      const showNote = price.whole && total > 0;
      amountNote.hidden = !showNote;
      if (showNote) {
        amountNote.textContent = result.quantity === 0
          ? "Iki 1 vnt. trūktų " + money(price.cents - total)
          : "Liktų " + money(result.remaining);
      }
    });
    renderPersonal();
    showCustomComparison(total);
    if (animate && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const previous = list.getAnimations?.().find((animation) => animation.id === "price-reveal");
      previous?.cancel();
      const animation = list.animate?.([{ opacity: 0.72, transform: "translateY(4px)" }, { opacity: 1, transform: "translateY(0)" }], { duration: 240, easing: "ease-out" });
      if (animation) animation.id = "price-reveal";
    }
  }

  more.addEventListener("click", () => {
    const showAll = more.getAttribute("aria-expanded") === "false";
    cards.slice(featuredCount).forEach(({ card }) => { card.hidden = !showAll; });
    more.setAttribute("aria-expanded", String(showAll));
    more.textContent = showAll ? "Rodyti mažiau" : "Daugiau palyginimų";
  });

  customPrice.addEventListener("input", () => showCustomComparison(sum.total));
  customUnit.addEventListener("change", () => showCustomComparison(sum.total));

  return {
    update(next, animate) {
      sum = next;
      render(animate);
    },
    reportRows(total, { includePersonal = false } = {}) {
      return {
        total: money(total),
        basis: "Bendra mokesčių ir įmokų suma",
        priceChecked: comparisonPriceChecked,
        items: referencePrices.map((price) => ({
          label: [price.label, price.detail].filter(Boolean).join(" · "),
          photo: price.photo,
          quantity: comparePrice(total, price).value,
          price: formatUnitPrice(price),
          date: price.source.date,
          source: price.source.name,
          sourceKind: price.source.kind,
          url: price.source.url,
        })),
        mvpd: { quantity: comparePrice(total, mvpdBenchmark).value, price: formatUnitPrice(mvpdBenchmark), url: mvpdBenchmark.url, source: mvpdBenchmark.source },
        personal: includePersonal ? householdBillComparisons(total, sum.purchases) : [],
      };
    },
  };
}

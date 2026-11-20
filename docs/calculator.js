"use strict";

const element = (id) => document.getElementById(id);
const form = element("tax-form");
const errorMessage = element("form-error");
const incomeMode = element("income-mode");
const wageBasis = element("wage-basis");
const wageInput = element("wages");
const wageNpd = element("wage-npd");
const wageMonthsFormat = new Intl.NumberFormat("lt-LT", { maximumFractionDigits: 1 });
const spendingList = element("spending-list");
const donut = element("donut");
const reportHelp = element("report-help");
const staleResult = element("stale-result");
const priceComparison = installPriceComparison(element("palyginimas"));
const vatFields = [
  { id: "vat-standard", rate: 21 },
  { id: "vat-9", rate: 9 },
  { id: "vat-5", rate: 5 },
];

let showFundShares = false;
let wageEntryBasis = "gross";
const wageInputs = { gross: wageInput.value, net: "" };
let result = {
  ...wageTaxes(24000),
  gross: toCents(24000),
  mode: "wages",
  caption: taxYear + " m. pavyzdys · 2 000 € ant popieriaus per mėnesį",
  example: true,
  vat: 0,
  purchases: [],
};

class InvalidField extends Error {}

function showError(field, message) {
  for (let details = field.closest("details"); details; details = details.parentElement.closest("details")) {
    details.open = true;
  }
  if (!field.hasAttribute("data-original-description")) {
    field.dataset.originalDescription = field.getAttribute("aria-describedby") ?? "";
  }
  field.setAttribute("aria-describedby", (field.dataset.originalDescription + " form-error").trim());
  field.setAttribute("aria-invalid", "true");
  errorMessage.textContent = message;
  errorMessage.hidden = false;
  field.focus();
  throw new InvalidField(message);
}

function readField(field, { required = false, integer = false, min = 0, max = 100_000_000, decimals } = {}) {
  const raw = field.value.trim();
  const label = field.labels?.[0]?.textContent.trim();
  if (!raw && !required) return null;
  if (!raw) showError(field, label ? "Užpildyk lauką „" + label + "“." : "Užpildyk pažymėtą lauką.");
  const value = parseInputNumber(raw);
  if (value === null) {
    showError(field, "Įvesk skaičių naudodamas kablelį arba tašką dešimtainėms dalims.");
  }
  const decimalPart = raw.split(/[,.]/)[1];
  if (decimals !== undefined && decimalPart?.length > decimals) {
    showError(field, "Įvesk kainą arba sumą su ne daugiau kaip dviem skaitmenimis po kablelio.");
  }
  if (value < min || value > max || (integer && !Number.isInteger(value))) {
    const type = integer ? "sveiką skaičių" : "skaičių";
    const boundary = (number) => number.toLocaleString("lt-LT");
    showError(field, "Įvesk " + type + " nuo " + boundary(min) + " iki " + boundary(max) + ".");
  }
  return value;
}

function readMoney(id, required = false) {
  return toCents(readField(element(id), { required, decimals: 2 }) ?? 0) / 100;
}

function readMonths(id, required = false) {
  return readField(element(id), { required, integer: true, max: 12 }) ?? 0;
}

const purchaseEditor = window.createPurchaseEditor(element("purchase-list"), element("add-purchase"), readField, showError);
const otherPurchaseEditor = window.createPurchaseEditor(element("other-purchase-list"), element("add-other-purchase"), readField, showError, true);

function renderIncomeMode() {
  ["wages", "pension", "dividends", "self", "paid"].forEach((mode) => {
    element(mode + "-panel").hidden = incomeMode.value !== mode;
  });
  element("self-actual-panel").hidden = element("self-expense-mode").value !== "actual";
}

function changeWageBasis() {
  wageInputs[wageEntryBasis] = wageInput.value;
  wageEntryBasis = wageBasis.value;
  wageInput.value = wageInputs[wageEntryBasis];
  const net = wageEntryBasis === "net";
  element("wages-label").textContent = net ? "Atlyginimas į rankas per mėnesį" : "Atlyginimas ant popieriaus per mėnesį";
  element("wage-pension-field").hidden = !net;
  element("wage-npd-field").hidden = !net;
  element("wage-help").textContent = net
    ? "Įvesk 2025 m. mėnesio vidurkį. Kintant atlyginimui ar turint kitų pajamų, įvertis gali skirtis nuo algalapio."
    : "Įvesk 2025 m. mėnesio vidurkį su premijomis.";
}

function clearError() {
  errorMessage.hidden = true;
  errorMessage.textContent = "";
  form.querySelectorAll("[aria-invalid]").forEach((field) => {
    field.removeAttribute("aria-invalid");
    if (field.dataset.originalDescription) {
      field.setAttribute("aria-describedby", field.dataset.originalDescription);
    } else {
      field.removeAttribute("aria-describedby");
    }
    delete field.dataset.originalDescription;
  });
}

function renderSpendingStatus() {
  element("stale-spending").hidden = staleResult.hidden;
  element("stale-insurance").hidden = staleResult.hidden || showFundShares || result.mode === "none";
}

function markResultStale() {
  resultCardSharing.reset();
  staleResult.hidden = false;
  element("stale-comparison").hidden = false;
  renderSpendingStatus();
  reportHelp.textContent = "Atidarant ataskaitą arba suvestinę, suma bus perskaičiuota pagal naujausius duomenis.";
}

function markUncalculated() {
  clearError();
  markResultStale();
}

function readIncome() {
  switch (incomeMode.value) {
    case "wages": {
      const annual = readMoney("wages", true) * 12;
      const higher = readMonths("disability-higher");
      const lower = readMonths("disability-lower");
      if (higher + lower > 12) {
        showError(element("disability-lower"), "Abiejų negalios kategorijų mėnesių suma negali viršyti 12.");
      }
      const isNet = wageBasis.value === "net";
      const pensionRate = isNet && element("wage-pension").checked ? 0.03 : 0;
      const npd = isNet ? wageNpd.value : null;
      const gross = isNet ? grossWagesFromNet(annual, higher, lower, undefined, pensionRate, npd !== "no") : annual;
      if (gross > wageContributionCeiling && higher + lower > 0) {
        showError(higher ? element("disability-higher") : element("disability-lower"), "Kai taikomas didesnis NPD dėl negalios ir pajamos viršija 126 532,80 €, įvesk faktines 2025 m. sumas režime „Jau sumokėti mokesčiai“.");
      }
      const amounts = wageTaxes(gross, 0, higher, lower, gross, pensionRate);
      return { ...amounts, fromNet: isNet, npd, gross: toCents(gross), caption: isNet ? "Atlyginimas · įvertis iš sumos į rankas" : "Atlyginimas · metinė prievolė" };
    }
    case "dividends": {
      const gross = readMoney("dividend", true);
      const amounts = wageTaxes(0, gross);
      return { tax: amounts.dividend, vsd: 0, psd: 0, caption: "Dividendai · metinė GPM prievolė" };
    }
    case "pension": {
      const amount = readField(element("pension-income"), { decimals: 2 });
      const periods = element("pension-period").value === "month" ? 12 : 1;
      const pensionIncome = amount === null ? null : toCents(amount * periods);
      return { tax: 0, vsd: 0, psd: 0, pensionIncome, caption: "Pensija („Sodros“ arba valstybinė)" };
    }
    case "self": {
      const income = readMoney("self-income", true);
      const expenses = element("self-expense-mode").value === "actual" ? readMoney("self-expense", true) : null;
      const months = readMonths("self-psd-months", true);
      const carriedLoss = readMoney("self-loss");
      return {
        ...selfEmploymentTaxes(income, expenses, months, element("self-vsd-exempt").checked, carriedLoss),
        caption: "Individuali veikla pagal pažymą · metinė prievolė",
      };
    }
    case "paid":
      return {
        tax: toCents(readMoney("paid-tax")),
        vsd: toCents(readMoney("paid-vsd")),
        psd: toCents(readMoney("paid-psd")),
        caption: "Faktinės sumos už 2025 m. laikotarpį",
      };
    default:
      return { tax: 0, vsd: 0, psd: 0, caption: "Tik pirkinių mokesčiai" };
  }
}

function annualLines() {
  const lines = [];
  if (result.mode !== "none") {
    lines.push(
      {
        label: result.mode === "paid" ? "GPM ir kiti mokesčiai" : result.mode === "dividends" ? "Dividendų GPM" : "GPM",
        detail: result.mode === "paid" ? "Pagal įvestas sumas" : "Gyventojų pajamų mokestis",
        cents: result.tax,
        group: "income",
        gpm: result.mode !== "paid",
      },
    );
    if (result.mode !== "dividends") {
      lines.push(
        { label: "VSD", detail: "Valstybinis socialinis draudimas", cents: result.vsd, group: "income" },
        { label: "PSD", detail: "Privalomasis sveikatos draudimas", cents: result.psd, group: "income" },
      );
    }
  }
  lines.push(
    { label: "PVM", detail: "Pagal įvestas prekių ir paslaugų kainas", cents: result.vat, group: "buying" },
    {
      label: "Akcizai",
      detail: "Pagal įvestus akcizinių prekių kiekius",
      cents: result.purchases.reduce((sum, item) => sum + item.excise, 0),
      group: "buying",
    },
  );
  return lines;
}

function renderRows(container, rows, formatAmount = money) {
  container.replaceChildren(...rows.map((row) => {
    const line = document.createElement("div");
    const name = document.createElement("dt");
    const label = document.createElement("strong");
    label.textContent = row.label;
    name.append(label);
    if (row.detail) {
      const detail = document.createElement("small");
      detail.textContent = row.detail;
      name.append(detail);
    }
    const amount = document.createElement("dd");
    amount.textContent = formatAmount(row.cents);
    line.append(name, amount);
    return line;
  }));
}

function purchaseCaveats() {
  const warnings = [];
  if (result.purchases.some((item) => item.missingPrice)) warnings.push("Pirkiniams be kainos PVM neapskaičiuotas.");
  if (result.purchases.some((item) => item.missingExcise)) warnings.push("Kai kuriems pirkiniams be kiekio akcizas neapskaičiuotas.");
  if (result.purchases.some((item) => item.estimate)) warnings.push("Degalams, kurių kiekis ar kaina neįvesti, taikytos 2025 m. vidutinės kainos.");
  if (result.purchases.some((item) => item.minCigarette)) warnings.push("Cigaretėms be kainos rodoma mažiausia akcizo suma.");
  if (result.purchases.some((item) => item.estimatedCigarette)) warnings.push("Kai didžiausia cigarečių kaina nenurodyta, akcizas įvertintas pagal pirkimo išlaidas.");
  if (result.purchases.some((item) => item.cigarettePriceExceedsMaximum)) warnings.push("Cigarečių pirkimo kaina viršija įvestą didžiausią mažmeninę kainą.");
  return warnings.length ? "Suma pagal turimus duomenis. " + warnings.join(" ") : "";
}

function purchaseTaxSummary(item) {
  const vat = item.missingPrice ? "PVM neskaičiuotas" : "PVM " + (item.estimatedTax === "vat" ? "≈ " : "") + money(item.vat);
  if (item.vatOnly) return vat;
  let excise = "Akcizas neskaičiuotas";
  if (!item.missingExcise) {
    const approximation = item.estimatedTax === "excise" || item.estimatedCigarette;
    excise = (item.minCigarette ? "Mažiausias akcizas " : "Akcizas ") + (approximation ? "≈ " : "") + money(item.excise);
  }
  return excise + " · " + vat;
}

function purchaseResultRow(item) {
  const estimated = item.estimatedTax || item.estimatedCigarette;
  const paid = item.price === null ? "" : "Su mokesčiais " + (item.estimatedTax === "vat" ? "≈ " : "") + money(item.price);
  let missing = "";
  if (item.netPrice === null) {
    if (item.price === null) missing = "Įvesk pirkimo kainą.";
    else if (item.missingExcise) missing = "Įvesk kiekį akcizui apskaičiuoti.";
    else if (item.cigarettePriceExceedsMaximum) missing = "Patikrink pakelių kiekį ir jų kainas.";
    else missing = "Apskaičiuoti mokesčiai viršija kainą.";
  }
  return {
    name: item.name,
    detail: [paid, purchaseTaxSummary(item)].filter(Boolean).join(" · "),
    netLabel: item.vatOnly ? "Be PVM" : "Be PVM ir akcizo",
    net: item.netPrice === null ? "" : (estimated ? "≈ " : "") + money(item.netPrice),
    note: missing || item.estimate,
  };
}

function renderPurchaseSummary(caveats) {
  const container = element("purchase-summary");
  container.hidden = !result.purchases.length;
  const list = element("purchase-results");
  list.replaceChildren(...result.purchases.map(purchaseResultRow).map((item) => {
    const itemRow = document.createElement("li");
    const name = document.createElement("strong");
    name.textContent = item.name;
    const detail = document.createElement("span");
    detail.textContent = item.detail;
    const net = document.createElement("div");
    net.className = "purchase-net";
    const label = document.createElement("span");
    label.textContent = item.netLabel;
    const value = document.createElement(item.net ? "strong" : "span");
    value.textContent = item.net || "Neapskaičiuota";
    net.append(label, value);
    itemRow.append(name, net, detail);
    if (item.note) {
      const note = document.createElement("small");
      note.textContent = item.note;
      itemRow.append(note);
    }
    return itemRow;
  }));
  const warning = element("result-warning");
  warning.hidden = !caveats;
  warning.textContent = caveats;
}

let angle = 0;
const slices = expenditures.map((category) => {
  const start = angle;
  angle += category.amount / expenditureTotal * 360;
  return category.color + " " + start + "deg " + angle + "deg";
});
const donutPaint = "conic-gradient(from -90deg, " + slices.join(", ") + ")";
const sourceAmountFormat = new Intl.NumberFormat("lt-LT", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const expandSpending = element("expand-spending");

function groupDisplayAmount(group) {
  return group.subtotal === null ? "Reikšmė nepateikta" : money(group.subtotal);
}

function updateExpandSpending() {
  expandSpending.textContent = chartRows.every(({ details }) => details.open) ? "Sutraukti visas" : "Išskleisti visas";
}

const chartRows = buildSpendingBreakdown(0).map((category) => {
  const row = document.createElement("li");
  row.className = "receipt-area";
  const details = document.createElement("details");
  details.className = "receipt-section";
  const summary = document.createElement("summary");
  summary.className = "spending-row";
  const title = document.createElement("span");
  title.className = "spending-label";
  const swatch = document.createElement("span");
  swatch.className = "swatch";
  swatch.style.setProperty("--category-color", category.color);
  swatch.setAttribute("aria-hidden", "true");
  const chevron = document.createElement("span");
  chevron.className = "receipt-chevron";
  chevron.setAttribute("aria-hidden", "true");
  title.append(chevron, swatch, category.name);
  const amount = document.createElement("span");
  amount.className = "cash";
  summary.append(title, amount);

  const content = document.createElement("div");
  content.className = "receipt-content";
  const facts = document.createElement("p");
  facts.className = "receipt-source";
  facts.textContent = "Lietuvos faktinės išlaidos šioje srityje · " + sourceAmountFormat.format(category.amount / 10) + " mln. €";
  const list = document.createElement("dl");
  list.className = "receipt-groups";
  const subtotals = category.groups.map((group) => {
    const groupRow = document.createElement("div");
    groupRow.dataset.code = group.code;
    groupRow.className = "receipt-group";
    const name = document.createElement("dt");
    const code = document.createElement("small");
    code.textContent = group.code;
    const description = document.createElement("span");
    description.className = "receipt-description";
    description.textContent = group.description;
    name.append(group.name, " ", code, description);
    const amounts = document.createElement("dd");
    const illustrative = document.createElement("strong");
    illustrative.className = "receipt-group-amount";
    const actual = document.createElement("small");
    actual.className = "receipt-actual";
    actual.textContent = group.actual === null ? "" : "Lietuva · " + sourceAmountFormat.format(group.actual / 10) + " mln. €";
    amounts.append(illustrative, actual);
    groupRow.append(name, amounts);
    list.append(groupRow);
    return illustrative;
  });
  content.append(facts, list);
  details.append(summary, content);
  details.addEventListener("toggle", updateExpandSpending);
  row.append(details);
  spendingList.append(row);
  return { details, amount, subtotals };
});

expandSpending.addEventListener("click", () => {
  const shouldExpand = chartRows.some(({ details }) => !details.open);
  chartRows.forEach(({ details }) => { details.open = shouldExpand; });
  updateExpandSpending();
});

function renderSpending(total, caveats) {
  const warning = element("spending-caveats");
  warning.textContent = caveats;
  warning.hidden = !caveats;
  element("allocation-amount").textContent = money(total);
  element("allocation-caption").textContent = result.example ? "Metinė suma · pavyzdys" : "Metinė suma";
  donut.style.background = total > 0 ? donutPaint : "";
  buildSpendingBreakdown(total).forEach((category, index) => {
    const row = chartRows[index];
    row.amount.textContent = money(category.subtotal);
    category.groups.forEach((group, groupIndex) => {
      row.subtotals[groupIndex].textContent = groupDisplayAmount(group);
    });
  });
}

const spendingTabs = [element("spending-overview-tab"), element("spending-insurance-tab")];

function selectSpendingTab(selectedTab) {
  for (const tab of spendingTabs) {
    const selected = tab === selectedTab;
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
    element(tab.getAttribute("aria-controls")).hidden = !selected;
  }
}

for (const [index, tab] of spendingTabs.entries()) {
  tab.addEventListener("click", () => selectSpendingTab(tab));
  tab.addEventListener("keydown", (event) => {
    let nextTab;
    switch (event.key) {
      case "ArrowLeft":
      case "ArrowRight":
        nextTab = spendingTabs[1 - index];
        break;
      case "Home":
        nextTab = spendingTabs[0];
        break;
      case "End":
        nextTab = spendingTabs[1];
        break;
      default:
        return;
    }
    event.preventDefault();
    selectSpendingTab(nextTab);
    nextTab.focus();
  });
}

function selectSpendingTabFromLink() {
  if (location.hash === "#contributions") {
    selectSpendingTab(spendingTabs[1]);
    element("islaidos").scrollIntoView({ block: "start" });
  } else if (location.hash === "#islaidos") {
    selectSpendingTab(spendingTabs[0]);
  }
}

function annualTotals() {
  const lines = annualLines();
  const total = lines.reduce((sum, line) => sum + line.cents, 0);
  const gpmLines = lines.filter((line) => line.gpm);
  const gpm = gpmLines.length ? gpmLines.reduce((sum, line) => sum + line.cents, 0) : null;
  const vsd = lines.find((line) => line.label === "VSD")?.cents ?? 0;
  const psd = lines.find((line) => line.label === "PSD")?.cents ?? 0;
  return { lines, total, gpm, vsd, psd };
}

const breakdownPercentage = new Intl.NumberFormat("lt-LT", { style: "percent", minimumFractionDigits: 2, maximumFractionDigits: 2 });

function breakdownRowDetail(row) {
  return row.share === undefined ? row.detail : breakdownPercentage.format(row.share) + " GPM";
}

function renderIncomeBreakdown({ total, gpm, vsd, psd }) {
  const funds = buildInsuranceBreakdown({ mode: result.mode, vsd, psd, fixed: showFundShares });
  const reference = funds[0].reference;
  const incomeTax = buildGpmBreakdown(reference ? null : gpm);
  if (!reference && gpm === null) {
    incomeTax.note = "GPM įvestas kartu su kitais mokesčiais. Čia pateikiamos bendros GPM proporcijos. " + incomeTax.note;
  }
  const intro = element("contrib-intro");
  const basisButton = element("insurance-basis");
  basisButton.hidden = result.mode === "none";
  basisButton.textContent = reference ? "Rodyti mano sumas" : "Rodyti bendras proporcijas";
  element("contrib-heading").textContent = reference ? "Bendros GPM, VSD ir PSD proporcijos" : "GPM, VSD ir PSD dalis bendroje sumoje";
  if (reference) {
    intro.textContent = "GPM dalys nustatytos 2025 m. biudžeto įstatyme. VSD ir PSD proporcijos pagrįstos 2025 m. įmokų tarifais arba fondų ataskaitomis.";
  } else {
    const amount = document.createElement("strong");
    amount.textContent = money(total);
    intro.replaceChildren(result.example ? "Pavyzdžio bendra metinė suma " : "Tavo bendra metinė suma ", amount, " jau apima čia eurais parodytas sumas.");
  }
  for (const item of [incomeTax, ...funds]) {
    const id = item.id + "-purpose";
    element(id).hidden = result.mode === "dividends" && item.id !== "gpm" && !reference;
    element(id + "-amount").textContent = item.reference ? "" : money(item.total);
    const formatAmount = item.reference ? (part) => breakdownPercentage.format(part / item.total) : money;
    const rows = item.reference ? item.rows : item.rows.map((row) => ({ ...row, detail: breakdownRowDetail(row) }));
    renderRows(element(id + "-rows"), rows, formatAmount);
    if (item.note) element(id + "-note").textContent = item.note;
    const source = element(id + "-source");
    source.textContent = item.sourceName;
    source.href = item.sourceUrl;
  }
}

function isEstimatedIncome() {
  return ["wages", "dividends", "self"].includes(result.mode);
}

const pensionTaxNote = "Nuo šios pensijos GPM, VSD ir PSD neskaičiuojami. Pirkinių ir paslaugų mokesčiai skaičiuojami pagal įvestas išlaidas.";

function pensionNote() {
  return (result.pensionIncome === null ? "" : "Metinė pensijos suma – " + money(result.pensionIncome) + ". ") + pensionTaxNote;
}

function wageEstimate() {
  if (!result.fromNet) return "";
  const basis = {
    no: "Perskaičiuojant laikoma, kad darbdavys NPD netaikė. Metinei prievolei vertinamas priklausantis NPD.",
    yes: "Perskaičiavimui naudojamas metinis NPD.",
    unknown: "Perskaičiuojant daroma prielaida, kad taikytas metinis NPD.",
  };
  return "Įvertintas metinis atlyginimas ant popieriaus – " + money(result.gross) + ". " + basis[result.npd]
    + (result.pension ? " II pakopos įmoka (" + money(result.pension) + ") panaudota perskaičiavimui." : "");
}

function wageEquivalent() {
  const months = result.mode === "wages" ? wageTaxMonths(result) : null;
  if (months === null) return null;
  const value = months > 0 && months < 0.05 ? "Mažiau nei 0,1" : wageMonthsFormat.format(months);
  return { months, label: value + " mėn." };
}

function renderResult(announce = false) {
  const { lines, total, gpm, vsd, psd } = annualTotals();
  const caveats = purchaseCaveats();
  const automatic = isEstimatedIncome();
  element("result-heading").textContent = automatic ? "Apskaičiuota mokesčių ir įmokų suma" : "Mokesčių ir įmokų suma pagal įvestį";
  element("total-amount").textContent = money(total);
  const equivalent = wageEquivalent();
  element("wage-equivalent").hidden = equivalent === null;
  if (equivalent) {
    element("wage-equivalent-value").textContent = equivalent.label;
    element("wage-equivalent-fill").style.width = (equivalent.months / 12 * 100) + "%";
  }
  const baseDetails = element("tax-bases");
  baseDetails.hidden = !result.bases?.length;
  renderRows(element("tax-base-rows"), (result.bases ?? []).map(([label, cents]) => ({ label, cents })));
  element("tax-bases-note").textContent = result.mode === "self"
    ? "2025 m. tarifai. Kai taikomas GPM kreditas, jis suapvalinamas atskirai iki centų."
    : "2025 m. tarifai. Kai taikomi abu GPM tarifai, šiame modelyje metinis NPD priskiriamas proporcingai.";
  element("wage-estimate").textContent = wageEstimate();
  element("wage-estimate").hidden = !result.fromNet;
  element("amount-kind").textContent = result.mode === "pension" ? pensionNote() : automatic
    ? "Pajamų dalis rodo preliminarią metinę prievolę prieš avansų ir išskaičiuotų sumų užskaitymą. Pirkinių mokesčiai apskaičiuoti pagal tavo duomenis."
    : "Suvestinė pagal įvestas sumas ir apskaičiuotus pirkinių mokesčius.";
  element("result-caption").textContent = result.caption + " · metinė suma";
  element("income-summary").hidden = result.mode === "none";
  renderRows(element("income-rows"), lines.filter((line) => line.group === "income"));
  renderRows(element("buying-rows"), lines.filter((line) => line.group === "buying"));
  renderPurchaseSummary(caveats);
  const comparisonCaveats = element("comparison-caveats");
  comparisonCaveats.textContent = caveats;
  comparisonCaveats.hidden = !caveats;

  priceComparison.update({ total, example: !!result.example, purchases: result.purchases }, announce);
  renderSpending(total, caveats);
  renderIncomeBreakdown({ total, gpm, vsd, psd });
  renderSpendingStatus();
  if (announce) {
    element("result-announcement").textContent = "Apskaičiuota suma " + money(total) + " per metus.";
  }
}

function reportData(includePurchases) {
  const { lines, total } = annualTotals();
  const spending = includePurchases ? buildSpendingBreakdown(total) : [];
  const notes = [
    isEstimatedIncome() ? "Pajamų dalis rodo preliminarią metinę mokestinę prievolę prieš avansų ir išskaičiuotų sumų užskaitymą." : "Suvestinė pagal įvestas sumas ir pirkinius.",
  ];
  if (includePurchases && result.fromNet) notes.push(wageEstimate());
  if (result.mode === "pension") notes.push(includePurchases ? pensionNote() : pensionTaxNote);
  return {
    year: taxYear,
    wageEquivalent: wageEquivalent()?.label,
    example: !!result.example,
    mode: result.caption,
    total: money(total),
    comparison: includePurchases ? priceComparison.reportRows(total, { includePersonal: true }) : null,
    purchases: includePurchases ? result.purchases.map(purchaseResultRow) : [],
    rows: lines.map((line) => [line.label, money(line.cents)]),
    spendingYear,
    spendingGroups: spending.map((area) => ({
      name: area.name,
      amount: money(area.subtotal),
      rows: area.groups.map((group) => [group.name + " · " + group.code, groupDisplayAmount(group), group.description]),
    })),
    spendingSource,
    notes,
    caveats: purchaseCaveats(),
    url: publicCalculatorUrl,
  };
}

incomeMode.addEventListener("change", renderIncomeMode);
wageBasis.addEventListener("change", changeWageBasis);
element("self-expense-mode").addEventListener("change", renderIncomeMode);
form.addEventListener("input", markUncalculated);
form.addEventListener("change", markUncalculated);

element("insurance-basis").addEventListener("click", () => {
  showFundShares = !showFundShares;
  renderIncomeBreakdown(annualTotals());
  renderSpendingStatus();
});

function calculateResult({ scroll = false } = {}) {
  clearError();
  try {
    const income = readIncome();
    const purchases = [...purchaseEditor.read(), ...otherPurchaseEditor.read()];
    const otherVat = vatFields.reduce((sum, field) => sum + vatInPrice(readMoney(field.id) * purchaseMonthsPerYear, field.rate), 0);
    const vat = purchases.reduce((sum, item) => sum + item.vat, otherVat);
    result = { ...income, mode: incomeMode.value, purchases, vat };
    resultCardSharing.reset();
    staleResult.hidden = true;
    element("stale-comparison").hidden = true;
    showFundShares = false;
    renderResult(true);
    reportHelp.textContent = "Ataskaitoje pateikiami ir pirkinių skaičiavimai. Dalijimosi suvestinėje pateikiamos metinės mokesčių sumos pagal jų rūšį.";
    if (scroll) {
      const heading = element("result-heading");
      heading.focus({ preventScroll: true });
      heading.closest(".result-card").scrollIntoView({ block: "start" });
    }
    return true;
  } catch (error) {
    if (!(error instanceof InvalidField)) throw error;
    markResultStale();
    return false;
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  calculateResult({ scroll: true });
});

element("view-report").addEventListener("click", () => {
  if (staleResult.hidden || calculateResult()) window.taxReport.open(reportData(true));
});

element("share-result").addEventListener("click", () => {
  if (staleResult.hidden || calculateResult()) window.taxReport.openShare(reportData(false));
});

const resultCardSharing = installResultCardSharing(() => {
  if (!staleResult.hidden && !calculateResult()) return null;
  const { total } = annualTotals();
  return {
    year: taxYear,
    example: !!result.example,
    comparison: priceComparison.reportRows(total),
    caveats: purchaseCaveats(),
    url: publicCalculatorUrl,
  };
});

installPublicLinkSharing();
renderIncomeMode();
renderResult();
selectSpendingTabFromLink();
window.addEventListener("hashchange", selectSpendingTabFromLink);

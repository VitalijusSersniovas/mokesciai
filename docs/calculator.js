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
const reportError = element("report-error");
const staleResult = element("stale-result");
const priceComparison = installPriceComparison(element("palyginimas"));
const taxYearSelect = element("tax-year");
const calendarYear = Number(new Intl.DateTimeFormat("lt-LT", {
  timeZone: "Europe/Vilnius", year: "numeric",
}).formatToParts(new Date()).find((part) => part.type === "year").value);
const supportedYears = [...(taxYearSelect?.options ?? [])].map((option) => Number(option.value));
const defaultTaxYear = supportedYears.find((year) => year <= calendarYear) ?? 2025;
if (taxYearSelect) taxYearSelect.value = defaultTaxYear;
const selectedTaxYear = () => Number(taxYearSelect?.value || defaultTaxYear);

function updateYearFields() {
  if (!taxYearSelect) return;
  const historical = selectedTaxYear() === 2025;
  element("vat-9-field").hidden = !historical;
  element("vat-12-field").hidden = historical;
  element("reduced-vat-summary").textContent = "Pirkiniai su " + (historical ? "9" : "12") + " % arba 5 % PVM";
  if (calendarYear > defaultTaxYear) {
    element("tax-year-help").textContent = "Naujausi patikrinti tarifai yra " + defaultTaxYear
      + " m. Jei skaičiuoji už ankstesnius metus, įvesk tų metų pajamas ir išlaidas.";
  }
}

let showFundShares = false;
let wageEntryBasis = wageBasis.value;
const wageInputs = { gross: "", net: "" };
wageInputs[wageEntryBasis] = wageInput.value;

class InvalidField extends Error {
  constructor(field, message) {
    super(message);
    this.field = field;
  }
}

const fieldErrors = new Map();
let reportErrorField;

function showError(field, message) {
  throw new InvalidField(field, message);
}

function expandFieldDetails(field) {
  for (let details = field.closest("details"); details; details = details.parentElement.closest("details")) {
    details.open = true;
  }
}

function revealField(field) {
  expandFieldDetails(field);
  field.focus();
}

function markFieldError(field, message) {
  let inlineError = fieldErrors.get(field);
  if (!inlineError) {
    inlineError = document.createElement("p");
    inlineError.className = "field-error";
    inlineError.id = field.id + "-error";
    (field.closest(".field") ?? field.parentElement).append(inlineError);
    const describedBy = field.getAttribute("aria-describedby") ?? "";
    field.setAttribute("aria-describedby", (describedBy + " " + inlineError.id).trim());
    field.setAttribute("aria-invalid", "true");
    fieldErrors.set(field, inlineError);
  }
  inlineError.textContent = message;
}

function clearFieldError(field) {
  const inlineError = fieldErrors.get(field);
  if (!inlineError) return;
  inlineError.remove();
  const descriptions = (field.getAttribute("aria-describedby") ?? "").split(/\s+/)
    .filter((id) => id && id !== inlineError.id);
  if (descriptions.length) field.setAttribute("aria-describedby", descriptions.join(" "));
  else field.removeAttribute("aria-describedby");
  field.removeAttribute("aria-invalid");
  fieldErrors.delete(field);
}

function validatePurchaseInput({ target }) {
  if (!target.matches("#pirkiniai input[inputmode=decimal]") || !target.value.trim() || fieldErrors.has(target)) return;
  const shopExpenses = target.id.startsWith("vat-");
  try {
    readField(target, {
      min: shopExpenses ? 0 : 0.01,
      decimals: shopExpenses || target.hasAttribute("data-purchase-currency") ? 2 : undefined,
    });
  } catch (error) {
    if (!(error instanceof InvalidField)) throw error;
    markFieldError(target, error.message);
  }
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

const purchaseEditor = window.createPurchaseEditor(element("purchase-list"), element("add-purchase"), readField, showError, false, selectedTaxYear);
const otherPurchaseEditor = window.createPurchaseEditor(element("other-purchase-list"), element("add-other-purchase"), readField, showError, true, selectedTaxYear);

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
    ? "Įvesk, kiek vidutiniškai gauni į rankas per mėnesį. Kintant atlyginimui ar turint kitų pajamų, įvertis gali skirtis nuo algalapio."
    : "Įvesk vidutinį mėnesio atlyginimą su premijomis.";
}

function clearReportError() {
  reportErrorField = undefined;
  if (!reportError) return;
  reportError.hidden = true;
  reportError.replaceChildren();
}

function clearErrors() {
  for (const field of fieldErrors.keys()) clearFieldError(field);
  errorMessage.hidden = true;
  errorMessage.textContent = "";
  clearReportError();
}

function showBlockedAction(field, message, action) {
  const link = document.createElement("a");
  link.href = "#" + field.id;
  link.textContent = "Pereiti prie pažymėto lauko";
  link.addEventListener("click", (event) => {
    event.preventDefault();
    revealField(field);
  });
  reportErrorField = field;
  reportError.replaceChildren(action + " Rasta įvesties klaida. " + message + " ", link);
  reportError.hidden = false;
  reportError.tabIndex = -1;
  reportError.focus();
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

function markUncalculated({ target }) {
  if (target === taxYearSelect) return;
  const changedPurchase = target.matches(".purchase-row select[id$='-product'], .purchase-row select[id$='-basis']")
    ? target.closest(".purchase-row") : null;
  for (const field of fieldErrors.keys()) {
    if (field !== target && !field.closest("[hidden]") && form.contains(field) && !changedPurchase?.contains(field)) continue;
    clearFieldError(field);
    if (reportErrorField === field) clearReportError();
  }
  errorMessage.hidden = true;
  errorMessage.textContent = "";
  markResultStale();
}

function readIncome(year) {
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
      const inferGross = year === 2025 ? grossWagesFromNet : grossWagesFromPayrollNet;
      const gross = isNet ? inferGross(annual, higher, lower, undefined, pensionRate, npd !== "no", year) : annual;
      const threshold = incomeTaxRules(year).firstIncomeTaxThreshold;
      if (gross > threshold && higher + lower > 0) {
        showError(higher ? element("disability-higher") : element("disability-lower"),
          "Kai taikomas didesnis NPD dėl negalios ir pajamos viršija " + money(toCents(threshold))
            + ", įvesk faktines sumas režime „Jau sumokėti mokesčiai“.");
      }
      const amounts = wageTaxes(gross, 0, higher, lower, gross, pensionRate, true, year);
      return {
        ...amounts,
        fromNet: isNet,
        enteredNet: isNet ? toCents(annual) : null,
        npd,
        gross: toCents(gross),
        caption: isNet ? "Atlyginimas · įvertis iš sumos į rankas" : "Atlyginimas · metinė prievolė",
      };
    }
    case "dividends": {
      const gross = readMoney("dividend", true);
      const amounts = wageTaxes(0, gross, 0, 0, undefined, 0, true, year);
      return { tax: amounts.dividend, vsd: 0, psd: 0, gross: toCents(gross), caption: "Dividendai · metinė GPM prievolė" };
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
        ...selfEmploymentTaxes(income, expenses, months, element("self-vsd-exempt").checked, carriedLoss, year),
        gross: toCents(income),
        caption: "Individuali veikla pagal pažymą · metinė prievolė",
      };
    }
    case "paid":
      return {
        tax: toCents(readMoney("paid-tax")),
        vsd: toCents(readMoney("paid-vsd")),
        psd: toCents(readMoney("paid-psd")),
        caption: "Faktinės pajamų mokesčių ir įmokų sumos",
      };
    default:
      return { tax: 0, vsd: 0, psd: 0, caption: "Tik pirkinių mokesčiai" };
  }
}

function exampleCaption(income) {
  if (incomeMode.value !== "wages") return income.caption;
  const wage = income.enteredNet ?? income.gross;
  const basis = income.fromNet ? " į rankas" : " ant popieriaus";
  return "Pavyzdys · " + compactMoney(wage / 12) + basis + " per mėnesį";
}

const exampleIncome = readIncome(selectedTaxYear());
let result = {
  ...exampleIncome,
  year: selectedTaxYear(),
  mode: incomeMode.value,
  caption: exampleCaption(exampleIncome),
  example: true,
  vat: 0,
  purchases: [],
};

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
  if (result.purchases.some((item) => item.estimate)) warnings.push("Degalams, kurių kiekis ar kaina neįvesti, taikytos prie pirkinių nurodytos vidutinės kainos.");
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
  const gross = item.price === null ? "Kaina neįvesta" : (item.estimatedTax === "vat" ? "≈ " : "") + money(item.price);
  const net = item.netPrice === null ? "Neapskaičiuota" : (estimated ? "≈ " : "") + money(item.netPrice);
  let missing = "";
  if (item.netPrice === null) {
    if (item.price === null) missing = "Įvesk pirkimo kainą.";
    else if (item.missingExcise) missing = "Įvesk kiekį akcizui apskaičiuoti.";
    else if (item.cigarettePriceExceedsMaximum) missing = "Patikrink pakelių kiekį ir jų kainas.";
    else missing = "Apskaičiuoti mokesčiai viršija kainą.";
  }
  return {
    name: item.name,
    amounts: [
      ["Iš viso per metus su mokesčiais", gross],
      ["Tikra kaina be mokesčių", net],
    ],
    taxes: purchaseTaxSummary(item),
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
    const amounts = document.createElement("dl");
    amounts.className = "purchase-amounts";
    for (const [label, amount] of item.amounts) {
      const group = document.createElement("div");
      const term = document.createElement("dt");
      term.textContent = label;
      const value = document.createElement("dd");
      value.textContent = amount;
      group.append(term, value);
      amounts.append(group);
    }
    const taxes = document.createElement("span");
    taxes.textContent = item.taxes;
    itemRow.append(name, amounts, taxes);
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
  const funds = buildInsuranceBreakdown({ mode: result.mode, vsd, psd, fixed: showFundShares, year: result.year });
  const reference = funds[0].reference;
  const incomeTax = buildGpmBreakdown(reference ? null : gpm, result.year);
  if (!reference && gpm === null) {
    incomeTax.note = "GPM įvestas kartu su kitais mokesčiais. Čia pateikiamos bendros GPM proporcijos. " + incomeTax.note;
  }
  const intro = element("contrib-intro");
  const basisButton = element("insurance-basis");
  basisButton.hidden = result.mode === "none";
  basisButton.textContent = reference ? "Rodyti mano sumas" : "Rodyti bendras proporcijas";
  element("contrib-heading").textContent = reference ? "Bendros GPM, VSD ir PSD proporcijos" : "GPM, VSD ir PSD dalis bendroje sumoje";
  if (reference) {
    intro.textContent = "GPM dalys nustatytos pagal " + result.year + " m. biudžeto tvarką. VSD ir PSD proporcijos pagrįstos įmokų tarifais arba 2025 m. fondų ataskaitomis.";
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
    + (result.pension ? " II pakopos įmoka (" + money(result.pension) + ") panaudota perskaičiavimui." : "")
    + (result.year >= 2026 && result.gross > toCents(incomeTaxRules(result.year).firstIncomeTaxThreshold)
      ? " Įvertis remiasi tolygiu atlyginimu. Jei prašei darbdavio GPM tarifą taikyti pagal sukauptas pajamas, naudok sumą ant popieriaus." : "");
}

function wageEquivalent(total) {
  const months = result.mode === "wages" ? wageTaxMonths(total, result.gross) : null;
  if (months === null) return null;
  const value = months > 0 && months < 0.05 ? "Mažiau nei 0,1" : wageMonthsFormat.format(months);
  return { months, label: value + " mėn." };
}

function renderAnnualIncome() {
  const before = result.pensionIncome ?? result.gross ?? null;
  element("annual-income").hidden = before === null;
  if (before === null) return;

  const after = before - result.tax - result.vsd - result.psd;
  let note = "";
  if (result.mode === "wages") {
    note = "Atskaičiuoti GPM, VSD ir PSD pagal metinę prievolę.";
    if (result.fromNet && result.enteredNet !== after) {
      note += " Pagal įvestį gauta į rankas per metus – " + money(result.enteredNet) + ".";
    }
    if (result.pension) note += " II pakopos įmoka apskaičiuota atskirai.";
  } else if (result.mode === "self") {
    note = "Abi sumos pateiktos prieš veiklos išlaidas. Skirtumą sudaro GPM, VSD ir PSD.";
  } else if (result.mode === "dividends") {
    note = "Atskaičiuotas dividendų GPM.";
  }

  element("annual-income-before").textContent = money(before);
  element("annual-income-after").textContent = money(after);
  const incomeNote = element("annual-income-note");
  incomeNote.textContent = note;
  incomeNote.hidden = !note;
}

function resultYearContext() {
  const tariffYear = "Taikomi " + result.year + " m. tarifai.";
  if (result.mode === "paid") {
    return "Pajamų mokesčiai ir įmokos pagal tavo įvestas sumas. Pirkiniams taikomi " + result.year + " m. tarifai.";
  }
  const period = result.year === defaultTaxYear ? "dabartines" : "įvestas";
  const data = result.mode === "none" ? period + " išlaidas" : period + " pajamas ir išlaidas";
  return "Metinis įvertis pagal " + data + ". " + tariffYear;
}

function renderResult(announce = false) {
  const { lines, total, gpm, vsd, psd } = annualTotals();
  const caveats = purchaseCaveats();
  const automatic = isEstimatedIncome();
  element("result-heading").textContent = automatic ? "Apskaičiuota mokesčių ir įmokų suma" : "Mokesčių ir įmokų suma pagal įvestį";
  element("total-amount").textContent = money(total);
  renderAnnualIncome();
  const equivalent = wageEquivalent(total);
  element("wage-equivalent").hidden = equivalent === null;
  if (equivalent) {
    element("wage-equivalent-value").textContent = equivalent.label;
    element("wage-equivalent-fill").style.width = Math.min(equivalent.months / 12 * 100, 100) + "%";
    element("wage-equivalent-calculation").textContent = money(total) + " ÷ " + money(Math.round(result.gross / 12))
      + ". Į bendrą sumą įeina ir pirkinių mokesčiai.";
  }
  const baseDetails = element("tax-bases");
  baseDetails.hidden = !result.bases?.length;
  renderRows(element("tax-base-rows"), (result.bases ?? []).map(([label, cents]) => ({ label, cents })));
  element("tax-bases-note").textContent = result.mode === "self"
    ? "Kai taikomas GPM kreditas, jis suapvalinamas atskirai iki centų."
    : "Kai taikomi keli GPM tarifai, šiame modelyje metinis NPD priskiriamas proporcingai.";
  element("wage-estimate").textContent = wageEstimate();
  element("wage-estimate").hidden = !result.fromNet;
  element("amount-kind").textContent = result.mode === "pension" ? pensionTaxNote : automatic
    ? "Pajamų dalis rodo preliminarią metinę prievolę prieš avansų ir išskaičiuotų sumų užskaitymą. Pirkinių mokesčiai apskaičiuoti pagal tavo duomenis."
    : "Suvestinė pagal įvestas sumas ir apskaičiuotus pirkinių mokesčius.";
  if (element("result-period-label")) element("result-period-label").textContent = result.year + " m.";
  if (element("result-year-context")) element("result-year-context").textContent = resultYearContext();
  element("result-caption").textContent = result.caption + " · metinė suma";
  element("income-summary").hidden = result.mode === "none";
  renderRows(element("income-rows"), lines.filter((line) => line.group === "income"));
  renderRows(element("buying-rows"), lines.filter((line) => line.group === "buying"));
  renderPurchaseSummary(caveats);
  const comparisonCaveats = element("comparison-caveats");
  comparisonCaveats.textContent = caveats;
  comparisonCaveats.hidden = !caveats;

  priceComparison.update({ total, example: !!result.example }, announce);
  renderSpending(total, caveats);
  renderIncomeBreakdown({ total, gpm, vsd, psd });
  renderSpendingStatus();
  if (announce) {
    element("result-announcement").textContent = "Apskaičiuota suma " + money(total) + " per metus.";
  }
}

function renderPublicSpendingContext() {
  const notes = [
    ["spending-coverage", spendingCoverage],
    ["spending-defence-context", defenceBudgetContext, defenceBudgetSource],
  ];
  for (const [id, note, ...otherSources] of notes) {
    const paragraph = element(id);
    if (!paragraph) continue;
    paragraph.textContent = note.text;
    for (const source of [note, ...otherSources]) {
      const link = document.createElement("a");
      link.href = source.url;
      link.textContent = source.source;
      paragraph.append(" ", link);
    }
  }

  const list = element("institution-budgets");
  if (!list) return;
  for (const item of institutionBudgetRows()) {
    const row = document.createElement("li");
    row.className = "institution-budget";
    const heading = document.createElement("h3");
    heading.textContent = item.name;
    const annual = document.createElement("p");
    annual.className = "institution-budget-annual";
    const value = document.createElement("strong");
    value.textContent = item.annual;
    annual.append(value, " per metus");
    const monthly = document.createElement("p");
    monthly.className = "institution-budget-monthly";
    monthly.textContent = item.monthly + " per mėnesį";
    const used = document.createElement("p");
    used.className = "institution-budget-total";
    used.textContent = "Panaudota " + item.used;
    const source = document.createElement("a");
    source.href = item.url;
    source.textContent = item.source;
    row.append(heading, annual, monthly, used, source);
    list.append(row);
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
    year: result.year,
    yearContext: resultYearContext(),
    wageEquivalent: wageEquivalent(total)?.label,
    example: !!result.example,
    mode: result.caption,
    total: money(total),
    comparison: includePurchases ? priceComparison.reportRows(total) : null,
    purchases: includePurchases ? result.purchases.map(purchaseResultRow) : [],
    rows: lines.map((line) => [line.label, money(line.cents)]),
    spendingYear,
    spendingGroups: spending.map((area) => ({
      name: area.name,
      amount: money(area.subtotal),
      rows: area.groups.map((group) => [group.name + " · " + group.code, groupDisplayAmount(group), group.description]),
    })),
    spendingSource,
    spendingCoverage,
    defenceBudgetContext,
    defenceBudgetSource,
    institutions: includePurchases ? {
      year: institutionBudgetYear,
      population: institutionBudgetPopulation.toLocaleString("lt-LT"),
      rows: institutionBudgetRows(),
    } : null,
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
form.addEventListener("focusout", validatePurchaseInput);

element("insurance-basis").addEventListener("click", () => {
  showFundShares = !showFundShares;
  renderIncomeBreakdown(annualTotals());
  renderSpendingStatus();
});

function calculateResult({ scroll = false, example = false, blockedAction = "" } = {}) {
  clearErrors();
  try {
    const year = selectedTaxYear();
    const income = readIncome(year);
    const purchases = [...purchaseEditor.read(), ...otherPurchaseEditor.read()];
    const otherVat = [21, year === 2025 ? 9 : 12, 5].reduce((sum, rate) => {
      const id = rate === 21 ? "vat-standard" : "vat-" + rate;
      return sum + vatInPrice(readMoney(id) * purchaseMonthsPerYear, rate);
    }, 0);
    const vat = purchases.reduce((sum, item) => sum + item.vat, otherVat);
    result = {
      ...income, year, mode: incomeMode.value, purchases, vat, example,
      caption: example ? exampleCaption(income) : income.caption,
    };
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
    markFieldError(error.field, error.message);
    errorMessage.textContent = error.message;
    errorMessage.hidden = false;
    if (blockedAction && reportError) {
      expandFieldDetails(error.field);
      showBlockedAction(error.field, error.message, blockedAction);
    } else {
      revealField(error.field);
    }
    return false;
  }
}

taxYearSelect?.addEventListener("change", () => {
  updateYearFields();
  purchaseEditor.refresh();
  otherPurchaseEditor.refresh();
  if (staleResult.hidden) calculateResult({ example: result.example });
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  calculateResult({ scroll: true });
});

element("view-report").addEventListener("click", () => {
  if (staleResult.hidden || calculateResult({ blockedAction: "Ataskaita neatidaryta." })) window.taxReport.open(reportData(true));
});

element("share-result").addEventListener("click", () => {
  if (staleResult.hidden || calculateResult({ blockedAction: "Suvestinė neatidaryta." })) window.taxReport.openShare(reportData(false));
});

const resultCardSharing = installResultCardSharing(() => {
  if (!staleResult.hidden && !calculateResult()) return null;
  const { total } = annualTotals();
  return {
    year: result.year,
    example: !!result.example,
    comparison: priceComparison.reportRows(total),
    caveats: purchaseCaveats(),
    url: publicCalculatorUrl,
  };
});

installPublicLinkSharing();
updateYearFields();
renderIncomeMode();
renderPublicSpendingContext();
renderResult();
selectSpendingTabFromLink();
window.addEventListener("hashchange", selectSpendingTabFromLink);

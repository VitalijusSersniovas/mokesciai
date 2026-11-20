"use strict";

const currency = new Intl.NumberFormat("lt-LT", { style: "currency", currency: "EUR" });
const shortCurrency = new Intl.NumberFormat("lt-LT", { style: "currency", currency: "EUR", maximumFractionDigits: 2, minimumFractionDigits: 0 });
const money = (cents) => currency.format(cents / 100);
const compactMoney = (cents) => shortCurrency.format(cents / 100);

function parseInputNumber(input) {
  const raw = input.trim();
  if (!/^(?:\d+|\d{1,3}(?:[ \u00a0\u202f]\d{3})+)(?:[,.]\d+)?$/.test(raw)) return null;
  return Number(raw.replace(/\s/g, "").replace(",", "."));
}
function toCents(euros) {
  const scaled = euros * 100;
  return Math.round(scaled + Number.EPSILON * Math.max(1, Math.abs(scaled)));
}

const taxYear = 2025;
const wageContributionCeiling = 126_532.80;
const selfContributionCeiling = 90_681.84;
const minimumMonthlyPsdCents = 7_245;
const wageVsdRate = 0.1252;
const wagePsdRate = 0.0698;

function progressiveIncomeTax(euros) {
  return Math.min(euros, wageContributionCeiling) * 0.20
    + Math.max(0, euros - wageContributionCeiling) * 0.32;
}

function wageAmounts(gross, dividend, higherMonths, lowerMonths, accruedInsuranceGross, pensionRate, useNpd = true) {
  const totalIncome = gross + dividend;
  const ordinaryNpd = totalIncome <= 28_647.48
    ? 8_964 - 0.49 * Math.max(0, totalIncome - 12_456)
    : Math.max(0, 4_800 - 0.18 * (totalIncome - 7_704));
  const annualNpd = useNpd
    ? Math.min(gross, ordinaryNpd * (12 - higherMonths - lowerMonths) / 12 + 1127 * higherMonths + 1057 * lowerMonths)
    : 0;
  // When different rates apply to wages, the annual NPD is allocated proportionally.
  const incomeTax = gross ? progressiveIncomeTax(gross) * (1 - annualNpd / gross) : 0;
  const vsdBase = Math.min(accruedInsuranceGross, wageContributionCeiling);
  return {
    annualNpd,
    vsdBase,
    incomeTax,
    vsd: vsdBase * wageVsdRate,
    psd: accruedInsuranceGross * wagePsdRate,
    pension: vsdBase * pensionRate,
  };
}

function wageTaxes(gross, dividend = 0, higherMonths = 0, lowerMonths = 0, accruedInsuranceGross = gross, pensionRate = 0, useNpd = true) {
  const amounts = wageAmounts(gross, dividend, higherMonths, lowerMonths, accruedInsuranceGross, pensionRate, useNpd);
  const tax = toCents(amounts.incomeTax);
  const vsd = toCents(amounts.vsd);
  const psd = toCents(amounts.psd);
  const pension = toCents(amounts.pension);
  return {
    tax,
    dividend: toCents(dividend * 0.15),
    vsd,
    psd,
    pension,
    net: toCents(gross) - tax - vsd - psd - pension,
    bases: [
      ["Metinis darbo užmokestis prieš mokesčius", toCents(gross)],
      ["Metinis NPD", toCents(amounts.annualNpd)],
      ["Darbo užmokesčio dalis po NPD", toCents(gross - amounts.annualNpd)],
      ["VSD bazė (iki 126 532,80 €)", toCents(amounts.vsdBase)],
      ["PSD bazė", toCents(accruedInsuranceGross)],
      ...(dividend ? [["Lietuvos įmonių dividendai prieš 15 % GPM", toCents(dividend)]] : []),
    ],
  };
}

function grossWagesFromNet(annualNet, higherMonths = 0, lowerMonths = 0, accruedInsuranceGross, pensionRate = 0, useNpd = true) {
  const netCents = toCents(annualNet);
  let low = 0;
  let high = 2 * (netCents + toCents(accruedInsuranceGross ?? 0)) + 1;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    const gross = middle / 100;
    const amounts = wageAmounts(gross, 0, higherMonths, lowerMonths, accruedInsuranceGross ?? gross, pensionRate, useNpd);
    const net = gross - amounts.incomeTax - amounts.vsd - amounts.psd - amounts.pension;
    if (net * 100 < netCents) low = middle + 1;
    else high = middle;
  }

  // Compare nearby cent amounts because the separate deductions can round in different directions.
  let closest = low;
  let difference = Infinity;
  for (let candidate = Math.max(0, low - 5); candidate <= low + 5; candidate += 1) {
    const { net } = wageTaxes(candidate / 100, 0, higherMonths, lowerMonths, accruedInsuranceGross, pensionRate, useNpd);
    const nextDifference = Math.abs(net - netCents);
    if (nextDifference < difference) {
      closest = candidate;
      difference = nextDifference;
    }
  }
  return closest / 100;
}

function wageTaxMonths({gross, tax, vsd, psd}) {
  return gross > 0 ? 12 * (tax + vsd + psd) / gross : null;
}

function selfEmploymentTaxes(revenue, actualExpenses, minPsdMonths, exemptVsd, carriedLoss = 0) {
  const flatExpenses = actualExpenses === null;
  const expenses = flatExpenses ? toCents(revenue * 0.30) / 100 : actualExpenses;
  const operatingProfit = Math.max(0, toCents(revenue - expenses));
  const lossDeduction = Math.min(operatingProfit, toCents(carriedLoss));
  const profitAfterLoss = operatingProfit - lossDeduction;
  // The 2025 GPM311 rules, Annex 7 example 5, reduce the insurance base by carried losses.
  const insurableProfit = Math.min(profitAfterLoss * 0.90 / 100, selfContributionCeiling);
  const vsd = exemptVsd ? 0 : toCents(insurableProfit * 0.1252);
  const psdMinimum = minimumMonthlyPsdCents * minPsdMonths;
  const psd = Math.max(toCents(insurableProfit * 0.0698), psdMinimum);
  const taxableProfit = (flatExpenses ? profitAfterLoss : Math.max(0, profitAfterLoss - vsd - psd)) / 100;
  const creditRate = Math.max(0, 0.10 - Math.max(0, taxableProfit - 20_000) / 150_000);
  const credit = toCents(taxableProfit * creditRate);
  const tax = toCents(taxableProfit * 0.15) - credit;
  return {
    tax, dividend: 0, vsd, psd,
    bases: [
      ["Metinės individualios veiklos pajamos", toCents(revenue)],
      ["Išlaidos prieš VSD ir PSD", toCents(expenses)],
      ["Pelnas prieš VSD ir PSD", operatingProfit],
      ...(lossDeduction ? [["Atskaityti ankstesnių metų mokestiniai nuostoliai", lossDeduction]] : []),
      ["Draudimo įmokų bazė (90 % pelno, iki 90 681,84 €)", toCents(insurableProfit)],
      ["PSD minimumas pagal įvestus mėnesius", psdMinimum],
      ["GPM apmokestinamasis pelnas", toCents(taxableProfit)],
      ...(credit ? [["GPM kreditas", credit]] : []),
    ],
  };
}

function vatInPrice(spendingEuros, rate) {
  return toCents(spendingEuros * rate / (100 + rate));
}

// Allocate whole cents and distribute the remaining cents to the largest remainders.
function apportion(total, weights) {
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
  if (!weightSum || !total) return weights.map(() => 0);
  const pieces = weights.map((weight, index) => {
    const exact = total * (weight / weightSum);
    return { index, floor: Math.floor(exact), remainder: exact % 1 };
  });
  const values = pieces.map((piece) => piece.floor);
  const centsLeft = total - values.reduce((sum, value) => sum + value, 0);
  pieces.sort((a, b) => b.remainder - a.remainder);
  for (const piece of pieces.slice(0, centsLeft)) values[piece.index] += 1;
  return values;
}


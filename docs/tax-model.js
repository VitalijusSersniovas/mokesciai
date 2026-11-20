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

const defaultIncomeTaxYear = 2025;
const incomeRulesByYear = {
  2025: {
    firstIncomeTaxThreshold: 126_532.80,
    secondIncomeTaxThreshold: 126_532.80,
    wageContributionCeiling: 126_532.80,
    selfContributionCeiling: 90_681.84,
    minimumMonthlyPsdCents: 7_245,
    annualMinimumWage: 12_456,
    alternativeNpdThreshold: 28_647.48,
    selfFlatTaxRate: 0.15,
    selfCreditRate: 0.10,
  },
  // VMI: 2026 GPM and NPD (GPMĮ 6, 18² and 20); Sodra: 2026 employee and self-employment contribution rules.
  2026: {
    firstIncomeTaxThreshold: 83_237.40,
    secondIncomeTaxThreshold: 138_729,
    wageContributionCeiling: 138_729,
    selfContributionCeiling: 99_422.45,
    minimumMonthlyPsdCents: 8_048,
    annualMinimumWage: 13_836,
    selfCreditRate: 0.15,
  },
};
const wageVsdRate = 0.1252;
const wagePsdRate = 0.0698;

function incomeTaxRules(year = defaultIncomeTaxYear) {
  if (!Object.hasOwn(incomeRulesByYear, year)) throw new RangeError("Unsupported income tax year: " + year);
  return incomeRulesByYear[year];
}

function progressiveIncomeTax(euros, rules) {
  const { firstIncomeTaxThreshold, secondIncomeTaxThreshold } = rules;
  return Math.min(euros, firstIncomeTaxThreshold) * 0.20
    + Math.max(0, Math.min(euros, secondIncomeTaxThreshold) - firstIncomeTaxThreshold) * 0.25
    + Math.max(0, euros - secondIncomeTaxThreshold) * 0.32;
}

function wageAmounts(gross, dividend, higherMonths, lowerMonths, accruedInsuranceGross, pensionRate, useNpd, rules, fromPayroll = false) {
  const totalIncome = gross + dividend;
  const ordinaryNpd = totalIncome > (rules.alternativeNpdThreshold ?? Infinity)
    ? Math.max(0, 4_800 - 0.18 * (totalIncome - 7_704))
    : Math.max(0, 8_964 - 0.49 * Math.max(0, totalIncome - rules.annualMinimumWage));
  const annualNpd = useNpd
    ? Math.min(gross, ordinaryNpd * (12 - higherMonths - lowerMonths) / 12 + 1127 * higherMonths + 1057 * lowerMonths)
    : 0;
  // Without a request to apply progressive withholding to cumulative income, rates apply to each payment (GPMĮ 23(7)).
  const incomeTaxBeforeNpd = fromPayroll ? 12 * progressiveIncomeTax(gross / 12, rules) : progressiveIncomeTax(gross, rules);
  // When different rates apply to wages, the annual NPD is allocated proportionally.
  const incomeTax = gross ? incomeTaxBeforeNpd * (1 - annualNpd / gross) : 0;
  const vsdBase = Math.min(accruedInsuranceGross, rules.wageContributionCeiling);
  return {
    annualNpd,
    vsdBase,
    incomeTax,
    vsd: vsdBase * wageVsdRate,
    psd: accruedInsuranceGross * wagePsdRate,
    pension: vsdBase * pensionRate,
  };
}

function wageTaxes(gross, dividend = 0, higherMonths = 0, lowerMonths = 0, accruedInsuranceGross = gross, pensionRate = 0, useNpd = true, year = defaultIncomeTaxYear) {
  const rules = incomeTaxRules(year);
  const amounts = wageAmounts(gross, dividend, higherMonths, lowerMonths, accruedInsuranceGross, pensionRate, useNpd, rules);
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
      ["VSD bazė (iki " + money(toCents(rules.wageContributionCeiling)) + ")", toCents(amounts.vsdBase)],
      ["PSD bazė", toCents(accruedInsuranceGross)],
      ...(dividend ? [["Lietuvos įmonių dividendai prieš 15 % GPM", toCents(dividend)]] : []),
    ],
  };
}

function inferGrossWages(annualNet, higherMonths, lowerMonths, accruedInsuranceGross, pensionRate, useNpd, rules, fromPayroll) {
  const amountsAtGross = (gross) =>
    wageAmounts(gross, 0, higherMonths, lowerMonths, accruedInsuranceGross ?? gross, pensionRate, useNpd, rules, fromPayroll);
  const netCents = toCents(annualNet);
  let low = 0;
  let high = 2 * (netCents + toCents(accruedInsuranceGross ?? 0)) + 1;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    const gross = middle / 100;
    const amounts = amountsAtGross(gross);
    const net = gross - amounts.incomeTax - amounts.vsd - amounts.psd - amounts.pension;
    if (net * 100 < netCents) low = middle + 1;
    else high = middle;
  }

  // Compare nearby cent amounts because the separate deductions can round in different directions.
  let closest = low;
  let difference = Infinity;
  for (let candidate = Math.max(0, low - 5); candidate <= low + 5; candidate += 1) {
    const { incomeTax, vsd, psd, pension } = amountsAtGross(candidate / 100);
    const net = candidate - toCents(incomeTax) - toCents(vsd) - toCents(psd) - toCents(pension);
    const nextDifference = Math.abs(net - netCents);
    if (nextDifference < difference) {
      closest = candidate;
      difference = nextDifference;
    }
  }
  return closest / 100;
}

function grossWagesFromNet(annualNet, higherMonths = 0, lowerMonths = 0, accruedInsuranceGross, pensionRate = 0, useNpd = true, year = defaultIncomeTaxYear) {
  return inferGrossWages(annualNet, higherMonths, lowerMonths, accruedInsuranceGross, pensionRate, useNpd, incomeTaxRules(year), false);
}

function grossWagesFromPayrollNet(annualNet, higherMonths = 0, lowerMonths = 0, accruedInsuranceGross, pensionRate = 0, useNpd = true, year = defaultIncomeTaxYear) {
  return inferGrossWages(annualNet, higherMonths, lowerMonths, accruedInsuranceGross, pensionRate, useNpd, incomeTaxRules(year), true);
}

function wageTaxMonths(annualTaxCents, annualGrossCents) {
  return annualGrossCents > 0 ? 12 * annualTaxCents / annualGrossCents : null;
}

function selfEmploymentTaxes(revenue, actualExpenses, minPsdMonths, exemptVsd, carriedLoss = 0, year = defaultIncomeTaxYear) {
  const rules = incomeTaxRules(year);
  const flatExpenses = actualExpenses === null;
  const expenses = flatExpenses ? toCents(revenue * 0.30) / 100 : actualExpenses;
  const operatingProfit = Math.max(0, toCents(revenue - expenses));
  const lossDeduction = Math.min(operatingProfit, toCents(carriedLoss));
  const profitAfterLoss = operatingProfit - lossDeduction;
  // The 2025 GPM311 rules, Annex 7 example 5, reduce the insurance base by carried losses.
  const insurableProfit = Math.min(profitAfterLoss * 0.90 / 100, rules.selfContributionCeiling);
  const vsd = exemptVsd ? 0 : toCents(insurableProfit * wageVsdRate);
  const psdMinimum = rules.minimumMonthlyPsdCents * minPsdMonths;
  const psd = Math.max(toCents(insurableProfit * wagePsdRate), psdMinimum);
  const taxableProfit = (flatExpenses ? profitAfterLoss : Math.max(0, profitAfterLoss - vsd - psd)) / 100;
  const creditRate = Math.max(0, rules.selfCreditRate - Math.max(0, taxableProfit - 20_000) / 150_000);
  const credit = toCents(taxableProfit * creditRate);
  const taxBeforeCredit = rules.selfFlatTaxRate === undefined
    ? progressiveIncomeTax(taxableProfit, rules)
    : taxableProfit * rules.selfFlatTaxRate;
  const tax = toCents(taxBeforeCredit) - credit;
  return {
    tax, dividend: 0, vsd, psd,
    bases: [
      ["Metinės individualios veiklos pajamos", toCents(revenue)],
      ["Išlaidos prieš VSD ir PSD", toCents(expenses)],
      ["Pelnas prieš VSD ir PSD", operatingProfit],
      ...(lossDeduction ? [["Atskaityti ankstesnių metų mokestiniai nuostoliai", lossDeduction]] : []),
      ["Draudimo įmokų bazė (90 % pelno, iki " + money(toCents(rules.selfContributionCeiling)) + ")", toCents(insurableProfit)],
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


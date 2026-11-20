const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.join(__dirname, '..', 'docs');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const model = vm.runInNewContext(
  read('tax-model.js') + read('comparison.js') + read('spending-data.js') + read('insurance-spending.js') +
  '\n({ toCents, wageTaxes, grossWagesFromNet, grossWagesFromPayrollNet, wageTaxMonths, selfEmploymentTaxes, vatInPrice, expenditures, expenditureTotal, spendingYear, buildSpendingBreakdown, comparePrice, referencePrices, buildGpmBreakdown, buildInsuranceBreakdown, vsdfExpenseWeights, psdfExpenseWeights })'
);
const { toCents, wageTaxes, grossWagesFromNet, grossWagesFromPayrollNet, wageTaxMonths, selfEmploymentTaxes, vatInPrice, expenditures, expenditureTotal, spendingYear, buildSpendingBreakdown, comparePrice, referencePrices, buildGpmBreakdown, buildInsuranceBreakdown, vsdfExpenseWeights, psdfExpenseWeights } = model;

test('money rounds decimal half-cents upward', () => {
  assert.equal(toCents(1.005), 101);
  assert.equal(toCents(10.075), 1008);
});

test('2025 employment and special NPD use annual amounts', () => {
  const regular = wageTaxes(24000);
  assert.equal(regular.tax, 413851);
  assert.equal(regular.vsd, 300480);
  assert.equal(regular.psd, 167520);
  assert.equal(regular.net, 1518149);
  assert.equal(wageTaxes(24000, 1000).tax, 423651);
  assert.equal(wageTaxes(24000, 1000).dividend, 15000);
  const onlyDividends = wageTaxes(0, 1000);
  assert.equal(onlyDividends.dividend, 15000);
  assert.equal(onlyDividends.tax + onlyDividends.vsd + onlyDividends.psd, 0);
  assert.equal(wageTaxes(14000, 5000, 0, 9).tax, 60953);
  assert.equal(wageTaxes(90000, 0, 12).tax, 1529520);
  assert.equal(wageTaxes(150000).tax, 3281606);
  assert.equal(wageTaxes(150000).vsd, 1584191);
  assert.equal(wageTaxes(12456).tax, 69840);
  assert.equal(wageTaxes(28647.48).tax, 552346);
  assert.equal(wageTaxes(29000).tax, 560666);
  assert.equal(wageTaxes(34370.67).tax, 687413);
});

test('2025 payroll uses the received amount for GPM and accrued wages for insurance when they differ', () => {
  const decReceivedNextYear = wageTaxes(24400, 0, 0, 0, 26800);
  assert.equal(decReceivedNextYear.tax, 425771);
  assert.equal(decReceivedNextYear.vsd, 335536);
  assert.equal(decReceivedNextYear.psd, 187064);

  const noAccruedWages = wageTaxes(24000, 0, 0, 0, 0);
  assert.equal(noAccruedWages.tax, 413851);
  assert.equal(noAccruedWages.vsd, 0);
  assert.equal(noAccruedWages.psd, 0);

  const overInsuranceCeiling = wageTaxes(24000, 0, 0, 0, 140000);
  assert.equal(overInsuranceCeiling.tax, 413851);
  assert.equal(overInsuranceCeiling.vsd, 1584191);
  assert.equal(overInsuranceCeiling.psd, 977200);
});

test('net wages invert the 2025 model with disability months, alternate insurance and pension contributions', () => {
  assert.equal(grossWagesFromNet(15181.49), 24000);
  const withPension = wageTaxes(24000, 0, 0, 0, undefined, 0.03);
  assert.equal(withPension.pension, 72000);
  assert.equal(withPension.net, 1446149);
  assert.equal(withPension.tax + withPension.vsd + withPension.psd, 881851);
  assert.equal(grossWagesFromNet(14461.49, 0, 0, undefined, 0.03), 24000);
  assert.equal(grossWagesFromNet(14916.29, 0, 0, 26800), 24400);
  assert.equal(grossWagesFromNet(19861.49, 0, 0, 0), 24000);

  for (const gross of [0, 0.01, 12_456, 24_000.01, 28_647.48, 28_647.49, 34_370.67, 126_532.80, 150_000]) {
    const options = [gross > 126_532.80 ? 0 : 4, 0, undefined, 0.03];
    const { net } = wageTaxes(gross, 0, ...options);
    const inferred = grossWagesFromNet(net / 100, ...options);
    assert.ok(Math.abs(toCents(inferred) - toCents(gross)) <= 4);
    assert.equal(wageTaxes(inferred, 0, ...options).net, net);
  }
});

const wages2026 = (gross, { dividend = 0, higherMonths = 0, lowerMonths = 0, pensionRate = 0, useNpd = true } = {}) =>
  wageTaxes(gross, dividend, higherMonths, lowerMonths, undefined, pensionRate, useNpd, 2026);

test('2026 annual NPD follows the new MMA, a single taper and unchanged disability amounts', () => {
  assert.equal(wages2026(13_836).bases[1][1], 896400);
  assert.equal(wages2026(24_000).bases[1][1], 398364);
  assert.equal(wages2026(24_000).tax, 400327);
  assert.equal(wages2026(32_129.88).bases[1][1], 0);
  assert.equal(wages2026(24_000, { higherMonths: 5, lowerMonths: 7 }).bases[1][1], 1303400);
  assert.equal(wages2026(24_000, { dividend: 1_000 }).tax, 410127);
  assert.equal(wages2026(24_000, { dividend: 1_000 }).dividend, 15000);
  assert.equal(wages2026(0, { dividend: 150_000 }).dividend, 2250000);
});

test('2026 wages use 20, 25 and 32 percent GPM, with separate VSD and PSD bases', () => {
  assert.equal(wages2026(83_237.40).tax, 1664748);
  assert.equal(wages2026(100_000).tax, 2083813);
  assert.equal(wages2026(138_729).tax, 3052038);
  const higherWages = wages2026(150_000, { pensionRate: 0.03 });
  assert.equal(higherWages.tax, 3412710);
  assert.equal(higherWages.vsd, 1736887);
  assert.equal(higherWages.psd, 1047000);
  assert.equal(higherWages.pension, 416187);
});

test('2026 net-to-gross estimates reproduce the monthly input, including the initial 1100 euro example', () => {
  const annualNet = 1_100 * 12;
  assert.equal(grossWagesFromNet(annualNet, 0, 0, undefined, 0, true, 2026), 19_824.99);
  assert.equal(grossWagesFromNet(annualNet, 0, 0, undefined, 0.03, true, 2026), 21_071.82);
  assert.equal(grossWagesFromNet(annualNet, 0, 0, undefined, 0, false, 2026), 21_818.17);
  for (const gross of [13_836, 32_129.88, 83_237.40, 138_729, 150_000]) {
    const { net } = wages2026(gross, { pensionRate: 0.03 });
    const inferred = grossWagesFromNet(net / 100, 0, 0, undefined, 0.03, true, 2026);
    // Separate cent rounding can give neighboring gross amounts the same net.
    assert.ok(Math.abs(toCents(inferred) - toCents(gross)) <= 5);
    assert.equal(wages2026(inferred, { pensionRate: 0.03 }).net, net);
  }
});

test('2026 regular payroll can withhold 20 percent while the annual return applies progressive GPM', () => {
  // At 100000 gross, twelve equal payroll payments have 20000 in withheld GPM and 19500 in contributions.
  const gross = grossWagesFromPayrollNet(60_500, 0, 0, undefined, 0, true, 2026);
  assert.equal(gross, 100_000);
  assert.equal(wages2026(gross).net, 5966187);
  assert.equal(grossWagesFromPayrollNet(1_100 * 12, 0, 0, undefined, 0, true, 2026), 19_824.99);
});

test('individual activity tax credit rounds separately', () => {
  const exact = selfEmploymentTaxes(24541.84, 0, 0, true);
  assert.equal(exact.psd, 154172);
  assert.equal(exact.tax, 161003);
  const withMinimum = selfEmploymentTaxes(10000, 2000, 12, false);
  assert.equal(withMinimum.tax, 31145);
  assert.equal(withMinimum.vsd, 90144);
  assert.equal(withMinimum.psd, 86940);
  assert.equal(selfEmploymentTaxes(50000, null, 0, false).tax, 525000);
  assert.equal(selfEmploymentTaxes(50000.08, null, 0, false).tax, 525001);
  const overCeiling = selfEmploymentTaxes(200000, null, 12, false);
  assert.equal(overCeiling.vsd, 1135337);
  assert.equal(overCeiling.psd, 632959);
});

test('2026 individual activity credit phases out at 42500 and higher profit uses the progressive bands', () => {
  // The 30 percent expense allowance leaves exactly 20000, 30000 and 42500 euros of taxable profit.
  const withFlatExpenses = (revenue) => selfEmploymentTaxes(revenue, null, 0, false, 0, 2026);
  assert.equal(withFlatExpenses(28_571.43).tax, 100000);
  assert.equal(withFlatExpenses(42_857.14).tax, 350000);
  assert.equal(withFlatExpenses(60_714.29).tax, 850000);
  assert.equal(withFlatExpenses(70_000).tax, 980000);
  assert.equal(withFlatExpenses(150_000).tax, 2208813);
  const higherProfit = withFlatExpenses(200_000);
  assert.equal(higherProfit.tax, 3092710);
  assert.equal(higherProfit.vsd, 1244769);
  assert.equal(higherProfit.psd, 693969);
});

test('2026 individual activity keeps the PSD floor and accepts eligible prior losses', () => {
  const withMinimum = selfEmploymentTaxes(10_000, 2_000, 12, false, 0, 2026);
  assert.equal(withMinimum.tax, 30664);
  assert.equal(withMinimum.vsd, 90144);
  assert.equal(withMinimum.psd, 96576);
  const taxableProfitExhausted = selfEmploymentTaxes(10_000, 2_000, 4, false, 12_000, 2026);
  assert.equal(taxableProfitExhausted.tax, 0);
  assert.equal(taxableProfitExhausted.vsd, 0);
  assert.equal(taxableProfitExhausted.psd, 32192);
});

test('2025 GPM311 Annex 7 example 5 deducts carried losses before GPM, VSD and PSD', () => {
  const declared = selfEmploymentTaxes(38000, null, 9, false, 1600);
  assert.equal(declared.tax, 208333);
  assert.equal(declared.vsd, 281700);
  assert.equal(declared.psd, 157050);
  const noLoss = selfEmploymentTaxes(38000, null, 9, false);
  assert.equal(noLoss.tax + noLoss.vsd + noLoss.psd, 716870);
});

test('carried losses reduce the insurance base and preserve the PSD minimum with actual expenses', () => {
  const reducedProfit = selfEmploymentTaxes(10000, 2000, 12, false, 1000);
  assert.equal(reducedProfit.tax, 26710);
  assert.equal(reducedProfit.vsd, 78876);
  assert.equal(reducedProfit.psd, 86940);

  const exhaustedProfit = selfEmploymentTaxes(10000, 2000, 4, false, 12000);
  assert.equal(exhaustedProfit.tax, 0);
  assert.equal(exhaustedProfit.vsd, 0);
  assert.equal(exhaustedProfit.psd, 28980);
});

test('included VAT separates standard and 2025 reduced rates', () => {
  assert.equal(vatInPrice(75, 21), 1302);
  assert.equal(vatInPrice(109, 9), 900);
  assert.equal(vatInPrice(105, 5), 500);
});

test('2025 income tax destination shares preserve the known GPM total', () => {
  const regular = buildGpmBreakdown(wageTaxes(24000).tax);
  assert.equal(regular.reference, false);
  assert.deepEqual(Array.from(regular.rows, (row) => row.cents), [209574, 204277]);
  assert.deepEqual(Array.from(regular.rows, (row) => row.share), [0.5064, 0.4936]);
  const reference = buildGpmBreakdown(null);
  assert.equal(reference.reference, true);
  assert.deepEqual(Array.from(reference.rows, (row) => row.cents), [5064, 4936]);
  for (const total of [0, 1, 577, 413851, 100000000]) {
    const { rows } = buildGpmBreakdown(total);
    assert.equal(rows.reduce((sum, row) => sum + row.cents, 0), total);
  }
});

test('2024 COFOG expense estimates preserve allocations to the cent and mark unpublished subgroups', () => {
  assert.equal(spendingYear, 2024);
  assert.equal(expenditureTotal, 311369);
  assert.equal(new Set(expenditures.map(({ code }) => code)).size, 10);
  assert.equal(expenditures.find(({ code }) => code === 'GF09').amount, 43374);

  for (const total of [0, 1, 97, 10000, 881851, 100000012]) {
    const areas = buildSpendingBreakdown(total);
    assert.equal(areas.reduce((sum, area) => sum + area.subtotal, 0), total);
    const groups = areas.flatMap((area) => area.groups);
    assert.equal(new Set(groups.map(({ code }) => code)).size, 69);
    assert.equal(groups.filter(({ actual }) => actual !== null).length, 67);
    assert.equal(groups.find(({ code }) => code === 'GF0105').subtotal, null);
    assert.equal(groups.find(({ code }) => code === 'GF0605').actual, null);
    assert.equal(groups.find(({ code }) => code === 'GF0108').subtotal, 0);
    assert.equal(groups.find(({ code }) => code === 'GF0301').actual, 5278);
    for (const area of areas) {
      assert.equal(area.groups.reduce((sum, group) => sum + (group.subtotal ?? 0), 0), area.subtotal);
    }
  }
});

test('purchasing benchmarks apply the full amount separately to each price', () => {
  const phone = referencePrices.find((price) => price.label === 'iPhone 17');
  assert.equal(comparePrice(868327, phone).quantity, 7);
  assert.equal(comparePrice(868327, referencePrices.find((price) => price.label === 'Skalbyklė')).quantity, 26);
  const diesel = referencePrices.find((price) => price.label === 'Dyzelinas');
  assert.equal(diesel.cents, 217.1);
  assert.equal(comparePrice(868327, diesel).quantity, 3999.6);
  assert.equal(comparePrice(114899, phone).remaining, 114899);
  assert.equal(comparePrice(483, referencePrices.find((price) => price.label === 'Elektra')).quantity, 20.1);
  assert.ok(referencePrices.every((price) => price.source.date.startsWith('2026')));
});

test('VSD and PSD use their own sources and allocated rows reconcile to the cent', () => {
  assert.equal(vsdfExpenseWeights.reduce((total, [, weight]) => total + weight, 0), 7_888_856_099);
  assert.equal(psdfExpenseWeights.reduce((total, [, weight]) => total + weight, 0), 377_526_675_739);
  const [vsd, psd] = buildInsuranceBreakdown({ mode: 'wages', vsd: 300480, psd: 167520 });
  assert.deepEqual(Array.from(vsd.rows, ({ cents }) => cents), [209280, 47760, 43440]);
  assert.deepEqual(Array.from(psd.rows, ({ cents }) => cents), [124815, 31164, 9888, 1653]);
  const [vsdf, psdf] = buildInsuranceBreakdown({ mode: 'wages', fixed: true });
  assert.deepEqual(Array.from(vsdf.rows, ({ cents }) => cents), [7780, 728, 686, 577, 173, 56]);
  assert.deepEqual(Array.from(psdf.rows, ({ cents }) => cents), [7451, 1860, 590, 99]);
  for (const mode of ['wages', 'self', 'paid', 'none']) {
    for (const amount of [0, 1, 97, 10000, 10000000000]) {
      const funds = buildInsuranceBreakdown({ mode, vsd: amount, psd: amount });
      for (const fund of funds) {
        assert.equal(fund.rows.reduce((total, row) => total + row.cents, 0), fund.total);
        assert.equal(fund.total, mode === 'none' ? 10000 : amount);
      }
      assert.equal(funds[0].rows.length, ['wages', 'self'].includes(mode) ? 3 : 6);
    }
  }
});

test('net-to-gross can use no payroll NPD without changing the annual entitlement', () => {
  const net = 14400;
  const gross = grossWagesFromNet(net, 0, 0, undefined, 0, false);
  const withheld = wageTaxes(gross, 0, 0, 0, undefined, 0, false);
  assert.equal(withheld.net, 1440000);
  assert.equal(withheld.bases[1][1], 0);
  assert.ok(gross > grossWagesFromNet(net));
  assert.ok(wageTaxes(gross).tax < withheld.tax);
});

test('wage comparison uses the same total as the summary, including purchase taxes', () => {
  assert.equal(wageTaxMonths(881851, 2400000), 4.409255);
  const wageTaxesAndContributions = 348833 + 273163 + 152291;
  const purchaseTaxes = 214116 + 72431;
  assert.equal(wageTaxMonths(wageTaxesAndContributions + purchaseTaxes, 2181817).toFixed(1), '5.8');
  assert.equal(wageTaxMonths(1060834, 0), null);
});

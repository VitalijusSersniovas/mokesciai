const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', 'docs', file), 'utf8');
const { defenceFundParts, parseDefenceAmount, wageTaxes, buildGpmBreakdown, buildInsuranceBreakdown } = vm.runInNewContext([
  'tax-model.js', 'spending-data.js', 'defence-fund.js', 'insurance-spending.js',
].map(read).join('\n') + '\n({ defenceFundParts, parseDefenceAmount, wageTaxes, buildGpmBreakdown, buildInsuranceBreakdown })');

test('defence examples use the rates for the selected year', () => {
  assert.deepEqual({ ...defenceFundParts(2025, 1000, 100) }, { gpm: null, excise: 410 });
  assert.deepEqual({ ...defenceFundParts(2026, 1000, 100) }, { gpm: 2000, excise: 800 });
  assert.deepEqual({ ...defenceFundParts(2026, 0, null) }, { gpm: 0, excise: null });
  const defence = defenceFundParts(2026, 0.24, 0.06);
  assert.equal(defence.gpm + defence.excise, 1);
  assert.equal(parseDefenceAmount('1\u202f000,50'), 1000.5);
  assert.equal(parseDefenceAmount(''), null);
  for (const invalid of ['-1', '2,001', '10 00', '1e3', '100000001']) {
    assert.ok(Number.isNaN(parseDefenceAmount(invalid)), invalid);
  }
});

test('the payroll example applies the all-municipality rate only to GPM', () => {
  const payroll = wageTaxes(24_000);
  const breakdown = buildGpmBreakdown(payroll.tax);
  assert.equal(breakdown.total, 413_851);
  assert.equal(breakdown.rows[0].label, 'Visų savivaldybių biudžetams');
  assert.equal(breakdown.rows[0].cents, 209_574);
  assert.equal(breakdown.rows[1].cents, 204_277);
});

test('2026 GPM assigns 2% to defence before applying the 50.44% municipality rate', () => {
  const breakdown = buildGpmBreakdown(1_000_000, 2026);
  assert.deepEqual(Array.from(breakdown.rows, ({ cents }) => cents), [494_312, 485_688, 20_000]);
  assert.deepEqual(Array.from(breakdown.rows, ({ share }) => share), [0.494312, 0.485688, 0.02]);
  assert.equal(breakdown.rows[2].label, 'Valstybės gynybos fondui');
  const reference = buildGpmBreakdown(null, 2026);
  assert.equal(reference.reference, true);
  assert.deepEqual(Array.from(reference.rows, ({ cents }) => cents), [4943, 4857, 200]);
});

test('2026 VSD uses contribution rates and estimated PSD allocation uses the published 2025 fund expenses', () => {
  const [vsd, psd] = buildInsuranceBreakdown({ mode: 'wages', vsd: 1252, psd: 698, year: 2026 });
  assert.match(vsd.note, /2026 m\./);
  assert.match(vsd.sourceUrl, /2026-m-sausio/);
  assert.deepEqual(Array.from(vsd.rows, ({ cents }) => cents), [872, 199, 181]);
  assert.match(psd.sourceName, /2025 m\./);
  assert.equal(psd.rows.reduce((amount, row) => amount + row.cents, 0), 698);

  const [reference] = buildInsuranceBreakdown({ mode: 'wages', fixed: true, year: 2026 });
  assert.equal(reference.reference, true);
  assert.match(reference.sourceName, /2025 m\. fondo sąnaudos/);
});

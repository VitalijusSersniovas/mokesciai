const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', 'docs', file), 'utf8');
const { defenceFundParts, parseDefenceAmount, wageTaxes, buildGpmBreakdown } = vm.runInNewContext([
  'tax-model.js', 'spending-data.js', 'defence-fund.js',
].map(read).join('\n') + '\n({ defenceFundParts, parseDefenceAmount, wageTaxes, buildGpmBreakdown })');

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

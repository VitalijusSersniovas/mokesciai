const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const read = (name) => fs.readFileSync(path.join(__dirname, '..', 'docs', name), 'utf8');
const { comparePrice, formatUnitPrice, referencePrices, householdBillComparisons, mvpdBenchmark } = vm.runInNewContext(
  read('tax-model.js') + '\n' + read('comparison.js') + '\n({ comparePrice, formatUnitPrice, referencePrices, householdBillComparisons, mvpdBenchmark })'
);

test('divisible purchases are rounded down to the affordable tenth', () => {
  const diesel = referencePrices.find((price) => price.label === 'Dyzelinas');
  assert.equal(comparePrice(100, diesel).quantity, 0.4);
  assert.equal(comparePrice(218, diesel).quantity, 0.9);
  assert.equal(comparePrice(219, diesel).quantity, 1);
  assert.equal(comparePrice(1, diesel).value, '< 0,1 l');
  assert.equal(comparePrice(0, diesel).value, '0 l');
});

test('fuel comparisons use the dated 2026 LEA prices with diesel featured and petrol available', () => {
  const featured = referencePrices.slice(0, 4);
  const petrol = referencePrices.find((price) => price.label === 'Benzinas');
  assert.equal(featured[2].label, 'Dyzelinas');
  assert.equal(featured[2].cents, 218.1);
  assert.equal(featured[2].source.date, '2026-11-19 iki 10 val.');
  assert.ok(referencePrices.indexOf(petrol) >= featured.length);
  assert.equal(petrol.cents, 174.4);
  assert.equal(comparePrice(1744, petrol).value, '10 l');
  assert.equal(petrol.source.date, featured[2].source.date);
  assert.ok(!referencePrices.some((price) => price.type === 'Susisiekimas'));
});

test('the regulated electricity price refers to the 2026 second-half tariff', () => {
  const electricity = referencePrices.find((price) => price.label === 'Elektra');
  assert.match(formatUnitPrice(electricity), /0,24/);
  assert.equal(comparePrice(1200, electricity).quantity, 50);
  assert.equal(comparePrice(1199, electricity).quantity, 49.9);
  assert.equal(electricity.source.date, '2026 m. liepa–gruodis');
});

test('whole purchases retain the exact break point at the listed retail price', () => {
  const phone = referencePrices.find((price) => price.label === 'iPhone 17');
  assert.match(formatUnitPrice(phone), /1\s149,00/);
  assert.equal(comparePrice(114899, phone).quantity, 0);
  assert.equal(comparePrice(114899, phone).remaining, 114899);
  assert.equal(comparePrice(114900, phone).quantity, 1);
  assert.equal(comparePrice(114900, phone).remaining, 0);
});

test('the minimum needs benchmark and personal bills express annual totals in months', () => {
  assert.equal(comparePrice(881851, mvpdBenchmark).value, '18,8 mėn.');
  const comparisons = householdBillComparisons(12000, [
    { productKey: 'electricity', price: 24000 },
    { productKey: 'electricity', price: 36000 },
    { productKey: 'heating', price: 120000 },
    { productKey: 'coldWater', price: 90000 },
  ]);
  assert.deepEqual(Array.from(comparisons, (row) => row.quantity), ['2,4 mėn.', '1,2 mėn.']);
  assert.match(comparisons[0].price, /50,00/);
  assert.equal(householdBillComparisons(12000, []).length, 0);
});

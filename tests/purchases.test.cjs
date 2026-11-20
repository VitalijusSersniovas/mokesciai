const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.join(__dirname, '..', 'docs');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');

class TestElement {
  constructor(tag) {
    this.tag = tag;
    this.children = [];
    this.events = {};
    this.value = '';
  }

  append(...children) {
    this.children.push(...children);
    if (this.tag === 'select' && this.value === '') {
      const first = this.children[0];
      this.value = first.tag === 'optgroup' ? first.children[0].value : first.value;
    }
  }

  replaceChildren(...children) {
    this.children = [];
    this.append(...children);
  }

  setAttribute() {}
  focus() {}

  addEventListener(name, listener) {
    this.events[name] = listener;
  }

  dispatchEvent(event) {
    this.events[event.type]?.(event);
  }

  find(id) {
    if (this.id === id) return this;
    for (const child of this.children) {
      const match = child.find(id);
      if (match) return match;
    }
    return undefined;
  }
}

function purchaseForm(product = 'petrol') {
  const otherOnly = product === 'other';
  const ctx = {
    window: {},
    Event: class { constructor(type) { this.type = type; } },
    document: { createElement: (tag) => new TestElement(tag) },
  };
  vm.runInNewContext(read('tax-model.js') + '\n' + read('purchases.js'), ctx);
  const list = new TestElement('div');
  const add = new TestElement('button');
  const readInput = (field, options = {}) => {
    if (field.value === '') {
      if (options.required) throw new Error(field.id + ': required');
      return null;
    }
    return Number(field.value.replace(',', '.'));
  };
  const showError = (field, message) => {
    const error = new Error(message);
    error.field = field.id;
    throw error;
  };
  const editor = ctx.window.createPurchaseEditor(list, add, readInput, showError, otherOnly);
  add.dispatchEvent({ type: 'click', preventDefault() {} });
  const field = (name) => list.find((otherOnly ? 'other-purchase-1-' : 'purchase-1-') + name);
  if (product && !otherOnly) {
    field('product').value = product;
    field('product').dispatchEvent({ type: 'change' });
  }
  const fill = (name, value) => {
    const input = field(name);
    input.value = String(value);
    input.dispatchEvent({ type: 'input' });
  };
  const chooseBasis = (value) => {
    fill('basis', value);
    field('basis').dispatchEvent({ type: 'change' });
  };
  return { field, fill, chooseBasis, result: () => editor.read()[0] };
}

test('new purchase rows start without a choice or active price fields', () => {
  const blank = purchaseForm('');
  assert.equal(blank.field('product').value, '');
  assert.equal(blank.field('price'), undefined);
  assert.throws(blank.result, (error) => error.field === 'purchase-1-product');
});

test('purchase examples match the product and are not submitted as values', () => {
  const petrol = purchaseForm();
  assert.equal(petrol.field('price').placeholder, 'Pvz., 200');
  assert.equal(petrol.field('known-quantity').placeholder, 'Pvz., 140,5');
  assert.equal(petrol.field('price').value, '');
  assert.throws(petrol.result, /purchase-1-price: required/);

  const beer = purchaseForm('beer');
  assert.equal(beer.field('quantity').placeholder, 'Pvz., 9');
  assert.equal(beer.field('strength').placeholder, 'Pvz., 5');
  assert.equal(beer.field('known-price').placeholder, 'Pvz., 26');
  assert.equal(purchaseForm('spirits').field('strength').placeholder, 'Pvz., 40');
  assert.equal(purchaseForm('cigarettes').field('quantity').placeholder, 'Pvz., 2');
});

test('fuel reference examples follow each monthly input without replacing refined values', () => {
  const petrol = purchaseForm();
  petrol.fill('price', 30);
  assert.equal(petrol.field('known-quantity').placeholder, 'Pvz., 21,1');
  assert.equal(petrol.field('known-quantity').value, '');
  assert.equal(petrol.result().excise, 12978);
  assert.equal(petrol.result().netPrice, 16774);

  petrol.fill('known-quantity', '21,1');
  petrol.fill('price', '60,00');
  assert.equal(petrol.field('known-quantity').placeholder, 'Pvz., 42,2');
  assert.equal(petrol.field('known-quantity').value, '21,1');
  assert.equal(petrol.result().excise, 12989);
  petrol.fill('price', '');
  assert.equal(petrol.field('known-quantity').placeholder, 'Pvz., 140,5');
  petrol.fill('price', '0,01');
  assert.equal(petrol.field('known-quantity').placeholder, 'Pvz., 0,01');

  const diesel = purchaseForm('diesel');
  diesel.fill('price', 30);
  assert.equal(diesel.field('known-quantity').placeholder, 'Pvz., 19,9');
  diesel.chooseBasis('quantity');
  diesel.fill('quantity', 20);
  assert.equal(diesel.field('known-price').placeholder, 'Pvz., 30,14');
  assert.equal(diesel.field('known-price').value, '');
});

test('household bills use monthly averages and apply VAT alone', () => {
  const energy = purchaseForm('electricity');
  assert.equal(energy.field('price'), undefined);
  energy.fill('service-price', 121);
  const electricity = energy.result();
  assert.equal(electricity.price, 145200);
  assert.equal(electricity.vat, 25200);
  assert.equal(electricity.excise, 0);
  assert.equal(electricity.netPrice, 120000);

  const heat = purchaseForm('heating');
  heat.fill('service-price', 91);
  assert.equal(heat.field('service-period'), undefined);
  assert.equal(heat.result().price, 109200);
  assert.equal(heat.result().vat, 9017);
  assert.equal(heat.result().netPrice, 100183);

  const other = purchaseForm('otherService');
  other.fill('service-price', 105);
  assert.throws(other.result, (error) => error.field === 'purchase-1-vat-rate');
  other.fill('vat-rate', '5');
  assert.equal(other.result().vat, 6000);
  other.fill('vat-rate', '0');
  assert.equal(other.result().vat, 0);
});

test('2025 road diesel annualizes monthly amounts and blocks an implausibly low checkout price', () => {
  const form = purchaseForm('diesel');
  form.chooseBasis('quantity');
  form.fill('quantity', 50);
  form.fill('known-price', '1,46');
  assert.throws(form.result, (error) => error.field === 'purchase-1-known-price' && /mėnesio sumą/.test(error.message));

  form.fill('known-price', 73);
  const row = form.result();
  assert.equal(row.excise, 31176);
  assert.equal(row.vat, 15203);
  assert.equal(row.price, 87600);
  assert.equal(row.netPrice, 41221);
  assert.equal(row.missingPrice, false);
  assert.equal(row.taxExceedsPrice, false);
  assert.equal(row.estimatedTax, null);

  form.fill('known-price', '');
  const partial = form.result();
  assert.equal(partial.excise, 31176);
  assert.equal(partial.vat, 15693);
  assert.equal(partial.netPrice, 43551);
  assert.equal(partial.estimatedTax, 'vat');
});

test('expenses alone estimate petrol excise and use actual VAT without old quantity input', () => {
  const form = purchaseForm();
  form.chooseBasis('quantity');
  form.fill('quantity', 50);
  form.chooseBasis('amount');
  assert.equal(form.field('quantity'), undefined);
  form.fill('price', 50);
  const row = form.result();
  assert.equal(row.excise, 21630);
  assert.equal(row.vat, 10413);
  assert.equal(row.netPrice, 27957);
  assert.equal(row.estimatedTax, 'excise');
  assert.match(row.estimate, /35,1 l per mėnesį/);

  form.fill('known-quantity', 33);
  const refined = form.result();
  assert.equal(refined.excise, 20315);
  assert.equal(refined.vat, 10413);
  assert.equal(refined.estimatedTax, null);
});

test('printed cigarette pack price, actual price and legal floor have distinct meanings', () => {
  const form = purchaseForm('cigarettes');
  form.fill('quantity', 1);
  let row = form.result();
  assert.equal(row.excise, 3593);
  assert.equal(row.minCigarette, true);
  assert.equal(row.missingPrice, true);
  assert.equal(row.netPrice, null);

  form.fill('known-price', 5);
  row = form.result();
  assert.equal(row.excise, 3722);
  assert.equal(row.estimatedCigarette, true);

  form.fill('max-retail', 4);
  row = form.result();
  assert.equal(row.excise, 3593);
  assert.equal(row.cigarettePriceExceedsMaximum, true);
  assert.equal(row.netPrice, null);
  assert.equal(form.field('price-warning').hidden, false);

  form.fill('max-retail', '5,75');
  row = form.result();
  assert.equal(row.excise, 3947);
  assert.equal(row.cigarettePriceExceedsMaximum, false);

  form.fill('quantity', '0,5');
  form.fill('known-price', '2,88');
  row = form.result();
  assert.equal(row.excise, 1974);
  assert.equal(row.cigarettePriceExceedsMaximum, false);
});

test('beer uses exclusive ABV threshold and known reduced rate', () => {
  const standard = purchaseForm('beer');
  standard.fill('quantity', 40);
  standard.fill('strength', '0,5');
  assert.throws(standard.result, (error) => error.field === 'purchase-1-strength' && /0,5 %/.test(error.message));
  standard.fill('strength', '0,501');
  assert.equal(standard.result().excise, 2638);
  standard.fill('strength', 5);
  assert.equal(standard.result().excise, 26328);
  assert.equal(standard.result().missingPrice, true);

  const reduced = purchaseForm('beerReduced');
  reduced.fill('quantity', 40);
  reduced.fill('strength', 5);
  assert.equal(reduced.result().excise, 13164);
});

test('ethyl-alcohol and intermediate categories use their 2025 rates', () => {
  const spirits = purchaseForm('spirits');
  spirits.fill('quantity', '0,7');
  spirits.fill('strength', '1,2');
  assert.throws(spirits.result, (error) => error.field === 'purchase-1-strength' && /1,2 %/.test(error.message));
  spirits.fill('strength', 40);
  assert.equal(spirits.result().excise, 9334);

  const intermediate = purchaseForm('intermediate');
  intermediate.fill('quantity', 1);
  assert.throws(intermediate.result, /purchase-1-strength: required/);
  intermediate.fill('strength', '15');
  assert.equal(intermediate.result().excise, 3504);
  intermediate.fill('strength', '15,01');
  assert.equal(intermediate.result().excise, 4440);
  intermediate.fill('strength', '22');
  assert.equal(intermediate.result().excise, 4440);
  intermediate.fill('strength', '22,01');
  assert.throws(intermediate.result, (error) => error.field === 'purchase-1-strength' && /22 %/.test(error.message));
  intermediate.chooseBasis('amount');
  intermediate.fill('price', '10');
  assert.equal(intermediate.result().missingExcise, true);
  intermediate.fill('known-quantity', '1');
  intermediate.fill('strength', '20');
  assert.equal(intermediate.result().excise, 4440);
});

test('other goods use the monthly quantity, unit price and selected VAT rate', () => {
  const form = purchaseForm('other');
  form.fill('price', 5);
  form.fill('vat-rate', 9);
  assert.equal(form.result().vat, 495);

  form.chooseBasis('quantity');
  form.fill('quantity', '2,5');
  assert.equal(form.result().missingPrice, true);
  form.fill('unit-price', 2);
  const row = form.result();
  assert.equal(row.vat, 495);
  assert.equal(row.netPrice, 5505);
  assert.equal(row.excise, 0);
  assert.equal(row.vatOnly, true);
  form.fill('vat-rate', 21);
  assert.equal(form.result().vat, 1041);
  form.fill('vat-rate', 0);
  assert.equal(form.result().vat, 0);
  assert.equal(form.result().netPrice, 6000);
});

test('an amount alone for beer calculates VAT and leaves excise undetermined', () => {
  const form = purchaseForm('beer');
  form.chooseBasis('amount');
  form.fill('price', 20);
  const row = form.result();
  assert.equal(row.vat, 4165);
  assert.equal(row.missingExcise, true);
  assert.equal(row.estimatedTax, null);
  assert.equal(row.netPrice, null);
});

test('other purchases use their own editor and default to the standard VAT rate', () => {
  const regular = purchaseForm('');
  assert.equal(regular.field('product').children.some((group) =>
    group.children.some((option) => option.value === 'other')), false);
  const other = purchaseForm('other');
  assert.equal(other.field('product').value, 'other');
  assert.equal(other.field('vat-rate').value, '21');
  other.fill('price', 12.1);
  assert.equal(other.result().vat, 2520);
});

test('heating and hot water may be entered separately or as one bill', () => {
  const payments = [['heating', 60], ['hotWater', 20], ['heatAndWater', 80]];
  const [heat, water, combined] = payments.map(([key, payment]) => {
    const purchase = purchaseForm(key);
    purchase.fill('service-price', payment);
    return purchase.result();
  });
  assert.equal(combined.price, heat.price + water.price);
  assert.ok(Math.abs(combined.vat - (heat.vat + water.vat)) <= 1);
  assert.equal(combined.excise, 0);
});

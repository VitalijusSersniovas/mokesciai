const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'docs', 'report.js'), 'utf8');

class Element {
  constructor(tag, document) {
    this.tag = tag;
    this.document = document;
    this.children = [];
    this.events = new Map();
    this.attributes = new Map();
    this.classes = new Set();
    this.classList = {
      add: (name) => this.classes.add(name),
      remove: (name) => this.classes.delete(name),
    };
  }
  append(...nodes) {
    nodes.forEach((node) => { node.parent = this; });
    this.children.push(...nodes);
  }
  remove() {
    this.parent.children = this.parent.children.filter((child) => child !== this);
  }
  setAttribute(name, value) {
    this.attributes.set(name, value);
  }
  removeAttribute(name) {
    this.attributes.delete(name);
  }
  addEventListener(name, handler) {
    const handlers = this.events.get(name) ?? [];
    this.events.set(name, [...handlers, handler]);
  }
  dispatchEvent(event) {
    return Promise.all((this.events.get(event.type) ?? []).map((handler) => handler(event)));
  }
  click() {
    return this.dispatchEvent({ type: 'click' });
  }
  showModal() {
    this.setAttribute('open', '');
  }
  close() {
    return this.dispatchEvent({ type: 'close' });
  }
  focus() {
    this.document.activeElement = this;
  }
  select() {
    this.selected = true;
  }
  cloneNode() {
    const copy = new Element(this.tag, this.document);
    copy.className = this.className;
    copy.innerHTML = this.innerHTML;
    return copy;
  }
  find(predicate) {
    if (predicate(this)) return this;
    for (const child of this.children) {
      const found = child.find(predicate);
      if (found) return found;
    }
  }
}

function setup(navigator = {}) {
  const images = [];
  const document = {
    createElement(tag) {
      const element = new Element(tag, document);
      if (tag === 'canvas') {
        let crop;
        element.getContext = () => ({
          drawImage(image, x, y) { crop = Buffer.from(image.src + ' ' + x + ',' + y).toString('base64'); },
        });
        element.toDataURL = () => 'data:image/jpeg;base64,' + crop;
      }
      return element;
    },
    getElementById(id) { return document.head.find((element) => element.id === id); },
    execCommand() { return false; },
  };
  document.head = document.createElement('head');
  document.body = document.createElement('body');
  let printCalls = 0;
  const window = {
    setTimeout() {},
    clearTimeout() {},
    print() { printCalls += 1; },
    Image: class {
      constructor() {
        this.naturalWidth = 1536;
        this.naturalHeight = 1024;
        images.push(this);
      }
    },
  };
  const files = [];
  class FileUrl extends URL {
    static createObjectURL(file) {
      files.push(file);
      return 'blob:test/report';
    }
  }
  vm.runInNewContext(source, { document, window, navigator, URL: FileUrl, Blob, Event });
  return { document, report: window.taxReport, files, images, printCalls: () => printCalls };
}

const data = {
  year: 2025,
  example: true,
  mode: 'Privati informacija <script>alert(1)</script>',
  total: '100,00 €',
  rows: [['GPM', '67,50 €'], ['VSD', '32,40 €'], ['PSD', '0,10 €']],
  spendingYear: 2024,
  spendingGroups: [
    { name: 'Švietimas', amount: '14,60 €', rows: [['Aukštasis mokslas', '5,20 €', 'Universitetai ir <kolegijos>'], ['<Kitas papunktis>', '9,40 €']] },
    { name: 'Gynyba', amount: '6,30 €', rows: [] },
  ],
  spendingSource: {
    source: 'Eurostatas',
    url: 'https://example.org/islaidos',
  },
  comparison: {
    basis: 'Metinė suma',
    total: '100,00 €',
    items: [
      { label: 'Pienas', price: '1,22 €', source: 'Duomenys', url: 'https://example.com/?a=1&b=2', date: '2025 m.', quantity: '82 l' },
      { label: 'iPhone 17', price: '989,00 €', source: 'Duomenys', url: 'https://example.com/phone', date: '2025-09-13', quantity: '0 vnt.' },
      { label: 'Kita prekė', price: '2,00 €', source: 'Kitas šaltinis', url: 'javascript:alert(99)', date: '2025 m.', quantity: '50 vnt.' },
    ],
  },
  notes: ['Nepublikuojama pirkinių informacija.'],
  url: 'https://example.org/path?value=secret#private',
};

test('report dialog gives a direct HTML download and a separate print document', async () => {
  const { document, report, files, images, printCalls } = setup();
  report.open({ ...data, comparison: { ...data.comparison, priceChecked: '2026-11-19' } });
  const dialog = document.body.find((element) => element.tag === 'dialog');
  assert.equal(dialog.attributes.get('open'), '');
  const download = dialog.find((element) => element.textContent === 'Atsisiųsti HTML');
  assert.equal(download.attributes.get('aria-disabled'), 'true');
  assert.equal(download.href, undefined);
  assert.equal(images.length, 2);
  const preview = dialog.find((element) => element.tag === 'article');
  assert.match(preview.innerHTML, /src="\.\/media\/palyginimai-maistas\.webp"/u);
  const comparisonDates = /2025 m\. mokesčių ir įmokų suma bei kortelėje nurodyta kaina su mokesčiais\. Kainų šaltiniai patikrinti 2026-11-19\./u;
  assert.match(preview.innerHTML, comparisonDates);
  assert.match(dialog.find((element) => element.tag === 'textarea').value, comparisonDates);
  images.forEach((image) => image.onload());
  await new Promise(setImmediate);
  assert.equal(download.href, 'blob:test/report');
  assert.equal(download.download, 'mano-mokesciu-ataskaita-2025.html');
  const html = await files[0].text();
  assert.match(html, comparisonDates);
  assert.match(html, /Mokesčių ataskaita|mokesčių ataskaita/u);
  assert.match(html, /Įvertis apskaičiuotas pagal 2024 m\. faktines Lietuvos valdžios sektoriaus išlaidų proporcijas\./u);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/u);
  assert.match(html, /href="https:\/\/example.com\/\?a=1&amp;b=2"/u);
  assert.doesNotMatch(html, /href="javascript:/u);
  assert.match(html, /img-src data:/u);
  const photoSources = Array.from(html.matchAll(/src="data:image\/jpeg;base64,([^"]+)"/gu), (match) => Buffer.from(match[1], 'base64').toString());
  assert.deepEqual(photoSources, [
    './media/palyginimai-maistas.webp 0,512',
    './media/palyginimai-paslaugos.webp 0,512',
  ]);
  assert.doesNotMatch(html, /src="\.\/media\//u);
  assert.ok(html.indexOf('Ką už šią sumą galima įsigyti?') < html.indexOf('Metiniai mokesčiai ir draudimo įmokos'));

  await dialog.find((element) => element.textContent === 'Spausdinti arba išsaugoti PDF').click();
  assert.equal(printCalls(), 1);
  assert.equal(document.body.classes.has('tax-export-printing'), true);
  const printCopy = document.body.find((element) => element.classes.has('tax-report-print-copy'));
  assert.match(printCopy.innerHTML, /src="data:image\/jpeg;base64,/u);
  assert.match(printCopy.innerHTML, comparisonDates);
  await dialog.close();
  assert.equal(document.body.classes.has('tax-export-printing'), false);
  assert.equal(document.body.children.length, 0);
});

test('report remains downloadable when a sheet fails to load', async () => {
  const { document, report, files, images } = setup();
  report.open(data);
  images[0].onerror();
  images[1].onload();
  await new Promise(setImmediate);
  const html = await files[0].text();
  assert.match(html, /Dalies iliustracijų nepavyko įkelti/u);
  assert.match(html, /Pienas/u);
  assert.match(html, /iPhone 17/u);
  assert.equal(Array.from(html.matchAll(/src="data:image\/jpeg;base64,/gu)).length, 1);
  const status = document.body.find((element) => element.attributes.get('role') === 'status');
  assert.match(status.textContent, /bus visi palyginimų skaičiai/u);
});

test('new comparison illustrations, minimum needs and personal bill equivalents stay in the full report', async () => {
  const { document, report, files, images } = setup();
  const comparison = {
    ...data.comparison,
    items: [
      { ...data.comparison.items[0], label: 'Skalbyklė', photo: 9 },
      { ...data.comparison.items[0], label: 'Internetas', photo: 13 },
      { ...data.comparison.items[1], photo: 16 },
    ],
    mvpd: { quantity: '0,2 mėn.', price: '450 € / mėn.', url: 'https://example.org/minimum', source: 'Ministro įsakymas' },
    personal: [{ label: 'Tavo elektra', quantity: '2 mėn.', price: '50 € / mėn.' }],
  };
  report.open({ ...data, comparison });
  assert.deepEqual(images.map((image) => image.src), [
    './media/palyginimai-kasdiena.webp', './media/palyginimai-namai.webp',
  ]);
  images.forEach((image) => image.onload());
  await new Promise(setImmediate);
  const html = await files[0].text();
  assert.match(html, /Minimalių vartojimo poreikių dydis vienam žmogui/u);
  assert.match(html, /<strong>0,2 mėn\.<\/strong> pagal 450 € \/ mėn\./u);
  assert.match(html, /href="https:\/\/example.org\/minimum"/u);
  assert.match(html, /Tavo elektra<\/th><td>50 € \/ mėn\.<\/td><td>2 mėn\.<\/td>/u);
  assert.equal(Array.from(html.matchAll(/src="data:image\/jpeg;base64,/gu)).length, 2);

  await document.body.find((element) => element.tag === 'dialog').close();
  report.openShare({ ...data, comparison });
  const textarea = document.body.find((element) => element.tag === 'textarea');
  assert.doesNotMatch(textarea.value, /Tavo elektra|Palyginimas pagal tavo sąskaitas/u);
});

test('the highlighted purchase price and missing inputs appear in the preview, download and print', async () => {
  const { document, report, files } = setup();
  report.open({
    ...data,
    comparison: null,
    purchases: [
      { name: 'Bešvinis benzinas', net: '≈ 1 211,44 €', detail: 'Su mokesčiais 2 600,00 € · Akcizas ≈ 937,32 € · PVM 451,24 €' },
      { name: 'Vynas', net: '', detail: 'PVM neskaičiuotas', note: 'Įvesk pirkimo kainą.' },
    ],
  });
  const dialog = document.body.find((element) => element.tag === 'dialog');
  await dialog.find((element) => element.textContent === 'Spausdinti arba išsaugoti PDF').click();
  const preview = dialog.find((element) => element.tag === 'article');
  const printCopy = document.body.find((element) => element.classes.has('tax-report-print-copy'));
  for (const html of [preview.innerHTML, await files[0].text(), printCopy.innerHTML]) {
    assert.match(html, /Be PVM ir akcizo <strong>≈ 1 211,44 €<\/strong>/u);
    assert.match(html, /Su mokesčiais 2 600,00 € · Akcizas ≈ 937,32 € · PVM 451,24 €/u);
    assert.match(html, /Be PVM ir akcizo · neapskaičiuota<\/p>\s*<p>PVM neskaičiuotas<\/p>\s*<p>Įvesk pirkimo kainą\.<\/p>/u);
  }
});

test('spending groups use projected amounts and expand for print and for downloading', async () => {
  const { document, report, files } = setup();
  report.open({ ...data, comparison: null });
  const dialog = document.body.find((element) => element.tag === 'dialog');
  const preview = dialog.find((element) => element.tag === 'article');
  const printCopy = document.body.find((element) => element.classes.has('tax-report-print-copy'));
  assert.match(preview.innerHTML, /<details class="tax-report-spending-group">/u);
  assert.match(preview.innerHTML, /<span>Švietimas<\/span><strong>14,60 €<\/strong>/u);
  assert.match(preview.innerHTML, /&lt;Kitas papunktis&gt;/u);
  assert.match(preview.innerHTML, /<small class="tax-report-row-description">Universitetai ir &lt;kolegijos&gt;<\/small>/u);
  assert.doesNotMatch(preview.innerHTML, /<th scope="row">Švietimas<\/th>|<th scope="col">Išlaidų sritis<\/th>/u);
  assert.doesNotMatch(preview.innerHTML, /<span>Gynyba<\/span>/u);
  assert.match(preview.innerHTML, /href="https:\/\/example.org\/islaidos"[^>]*>Eurostatas<\/a>/u);
  assert.match(printCopy.innerHTML, /<details class="tax-report-spending-group" open>/u);
  const text = dialog.find((element) => element.tag === 'textarea').value;
  assert.match(text, /Išlaidų papunkčiai\nĮvertis apskaičiuotas pagal 2024 m\. faktines Lietuvos valdžios sektoriaus išlaidų proporcijas\.\nŠvietimas · 14,60 €\n  Aukštasis mokslas · 5,20 € \(Universitetai ir <kolegijos>\)/u);
  assert.equal(text.split('Švietimas · 14,60 €').length, 2);
  assert.match(text, /<Kitas papunktis> · 9,40 €/u);
  assert.match(text, /Eurostatas\nhttps:\/\/example.org\/islaidos/u);

  const html = await files[0].text();
  assert.match(html, /<details class="tax-report-spending-group">/u);
  const script = html.match(/<script>([\s\S]+)<\/script>/u)[1];
  const events = new Map();
  const closedGroup = { open: false };
  const openGroup = { open: true };
  vm.runInNewContext(script, {
    window: { addEventListener(name, handler) { events.set(name, handler); } },
    document: { querySelectorAll: () => [closedGroup, openGroup].filter((group) => !group.open) },
  });
  events.get('beforeprint')();
  assert.equal(closedGroup.open, true);
  events.get('afterprint')();
  assert.equal(closedGroup.open, false);
  assert.equal(openGroup.open, true);
});

test('full reports keep tax totals and omit the PSD purpose section', async () => {
  const { document, report, files } = setup();
  report.open({ ...data, comparison: null });
  const dialog = document.body.find((element) => element.tag === 'dialog');
  const preview = dialog.find((element) => element.tag === 'article');
  const printCopy = document.body.find((element) => element.classes.has('tax-report-print-copy'));
  for (const html of [preview.innerHTML, printCopy.innerHTML, await files[0].text()]) {
    assert.match(html, /<th scope="row">GPM<\/th><td>67,50 €<\/td>/u);
    assert.match(html, /<th scope="row">VSD<\/th><td>32,40 €<\/td>/u);
    assert.match(html, /<th scope="row">PSD<\/th><td>0,10 €<\/td>/u);
    assert.doesNotMatch(html, /PSD įmokos paskirtis|Į bendrą sumą įskaičiuota PSD įmoka|Draudimo paskirtis/u);
  }
  const text = dialog.find((element) => element.tag === 'textarea').value;
  assert.match(text, /PSD · 0,10 €/u);
  assert.doesNotMatch(text, /PSD įmokos paskirtis|Į bendrą sumą įskaičiuota PSD įmoka/u);
});

test('summary stays manually selectable if clipboard and device sharing fail', async () => {
  const { document, report } = setup({
    clipboard: { async writeText() { throw Error('Clipboard blocked'); } },
    async share() { throw Error('Sharing blocked'); },
  });
  report.openShare(data);
  const dialog = document.body.find((element) => element.tag === 'dialog');
  const field = dialog.find((element) => element.tag === 'textarea');
  assert.equal(field.readOnly, true);
  assert.match(field.value, /Pavyzdys pagal numatytąjį atlyginimą/u);
  assert.match(field.value, /GPM · 67,50 €\nVSD · 32,40 €\nPSD · 0,10 €/u);
  assert.match(field.value, /https:\/\/example.org\//u);
  assert.doesNotMatch(field.value, /Privati informacija|pirkinių informacija|secret|Pienas|Aukštasis mokslas|Pensijos|PSDF ataskaita|išklotinė|biudžetams|VSD ir PSD dalis bendroje sumoje/u);

  await dialog.find((element) => element.textContent === 'Dalytis per įrenginį').click();
  const status = dialog.find((element) => element.attributes.get('role') === 'status');
  assert.match(status.textContent, /nukopijuoti suvestinę/u);
  await dialog.find((element) => element.textContent === 'Kopijuoti suvestinę').click();
  assert.equal(field.selected, true);
  assert.match(status.textContent, /Tekstas pažymėtas/u);
});

test('calculation caveat accompanies the result in the preview, PDF, HTML and sharing text', async () => {
  const { document, report, files } = setup();
  const caveat = 'Daliai pirkinių PVM neapskaičiuotas. Cigarečių akcizas rodomas kaip apatinė riba. <Pastaba>';
  const scoped = { ...data, comparison: null, caveats: `  ${caveat}  ` };
  report.open(scoped);
  const dialog = document.body.find((element) => element.tag === 'dialog');
  const preview = dialog.find((element) => element.tag === 'article');
  const printCopy = document.body.find((element) => element.classes.has('tax-report-print-copy'));
  for (const markup of [preview.innerHTML, printCopy.innerHTML, await files[0].text()]) {
    assert.match(markup, /<p class="tax-report-caveat"><strong>Skaičiavimo pastaba\.<\/strong> Daliai pirkinių PVM neapskaičiuotas\. Cigarečių akcizas rodomas kaip apatinė riba\. &lt;Pastaba&gt;<\/p>/u);
    assert.doesNotMatch(markup, /<Pastaba>/u);
    assert.ok(markup.indexOf('apatinė riba') < markup.indexOf('Metiniai mokesčiai ir draudimo įmokos'));
  }
  const fullText = dialog.find((element) => element.tag === 'textarea').value;
  assert.ok(fullText.includes('Skaičiavimo pastaba. ' + caveat));
  await dialog.close();

  report.openShare(scoped);
  const summaryText = document.body.find((element) => element.tag === 'textarea').value;
  assert.ok(summaryText.includes(`Metiniai mokesčiai ir įmokos · 100,00 €\n${caveat}\nGPM · 67,50 €`));
});

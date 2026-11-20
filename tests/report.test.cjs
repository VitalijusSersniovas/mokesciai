const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'docs', 'report.js'), 'utf8');
const sharingSource = fs.readFileSync(path.join(__dirname, '..', 'docs', 'sharing.js'), 'utf8');

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
    querySelector() { return { href: 'https://example.org/' }; },
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
  vm.runInNewContext(sharingSource + '\n' + source, { document, window, navigator, URL: FileUrl, Blob, Event });
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
  const comparisonDates = /apskaičiuota metinė mokesčių ir įmokų suma bei kortelėje nurodyta kaina su mokesčiais\. Paskutinė kainos šaltinio patikra 2026-11-19\./u;
  assert.match(preview.innerHTML, comparisonDates);
  assert.match(dialog.find((element) => element.attributes.get('aria-label') === 'Ataskaitos tekstas').value, comparisonDates);
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
  assert.ok(html.indexOf('Ką už šią sumą galima įsigyti?') < html.indexOf('Tavo sumokėti mokesčiai ir draudimo įmokos per metus'));
  const footer = dialog.find((element) => element.className === 'tax-export-footer');
  assert.ok(dialog.children.indexOf(preview) < dialog.children.indexOf(footer));
  assert.equal(footer.find((element) => element.textContent === 'Atsisiųsti HTML'), download);
  assert.ok(footer.find((element) => element.textContent === 'Pasidalyti su draugu'));
  assert.ok(footer.find((element) => element.textContent === 'Ataskaitos tekstas kopijavimui'));
  assert.ok(html.indexOf('Tavo sumokėti mokesčiai ir draudimo įmokos per metus') < html.indexOf('class="print-actions"'));

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

test('additional comparison illustration sheets are available in the full report', async () => {
  const { report, files, images } = setup();
  const comparison = {
    ...data.comparison,
    items: [
      { ...data.comparison.items[0], label: 'Skalbyklė', photo: 9 },
      { ...data.comparison.items[0], label: 'Internetas', photo: 13 },
      { ...data.comparison.items[1], photo: 16 },
    ],
  };
  report.open({ ...data, comparison });
  assert.deepEqual(images.map((image) => image.src), [
    './media/palyginimai-kasdiena.webp', './media/palyginimai-namai.webp',
  ]);
  images.forEach((image) => image.onload());
  await new Promise(setImmediate);
  const html = await files[0].text();
  assert.match(html, /Skalbyklė/u);
  assert.match(html, /Internetas/u);
  assert.equal(Array.from(html.matchAll(/src="data:image\/jpeg;base64,/gu)).length, 2);
});

test('annual gross and net purchase prices are labelled in preview, download, print and text', async () => {
  const { document, report, files } = setup();
  report.open({
    ...data,
    comparison: null,
    purchases: [
      {
        name: 'Bešvinis benzinas',
        amounts: [['Iš viso per metus su mokesčiais', '240,00 €'], ['Tikra kaina be mokesčių', '≈ 112,17 €']],
        taxes: 'Akcizas ≈ 86,18 € · PVM 41,65 €',
      },
      {
        name: 'Vynas',
        amounts: [['Iš viso per metus su mokesčiais', 'Kaina neįvesta'], ['Tikra kaina be mokesčių', 'Neapskaičiuota']],
        taxes: 'PVM neskaičiuotas',
        note: 'Įvesk pirkimo kainą.',
      },
      {
        name: 'Buitinė elektra',
        amounts: [['Iš viso per metus su mokesčiais', '480,00 €'], ['Tikra kaina be mokesčių', '396,69 €']],
        taxes: 'PVM 83,31 €',
      },
    ],
  });
  const dialog = document.body.find((element) => element.tag === 'dialog');
  await dialog.find((element) => element.textContent === 'Spausdinti arba išsaugoti PDF').click();
  const preview = dialog.find((element) => element.tag === 'article');
  const printCopy = document.body.find((element) => element.classes.has('tax-report-print-copy'));
  for (const html of [preview.innerHTML, await files[0].text(), printCopy.innerHTML]) {
    assert.match(html, /<dt>Iš viso per metus su mokesčiais<\/dt><dd>240,00 €<\/dd>.*<dt>Tikra kaina be mokesčių<\/dt><dd>≈ 112,17 €<\/dd>/u);
    assert.match(html, /Akcizas ≈ 86,18 € · PVM 41,65 €/u);
    assert.match(html, /Mėnesio kiekius ir išlaidas padauginome iš 12\./u);
    assert.match(html, /<dd>Kaina neįvesta<\/dd>.*<dd>Neapskaičiuota<\/dd>/u);
    assert.match(html, /<p>PVM neskaičiuotas<\/p>\s*<p>Įvesk pirkimo kainą\.<\/p>/u);
    assert.match(html, /<dt>Tikra kaina be mokesčių<\/dt><dd>396,69 €<\/dd>/u);
  }
  const text = dialog.find((element) => element.attributes.get('aria-label') === 'Ataskaitos tekstas').value;
  assert.match(text, /Bešvinis benzinas\nIš viso per metus su mokesčiais · 240,00 €\nTikra kaina be mokesčių · ≈ 112,17 €/u);
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
  const text = dialog.find((element) => element.attributes.get('aria-label') === 'Ataskaitos tekstas').value;
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

test('reports explain the latest comparable spending year and place 2025 institutions after spending details', async () => {
  const { document, report, files } = setup();
  report.open({
    ...data, comparison: null,
    spendingPublication: {
      text: 'Lentelės atnaujinimas numatytas 2026 m. gruodžio 18 d. Išklotinės tikimasi apie 2027 m. vasarį.',
      source: 'VDA skelbimo kalendorius', url: 'https://example.org/vda',
    },
    spendingPublicationEurostat: { source: 'Eurostato grafikas', url: 'https://example.org/eurostat' },
    spendingCoverage: { text: 'Naujausi palyginami duomenys už 2024 m.', source: 'Valstybės biudžetas', url: 'https://example.org/2025' },
    defenceBudgetContext: { text: 'Gynybai numatyta 5,38 % BVP.', source: 'Gynybos planas', url: 'https://example.org/2026' },
    institutions: {
      year: 2025, population: '2 889 128',
      rows: [{ name: 'LRT', used: '79 641 982,57 €', annual: '27,57 €', monthly: '2,30 €', source: 'Vykdymo ataskaita', url: 'https://example.org/lrt' }],
    },
  });
  const dialog = document.body.find((element) => element.tag === 'dialog');
  const preview = dialog.find((element) => element.tag === 'article');
  const printCopy = document.body.find((element) => element.classes.has('tax-report-print-copy'));
  for (const markup of [preview.innerHTML, printCopy.innerHTML, await files[0].text()]) {
    assert.match(markup, /tax-report-preliminary.*Preliminarus skaičiavimas pagal įvestus duomenis/u);
    assert.match(markup, /Kada laukiama 2025 m. išklotinės\?.*2026 m. gruodžio 18 d\..*2027 m. vasarį/u);
    assert.ok(markup.includes('href="https://example.org/vda"') && markup.includes('href="https://example.org/eurostat"'));
    assert.match(markup, /Naujausi palyginami duomenys už 2024 m\..*href="https:\/\/example.org\/2025"/u);
    assert.match(markup, /Gynybai numatyta 5,38 % BVP/u);
    assert.ok(markup.indexOf('Išlaidų papunkčiai') < markup.indexOf('<h3>LRT</h3>'));
    assert.match(markup, /<strong>27,57 €<\/strong> per metus · 2,30 € per mėnesį/u);
    assert.match(markup, /Panaudota 79 641 982,57 €.*href="https:\/\/example.org\/lrt"/u);
  }
  const text = dialog.find((element) => element.attributes.get('aria-label') === 'Ataskaitos tekstas').value;
  assert.match(text, /Preliminarus skaičiavimas pagal įvestus duomenis/u);
  assert.match(text, /2026 m. gruodžio 18 d\..*2027 m. vasarį/u);
  assert.ok(text.indexOf('Išlaidų papunkčiai') < text.indexOf('LRT · 27,57 € per metus'));
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
  const text = dialog.find((element) => element.attributes.get('aria-label') === 'Ataskaitos tekstas').value;
  assert.match(text, /PSD · 0,10 €/u);
  assert.doesNotMatch(text, /PSD įmokos paskirtis|Į bendrą sumą įskaičiuota PSD įmoka/u);
});

test('summary stays manually selectable if clipboard and device sharing fail', async () => {
  const { document, report } = setup({
    clipboard: { async writeText() { throw Error('Clipboard blocked'); } },
    async share() { throw Error('Sharing blocked'); },
  });
  report.openShare({ ...data, wageEquivalent: '5,8 mėn.' });
  const dialog = document.body.find((element) => element.tag === 'dialog');
  const field = dialog.find((element) => element.tag === 'textarea');
  assert.equal(field.readOnly, true);
  assert.match(field.value, /Pavyzdys pagal numatytąjį atlyginimą/u);
  assert.match(field.value, /Bendra metinė mokesčių ir įmokų suma prilygsta 5,8 mėn. atlyginimo ant popieriaus/u);
  assert.match(field.value, /GPM · 67,50 €\nVSD · 32,40 €\nPSD · 0,10 €/u);
  assert.match(field.value, /Preliminarus skaičiavimas pagal įvestus duomenis\./u);
  assert.doesNotMatch(field.value, /https?:\/\//u);
  assert.doesNotMatch(field.value, /Privati informacija|pirkinių informacija|secret|Pienas|Aukštasis mokslas|Pensijos|PSDF ataskaita|išklotinė|biudžetams|VSD ir PSD dalis bendroje sumoje/u);

  await dialog.find((element) => element.textContent === 'Dalytis per įrenginį').click();
  const status = dialog.find((element) => element.attributes.get('role') === 'status');
  assert.match(status.textContent, /nukopijuoti suvestinę/u);
  await dialog.find((element) => element.textContent === 'Kopijuoti suvestinę').click();
  assert.equal(field.selected, true);
  assert.match(status.textContent, /Tekstas pažymėtas/u);
});

test('the report shares a clean calculator link separately from the tax summary', async () => {
  const copied = [];
  const shared = [];
  const { document, report } = setup({
    clipboard: { async writeText(text) { copied.push(text); } },
    async share(payload) { shared.push(payload); },
  });
  const url = 'https://example.org/mokesciai/';
  document.querySelector = () => ({ href: url });
  report.open({ ...data, url: url + '?value=secret#private', comparison: null });
  const dialog = document.body.find((element) => element.tag === 'dialog');
  const section = dialog.find((element) => element.className === 'tax-export-share');
  assert.equal(section.find((element) => element.tag === 'h3').textContent, 'Pasidalyti su draugu');
  for (const [name, host, key] of [
    ['Facebook', 'www.facebook.com', 'u'], ['WhatsApp', 'wa.me', 'text'],
    ['Telegram', 't.me', 'url'], ['X', 'twitter.com', 'url'],
  ]) {
    const link = section.find((element) => element.textContent === `Dalytis „${name}“`);
    const href = new URL(link.href);
    assert.equal(href.hostname, host);
    assert.equal(href.searchParams.get(key), url);
    assert.equal(link.rel, 'noopener noreferrer');
  }
  await section.find((element) => element.textContent === 'Kopijuoti skaičiuoklės nuorodą').click();
  await section.find((element) => element.textContent === 'Kopijuoti mokesčių suvestinę').click();
  await section.find((element) => element.textContent === 'Dalytis suvestine per įrenginį').click();
  assert.equal(copied[0], url);
  assert.match(copied[1], /GPM · 67,50 €/u);
  assert.doesNotMatch(copied[1], /https?:\/\/|Privati informacija|secret|Pienas|Aukštasis mokslas/u);
  assert.equal(shared[0].text, copied[1]);
  assert.equal(shared[0].url, undefined);
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
    assert.ok(markup.indexOf('apatinė riba') < markup.indexOf('Tavo sumokėti mokesčiai ir draudimo įmokos per metus'));
  }
  const fullText = dialog.find((element) => element.attributes.get('aria-label') === 'Ataskaitos tekstas').value;
  assert.ok(fullText.includes('Skaičiavimo pastaba. ' + caveat));
  await dialog.close();

  report.openShare(scoped);
  const summaryText = document.body.find((element) => element.tag === 'textarea').value;
  assert.ok(summaryText.includes(`Metiniai mokesčiai ir įmokos · 100,00 €\n${caveat}\nGPM · 67,50 €`));
});

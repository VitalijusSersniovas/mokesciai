const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'docs', 'share-card.js'), 'utf8');

function setup() {
  const drawnText = [];
  const drawnPositions = [];
  const drawnImages = [];
  const imageUrls = [];
  const context = {
    beginPath() {}, moveTo() {}, arcTo() {}, closePath() {}, save() {}, clip() {},
    fillRect() {}, restore() {}, stroke() {}, arc() {}, fill() {}, lineTo() {},
    measureText(value) { return { width: value.length * 10 }; },
    fillText(value, x, y) { drawnText.push(value); drawnPositions.push({ value, x, y, font: this.font }); },
    drawImage(...parameters) { drawnImages.push(parameters); },
  };
  const canvas = {
    getContext() { return context; },
    toBlob(callback, mimeType) { callback(new Blob(['test'], { type: mimeType })); },
  };
  class Image {
    constructor() {
      this.naturalWidth = 1536;
      this.naturalHeight = 1024;
    }
    set src(url) {
      this.url = url;
      imageUrls.push(url);
      this.onload();
    }
  }
  const document = { createElement() { return canvas; } };
  const window = {};
  vm.runInNewContext(source, { document, window, URL, Image });
  return { canvas, makeCard: window.makeTaxShareCard, drawnText, drawnPositions, drawnImages, imageUrls };
}

const comparison = {
  total: '100,00 €',
  basis: 'Mokesčiai ir įmokos',
  personal: [{ label: 'Never share this bill', price: '9 999,00 €' }],
  items: [
    { label: 'Pienas · 2,5 % riebumo', quantity: '63,6 l', price: '1,57 € / l', date: '2025 m.', photo: 2 },
    { label: 'Elektra · Namų ūkiams', quantity: '501,5 kWh', price: '0,1994 € / kWh', date: '2025 m.', photo: 4 },
    { label: 'Dyzelinas', quantity: '66,3 l', price: '1,507 € / l', date: '2025 m.', photo: 3 },
    { label: 'Danties plombavimas · Helio plomba', quantity: '1 vnt.', price: '60,00 € / vnt.', date: '2025 m.', photo: 5 },
    { label: 'Internetas', quantity: '7 mėn.', price: '12,70 € / mėn.', date: '2025 m.', photo: 13 },
  ],
};

test('PNG card maps product photos and only shows public comparison data', async () => {
  const { canvas, makeCard, drawnText, drawnImages, imageUrls } = setup();
  const blob = await makeCard({
    comparison: { ...comparison, priceChecked: '2026-11-19' },
    example: true,
    year: 2025,
    url: 'https://example.org/private?salary=secret#fragment',
    salary: 'Never share this amount',
  });

  assert.equal(blob.type, 'image/png');
  assert.equal(canvas.width, 1080);
  assert.equal(canvas.height, 1350);
  assert.deepEqual(imageUrls, ['./media/palyginimai-maistas.webp', './media/palyginimai-paslaugos.webp']);
  assert.equal(drawnImages.length, 4);
  assert.deepEqual(drawnImages.map(([image, x]) => [image.url, x]), [
    [imageUrls[0], 0], [imageUrls[1], 0], [imageUrls[0], 768], [imageUrls[1], 768],
  ]);
  const productLabels = ['Pienas', 'Elektra', 'Dyzelinas', 'Danties plombavimas'];
  assert.deepEqual(drawnText.filter((value) => productLabels.includes(value)), productLabels);
  for (const value of ['PAVYZDYS', '100,00 €', 'Metinė suma · 2025 m.', 'example.org', '63,6 l', 'Vitalijus Šeršniovas, skaičiuoklės iniciatorius']) {
    assert.ok(drawnText.includes(value));
  }
  assert.ok(drawnText.includes('Iliustraciniai palyginimai. Kainų šaltiniai patikrinti 2026-11-19.'));
  assert.doesNotMatch(drawnText.join('\n'), /private|salary|secret|Never share|Internetas/);
});

test('PNG card rejects incomplete comparison before requesting media', async () => {
  const { makeCard, imageUrls } = setup();
  await assert.rejects(makeCard({ comparison: { ...comparison, items: [] } }), /trūksta/);
  for (const photo of [undefined, -1, 16, '8']) {
    const items = comparison.items.map((item, index) => index === 2 ? { ...item, photo } : item);
    await assert.rejects(makeCard({ comparison: { ...comparison, items } }), /iliustracijos/);
  }
  assert.equal(imageUrls.length, 0);
});

test('PNG card wraps calculation caveats and keeps the month, year and attribution visible', async () => {
  const { canvas, makeCard, drawnText, drawnPositions } = setup();
  const caveats = 'Daliai pirkinių PVM neapskaičiuotas, nes trūksta galutinių kainų. Cigarečių akcizas rodomas kaip apatinė riba, kai nepateikta didžiausia mažmeninė kaina. Šių pirkinių mokesčių sumos yra dalinės.';
  await makeCard({ caveats, comparison: { ...comparison, period: 'month' }, year: 2025, url: 'https://example.org/' });
  const label = drawnText.indexOf('Skaičiavimo pastaba');
  const footer = drawnText.indexOf('Iliustraciniai palyginimai pagal nurodytas kainas.');
  assert.ok(label > drawnText.indexOf('100,00 €'));
  assert.ok(footer - label >= 4);
  assert.equal(drawnText.slice(label + 1, footer).join(' '), caveats);
  assert.ok(drawnText.includes('Mėnesio vidurkis · 2025 m.'));
  assert.ok(canvas.height > 1350);
  assert.ok(drawnPositions.slice(label + 1, footer).every(({ font }) => font.includes('23px')));
  assert.ok(drawnPositions.every(({ x, y }) => x >= 0 && x < canvas.width && y < canvas.height));
});

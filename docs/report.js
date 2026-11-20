(() => {
  "use strict";

  const brand = "Mano mokesčių euras";
  const preliminaryNotice = "Preliminarus skaičiavimas pagal įvestus duomenis.";
  const annualTaxHeading = "Tavo sumokėti mokesčiai ir draudimo įmokos per metus";
  const institutionHeading = "Kiek įstaigų išlaikymas kainuoja vienam gyventojui?";
  const htmlEntities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  const photoSheets = [
    "./media/palyginimai-maistas.webp",
    "./media/palyginimai-paslaugos.webp",
    "./media/palyginimai-kasdiena.webp",
    "./media/palyginimai-namai.webp",
  ];
  const photoIndices = new Map([
    ["Bulvės", 0],
    ["Kiaulienos nugarinė", 1],
    ["Pienas", 2],
    ["Dyzelinas", 3],
    ["Elektra", 4],
    ["Danties plombavimas", 5],
    ["iPhone 17", 6],
    ["MacBook Air", 7],
  ]);
  const photoCache = new Map();

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => htmlEntities[character]);
  }

  function resultCaveat(data) {
    return typeof data.caveats === "string" ? data.caveats.trim() : "";
  }

  function reportRows(rows) {
    return rows.map(([label, amount, description]) => {
      const detail = description ? `<small class="tax-report-row-description">${escapeHtml(description)}</small>` : "";
      return `<tr><th scope="row">${escapeHtml(label)}${detail}</th><td>${escapeHtml(amount)}</td></tr>`;
    }).join("");
  }

  function safeHttpsUrl(raw) {
    if (!raw) return null;
    try {
      const url = new URL(raw);
      return url.protocol === "https:" && !url.username && !url.password ? url : null;
    } catch {
      return null;
    }
  }

  function sourceLink(item) {
    const source = escapeHtml(item.source);
    const url = safeHttpsUrl(item.url);
    return url ? `<a href="${escapeHtml(url.href)}" target="_blank" rel="noopener noreferrer">${source}</a>` : source;
  }

  function productName(item) {
    return item.label.split(" · ", 1)[0];
  }

  function comparisonPhotoIndex(item) {
    const index = item.photo === undefined ? photoIndices.get(productName(item)) : item.photo;
    return Number.isInteger(index) && index >= 0 && index < photoSheets.length * 4 ? index : undefined;
  }

  function comparisonPhoto(item, photos) {
    const index = comparisonPhotoIndex(item);
    if (index === undefined) return "";
    const embedded = photos?.get(index);
    if (photos && !embedded) return "";
    const src = embedded ?? photoSheets[Math.floor(index / 4)];
    const css = embedded ? "" : ` class="tax-report-photo-sheet tax-report-tile-${index % 4}"`;
    return `<span class="tax-report-photo"><img${css} src="${escapeHtml(src)}" alt=""></span>`;
  }

  function comparisonCard(item, photos) {
    const label = productName(item);
    const detail = item.label.slice(label.length + 3);
    return `<li>
      ${comparisonPhoto(item, photos)}
      <div class="tax-report-product">
        <strong>${escapeHtml(item.quantity)}</strong>
        <h3>${escapeHtml(label)}</h3>
        ${detail ? `<p>${escapeHtml(detail)}</p>` : ""}
        <p class="tax-report-unit-price">${escapeHtml(item.price)}</p>
        ${item.sourceKind ? `<p class="tax-report-source">${escapeHtml(item.sourceKind)}</p>` : ""}
        <p class="tax-report-source">${sourceLink(item)} · ${escapeHtml(item.date)}</p>
      </div>
    </li>`;
  }

  function requestedPhotoIndices(data) {
    return [...new Set((data.comparison?.items ?? []).map(comparisonPhotoIndex))]
      .filter((index) => index !== undefined);
  }

  function loadPhotoSheet(sheet) {
    if (photoCache.has(sheet)) return photoCache.get(sheet);
    const pending = new Promise((resolve) => {
      if (typeof window.Image !== "function") return resolve([]);
      const image = new window.Image();
      const finish = (photos) => {
        window.clearTimeout(timeout);
        image.onload = null;
        image.onerror = null;
        resolve(photos);
      };
      const timeout = window.setTimeout(() => finish([]), 5000);
      image.onerror = () => finish([]);
      image.onload = () => {
        try {
          const sourceWidth = image.naturalWidth / 2;
          const sourceHeight = image.naturalHeight / 2;
          const canvas = document.createElement("canvas");
          canvas.width = 420;
          canvas.height = 280;
          const context = canvas.getContext("2d");
          const photos = Array.from({ length: 4 }, (_, tile) => {
            context.drawImage(
              image, sourceWidth * (tile % 2), sourceHeight * Math.floor(tile / 2), sourceWidth, sourceHeight,
              0, 0, canvas.width, canvas.height,
            );
            return canvas.toDataURL("image/jpeg", 0.87);
          });
          finish(photos);
        } catch {
          finish([]);
        }
      };
      image.src = photoSheets[sheet];
    }).then((photos) => {
      if (!photos.length) photoCache.delete(sheet);
      return photos;
    });
    photoCache.set(sheet, pending);
    return pending;
  }

  async function preparePhotos(indices) {
    const sheets = [...new Set(indices.map((index) => Math.floor(index / 4)))];
    const entries = await Promise.all(sheets.map(async (sheet) => [sheet, await loadPhotoSheet(sheet)]));
    const images = new Map(entries);
    return new Map(indices.flatMap((index) => {
      const src = images.get(Math.floor(index / 4))?.[index % 4];
      return src ? [[index, src]] : [];
    }));
  }

  function reportSpendingDetails(data, expanded) {
    const available = (data.spendingGroups ?? []).filter((group) => group.rows.length > 0);
    if (!available.length) return "";
    return `<section class="tax-report-spending-details" aria-labelledby="tax-report-spending-heading">
      <h2 id="tax-report-spending-heading">Išlaidų papunkčiai</h2>
      <p>${escapeHtml(spendingBasis(data.spendingYear))}</p>
      ${data.spendingPublication ? `<p><strong>Kada laukiama 2025 m. išklotinės?</strong> ${escapeHtml(data.spendingPublication.text)}
        ${sourceLink(data.spendingPublication)} ${data.spendingPublicationEurostat ? sourceLink(data.spendingPublicationEurostat) : ""}</p>` : ""}
      ${data.spendingCoverage ? `<p>${escapeHtml(data.spendingCoverage.text)} ${sourceLink(data.spendingCoverage)}</p>` : ""}
      ${data.defenceBudgetContext ? `<p>${escapeHtml(data.defenceBudgetContext.text)} ${sourceLink(data.defenceBudgetContext)}
        ${data.defenceBudgetSource ? sourceLink(data.defenceBudgetSource) : ""}</p>` : ""}
      <p class="tax-report-spending-help">Išskleisk sritį, kad matytum jos papunkčius.</p>
      ${available.map((group) => `<details class="tax-report-spending-group"${expanded ? " open" : ""}>
        <summary><span>${escapeHtml(group.name)}</span><strong>${escapeHtml(group.amount)}</strong></summary>
        <table aria-label="${escapeHtml(group.name)}">
          <thead><tr><th scope="col">Išlaidų papunktis</th><th scope="col">Įvertinta suma</th></tr></thead>
          <tbody>${reportRows(group.rows)}</tbody>
        </table>
      </details>`).join("")}
      ${data.spendingSource ? `<p>${sourceLink(data.spendingSource)}</p>` : ""}
    </section>`;
  }

  function spendingBasis(year) {
    return `Įvertis apskaičiuotas pagal ${year} m. faktines Lietuvos valdžios sektoriaus išlaidų proporcijas.`;
  }

  function institutionBasis(data) {
    return `${data.year} m. panaudoti asignavimai padalyti iš vidutinio tų metų Lietuvos gyventojų skaičiaus (${data.population}). Rodomi šalies vidurkiai.`;
  }

  function reportInstitutionBudgets(institutions) {
    if (!institutions?.rows.length) return "";
    return `<section aria-labelledby="tax-report-institutions-heading">
      <h2 id="tax-report-institutions-heading">${institutionHeading}</h2>
      <p>${escapeHtml(institutionBasis(institutions))}</p>
      <ul class="tax-report-institutions" role="list">
        ${institutions.rows.map((item) => `<li>
          <h3>${escapeHtml(item.name)}</h3>
          <p class="tax-report-institution-annual"><strong>${escapeHtml(item.annual)}</strong> per metus vienam gyventojui</p>
          <p>Panaudota ${escapeHtml(item.used)}. ${sourceLink(item)}</p>
        </li>`).join("")}
      </ul>
    </section>`;
  }

  function reportPurchaseDetails(purchases) {
    if (!purchases?.length) return "";
    return `<section aria-labelledby="tax-report-purchases-heading">
      <h2 id="tax-report-purchases-heading">Metinės sumos pagal prekę ar paslaugą</h2>
      <p>Mėnesio kiekius ir išlaidas padauginome iš 12. Kaina be mokesčių gauta atėmus apskaičiuotą PVM ir taikomą akcizą.</p>
      <ul class="tax-report-purchases" role="list">
        ${purchases.map((item) => `<li>
          <h3>${escapeHtml(item.name)}</h3>
          <dl class="tax-report-purchase-amounts">
            ${item.amounts.map(([label, amount]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(amount)}</dd></div>`).join("")}
          </dl>
          <p>${escapeHtml(item.taxes)}</p>
          ${item.note ? `<p>${escapeHtml(item.note)}</p>` : ""}
        </li>`).join("")}
      </ul>
    </section>`;
  }

  function comparisonBasis(data) {
    const date = data.comparison?.priceChecked;
    const basis = "Kiekvienam palyginimui naudojama apskaičiuota metinė mokesčių ir įmokų suma bei kortelėje nurodyta kaina su mokesčiais.";
    return date ? `${basis} Paskutinė kainos šaltinio patikra ${date}.` : basis;
  }

  function reportContent(data, photos, expandedSpending = false) {
    const caveat = resultCaveat(data);
    const comparisonSection = data.comparison?.items?.length
      ? `<section aria-label="Perkamosios galios palyginimas">
           <h2>Ką už šią sumą galima įsigyti?</h2>
           <p>${escapeHtml(comparisonBasis(data))}</p>
           <ul class="tax-report-products" role="list">${data.comparison.items.map((item) => comparisonCard(item, photos)).join("")}</ul>
           <p class="tax-report-picture-credit">${photos && photos.size < requestedPhotoIndices(data).length ? "Dalies iliustracijų nepavyko įkelti." : "Prekių ir paslaugų vaizdai iliustraciniai, sukurti DI."}</p>
           <p class="tax-report-picture-credit">${escapeHtml(data.comparison.basis)} · <strong>${escapeHtml(data.comparison.total)}</strong></p>
         </section>`
      : "";
    const notesSection = data.notes.length
      ? `<section aria-label="Pastabos">
           <h2>Apie skaičiavimą</h2>
           <ul>${data.notes.map((note) => `<li>${escapeHtml(note)}</li>`).join("")}</ul>
         </section>`
      : "";
    return `
      <header>
        <div class="tax-report-brand">${brand}</div>
        <h1>${escapeHtml(data.year)} m. mokesčių ataskaita</h1>
        <p class="tax-report-preliminary"><strong>${preliminaryNotice}</strong></p>
        <p>${escapeHtml(data.mode)}</p>
        ${data.yearContext ? `<p class="tax-report-year-context">${escapeHtml(data.yearContext)}</p>` : ""}
        ${caveat ? `<p class="tax-report-caveat"><strong>Skaičiavimo pastaba.</strong> ${escapeHtml(caveat)}</p>` : ""}
      </header>
      ${comparisonSection}
      <section aria-labelledby="tax-report-annual-tax-heading">
        <h2 id="tax-report-annual-tax-heading">${annualTaxHeading}</h2>
        <div class="tax-report-amount"><span>Bendra suma</span><strong>${escapeHtml(data.total)}</strong></div>
        <table>
          <thead><tr><th scope="col">Mokestis arba įmoka</th><th scope="col">Suma</th></tr></thead>
          <tbody>${reportRows(data.rows)}</tbody>
        </table>
      </section>
      ${reportPurchaseDetails(data.purchases)}
      ${reportSpendingDetails(data, expandedSpending)}
      ${reportInstitutionBudgets(data.institutions)}
      ${notesSection}`;
  }

  const contentStyles = `
    .tax-report-document { color: #18283c; background: #fff; line-height: 1.45; }
    .tax-report-document header { padding-bottom: 16px; border-bottom: 1px solid #dce3e1; }
    .tax-report-brand { color: #0b5b50; font-weight: 750; }
    .tax-report-document h1, .tax-report-document h2, .tax-report-document p { margin: 0; }
    .tax-report-document h1 { font-size: clamp(1.62rem, 5vw, 2.45rem); letter-spacing: -.045em; margin-top: 10px; line-height: 1.12; }
    .tax-report-document h2 { font-size: 1.13rem; line-height: 1.3; letter-spacing: -.015em; }
    .tax-report-document p { color: #435467; }
    .tax-report-document h1 + p, .tax-report-document h2 + p { margin-top: 6px; }
    .tax-report-document .tax-report-year-context { margin-top: 5px; }
    .tax-report-document .tax-report-preliminary { margin-block: 9px 7px; padding: 7px 10px; border-radius: 6px; background: #e9f4ef; color: #123f38; }
    .tax-report-document .tax-report-caveat { margin-top: 12px; padding: 10px 12px; border-left: 3px solid #9b592f; background: #fff0db; color: #633b24; overflow-wrap: anywhere; }
    .tax-report-amount { margin-top: 16px; padding: 12px 15px; border: 1px solid #cadfd6; border-radius: 10px; background: #e9f4ef; color: #123f38; }
    .tax-report-amount span { display: block; font-size: .8rem; font-weight: 700; }
    .tax-report-amount strong { display: block; font-size: 2rem; letter-spacing: -.04em; line-height: 1.15; }
    .tax-report-document section { margin-top: 19px; }
    .tax-report-document table { width: 100%; margin-top: 7px; border-collapse: collapse; font-variant-numeric: tabular-nums; font-size: .89rem; }
    .tax-report-document th, .tax-report-document td { padding: 7px 6px 7px 0; border-bottom: 1px solid #dce3e1; text-align: left; vertical-align: top; }
    .tax-report-document th { font-weight: 650; }
    .tax-report-document thead th { color: #435467; font-size: .77rem; }
    .tax-report-document th:last-child, .tax-report-document td:last-child { text-align: right; }
    .tax-report-document td:last-child { white-space: nowrap; }
    .tax-report-document ul { padding-left: 20px; margin: 7px 0 0; color: #435467; }
    .tax-report-document li { margin: 3px 0; }
    .tax-report-document .tax-report-purchases { list-style: none; padding: 0; }
    .tax-report-purchases li { margin: 0; padding-block: 9px; border-bottom: 1px solid #dce3e1; break-inside: avoid; }
    .tax-report-purchases h3 { margin: 0 0 4px; font-size: .95rem; }
    .tax-report-purchases p { font-size: .85rem; }
    .tax-report-purchase-amounts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; margin: 5px 0; }
    .tax-report-purchase-amounts > div { display: grid; align-content: space-between; gap: 3px; min-width: 0; padding: 6px 9px; border: 1px solid #dce7e2; border-radius: 7px; background: #f6f8f5; }
    .tax-report-purchase-amounts > div + div { border-color: #cfe2d7; background: #eaf4ee; }
    .tax-report-purchase-amounts dt { color: #435467; font-size: .78rem; }
    .tax-report-purchase-amounts dd { margin: 0; font-size: 1.05rem; font-weight: 750; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
    .tax-report-purchase-amounts > div + div dd { color: #0b5b50; }
    .tax-report-document .tax-report-products {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 9px;
      list-style: none;
      margin-top: 11px;
      padding: 0;
    }
    .tax-report-products li {
      margin: 0;
      min-width: 0;
      overflow: hidden;
      background: #f8faf7;
      border: 1px solid #d5e2d9;
      border-radius: 9px;
      break-inside: avoid;
    }
    .tax-report-photo { display: block; position: relative; overflow: hidden; aspect-ratio: 3 / 2; }
    .tax-report-photo img { display: block; width: 100%; height: 100%; object-fit: cover; }
    .tax-report-photo img.tax-report-photo-sheet { position: absolute; inset: 0 auto auto 0; width: 200%; height: 200%; max-width: none; }
    .tax-report-tile-1 { transform: translateX(-50%); }
    .tax-report-tile-2 { transform: translateY(-50%); }
    .tax-report-tile-3 { transform: translate(-50%, -50%); }
    .tax-report-product { padding: 8px; overflow-wrap: anywhere; }
    .tax-report-product strong { display: block; margin-bottom: 4px; color: #0b5b50; font-size: 1.14rem; letter-spacing: -.025em; line-height: 1.15; }
    .tax-report-product h3 { color: #18283c; margin: 0; font-size: .85rem; line-height: 1.18; }
    .tax-report-product p { margin-top: 3px; font-size: .72rem; line-height: 1.25; }
    .tax-report-product .tax-report-unit-price { color: #274840; font-weight: 700; }
    .tax-report-product .tax-report-source, .tax-report-document .tax-report-picture-credit { color: #435467; font-size: .68rem; }
    .tax-report-document .tax-report-picture-credit { margin-top: 5px; }
    .tax-report-spending-details { margin-block: 16px 10px; }
    .tax-report-document .tax-report-spending-details > p { margin-block: 4px 8px; font-size: .82rem; }
    .tax-report-spending-group { padding-inline: 9px; background: #f8faf7; border: 1px solid #d5e2d9; border-radius: 8px; }
    .tax-report-spending-group + .tax-report-spending-group { margin-top: 5px; }
    .tax-report-spending-group summary { display: list-item; list-style: revert; cursor: pointer; min-height: 0; padding-block: 7px; line-height: 1.4; font-size: .86rem; overflow-wrap: anywhere; }
    .tax-report-spending-group summary::-webkit-details-marker { display: inline; }
    .tax-report-spending-group summary strong { margin-left: 7px; white-space: nowrap; font-variant-numeric: tabular-nums; }
    .tax-report-spending-group table { margin-top: 1px; margin-bottom: 6px; }
    .tax-report-row-description { display: block; margin-top: 2px; color: #435467; font-size: .78rem; font-weight: 400; }
    .tax-report-document .tax-report-institutions { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 182px), 1fr)); gap: 8px; list-style: none; padding: 0; margin-top: 10px; font-size: .85rem; }
    .tax-report-institutions li { display: grid; align-content: start; gap: 4px; margin: 0; padding: 10px 12px; border: 1px solid #dce3e1; border-radius: 8px; break-inside: avoid; }
    .tax-report-institutions li:first-child { grid-column: 1 / -1; border-color: #c1ddcf; background: #eaf4ee; }
    .tax-report-institutions h3 { margin: 0 0 3px; font-size: .94rem; }
    .tax-report-institution-annual strong { color: #0b5b50; font-size: 1.3rem; font-variant-numeric: tabular-nums; }
    .tax-report-institutions li:first-child .tax-report-institution-annual strong { font-size: 1.8rem; }
    .tax-report-institutions a { overflow-wrap: anywhere; }
    @media screen and (max-width: 560px) {
      .tax-report-document .tax-report-products { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    @media print {
      @page { margin: 15mm; }
      .tax-report-document, .tax-report-amount { background: #fff; }
      .tax-report-document h1, .tax-report-document h2, .tax-report-document p { break-after: avoid; }
      .tax-report-document header, .tax-report-document tr, .tax-report-amount { break-inside: avoid; }
      .tax-report-products li { background: #fff; }
      .tax-report-spending-group { background: #fff; padding-inline: 0; border: 0; border-top: 1px solid #d5e2d9; border-radius: 0; }
      .tax-report-spending-group summary { display: block; break-after: avoid; }
      .tax-report-spending-help { display: none; }
      .tax-report-document .tax-report-institutions { display: block; }
      .tax-report-institutions li + li { margin-top: 6px; }
    }
  `;

  function reportHtml(data, photos) {
    return `<!doctype html>
<html lang="lt">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
  <title>${escapeHtml(data.year)} m. mokesčių ataskaita</title>
  <style>
    * { box-sizing: border-box; }
    html { color-scheme: light; background: #f5f5ef; }
    body { margin: 0; font: 16px/1.5 system-ui, sans-serif; }
    main { max-width: 760px; padding: clamp(18px, 5vw, 42px); border: 1px solid #dce3e1; border-radius: 16px; margin: 18px auto; }
    .print-actions { display: flex; justify-content: flex-end; margin-top: 18px; }
    button { background: #0b5b50; border: 0; border-radius: 8px; color: #fff; cursor: pointer; padding: 9px 12px; font: 700 .82rem system-ui, sans-serif; }
    button:focus-visible { outline: 3px solid #127064; outline-offset: 3px; }
    ${contentStyles}
    @media (max-width: 800px) { main { margin: 10px; } }
    @media print { html { background: #fff; } main { margin: 0; padding: 0; max-width: none; border: 0; } .print-actions { display: none; } }
  </style>
</head>
<body>
  <main class="tax-report-document">
    ${reportContent(data, photos)}
    <div class="print-actions"><button type="button" onclick="window.print()">Spausdinti arba išsaugoti PDF</button></div>
  </main>
  <script>
    let collapsedGroups = [];
    window.addEventListener("beforeprint", () => {
      collapsedGroups = Array.from(document.querySelectorAll(".tax-report-spending-group:not([open])"));
      collapsedGroups.forEach((group) => { group.open = true; });
    });
    window.addEventListener("afterprint", () => {
      collapsedGroups.forEach((group) => { group.open = false; });
      collapsedGroups = [];
    });
  </script>
</body>
</html>`;
  }

  function safeShareUrl(raw) {
    const canonical = safeHttpsUrl(document.querySelector?.('link[rel="canonical"]')?.href);
    if (canonical) return canonical.origin + canonical.pathname;
    const url = safeHttpsUrl(raw);
    return url ? url.origin + "/" : "";
  }

  function summaryText(data) {
    return [
      `${brand} · ${data.year} m.`,
      preliminaryNotice,
      data.example ? "Pavyzdys pagal numatytąjį atlyginimą." : "",
      `Metiniai mokesčiai ir įmokos · ${data.total}`,
      resultCaveat(data),
      data.wageEquivalent ? "Bendra metinė mokesčių ir įmokų suma prilygsta " + data.wageEquivalent + " atlyginimo ant popieriaus." : "",
      ...data.rows.map(([label, amount]) => `${label} · ${amount}`),
      data.yearContext,
    ].filter(Boolean).join("\n");
  }

  function fullReportText(data) {
    const paragraph = (name, lines) => lines.length ? [name, ...lines].join("\n") : "";
    const caveat = resultCaveat(data);
    const comparison = data.comparison;
    const sourceLines = (source) => source ? [source.source, safeHttpsUrl(source.url)?.href].filter(Boolean) : [];
    const spendingDetails = (data.spendingGroups ?? []).filter((group) => group.rows.length).map((group) => [
      `${group.name} · ${group.amount}`,
      ...group.rows.map(([label, amount, description]) => `  ${label} · ${amount}${description ? ` (${description})` : ""}`),
    ].join("\n"));
    const comparisons = (comparison?.items ?? []).map((item) => {
      const url = safeHttpsUrl(item.url);
      const context = [item.price, item.source, item.date, item.sourceKind].filter(Boolean).join(", ");
      return `${item.label} · ${item.quantity} (${context})` + (url ? "\n" + url.href : "");
    });
    return [
      [brand, `${data.year} m. mokesčių ataskaita`, preliminaryNotice, data.mode, data.yearContext].filter(Boolean).join("\n"),
      caveat ? "Skaičiavimo pastaba. " + caveat : "",
      comparisons.length ? paragraph("Perkamosios galios palyginimas", [comparisonBasis(data), `${comparison.basis} · ${comparison.total}`, ...comparisons]) : "",
      paragraph(annualTaxHeading, [`Bendra suma · ${data.total}`, ...data.rows.map(([label, amount]) => `${label} · ${amount}`)]),
      paragraph("Metinės sumos pagal prekę ar paslaugą", (data.purchases ?? []).map((item) => [
        item.name, ...item.amounts.map(([label, amount]) => label + " · " + amount), item.taxes, item.note,
      ].filter(Boolean).join("\n"))),
      spendingDetails.length ? paragraph("Išlaidų papunkčiai", [
        spendingBasis(data.spendingYear),
        data.spendingPublication?.text,
        ...sourceLines(data.spendingPublication),
        ...sourceLines(data.spendingPublicationEurostat),
        data.spendingCoverage?.text,
        ...sourceLines(data.spendingCoverage),
        data.defenceBudgetContext?.text,
        ...sourceLines(data.defenceBudgetContext),
        ...sourceLines(data.defenceBudgetSource),
        ...spendingDetails,
        ...sourceLines(data.spendingSource),
      ].filter(Boolean)) : "",
      data.institutions?.rows.length ? paragraph(institutionHeading, [
        institutionBasis(data.institutions),
        ...data.institutions.rows.map((item) => [
          `${item.name} · ${item.annual} per metus vienam gyventojui`,
          `Panaudota ${item.used}.`,
          ...sourceLines(item),
        ].join("\n")),
      ]) : "",
      paragraph("Apie skaičiavimą", data.notes),
    ].filter(Boolean).join("\n\n");
  }

  function createReportFile(data, photos) {
    const html = reportHtml(data, photos);
    const file = new Blob([html], { type: "text/html;charset=utf-8" });
    const filename = `mano-mokesciu-ataskaita-${Number.isInteger(data.year) ? data.year : "metine"}.html`;
    const objectUrl = typeof URL.createObjectURL === "function" ? URL.createObjectURL(file) : null;
    return {
      filename,
      url: objectUrl ?? "data:text/html;charset=utf-8," + encodeURIComponent(html),
      release() {
        if (objectUrl) window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
      },
    };
  }

  function installDialogStyles() {
    if (document.getElementById("tax-export-styles")) return;
    const style = document.createElement("style");
    style.id = "tax-export-styles";
    style.textContent = contentStyles + `
      .tax-export-dialog { width: min(680px, calc(100% - 24px)); max-height: calc(100% - 24px); overflow: auto; padding: clamp(13px, 3vw, 23px); border: 1px solid #cdded7; border-radius: 14px; background: #fff; color: #18283c; box-shadow: 0 20px 70px #17293d44; }
      .tax-export-dialog:not([open]) { display: none; }
      .tax-export-dialog::backdrop { background: #18283c77; }
      .tax-export-dialog h2.tax-export-title { font-size: 1.24rem; margin: 0; }
      .tax-export-header, .tax-export-actions { display: flex; flex-wrap: wrap; gap: 7px; align-items: center; }
      .tax-export-header { justify-content: space-between; margin-bottom: 9px; }
      .tax-export-actions { margin-block: 12px; }
      .tax-export-actions .secondary-button, .tax-export-header .secondary-button { text-decoration: none; display: inline-grid; align-items: center; min-height: 40px; }
      .tax-export-actions a[aria-disabled="true"], .tax-export-actions button:disabled { opacity: .6; cursor: wait; }
      .tax-export-primary { background: #0b5b50 !important; border-color: #0b5b50 !important; color: #fff !important; }
      .tax-export-primary:hover { background: #084b42 !important; }
      .tax-export-help, .tax-export-status { font-size: .84rem; color: #435467; margin: 5px 0; }
      .tax-export-status { color: #0b5b50; font-weight: 650; }
      .tax-export-status:empty { display: none; }
      .tax-export-text { display: block; width: 100%; min-height: 126px; margin-block: 8px; resize: vertical; padding: 8px; font: inherit; font-size: .88rem; color: #18283c; background: #f8faf9; border: 1px solid #cdded7; border-radius: 6px; }
      .tax-export-text:focus { outline-color: #127064; }
      .tax-export-copy { border-top: 1px solid #dce3e1; padding-block: 6px; }
      .tax-export-share { margin-block: 12px; padding: 12px; border: 1px solid #cadfd6; border-radius: 10px; background: #f4faf7; }
      .tax-export-share h3 { margin: 0; font-size: .97rem; }
      .tax-export-share .tax-export-actions { margin-block: 9px 0; }
      .tax-export-share .tax-export-help ~ .tax-export-help { margin-top: 12px; }
      .tax-export-share .tax-export-text[hidden] { display: none; }
      .tax-export-share input.tax-export-text { min-height: 0; }
      .tax-export-dialog .tax-report-document { margin-top: 10px; }
      .tax-export-footer { border-top: 1px solid #dce3e1; padding-top: 12px; margin-top: 18px; }
      .tax-report-print-copy { display: none; }
      @media print {
        body.tax-export-printing > :not(.tax-report-print-copy) { display: none !important; }
        body.tax-export-printing > .tax-report-print-copy { display: block !important; overflow: visible; margin: 0; padding: 0; }
        body.tax-export-printing { margin: 0; background: #fff; }
      }
    `;
    document.head.append(style);
  }

  function makeButton(label) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "secondary-button";
    button.textContent = label;
    return button;
  }

  function makeParagraph(text, className = "tax-export-help") {
    const paragraph = document.createElement("p");
    paragraph.textContent = text;
    paragraph.className = className;
    return paragraph;
  }

  function makeDialog(title) {
    installDialogStyles();
    const active = document.activeElement;
    const dialog = document.createElement("dialog");
    dialog.className = "tax-export-dialog";
    dialog.setAttribute("aria-label", title);
    const header = document.createElement("div");
    header.className = "tax-export-header";
    const heading = document.createElement("h2");
    heading.className = "tax-export-title";
    heading.textContent = title;
    const closeButton = makeButton("Uždaryti");
    header.append(heading, closeButton);
    dialog.append(header);

    function close() {
      if (typeof dialog.close === "function") dialog.close();
      else dialog.dispatchEvent(new Event("close"));
    }

    closeButton.addEventListener("click", close);
    dialog.addEventListener("close", () => {
      dialog.remove();
      if (active?.isConnected) active.focus();
    });
    return {
      dialog,
      show() {
        document.body.append(dialog);
        if (typeof dialog.showModal === "function") dialog.showModal();
        else {
          dialog.setAttribute("role", "dialog");
          dialog.setAttribute("open", "");
          dialog.addEventListener("keydown", (event) => {
            if (event.key === "Escape") close();
          });
          closeButton.focus();
        }
      },
    };
  }

  function selectableText(text, label) {
    const field = document.createElement("textarea");
    field.className = "tax-export-text";
    field.readOnly = true;
    field.value = text;
    field.setAttribute("aria-label", label);
    return field;
  }

  async function copyText(field, status, copied = "Tekstas nukopijuotas.") {
    try {
      if (typeof navigator.clipboard?.writeText === "function") {
        await navigator.clipboard.writeText(field.value);
        status.textContent = copied;
        return;
      }
    } catch {
      // The browser may restrict clipboard access inside a preview.
    }
    field.hidden = false;
    field.focus();
    field.select();
    try {
      if (typeof document.execCommand === "function" && document.execCommand("copy")) {
        status.textContent = copied;
        return;
      }
    } catch {
      // The selected text is still available for the browser's manual Copy command.
    }
    status.textContent = "Tekstas pažymėtas. Nukopijuok jį klavišais „Ctrl+C“ arba „⌘C“. Telefone naudok teksto meniu.";
  }

  function makeActions() {
    const actions = document.createElement("div");
    actions.className = "tax-export-actions";
    const status = makeParagraph("", "tax-export-status");
    status.setAttribute("role", "status");
    return { actions, status };
  }

  function makeSummaryShare(field, status, label) {
    if (typeof navigator.share !== "function") return null;
    const share = makeButton(label);
    share.addEventListener("click", async () => {
      try {
        await navigator.share({ title: brand, text: field.value });
        status.textContent = "Suvestinė perduota įrenginio dalijimosi funkcijai.";
      } catch (error) {
        if (error?.name === "AbortError") {
          status.textContent = "Dalijimasis atšauktas. Gali nukopijuoti suvestinę.";
          return;
        }
        field.hidden = false;
        status.textContent = "Gali nukopijuoti suvestinę iš teksto lauko.";
      }
    });
    return share;
  }

  function reportSharing(data) {
    const url = safeShareUrl(data.url);
    const section = document.createElement("section");
    section.className = "tax-export-share";
    section.setAttribute("aria-labelledby", "tax-export-share-heading");
    const heading = document.createElement("h3");
    heading.id = "tax-export-share-heading";
    heading.textContent = "Pasidalyti su draugu";
    const { actions, status } = makeActions();
    section.append(heading);
    if (url) {
      const linkField = document.createElement("input");
      linkField.className = "tax-export-text";
      linkField.type = "url";
      linkField.readOnly = true;
      linkField.hidden = true;
      linkField.value = url;
      linkField.setAttribute("aria-label", "Skaičiuoklės nuoroda");
      const copyLink = makeButton("Kopijuoti skaičiuoklės nuorodą");
      copyLink.addEventListener("click", () => copyText(linkField, status, "Skaičiuoklės nuoroda nukopijuota."));
      const linkActions = document.createElement("div");
      linkActions.className = "tax-export-actions";
      linkActions.append(copyLink, ...calculatorSocialPlatforms.map((platform) => makeCalculatorSocialLink(url, platform)));
      section.append(makeParagraph("Nuoroda atveria skaičiuoklę."), linkActions, linkField);
    }
    const summary = selectableText(summaryText(data), "Mokesčių suvestinė dalijimuisi");
    summary.hidden = true;
    const copySummary = makeButton("Kopijuoti mokesčių suvestinę");
    copySummary.addEventListener("click", () => copyText(summary, status, "Mokesčių suvestinė nukopijuota."));
    actions.append(copySummary);
    const share = makeSummaryShare(summary, status, "Dalytis suvestine per įrenginį");
    if (share) actions.append(share);
    section.append(makeParagraph("Suvestinė yra tekstas su tavo metinėmis mokesčių sumomis."), actions, summary, status);
    return section;
  }

  function open(data) {
    const { dialog, show } = makeDialog("Ataskaitos peržiūra");
    const { actions, status } = makeActions();
    const print = makeButton("Spausdinti arba išsaugoti PDF");
    print.classList.add("tax-export-primary");
    const download = document.createElement("a");
    download.className = "secondary-button";
    download.textContent = "Atsisiųsti HTML";
    const newTab = document.createElement("a");
    newTab.className = "secondary-button";
    newTab.target = "_blank";
    newTab.rel = "noopener noreferrer";
    newTab.textContent = "Atidaryti naujame skirtuke";
    actions.append(print, download, newTab);

    const copy = document.createElement("details");
    copy.className = "tax-export-copy";
    const copyTitle = document.createElement("summary");
    copyTitle.textContent = "Ataskaitos tekstas kopijavimui";
    const textField = selectableText(fullReportText(data), "Ataskaitos tekstas");
    const copyButton = makeButton("Kopijuoti ataskaitos tekstą");
    copyButton.addEventListener("click", () => copyText(textField, status));
    copy.append(copyTitle, textField, copyButton);

    const preview = document.createElement("article");
    preview.className = "tax-report-document";
    preview.innerHTML = reportContent(data);
    const printCopy = preview.cloneNode(false);
    printCopy.classList.add("tax-report-print-copy");
    printCopy.innerHTML = reportContent(data, undefined, true);

    let file;
    let closed = false;
    print.addEventListener("click", () => window.print());
    dialog.addEventListener("close", () => {
      closed = true;
      printCopy.remove();
      document.body.classList.remove("tax-export-printing");
      file?.release();
    });
    const footer = document.createElement("footer");
    footer.className = "tax-export-footer";
    footer.append(
      makeParagraph("Norėdamas išsaugoti PDF, spausdinimo lange pasirink PDF formatą."),
      actions, status, reportSharing(data), copy,
    );
    dialog.append(preview, footer);
    document.body.append(printCopy);
    show();
    document.body.classList.add("tax-export-printing");

    const indices = requestedPhotoIndices(data);
    function prepareDownload(photos) {
      if (closed) return;
      printCopy.innerHTML = reportContent(data, photos, true);
      file = createReportFile(data, photos);
      download.href = file.url;
      download.download = file.filename;
      newTab.href = file.url;
      download.removeAttribute("aria-disabled");
      newTab.removeAttribute("aria-disabled");
      print.disabled = false;
      status.textContent = photos.size < indices.length ? "Dalies iliustracijų nepavyko įkelti. Išsaugomoje ataskaitoje bus visi palyginimų skaičiai." : "";
    }

    if (!indices.length) {
      prepareDownload(new Map());
      return;
    }
    download.setAttribute("aria-disabled", "true");
    newTab.setAttribute("aria-disabled", "true");
    print.disabled = true;
    status.textContent = "Ruošiami ataskaitos vaizdai…";
    preparePhotos(indices).then(prepareDownload);
  }

  function openShare(data) {
    const { dialog, show } = makeDialog("Dalytis suvestine");
    const field = selectableText(summaryText(data), "Mokesčių suvestinės tekstas");
    const { actions, status } = makeActions();
    const copy = makeButton("Kopijuoti suvestinę");
    copy.classList.add("tax-export-primary");
    copy.addEventListener("click", () => copyText(field, status));
    actions.append(copy);
    const share = makeSummaryShare(field, status, "Dalytis per įrenginį");
    if (share) actions.append(share);
    dialog.append(
      makeParagraph("Suvestinėje pateikiamos metinės mokesčių sumos pagal jų rūšį. Tekstą gali pažymėti ir nukopijuoti."),
      field, actions, status,
    );
    show();
  }

  window.taxReport = { open, openShare };
})();

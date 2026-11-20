(() => {
  "use strict";

  const format = { width: 1080, height: 1350, margin: 54, gap: 20 };
  const caveatStyle = { top: 1178, inset: 22, size: 23, lineHeight: 30 };
  const colors = {
    background: "#f5f3e9",
    white: "#fffef9",
    ink: "#162e28",
    muted: "#476158",
    teal: "#075545",
    lightTeal: "#dcece2",
    border: "#d5e2d9",
    caveatBackground: "#fff0db",
    caveatInk: "#633b24",
  };
  const sheets = [
    "./media/palyginimai-maistas.webp",
    "./media/palyginimai-paslaugos.webp",
    "./media/palyginimai-kasdiena.webp",
    "./media/palyginimai-namai.webp",
  ];

  function roundedRect(context, x, y, width, height, radius) {
    context.beginPath();
    context.moveTo(x + radius, y);
    context.arcTo(x + width, y, x + width, y + height, radius);
    context.arcTo(x + width, y + height, x, y + height, radius);
    context.arcTo(x, y + height, x, y, radius);
    context.arcTo(x, y, x + width, y, radius);
    context.closePath();
  }

  function canvasFont(weight, size) {
    return `${weight} ${size}px Arial, "DejaVu Sans", sans-serif`;
  }

  function type(context, value, x, y, size, color, { weight = 600, maxWidth = Infinity, align = "left" } = {}) {
    context.textAlign = align;
    context.fillStyle = color;
    context.font = canvasFont(weight, size);
    const width = context.measureText(value).width;
    if (width > maxWidth) {
      context.font = canvasFont(weight, Math.max(1, Math.floor(size * maxWidth / width)));
    }
    context.fillText(value, x, y);
  }

  function layoutCaveat(context, value) {
    const words = typeof value === "string" ? value.match(/\S+/gu) : null;
    if (!words) return null;
    const maxWidth = format.width - 2 * (format.margin + caveatStyle.inset);
    context.font = canvasFont(600, caveatStyle.size);
    const lines = [];
    let current = "";
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (current && context.measureText(next).width > maxWidth) {
        lines.push(current);
        current = word;
      } else {
        current = next;
      }
    }
    lines.push(current);
    const height = 51 + lines.length * caveatStyle.lineHeight;
    return { lines, maxWidth, height, offset: height + 10 };
  }

  function loadSheet(url) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Nepavyko įkelti rezultato kortelės vaizdų."));
      image.src = url;
    });
  }

  function drawSheetTile(context, image, product, x, y, width, height) {
    const tileWidth = image.naturalWidth / 2;
    const tileHeight = image.naturalHeight / 2;
    const scale = Math.max(width / tileWidth, height / tileHeight);
    const sourceWidth = width / scale;
    const sourceHeight = height / scale;
    const sourceX = (product.tile % 2) * tileWidth + (tileWidth - sourceWidth) / 2;
    const sourceY = Math.floor(product.tile / 2) * tileHeight + (tileHeight - sourceHeight) * (product.focusY ?? 0.5);
    context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
  }

  function drawProduct(context, image, product, index) {
    const width = (format.width - 2 * format.margin - format.gap) / 2;
    const height = 314;
    const photoHeight = 180;
    const x = format.margin + (index % 2) * (width + format.gap);
    const y = 317 + Math.floor(index / 2) * (height + format.gap);
    context.save();
    roundedRect(context, x, y, width, height, 23);
    context.clip();
    context.fillStyle = colors.white;
    context.fillRect(x, y, width, height);
    drawSheetTile(context, image, product, x, y, width, photoHeight);
    context.restore();

    roundedRect(context, x, y, width, height, 23);
    context.lineWidth = 2;
    context.strokeStyle = colors.border;
    context.stroke();

    const inset = x + 20;
    type(context, product.label, inset, y + 215, 27, colors.ink, { weight: 700, maxWidth: width - 40 });
    type(context, product.quantity, inset, y + 270, 49, colors.teal, { weight: 800, maxWidth: width - 40 });
    type(context, [product.price, product.date].filter(Boolean).join(" · "), inset, y + 298, 17, colors.muted, { weight: 500, maxWidth: width - 40 });
  }

  function drawHeading(context, example) {
    const x = format.margin;
    context.fillStyle = colors.lightTeal;
    context.beginPath();
    context.arc(1057, 12, 279, 0, Math.PI * 2);
    context.fill();

    roundedRect(context, x, 47, 45, 45, 11);
    context.fillStyle = colors.teal;
    context.fill();
    type(context, "€", x + 23, 79, 31, colors.white, { weight: 800, align: "center" });
    type(context, "Mano mokesčių euras", x + 60, 78, 25, colors.ink, { weight: 700 });
    type(context, example ? "PAVYZDYS" : "PRELIMINARUS REZULTATAS", format.width - x, 78, 17, colors.teal, { weight: 800, align: "right" });
    type(context, "Ką už šią sumą", x, 179, 72, colors.ink, { weight: 800 });
    type(context, "galima įsigyti?", x, 251, 72, colors.teal, { weight: 800 });
    type(context, "Kiekvienam palyginimui naudojama visa mokesčių ir įmokų suma.", x, 289, 23, colors.muted, { weight: 500 });
  }

  function publicHost(value) {
    if (!value) return "";
    try {
      const url = new URL(value);
      if (url.protocol !== "https:" || url.username || url.password) return "";
      const canonical = document.querySelector?.('link[rel="canonical"]')?.href;
      return url.hostname + (url.href === canonical ? url.pathname.replace(/\/$/, "") : "");
    } catch {
      return "";
    }
  }

  function drawCaveat(context, caveat) {
    const x = format.margin;
    const width = format.width - 2 * x;
    const { top, inset, size, lineHeight } = caveatStyle;
    roundedRect(context, x, top, width, caveat.height, 17);
    context.fillStyle = colors.caveatBackground;
    context.fill();
    type(context, "Skaičiavimo pastaba", x + inset, top + 28, 21, colors.caveatInk, { weight: 800 });
    caveat.lines.forEach((line, index) => {
      type(context, line, x + inset, top + 57 + index * lineHeight, size, colors.caveatInk, { maxWidth: caveat.maxWidth });
    });
  }

  function drawTotal(context, comparison, url, year, caveat) {
    const x = format.margin;
    const width = format.width - 2 * x;
    roundedRect(context, x, 990, width, 169, 25);
    context.fillStyle = colors.teal;
    context.fill();
    const period = comparison.period === "month" ? "Mėnesio vidurkis" : "Metinė suma";
    const title = Number.isInteger(year) ? `${period} · ${year} m.` : period;
    type(context, title, x + 28, 1037, 24, colors.lightTeal, { weight: 700 });
    type(context, comparison.basis, x + 28, 1070, 20, colors.lightTeal, { weight: 500 });
    type(context, comparison.total, x + 28, 1130, 58, colors.white, { weight: 800, maxWidth: width - 56 });

    if (caveat) drawCaveat(context, caveat);
    const footerOffset = caveat?.offset ?? 0;
    const priceNote = comparison.priceChecked
      ? `Iliustraciniai palyginimai. Kainų šaltiniai patikrinti ${comparison.priceChecked}.`
      : "Iliustraciniai palyginimai pagal nurodytas kainas.";
    type(context, priceNote, x, 1201 + footerOffset, 22, colors.muted, { weight: 500, maxWidth: width });
    context.strokeStyle = colors.border;
    context.beginPath();
    context.moveTo(x, 1223 + footerOffset);
    context.lineTo(format.width - x, 1223 + footerOffset);
    context.stroke();
    const host = publicHost(url);
    if (host) type(context, host, x, 1265 + footerOffset, 26, colors.teal, { weight: 700, maxWidth: width });
    type(context, "Vitalijus Šeršniovas, skaičiuoklės iniciatorius", x, (host ? 1300 : 1265) + footerOffset, 20, colors.muted, { weight: 500 });
  }

  async function makeTaxShareCard({ example = false, comparison, url, year, caveats } = {}) {
    if (!comparison?.total || !comparison?.basis || !Array.isArray(comparison.items)) {
      throw new Error("Rezultato kortelei reikia apskaičiuotos sumos ir prekių palyginimų.");
    }
    const featured = [...comparison.items.slice(0, 4)];
    if (featured.length !== 4) {
      throw new Error("Rezultato kortelei trūksta vieno iš prekių palyginimų.");
    }
    const items = featured.map((item) => {
      if (!item?.label || !item.quantity || !Number.isInteger(item.photo) || item.photo < 0 || item.photo >= sheets.length * 4) {
        throw new Error("Rezultato kortelei trūksta palyginimo duomenų arba iliustracijos.");
      }
      return {
        label: item.shortLabel || item.label.split(" · ", 1)[0],
        quantity: item.quantity,
        price: item.price,
        date: item.date,
        sheet: Math.floor(item.photo / 4),
        tile: item.photo % 4,
        focusY: item.photo === 6 ? 0 : 0.5,
      };
    });

    const canvas = document.createElement("canvas");
    canvas.width = format.width;
    canvas.height = format.height;
    const context = canvas.getContext("2d");
    if (!context || typeof canvas.toBlob !== "function") {
      throw new Error("Ši naršyklė nepalaiko PNG kortelės kūrimo.");
    }
    const caveat = layoutCaveat(context, caveats);
    if (caveat) canvas.height += caveat.offset;
    const neededSheets = [...new Set(items.map((item) => item.sheet))];
    const images = new Map(await Promise.all(neededSheets.map(async (sheet) => [sheet, await loadSheet(sheets[sheet])])));
    context.fillStyle = colors.background;
    context.fillRect(0, 0, canvas.width, canvas.height);
    drawHeading(context, example);
    items.forEach((item, index) => drawProduct(context, images.get(item.sheet), item, index));
    drawTotal(context, comparison, url, year, caveat);

    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Nepavyko išsaugoti PNG kortelės."));
      }, "image/png");
    });
  }

  window.makeTaxShareCard = makeTaxShareCard;
})();

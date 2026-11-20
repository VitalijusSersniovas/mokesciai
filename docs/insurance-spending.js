"use strict";

const employeeVsdSource = "https://sodra.lt/wp-content/uploads/2025/08/Imoku-tarifai-draudejams-turintiems-samdomu-darbuotoju2.pdf";
const selfVsdSource = "https://sodra.lt/imoku-tarifai/imoku-tarifai-taikomi-savarankiskai-dirbantiems-asmenims";
const vsdfSource = "https://lrv.lt/media/viesa/saugykla/2026/5/mq0bPXzVC9c.pdf#page=4";
const psdfSource = "https://ligoniukasa.lrv.lt/public/canonical/1774349223/14064/2025%20m.%20PSDF%20biud%C5%BEeto%20vykdymo%20%20ataskaita.xlsx";

const pensionInsurance = "Pensijų draudimas";
const sicknessInsurance = "Ligos draudimas";
const parentalInsurance = "Motinystės, tėvystės ir vaiko priežiūros išmokos";

// 2025 m. VSD tarifo dalys šimtosiomis procentinio punkto dalimis.
const personalVsdWeights = [
  [pensionInsurance, 872],
  [sicknessInsurance, 199],
  [parentalInsurance, 181],
];

// VSDF 2025 m. biudžeto vykdymo ataskaitos sąnaudos eurais (2.1–2.7).
const vsdfExpenseWeights = [
  [pensionInsurance, 6_137_762_801],
  [sicknessInsurance, 574_109_177],
  ["Nedarbo draudimas", 541_552_528],
  [parentalInsurance, 454_907_332],
  ["Administravimas ir kitos sąnaudos", 136_295_051],
  ["Nelaimingi atsitikimai darbe ir profesinės ligos", 44_229_210],
];

// PSDF 2025 m. biudžeto vykdymo ataskaita, faktinės išlaidos,
// III.1–III.5 straipsniai, euro centais. III.6 finansuojamas iš valstybės asignavimų.
const psdfExpenseWeights = [
  ["Gydymo paslaugos", 281_286_591_141, "Gydytojai, tyrimai, gydymas ligoninėje, slauga ir reabilitacija."],
  ["Vaistai ir medicinos priemonės", 70_231_254_757, "Kompensuojami vaistai, ortopedijos priemonės ir įrangos nuoma."],
  ["Sveikatos programos ir kitos išlaidos", 22_284_727_889, "Prevencijos programos, skiepai ir kitos apmokamos paslaugos."],
  ["Draudimo administravimas ir įmokų surinkimas", 3_724_101_952],
];

function buildInsuranceBreakdown({ mode, vsd, psd, fixed = false }) {
  const reference = fixed || mode === "none";
  const byVsdRate = !reference && (mode === "wages" || mode === "self");
  const vsdTotal = reference ? 10_000 : vsd;
  const psdTotal = reference ? 10_000 : psd;
  const vsdNote = byVsdRate
    ? "2025 m. VSD tarifą sudaro 8,72 % įmokų bazės pensijų draudimui, 1,99 % ligos draudimui ir 1,81 % motinystės draudimui."
    : "Pavyzdys pagal „Sodros“ fondo 2025 m. sąnaudų proporcijas. Fondas taip pat gauna darbdavių įmokas ir valstybės biudžeto lėšas.";
  const manualNote = !reference && !byVsdRate ? " Įvestos VSD įmokos sudėtis priklauso nuo draudimo rūšies." : "";

  return [
    {
      id: "vsd",
      name: "VSD · Socialinis draudimas",
      total: vsdTotal,
      reference,
      note: vsdNote + manualNote,
      rows: insuranceRows(vsdTotal, byVsdRate ? personalVsdWeights : vsdfExpenseWeights),
      sourceName: byVsdRate ? "„Sodra“ · 2025 m. tarifai" : "„Sodra“ · 2025 m. fondo sąnaudos",
      sourceUrl: byVsdRate ? (mode === "self" ? selfVsdSource : employeeVsdSource) : vsdfSource,
    },
    {
      id: "psd",
      name: "PSD · Sveikatos draudimas",
      total: psdTotal,
      reference,
      rows: insuranceRows(psdTotal, psdfExpenseWeights),
      sourceName: "Valstybinė ligonių kasa · 2025 m. išlaidų duomenys (XLSX)",
      sourceUrl: psdfSource,
    },
  ];
}

function insuranceRows(total, weights) {
  const amounts = apportion(total, weights.map(([, weight]) => weight));
  return weights.map(([label, , detail], index) => ({ label, cents: amounts[index], detail }));
}

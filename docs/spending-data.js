"use strict";

// Eurostat gov_10a_exp, 2024, LT / S13 / TE / MIO_EUR, snapshot 2026-10-21.
// Official amounts are tenths of a million euros. Null marks an unpublished value.
// Descriptions give examples of what each group can include under UN COFOG:
// https://unstats.un.org/unsd/classifications/Econ/Download/In%20Text/M84_complete_english.pdf
const spendingYear = 2024;
const spendingSource = {
  source: "Eurostatas · 2024 m. Lietuvos valdžios sektoriaus išlaidos (COFOG)",
  url: "https://ec.europa.eu/eurostat/databrowser/view/gov_10a_exp/default/table?lang=en",
};
const spendingPublication = {
  text: "Valstybės duomenų agentūros kalendoriuje išlaidų lentelės atnaujinimas numatytas 2026 m. gruodžio 18 d. Pagal įprastą Eurostato grafiką išsamios 2025 m. išklotinės tikimasi apie 2027 m. vasarį.",
  source: "VDA · Išlaidų lentelės atnaujinimas",
  url: "https://osp.stat.gov.lt/valdzios-sektoriaus-finansai",
};
const spendingPublicationEurostat = {
  source: "Eurostatas · Skelbimo grafikas",
  url: "https://ec.europa.eu/eurostat/cache/metadata/en/gov_10a_exp_esms.htm",
};
const spendingCoverage = {
  text: "Už 2025 m. jau paskelbta bendra išlaidų suma ir gynybos išlaidos. Gynybai teko 2,28 mlrd. € (6,55 % visų valdžios sektoriaus išlaidų).",
  source: "Valstybės duomenų agentūra · 2025 m. valdžios sektoriaus išlaidos",
  url: "https://osp-rs.stat.gov.lt/rest_json/data/S7R229_M2040214/?startPeriod=2024&endPeriod=2026",
};
const defenceBudgetContext = {
  text: "2026 m. patvirtintame biudžete gynybai numatyta 5,38 % BVP, o NATO 2026 m. įvertis yra 5,33 % BVP. Išlaidų papunkčių dalys skaičiuojamos nuo visų valdžios sektoriaus išlaidų.",
  source: "NATO · 2026 m. įverčiai (3 lentelė)",
  url: "https://www.nato.int/content/dam/nato/webready/documents/finance/def-exp-2026-en.pdf#page=8",
};
const defenceBudgetSource = {
  source: "Finansų ministerija · Patvirtintas 2026 m. biudžetas",
  url: "https://finmin.lrv.lt/lt/naujienos/seimas-patvirtino-2026-2028-m-valstybes-biudzeto-projekta-qpNg/",
};

const institutionBudgetYear = 2025;
const institutionBudgetPopulation = 2_889_128;
const institutionBudgetUsed = [
  {
    name: "Bendrasis pagalbos centras (112)", used: 1_488_784_447,
    source: "PAGD biudžeto vykdymo ataskaita",
    url: "https://pagd.lrv.lt/public/canonical/1773840046/8172/PAGD%20MBVAR%2020251231.pdf#page=41",
  },
  {
    name: "LRT", used: 7_964_198_257,
    source: "LRT biudžeto vykdymo ataskaita",
    url: "https://apie.lrt.lt/api/uploads/BVA_su_audito_isvada_2025_500f22d407.pdf#page=4",
  },
  {
    name: "Seimo kanceliarija", used: 5_429_300_000,
    source: "Valstybės biudžeto vykdymas · 8 priedas",
    url: "https://finmin.lrv.lt/public/canonical/1773984051/26904/Priedas_Nr._8_VBV_2025%20m.pdf",
  },
  {
    name: "Lietuvos nacionalinis muziejus", used: 1_698_340_000,
    source: "Valstybės biudžeto vykdymas · 8 priedas",
    url: "https://finmin.lrv.lt/public/canonical/1773984051/26904/Priedas_Nr._8_VBV_2025%20m.pdf",
  },
];

function institutionBudgetRows() {
  return institutionBudgetUsed.map((item) => {
    const annualCents = item.used / institutionBudgetPopulation;
    return {
      ...item,
      used: compactMoney(item.used),
      annual: money(Math.round(annualCents)),
      monthly: money(Math.round(annualCents / 12)),
    };
  });
}

const expenditures = [
  { code: "GF10", name: "Socialinė apsauga", amount: 115958, color: "#0d6659" },
  { code: "GF07", name: "Sveikata", amount: 45489, color: "#32937d" },
  { code: "GF09", name: "Švietimas", amount: 43374, color: "#75b196" },
  { code: "GF01", name: "Bendrosios paslaugos visuomenei", amount: 28065, color: "#304e6a" },
  { code: "GF04", name: "Ekonomikos reikalai", amount: 25034, color: "#52789b" },
  { code: "GF02", name: "Gynyba", amount: 20373, color: "#7d99b3" },
  { code: "GF03", name: "Viešoji tvarka ir saugumas", amount: 12322, color: "#cd9b48" },
  { code: "GF08", name: "Poilsis, kultūra ir religija", amount: 9954, color: "#e0bc77" },
  { code: "GF06", name: "Būstas ir komunaliniai patogumai", amount: 6588, color: "#af806c" },
  { code: "GF05", name: "Aplinkos apsauga", amount: 4212, color: "#c9a897" },
];
const expenditureTotal = expenditures.reduce((total, category) => total + category.amount, 0);

const spendingSubgroups = {
  GF01: [
    ["GF0101", "Valdžios institucijos, finansų, mokesčių ir užsienio reikalai", 11734, "Seimas, Vyriausybė, mokesčių administravimas ir diplomatija"],
    ["GF0102", "Ekonominė pagalba užsieniui", 790, "Parama kitų šalių ekonominei plėtrai"],
    ["GF0103", "Bendrosios tarnybos", 5166, "Bendri valdžios IT, statistikos, archyvų ir personalo darbai"],
    ["GF0104", "Fundamentiniai tyrimai", 3238, "Naujų mokslo žinių paieška be konkretaus praktinio tikslo"],
    ["GF0105", "Bendrųjų paslaugų tyrimai ir plėtra", null, "Taikomieji bendrų valdžios paslaugų tyrimai"],
    ["GF0106", "Kitos bendrosios paslaugos", 557, "Pavyzdžiui, rinkimai, referendumai ir rinkėjų registravimas"],
    ["GF0107", "Valstybės skolos operacijos", 6580, "Skolos palūkanos ir skolinimosi išlaidos"],
    ["GF0108", "Bendrieji pervedimai tarp valdžios lygmenų", 0, "Lėšų pervedimai tarp valdžios lygmenų be konkrečios paskirties"],
  ],
  GF02: [
    ["GF0201", "Karinė gynyba", 18110, "Kariuomenė, jos aprūpinimas ir parengtis"],
    ["GF0202", "Civilinė gynyba", 68, "Gyventojų ir įstaigų pasirengimas gynybai bei pratybos"],
    ["GF0203", "Karinė pagalba užsieniui", 800, "Karinė parama kitoms šalims ir taikos palaikymo misijoms"],
    ["GF0204", "Gynybos tyrimai ir plėtra", 53, "Taikomieji gynybos tyrimai ir bandymai"],
    ["GF0205", "Kitos gynybos išlaidos", 1342, "Bendri gynybos planai, programos ir valdymas"],
  ],
  GF03: [
    ["GF0301", "Policijos paslaugos", 5278, "Policija, eismo kontrolė ir sienos apsauga"],
    ["GF0302", "Priešgaisrinė apsauga", 1805, "Ugniagesiai, gaisrų prevencija ir gelbėjimo darbai"],
    ["GF0303", "Teismai", 1888, "Bylų nagrinėjimas, teisinė pagalba ir probacija"],
    ["GF0304", "Įkalinimo įstaigos", 1237, "Kalėjimų išlaikymas ir pagalba kaliniams grįžti į visuomenę"],
    ["GF0305", "Viešosios tvarkos ir saugumo tyrimai ir plėtra", 0, "Taikomieji saugumo tyrimai ir bandymai"],
    ["GF0306", "Kitos viešosios tvarkos ir saugumo išlaidos", 2113, "Bendri viešojo saugumo planai, taisyklės ir priežiūra"],
  ],
  GF04: [
    ["GF0401", "Bendrieji ekonomikos, prekybos ir darbo reikalai", 2940, "Verslo sąlygos, prekybos reguliavimas ir užimtumo programos"],
    ["GF0402", "Žemės ūkis, miškininkystė, žvejyba ir medžioklė", 2701, "Parama ūkiams, miškų ir žuvų išteklių priežiūra"],
    ["GF0403", "Kuras ir energetika", 1636, "Elektros, šilumos ir kuro tiekimas bei reguliavimas"],
    ["GF0404", "Kasyba, gamyba ir statyba", 225, "Pramonės rėmimas, išteklių gavybos ir statybų priežiūra"],
    ["GF0405", "Transportas", 15635, "Keliai, geležinkeliai, vandens ir oro transportas"],
    ["GF0406", "Ryšiai", 222, "Paštas, telefonija ir ryšių tinklai"],
    ["GF0407", "Kitos ūkio šakos", 1275, "Mažmeninė prekyba, sandėliavimas, viešbučiai ir turizmas"],
    ["GF0408", "Ekonomikos tyrimai ir plėtra", 0, "Taikomieji ūkio šakų tyrimai ir bandymai"],
    ["GF0409", "Kitos ekonomikos išlaidos", 401, "Ūkio priemonės, nepriskirtos kitoms šios srities grupėms"],
  ],
  GF05: [
    ["GF0501", "Atliekų tvarkymas", 1907, "Atliekų surinkimas, perdirbimas ir šalinimas"],
    ["GF0502", "Nuotekų tvarkymas", 171, "Kanalizacijos tinklai ir nuotekų valymas"],
    ["GF0503", "Taršos mažinimas", 1152, "Oro, vandens, dirvožemio taršos ir triukšmo kontrolė"],
    ["GF0504", "Biologinės įvairovės ir kraštovaizdžio apsauga", 127, "Rūšių, buveinių ir gamtos vietovių apsauga"],
    ["GF0505", "Aplinkos apsaugos tyrimai ir plėtra", 2, "Taikomieji aplinkos apsaugos tyrimai ir bandymai"],
    ["GF0506", "Kitos aplinkos apsaugos išlaidos", 854, "Bendri aplinkosaugos planai, taisyklės ir priežiūra"],
  ],
  GF06: [
    ["GF0601", "Būsto plėtra", 1539, "Būstų statyba, atnaujinimas ir parama šiems darbams"],
    ["GF0602", "Bendruomenių plėtra", 3090, "Gyvenviečių, sklypų ir vietos infrastruktūros planavimas"],
    ["GF0603", "Vandens tiekimas", 94, "Vandentiekio įrengimas ir priežiūra"],
    ["GF0604", "Gatvių apšvietimas", 586, "Gatvių šviestuvų įrengimas ir priežiūra"],
    ["GF0605", "Būsto ir komunalinių paslaugų tyrimai ir plėtra", null, "Taikomieji būsto ir komunalinių paslaugų tyrimai"],
    ["GF0606", "Kitos būsto ir komunalinių paslaugų išlaidos", 1279, "Bendri būsto ir komunalinių paslaugų planai bei priežiūra"],
  ],
  GF07: [
    ["GF0701", "Medicinos produktai, priemonės ir įranga", 7172, "Vaistai, akiniai, protezai ir kitos medicinos priemonės"],
    ["GF0702", "Ambulatorinės paslaugos", 14606, "Gydytojų konsultacijos, odontologija ir tyrimai be gulėjimo ligoninėje"],
    ["GF0703", "Ligoninių paslaugos", 21766, "Gydymas ligoninėje, gimdymo ir slaugos paslaugos"],
    ["GF0704", "Visuomenės sveikatos paslaugos", 602, "Skiepijimo, ligų prevencijos ir sveikatos stebėjimo programos"],
    ["GF0705", "Sveikatos tyrimai ir plėtra", 55, "Taikomieji medicinos ir sveikatos tyrimai"],
    ["GF0706", "Kitos sveikatos išlaidos", 1287, "Sveikatos sistemos planavimas, licencijos ir priežiūra"],
  ],
  GF08: [
    ["GF0801", "Poilsio ir sporto paslaugos", 2523, "Sporto aikštynai, varžybos ir poilsio vietos"],
    ["GF0802", "Kultūros paslaugos", 6035, "Bibliotekos, muziejai, teatrai, paveldas ir renginiai"],
    ["GF0803", "Transliavimas ir leidyba", 956, "Radijo, televizijos ir leidybos rėmimas bei priežiūra"],
    ["GF0804", "Religinės ir kitos bendruomenių paslaugos", 166, "Parama religinėms ir kitoms bendruomenių organizacijoms"],
    ["GF0805", "Poilsio, kultūros ir religijos tyrimai ir plėtra", 0, "Taikomieji poilsio, kultūros ir religijos tyrimai"],
    ["GF0806", "Kitos poilsio, kultūros ir religijos išlaidos", 274, "Bendri sporto, laisvalaikio ir kultūros planai bei priežiūra"],
  ],
  GF09: [
    ["GF0901", "Ikimokyklinis, priešmokyklinis ir pradinis ugdymas", 9457, "Darželiai, priešmokyklinės grupės ir pradinės klasės"],
    ["GF0902", "Pagrindinis ir vidurinis ugdymas", 16881, "Mokymasis nuo 5 iki 12 klasės"],
    ["GF0903", "Mokymas po vidurinio ugdymo (iki aukštojo mokslo)", 1928, "Pavyzdžiui, profesinis mokymas baigus vidurinę mokyklą"],
    ["GF0904", "Aukštasis mokslas", 6552, "Kolegijų ir universitetų studijos, parama studentams"],
    ["GF0905", "Ugdymas, nepriskirtas konkrečiam lygiui", 2698, "Pavyzdžiui, suaugusiųjų mokymo kursai be išankstinio pasirengimo"],
    ["GF0906", "Pagalbinės švietimo paslaugos", 310, "Maitinimas, pavėžėjimas ir bendrabučiai"],
    ["GF0907", "Švietimo tyrimai ir plėtra", 2015, "Taikomieji švietimo tyrimai ir bandymai"],
    ["GF0908", "Kitos švietimo išlaidos", 3534, "Švietimo sistemos planavimas, taisyklės ir priežiūra"],
  ],
  GF10: [
    ["GF1001", "Liga ir negalia", 30830, "Ligos ir negalios išmokos bei pagalba kasdienybėje"],
    ["GF1002", "Senatvė", 54785, "Senatvės pensijos ir socialinė pagalba vyresniems žmonėms"],
    ["GF1003", "Našliai ir našlaičiai", 2202, "Pensijos ir kita pagalba mirus artimajam"],
    ["GF1004", "Šeima ir vaikai", 14400, "Vaiko pinigai, motinystės išmokos ir vaikų globa"],
    ["GF1005", "Nedarbas", 7770, "Nedarbo išmokos ir pagalba netekus darbo"],
    ["GF1006", "Būsto parama", 852, "Nuomos kompensacijos ir socialinis būstas"],
    ["GF1007", "Kita socialinės atskirties mažinimo parama", 3128, "Pagalba stokojantiems, pavyzdžiui, maistas ar nakvynė"],
    ["GF1008", "Socialinės apsaugos tyrimai ir plėtra", 0, "Taikomieji socialinės apsaugos tyrimai ir bandymai"],
    ["GF1009", "Kitos socialinės apsaugos išlaidos", 1991, "Socialinės apsaugos valdymas ir pagalba nelaimių aukoms"],
  ],
};

// Allocate the parent subtotal to its published subgroups. This preserves the
// total when the independent rounding of the source data differs by €0.1m.
function buildSpendingBreakdown(total) {
  const totals = apportion(total, expenditures.map((area) => area.amount));
  return expenditures.map((area, index) => {
    const groups = spendingSubgroups[area.code].slice().sort((a, b) => (b[2] ?? -1) - (a[2] ?? -1));
    const subtotal = totals[index];
    const amounts = apportion(subtotal, groups.map(([, , actual]) => actual ?? 0));
    return {
      ...area, subtotal,
      groups: groups.map(([code, name, actual, description], groupIndex) => ({
        code, name, actual, description,
        subtotal: actual === null ? null : amounts[groupIndex],
      })),
    };
  });
}

function buildGpmBreakdown(cents, year = 2025) {
  const defenceShare = Number(year) === 2026 ? 20_000 : 0;
  // 2026 m. 50,44 % savivaldybėms skaičiuojami nuo likučio, atskaičius 2 % Gynybos fondui.
  const municipalShare = defenceShare ? 494_312 : 506_400;
  const destinations = [
    ["Visų savivaldybių biudžetams", municipalShare],
    ["Valstybės biudžetui", 1_000_000 - municipalShare - defenceShare],
  ];
  if (defenceShare) destinations.push(["Valstybės gynybos fondui", defenceShare]);
  const reference = cents === null;
  const total = cents ?? 10_000;
  const amounts = apportion(total, destinations.map(([, weight]) => weight));
  const note = defenceShare
    ? "Gynybos fondui skiriama 2 % GPM, o visoms savivaldybėms kartu tenka 50,44 % likusios sumos."
    : "Pagal 2025 m. biudžeto tvarką GPM dalis apskaičiuojama visoms savivaldybėms kartu.";
  return {
    id: "gpm",
    name: "GPM · Gyventojų pajamų mokestis",
    total,
    reference,
    note: note + " Fiksuotam verslo liudijimo GPM taikoma atskira tvarka.",
    rows: destinations.map(([label, weight], index) => ({ label, cents: amounts[index], share: weight / 1_000_000 })),
    sourceName: defenceShare ? "2026 m. biudžeto patvirtinimo įstatymas" : "VMI · 2025 m. GPM paskirstymas",
    sourceUrl: defenceShare
      ? "https://www.e-tar.lt/portal/lt/legalAct/dcff3500df1711f08918e1adc7c5b1ec"
      : "https://www.vmi.lt/evmi/documents/20142/753727/NB_apzvalga_2025m%2B%281%29.pdf/b9db3445-2e7d-de44-8163-e4dd2e467107?t=1777545236783",
  };
}

"use strict";

const purchaseMonthsPerYear = 12;

(() => {
  const groups = {
    fuel: "Degalai",
    alcohol: "Alkoholis",
    tobacco: "Tabakas ir elektroninės cigaretės",
    services: "Namų ūkio ir kitos paslaugos",
  };

  const purchaseRules = {
    2025: {
      fuelPrices: { petrol: 1.423, diesel: 1.507 },
      fuelReference: "2025 m. LEA ir EK metinis vidurkis",
      reducedVat: 9,
      heatingVat: 9,
      excise: {
        petrol: 0.513, diesel: 0.5196, gas: 0.3709,
        beer: 0.1097, beerReduced: 0.05485, lightWine: 1.27, wine: 2.54,
        intermediate: 2.92, intermediateAbove15: 3.70, spirits: 0.2778,
        heated: 0.0894, liquid: 0.63, tobacco: 0.1235,
      },
      cigarettes: { specificPerPack: 1.852, minimumPerPack: 2.994 },
    },
    2026: {
      // https://www.ena.lt/Naujiena/kdk-20261120/
      fuelPrices: { petrol: 1.729, diesel: 2.171 },
      fuelReference: "LEA vidurkis (2026 m. lapkričio 20 d. iki 10 val.)",
      reducedVat: 12,
      heatingVat: 21,
      // VMI 2026 m. tarifai. Dyzelinui nuo birželio 16 d. vėl taikoma 500 €/1 000 l pastovioji dalis.
      excise: {
        petrol: 0.562, diesel: 0.5536, gas: 0.3709,
        beer: 0.1274, beerReduced: 0.0637, lightWine: 1.48, wine: 2.96,
        intermediate: 3.65, intermediateAbove15: 4.11, spirits: 0.313,
        heated: 0.1006, liquid: 1.56, tobacco: 0.1352,
      },
      cigarettes: { specificPerPack: 2.01, minimumPerPack: 3.248 },
    },
  };
  const fuelPriceFormat = new Intl.NumberFormat("lt-LT", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  const quantityFormat = new Intl.NumberFormat("lt-LT", { maximumFractionDigits: 1 });
  const amountFormat = new Intl.NumberFormat("lt-LT", { maximumFractionDigits: 2 });
  const formatFuelQuantity = (quantity) => (quantity < 0.1 ? amountFormat : quantityFormat).format(quantity);

  const products = {
    petrol: { group: "fuel", label: "Bešvinis benzinas", unit: "Litrai" },
    diesel: { group: "fuel", label: "Kelių dyzelinas", unit: "Litrai" },
    gas: { group: "fuel", label: "Suskystintos automobilių dujos", unit: "Kilogramai" },
    beer: { group: "alcohol", label: "Alus (standartinis tarifas)", unit: "Litrai", aboveStrength: 0.5 },
    beerReduced: { group: "alcohol", label: "Alus (patvirtintas sumažintas tarifas)", unit: "Litrai", aboveStrength: 0.5 },
    lightWine: { group: "alcohol", label: "Vynas ir fermentuoti gėrimai (iki 8,5 %)", unit: "Litrai" },
    wine: { group: "alcohol", label: "Vynas ir fermentuoti gėrimai virš 8,5 %", unit: "Litrai" },
    intermediate: { group: "alcohol", label: "Vermutas, portveinas ir panašūs gėrimai", unit: "Litrai", aboveStrength: 1.2, maxStrength: 22 },
    spirits: { group: "alcohol", label: "Stiprieji gėrimai (degtinė, viskis, likeris)", unit: "Litrai", aboveStrength: 1.2 },
    cigarettes: { group: "tobacco", label: "Cigaretės", unit: "Cigarečių pakeliai" },
    heated: { group: "tobacco", label: "Kaitinamasis tabakas", unit: "Tabako lazdelės" },
    liquid: { group: "tobacco", label: "Elektroninių cigarečių skystis", unit: "Mililitrai" },
    tobacco: { group: "tobacco", label: "Rūkomasis tabakas", unit: "Gramai" },
    other: { group: "other", label: "Kita prekė", unit: "Kiekis" },
  };
  const services = {
    electricity: { label: "Buitinė elektra", vat: 21, monthlyExample: 45 },
    homeGas: { label: "Buitinės gamtinės dujos", vat: 21, monthlyExample: 30 },
    coldWater: { label: "Šaltas vanduo ir nuotekos", vat: 21, monthlyExample: 20 },
    heating: { label: "Centralizuotas būsto šildymas", vatRule: "heatingVat", monthlyExample: 60 },
    hotWater: { label: "Karštas vanduo", vatRule: "heatingVat", monthlyExample: 20 },
    heatAndWater: { label: "Šildymas ir karštas vanduo (viena bendra suma)", vatRule: "heatingVat", monthlyExample: 80 },
    telecom: { label: "Internetas ir mobilusis ryšys", vat: 21, monthlyExample: 25 },
    publicTransport: { label: "Viešasis transportas reguliariais maršrutais", vatRule: "reducedVat", monthlyExample: 15 },
    otherService: { label: "Kita paslauga pagal sąskaitą", monthlyExample: 30 },
  };

  const purchaseExamples = {
    petrol: { quantity: "130", spending: "200" },
    diesel: { quantity: "130", spending: "200" },
    gas: { quantity: "65", spending: "90" },
    beer: { quantity: "9", spending: "26", strength: "5" },
    beerReduced: { quantity: "9", spending: "26", strength: "5" },
    lightWine: { quantity: "4", spending: "35" },
    wine: { quantity: "3", spending: "35" },
    intermediate: { quantity: "2", spending: "35", strength: "18" },
    spirits: { quantity: "2", spending: "52", strength: "40" },
    cigarettes: { quantity: "2", spending: "13" },
    heated: { quantity: "85", spending: "22" },
    liquid: { quantity: "9", spending: "13" },
    tobacco: { quantity: "43", spending: "22" },
    other: { quantity: "9", spending: "45" },
  };

  const productHelp = {
    diesel: "Šis tarifas skirtas įprastam kelių dyzelinui.",
    gas: "Suskystintų dujų akcizas nustatomas pagal svorį. Įvesk kiekį kilogramais.",
    beer: "Stiprumą rasi ant etiketės. Mažosios daryklos lengvatai rinkis atskirą alaus rūšį.",
    beerReduced: "Rinkis, jei žinai, kad šiai partijai taikomas sumažintas akcizas.",
    lightWine: "Natūralios fermentacijos gėrimai nuo daugiau kaip 1,2 % iki 8,5 % imtinai, pavyzdžiui, sidras.",
    wine: "Įprastas nefortifikuotas vynas arba kitas natūralios fermentacijos gėrimas.",
    intermediate: "Šiai grupei priskiriami vermutai ir kai kurie spirituoti vynai, pvz., portveinas. Įrašyk etiketėje nurodytą stiprumą iki 22 %. Tarifą pagal 15 % ribą parinksime automatiškai.",
    spirits: "Rinkis pagal gėrimo rūšį. Šiai grupei priklauso ir likeriai, kurių stiprumas gali būti mažesnis nei 22 %. Akcizui įrašyk etiketėje nurodytą stiprumą.",
    cigarettes: "1 pakelis = 20 cigarečių. Pavyzdžiui, 10 cigarečių = 0,5 pakelio.",
    other: "PVM tarifą rasi pirkimo dokumente.",
  };

  function taxForPurchase(key, monthlyQuantity, monthlyPrice, extra, vatRate, rules) {
    const product = products[key] ?? services[key];
    const pricePerLitre = rules.fuelPrices[key];
    const fuelReference = pricePerLitre
      ? "Kainos šaltinis: " + rules.fuelReference + " · " + fuelPriceFormat.format(pricePerLitre) + " €/l."
      : "";
    let estimate = "";
    let estimatedTax = null;
    if (pricePerLitre && monthlyQuantity === null) {
      monthlyQuantity = monthlyPrice / pricePerLitre;
      estimatedTax = "excise";
      estimate = "Akcizo įverčiui naudotas kiekis – apie " + formatFuelQuantity(monthlyQuantity)
        + " l per mėnesį. " + fuelReference;
    } else if (pricePerLitre && monthlyPrice === null) {
      monthlyPrice = monthlyQuantity * pricePerLitre;
      estimatedTax = "vat";
      estimate = "Išlaidos PVM įverčiui apskaičiuotos pagal vidutinę degalų kainą. " + fuelReference;
    }
    const quantity = monthlyQuantity === null ? null : monthlyQuantity * purchaseMonthsPerYear;
    const price = monthlyPrice === null ? null : monthlyPrice * purchaseMonthsPerYear;
    const vatOnly = key === "other" || Object.hasOwn(services, key);
    const missingExcise = !vatOnly && quantity === null;
    let excise = 0;
    if (!missingExcise && key === "cigarettes") {
      const maximumRetail = extra === null ? (price ?? 0) : extra * quantity;
      const { minimumPerPack, specificPerPack } = rules.cigarettes;
      excise = Math.max(minimumPerPack * quantity, specificPerPack * quantity + 0.25 * maximumRetail);
    } else if (!missingExcise && !vatOnly) {
      let exciseRate = rules.excise[key];
      if (key === "intermediate") {
        if (extra > 15) exciseRate = rules.excise.intermediateAbove15;
      } else if (product.aboveStrength !== undefined) {
        exciseRate *= extra;
      }
      excise = exciseRate * quantity;
    }
    const exciseCents = toCents(excise);
    const vatCents = price === null ? 0 : vatInPrice(price, vatRate);
    const priceCents = price === null ? null : toCents(price);
    const taxExceedsPrice = priceCents !== null && exciseCents + vatCents > priceCents;
    const cigarettePriceExceedsMaximum = key === "cigarettes" && quantity !== null && price !== null && extra !== null
      && toCents(monthlyPrice) > toCents(monthlyQuantity * extra);
    const cigaretteMinimum = key === "cigarettes" && !missingExcise && extra === null;
    return {
      name: key === "intermediate" && extra !== null
        ? product.label + " · " + extra.toLocaleString("lt-LT", { maximumFractionDigits: 15 }) + " %"
        : product.label,
      excise: exciseCents,
      vat: vatCents,
      price: priceCents,
      netPrice: priceCents === null || missingExcise || taxExceedsPrice || cigarettePriceExceedsMaximum
        ? null : priceCents - exciseCents - vatCents,
      vatOnly,
      missingPrice: price === null && vatRate > 0,
      missingExcise,
      estimate,
      estimatedTax,
      taxExceedsPrice: !estimate && taxExceedsPrice,
      cigarettePriceExceedsMaximum,
      minCigarette: cigaretteMinimum && price === null,
      estimatedCigarette: cigaretteMinimum && price !== null,
    };
  }

  function create(tag, options = {}) {
    const element = document.createElement(tag);
    Object.assign(element, options);
    return element;
  }

  function makeSelect(id, text, options) {
    const wrapper = create("div", { className: "field" });
    const label = create("label", { htmlFor: id, textContent: text });
    const select = create("select", { id });
    for (const option of options) {
      select.append(create("option", { value: option.value, textContent: option.text }));
    }
    wrapper.append(label, select);
    return { wrapper, label, input: select };
  }

  function makeInput(id, text, { currency = false, example } = {}) {
    const wrapper = create("div", { className: "field" });
    const label = create("label", { htmlFor: id, textContent: text });
    const input = create("input", {
      id,
      type: "text",
      inputMode: "decimal",
      autocomplete: "off",
    });
    if (example) input.placeholder = "Pvz., " + example;
    const frame = create("div", { className: "money-field" });
    frame.append(input);
    if (currency) {
      const symbol = create("span", { textContent: "€" });
      symbol.setAttribute("aria-hidden", "true");
      frame.append(symbol);
    }
    wrapper.append(label, frame);
    return { wrapper, label, input };
  }

  function makeProductSelect(id) {
    const field = makeSelect(id, "Prekė ar paslauga", [{ value: "", text: "Pasirinkti prekę ar paslaugą" }]);
    field.input.required = true;
    for (const [groupKey, name] of Object.entries(groups)) {
      const group = create("optgroup", { label: name });
      const options = groupKey === "services" ? Object.entries(services) : Object.entries(products).filter(([, item]) => item.group === groupKey);
      for (const [productKey, product] of options) {
        group.append(create("option", { value: productKey, textContent: product.label }));
      }
      field.input.append(group);
    }
    field.input.value = "";
    return field;
  }

  function createPurchaseEditor(listElement, addButton, readField, showError, otherOnly = false, getYear = () => 2025) {
    const rows = [];
    let nextId = 1;
    const notify = () => listElement.dispatchEvent(new Event("change", { bubbles: true }));
    const getRules = () => purchaseRules[getYear()];

    function addPurchase(event) {
      event.preventDefault();
      const id = (otherOnly ? "other-purchase-" : "purchase-") + nextId;
      const row = create("div", { className: "purchase-row" });
      row.setAttribute("role", "group");
      row.setAttribute("aria-label", "Pirkinys Nr. " + nextId);
      const product = makeProductSelect(id + "-product");
      if (otherOnly) {
        product.input.replaceChildren(create("option", { value: "other", textContent: "Kita prekė" }));
        product.input.value = "other";
        product.wrapper.hidden = true;
      }
      const remove = create("button", {
        className: "remove-purchase",
        textContent: "Pašalinti",
        type: "button",
      });
      remove.setAttribute("aria-label", "Pašalinti pirkinį Nr. " + nextId);
      nextId += 1;

      const header = create("div", { className: "purchase-head" });
      if (otherOnly) header.append(create("strong", { textContent: "Kita prekė" }));
      header.append(product.wrapper, remove);
      const fields = create("div", { className: "purchase-fields" });
      const basis = makeSelect(id + "-basis", "Kaip skaičiuoti?", [
        { value: "amount", text: "Pagal išlaidas" },
        { value: "quantity", text: "Pagal kiekį" },
      ]);
      basis.wrapper.className += " purchase-basis";
      const quantity = makeInput(id + "-quantity", "");
      const price = makeInput(id + "-price", "Išlaidos per mėnesį", { currency: true });
      const quantityRefinement = makeInput(id + "-known-quantity", "");
      const priceRefinement = makeInput(id + "-known-price", "Išlaidos per mėnesį (su PVM)", { currency: true });
      const unitPrice = makeInput(id + "-unit-price", "Kaina už vienetą su PVM", { currency: true, example: "5" });
      const servicePrice = makeInput(id + "-service-price", "Vidutinės mėnesio išlaidos", { currency: true });
      servicePrice.wrapper.className += " purchase-service-price";
      const vatRate = makeSelect(id + "-vat-rate", "PVM tarifas", []);
      const priceGuide = create("p", {
        className: "field-help", id: id + "-price-guide", textContent: "Suma su PVM. Taros užstato neįtrauk.",
      });
      const priceWarning = create("p", { className: "field-help", id: id + "-price-warning", hidden: true });
      priceWarning.setAttribute("role", "status");
      price.input.setAttribute("aria-describedby", priceGuide.id + " " + priceWarning.id);
      const help = create("p", { className: "field-help", id: id + "-help" });
      const estimateGuide = create("p", { className: "field-help", id: id + "-estimate-guide" });
      const strength = makeInput(id + "-strength", "Stiprumas (%)");
      const maxRetail = makeInput(id + "-max-retail", "Didžiausia kaina, nurodyta ant pakelio", { currency: true, example: "6" });
      const refine = create("details", { className: "field-details purchase-refine" });
      const refineTitle = create("summary");
      const refineIcon = create("span", { className: "details-icon", textContent: "+" });
      refineIcon.setAttribute("aria-hidden", "true");
      refineTitle.append(refineIcon, create("span", { textContent: "Patikslinti skaičiavimą" }));
      const refineFields = create("div", { className: "purchase-fields" });
      refine.append(refineTitle, refineFields);
      product.input.setAttribute("aria-describedby", help.id);
      basis.input.setAttribute("aria-describedby", estimateGuide.id);
      servicePrice.input.setAttribute("aria-describedby", help.id);

      function resetBasis() {
        basis.input.value = ["alcohol", "tobacco"].includes(products[product.input.value]?.group) ? "quantity" : "amount";
      }

      function updateVatOptions() {
        const selected = vatRate.input.value;
        const options = [
          { value: "", textContent: "Pasirinkti PVM tarifą" },
          ...[21, getRules().reducedVat, 5].map((rate) => ({ value: String(rate), textContent: rate + " %" })),
          { value: "0", textContent: "0 % arba PVM netaikomas" },
        ];
        vatRate.input.replaceChildren(...options.map((option) => create("option", option)));
        vatRate.input.value = options.some(({ value }) => selected === value) ? selected : "";
      }

      function updatePurchaseExamples() {
        const key = product.input.value;
        const examples = purchaseExamples[key];
        if (!examples) return;
        const pricePerLitre = getRules().fuelPrices[key];
        quantity.input.placeholder = "Pvz., " + examples.quantity;
        price.input.placeholder = "Pvz., " + examples.spending;
        quantityRefinement.input.placeholder = quantity.input.placeholder;
        priceRefinement.input.placeholder = price.input.placeholder;
        if (!pricePerLitre) return;

        const enteredSpending = parseInputNumber(price.input.value);
        const enteredLitres = parseInputNumber(quantity.input.value);
        const spending = enteredSpending >= 0.01 && enteredSpending <= 100_000_000 ? enteredSpending : Number(examples.spending);
        const litres = enteredLitres >= 0.01 && enteredLitres <= 100_000_000 ? enteredLitres : Number(examples.quantity);
        quantityRefinement.input.placeholder = "Pvz., " + formatFuelQuantity(spending / pricePerLitre);
        priceRefinement.input.placeholder = "Pvz., " + amountFormat.format(litres * pricePerLitre);
      }

      function updateFields() {
        const key = product.input.value;
        const service = services[key];
        const rules = getRules();
        fields.hidden = !key;
        if (!key || service) {
          fields.replaceChildren();
          priceGuide.hidden = estimateGuide.hidden = refine.hidden = true;
          help.hidden = !service;
          help.textContent = "";
          if (service) {
            servicePrice.input.placeholder = "Pvz., " + service.monthlyExample;
            servicePrice.input.required = true;
            fields.append(servicePrice.wrapper);
            const serviceVat = service.vat ?? rules[service.vatRule];
            if (serviceVat === undefined) fields.append(vatRate.wrapper);
            help.textContent = serviceVat === undefined
              ? "Įvesk sąskaitos sumą su PVM ir pasirink joje nurodytą tarifą. Skirtingiems tarifams pridėk atskiras eilutes."
              : "Įvesk sąskaitos sumą su PVM. Taikomas " + serviceVat + " % PVM.";
            if (key === "heatAndWater") help.textContent += " Šią sumą įvesk vieną kartą, jei abi paslaugos sąskaitoje sujungtos.";
          }
          return;
        }
        const selected = products[key];
        const examples = purchaseExamples[key];
        const byAmount = basis.input.value === "amount";
        quantity.label.textContent = selected.unit + " per mėnesį";
        quantityRefinement.label.textContent = quantity.label.textContent;
        updatePurchaseExamples();
        quantity.input.setAttribute("aria-describedby", help.id);
        quantityRefinement.input.setAttribute("aria-describedby", help.id);
        quantity.input.required = true;
        price.input.required = true;
        const vatOnly = key === "other";
        const hasStrength = selected.aboveStrength !== undefined;
        if (hasStrength) strength.input.placeholder = "Pvz., " + examples.strength;
        strength.input.required = !byAmount && hasStrength;
        priceGuide.hidden = !byAmount;
        help.textContent = productHelp[key] ?? "";
        help.hidden = !help.textContent;
        const pricePerLitre = rules.fuelPrices[key];
        estimateGuide.textContent = pricePerLitre
          ? (byAmount ? "Kiekį įvertinsime pagal vidutinę degalų kainą. " : "Išlaidas PVM įverčiui įvertinsime pagal vidutinę degalų kainą. ")
            + rules.fuelReference + " · " + fuelPriceFormat.format(pricePerLitre) + " €/l."
          : (byAmount && !vatOnly ? "Akcizui patikslinti įrašyk kiekį žemiau." : !byAmount ? "PVM apskaičiuosime, jei pridėsi kainą." : "");
        estimateGuide.hidden = !estimateGuide.textContent;

        fields.replaceChildren(basis.wrapper, byAmount ? price.wrapper : quantity.wrapper);
        if (vatOnly) fields.append(vatRate.wrapper);
        if (hasStrength && !byAmount) fields.append(strength.wrapper);

        refine.hidden = vatOnly && byAmount;
        refineFields.replaceChildren();
        if (!refine.hidden) {
          refineFields.append(byAmount ? quantityRefinement.wrapper : vatOnly ? unitPrice.wrapper : priceRefinement.wrapper);
          if (byAmount && hasStrength) refineFields.append(strength.wrapper);
          if (key === "cigarettes") refineFields.append(maxRetail.wrapper);
        }
      }

      const entry = {
        focus: otherOnly ? price.input : product.input,
        refresh() {
          updateVatOptions();
          updateFields();
        },
        read() {
          const key = product.input.value;
          if (!key) showError(product.input, "Pasirink prekę ar paslaugą arba pašalink tuščią eilutę.");
          const rules = getRules();
          const service = services[key];
          if (service) {
            const price = readField(servicePrice.input, { required: true, min: 0.01, decimals: 2 });
            const serviceVat = service.vat ?? rules[service.vatRule];
            if (serviceVat === undefined && !vatRate.input.value) showError(vatRate.input, "Pasirink sąskaitoje nurodytą PVM tarifą.");
            return taxForPurchase(key, null, price, null, serviceVat ?? Number(vatRate.input.value), rules);
          }
          const definition = products[key];
          const byAmount = basis.input.value === "amount";
          const quantityInput = byAmount ? quantityRefinement.input : quantity.input;
          const priceInput = byAmount ? price.input : priceRefinement.input;
          const isOther = key === "other";
          const monthlyQuantity = isOther && byAmount ? null : readField(quantityInput, { required: !byAmount, min: 0.01 });
          let monthlyPrice = isOther && !byAmount ? null : readField(priceInput, { required: byAmount, min: 0.01, decimals: 2 });
          if (isOther && !vatRate.input.value) showError(vatRate.input, "Pasirink pirkimo dokumente nurodytą PVM tarifą.");
          const rate = isOther ? Number(vatRate.input.value) : 21;
          if (isOther && !byAmount) {
            const cost = readField(unitPrice.input, { min: 0.01, decimals: 2 });
            monthlyPrice = cost === null ? null : monthlyQuantity * cost;
            if (monthlyPrice > 100_000_000) showError(unitPrice.input, "Bendra mėnesio kaina gali būti iki 100 mln. €.");
          }
          let extraValue = null;
          if (monthlyQuantity !== null && key === "cigarettes") {
            extraValue = readField(maxRetail.input, { min: 0.01, max: 10000, decimals: 2 });
          } else if (monthlyQuantity !== null && definition.aboveStrength !== undefined) {
            extraValue = readField(strength.input, { required: true, max: 100 });
            if (extraValue <= definition.aboveStrength) {
              const lowerBound = definition.aboveStrength.toLocaleString("lt-LT");
              showError(strength.input, "Šios prekės stiprumas turi viršyti " + lowerBound + " %.");
            }
            if (definition.maxStrength !== undefined && extraValue > definition.maxStrength) {
              showError(strength.input, "Šios grupės gėrimo stiprumas negali viršyti " + definition.maxStrength + " %. Patikrink gėrimo rūšį etiketėje.");
            }
          }
          const tax = taxForPurchase(key, monthlyQuantity, monthlyPrice, extraValue, rate, rules);
          if (tax.taxExceedsPrice) {
            showError(priceInput, "Apskaičiuoti mokesčiai viršija įvestą kainą. Patikrink, ar įrašei mėnesio sumą už visą kiekį.");
          }
          priceWarning.hidden = !tax.cigarettePriceExceedsMaximum;
          priceWarning.textContent = tax.cigarettePriceExceedsMaximum
            ? "Įvesta suma viršija didžiausią pakelių kainą. Patikrink kiekius ir pakelių kainas."
            : "";
          return tax;
        },
      };
      resetBasis();
      entry.refresh();
      if (otherOnly) vatRate.input.value = "21";
      row.addEventListener("input", () => {
        priceWarning.hidden = true;
        priceWarning.textContent = "";
      });
      product.input.addEventListener("change", () => {
        for (const field of [quantity, price, quantityRefinement, priceRefinement, unitPrice, strength, maxRetail, servicePrice]) field.input.value = "";
        vatRate.input.value = product.input.value === "otherService" ? "" : "21";
        priceWarning.hidden = true;
        priceWarning.textContent = "";
        refine.open = false;
        resetBasis();
        updateFields();
      });
      price.input.addEventListener("input", updatePurchaseExamples);
      quantity.input.addEventListener("input", updatePurchaseExamples);
      basis.input.addEventListener("change", () => {
        const byAmount = basis.input.value === "amount";
        const secondary = byAmount ? quantityRefinement : product.input.value === "other" ? unitPrice : priceRefinement;
        refine.open = !!(secondary.input.value.trim() || maxRetail.input.value.trim());
        priceWarning.hidden = true;
        priceWarning.textContent = "";
        updateFields();
      });
      remove.addEventListener("click", () => {
        const index = rows.indexOf(entry);
        rows.splice(index, 1);
        row.remove();
        const next = rows[index] ?? rows[index - 1];
        (next?.focus ?? addButton).focus();
        notify();
      });
      row.append(header, fields, priceGuide, help, estimateGuide, refine, priceWarning);
      rows.push(entry);
      listElement.append(row);
      entry.focus.focus();
      notify();
    }

    addButton.addEventListener("click", addPurchase);
    return {
      read: () => rows.map((row) => row.read()),
      refresh: () => rows.forEach((row) => row.refresh()),
    };
  }

  window.createPurchaseEditor = createPurchaseEditor;
})();

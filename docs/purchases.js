"use strict";

const purchaseWeeksPerYear = 52;

(() => {
  const groups = {
    fuel: "Degalai",
    alcohol: "Alkoholis",
    tobacco: "Tabakas ir elektroninės cigaretės",
    services: "Namų ūkio ir kitos paslaugos",
  };

  // 2025 m. LEA ir EK metiniai mažmeninių kainų vidurkiai (25–26 skaidrės).
  const averageFuelPrices = { petrol: 1.423, diesel: 1.507 };
  const fuelPriceFormat = new Intl.NumberFormat("lt-LT", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  const quantityFormat = new Intl.NumberFormat("lt-LT", { maximumFractionDigits: 1 });

  // 2025 m. tarifai vienam įvesties vienetui pagal Lietuvos muitinės tarifų lentelę.
  const products = {
    petrol: { group: "fuel", label: "Bešvinis benzinas", unit: "Litrai", rate: 0.513 },
    diesel: { group: "fuel", label: "Kelių dyzelinas", unit: "Litrai", rate: 0.5196 },
    gas: { group: "fuel", label: "Suskystintos automobilių dujos", unit: "Kilogramai", rate: 0.3709 },
    beer: { group: "alcohol", label: "Alus (standartinis tarifas)", unit: "Litrai", aboveStrength: 0.5, rate: 0.1097 },
    beerReduced: { group: "alcohol", label: "Alus (patvirtintas sumažintas tarifas)", unit: "Litrai", aboveStrength: 0.5, rate: 0.05485 },
    lightWine: { group: "alcohol", label: "Vynas ir fermentuoti gėrimai (iki 8,5 %)", unit: "Litrai", rate: 1.27 },
    wine: { group: "alcohol", label: "Vynas ir fermentuoti gėrimai virš 8,5 %", unit: "Litrai", rate: 2.54 },
    intermediate: { group: "alcohol", label: "Vermutas, portveinas ir panašūs gėrimai", unit: "Litrai", aboveStrength: 1.2, maxStrength: 22, rate: 2.92, rateAbove15: 3.70 },
    spirits: { group: "alcohol", label: "Stiprieji gėrimai (degtinė, viskis, likeris)", unit: "Litrai", aboveStrength: 1.2, rate: 0.2778 },
    cigarettes: { group: "tobacco", label: "Cigaretės", unit: "Cigarečių pakeliai" },
    heated: { group: "tobacco", label: "Kaitinamasis tabakas", unit: "Tabako lazdelės", rate: 0.0894 },
    liquid: { group: "tobacco", label: "Elektroninių cigarečių skystis", unit: "Mililitrai", rate: 0.63 },
    tobacco: { group: "tobacco", label: "Rūkomasis tabakas", unit: "Gramai", rate: 0.1235 },
    other: { group: "other", label: "Kita prekė", unit: "Kiekis" },
  };
  const services = {
    electricity: { label: "Buitinė elektra", vat: 21, monthlyExample: 45 },
    homeGas: { label: "Buitinės gamtinės dujos", vat: 21, monthlyExample: 30 },
    coldWater: { label: "Šaltas vanduo ir nuotekos", vat: 21, monthlyExample: 20 },
    heating: { label: "Centralizuotas būsto šildymas", vat: 9, monthlyExample: 60 },
    hotWater: { label: "Karštas vanduo", vat: 9, monthlyExample: 20 },
    heatAndWater: { label: "Šildymas ir karštas vanduo (viena bendra suma)", vat: 9, monthlyExample: 80 },
    telecom: { label: "Internetas ir mobilusis ryšys", vat: 21, monthlyExample: 25 },
    publicTransport: { label: "Viešasis transportas reguliariais maršrutais", vat: 9, monthlyExample: 15 },
    otherService: { label: "Kita paslauga pagal sąskaitą", monthlyExample: 30 },
  };

  const purchaseExamples = {
    petrol: { quantity: "30", spending: "50" },
    diesel: { quantity: "30", spending: "50" },
    gas: { quantity: "15", spending: "20" },
    beer: { quantity: "2", spending: "6", strength: "5" },
    beerReduced: { quantity: "2", spending: "6", strength: "5" },
    lightWine: { quantity: "1", spending: "8" },
    wine: { quantity: "0,75", spending: "8" },
    intermediate: { quantity: "0,5", spending: "8", strength: "18" },
    spirits: { quantity: "0,5", spending: "12", strength: "40" },
    cigarettes: { quantity: "0,5", spending: "3" },
    heated: { quantity: "20", spending: "5" },
    liquid: { quantity: "2", spending: "3" },
    tobacco: { quantity: "10", spending: "5" },
    other: { quantity: "2", spending: "10" },
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

  function taxForPurchase(key, weeklyQuantity, weeklyPrice, extra, vatRate, periodsPerYear = purchaseWeeksPerYear) {
    const product = products[key] ?? services[key];
    const pricePerLitre = averageFuelPrices[key];
    let estimate = "";
    let estimatedTax = null;
    if (pricePerLitre && weeklyQuantity === null) {
      weeklyQuantity = weeklyPrice / pricePerLitre;
      estimatedTax = "excise";
      estimate = "Akcizo įverčiui naudotas kiekis – apie " + quantityFormat.format(weeklyQuantity)
        + " l per savaitę, pagal 2025 m. vidutinę kainą " + fuelPriceFormat.format(pricePerLitre) + " €/l.";
    } else if (pricePerLitre && weeklyPrice === null) {
      weeklyPrice = weeklyQuantity * pricePerLitre;
      estimatedTax = "vat";
      estimate = "PVM įverčiui taikyta 2025 m. vidutinė kaina " + fuelPriceFormat.format(pricePerLitre) + " €/l.";
    }
    const quantity = weeklyQuantity === null ? null : weeklyQuantity * periodsPerYear;
    const price = weeklyPrice === null ? null : weeklyPrice * periodsPerYear;
    const vatOnly = key === "other" || Object.hasOwn(services, key);
    const missingExcise = !vatOnly && quantity === null;
    let excise = 0;
    if (!missingExcise && key === "cigarettes") {
      const maximumRetail = extra === null ? (price ?? 0) : extra * quantity;
      excise = Math.max(2.994 * quantity, 1.852 * quantity + 0.25 * maximumRetail);
    } else if (!missingExcise && !vatOnly) {
      let ratePerLitre = product.rate;
      if (product.rateAbove15 !== undefined) {
        ratePerLitre = extra > 15 ? product.rateAbove15 : product.rate;
      } else if (product.aboveStrength !== undefined) {
        ratePerLitre *= extra;
      }
      excise = ratePerLitre * quantity;
    }
    const exciseCents = toCents(excise);
    const vatCents = price === null ? 0 : vatInPrice(price, vatRate);
    const priceCents = price === null ? null : toCents(price);
    const taxExceedsPrice = priceCents !== null && exciseCents + vatCents > priceCents;
    const cigarettePriceExceedsMaximum = key === "cigarettes" && quantity !== null && price !== null && extra !== null
      && toCents(weeklyPrice) > toCents(weeklyQuantity * extra);
    const cigaretteMinimum = key === "cigarettes" && !missingExcise && extra === null;
    return {
      name: key === "intermediate" && extra !== null
        ? product.label + " · " + extra.toLocaleString("lt-LT", { maximumFractionDigits: 15 }) + " %"
        : product.label,
      productKey: key,
      excise: exciseCents,
      vat: vatCents,
      price: priceCents,
      weekly: periodsPerYear === purchaseWeeksPerYear,
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

  function createPurchaseEditor(listElement, addButton, readField, showError, otherOnly = false) {
    const rows = [];
    let nextId = 1;
    const notify = () => listElement.dispatchEvent(new Event("change", { bubbles: true }));

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
      const price = makeInput(id + "-price", "Išlaidos per savaitę", { currency: true });
      const quantityRefinement = makeInput(id + "-known-quantity", "");
      const priceRefinement = makeInput(id + "-known-price", "Išlaidos per savaitę (su PVM)", { currency: true });
      const unitPrice = makeInput(id + "-unit-price", "Kaina už vienetą su PVM", { currency: true, example: "5" });
      const servicePrice = makeInput(id + "-service-price", "Išlaidos su PVM", { currency: true });
      const servicePeriod = makeSelect(id + "-service-period", "Laikotarpis", [
        { value: "month", text: "Vidutiniškai per mėnesį" },
        { value: "year", text: "Iš viso per metus" },
      ]);
      servicePeriod.wrapper.className += " purchase-basis";
      const serviceAmounts = { month: "", year: "" };
      let activeServicePeriod = "month";
      const vatRate = makeSelect(id + "-vat-rate", "PVM tarifas", [
        { value: "", text: "Pasirinkti PVM tarifą" },
        ...[21, 9, 5].map((rate) => ({ value: String(rate), text: rate + " %" })),
        { value: "0", text: "0 % arba PVM netaikomas" },
      ]);
      if (otherOnly) vatRate.input.value = "21";
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

      function updateServicePriceField(service) {
        const monthly = servicePeriod.input.value === "month";
        servicePrice.label.textContent = monthly ? "Vidutinės mėnesio išlaidos" : "2025 m. išlaidos";
        servicePrice.input.placeholder = "Pvz., " + (monthly ? service.monthlyExample : service.monthlyExample * 12);
      }

      function updateFields() {
        const key = product.input.value;
        const service = services[key];
        fields.hidden = !key;
        if (!key || service) {
          fields.replaceChildren();
          priceGuide.hidden = estimateGuide.hidden = refine.hidden = true;
          help.hidden = !service;
          help.textContent = "";
          if (service) {
            updateServicePriceField(service);
            servicePrice.input.required = true;
            fields.append(servicePeriod.wrapper, servicePrice.wrapper);
            if (service.vat === undefined) fields.append(vatRate.wrapper);
            help.textContent = service.vat === undefined
              ? "Įvesk sąskaitos sumą su PVM ir pasirink joje nurodytą tarifą. Skirtingiems tarifams pridėk atskiras eilutes."
              : "Įvesk sąskaitos sumą su PVM. Taikomas " + service.vat + " % PVM.";
            if (key === "heatAndWater") help.textContent += " Šią sumą įvesk vieną kartą, jei abi paslaugos sąskaitoje sujungtos.";
          }
          return;
        }
        const selected = products[key];
        const examples = purchaseExamples[key];
        const byAmount = basis.input.value === "amount";
        quantity.label.textContent = selected.unit + " per savaitę";
        quantityRefinement.label.textContent = quantity.label.textContent;
        quantity.input.placeholder = quantityRefinement.input.placeholder = "Pvz., " + examples.quantity;
        price.input.placeholder = priceRefinement.input.placeholder = "Pvz., " + examples.spending;
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
        estimateGuide.textContent = averageFuelPrices[key]
          ? (byAmount ? "Kiekį įvertinsime pagal 2025 m. vidutinę degalų kainą." : "Išlaidas PVM įverčiui apskaičiuosime pagal 2025 m. vidutinę degalų kainą.")
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
        read() {
          const key = product.input.value;
          if (!key) showError(product.input, "Pasirink prekę ar paslaugą arba pašalink tuščią eilutę.");
          const service = services[key];
          if (service) {
            const price = readField(servicePrice.input, { required: true, min: 0.01, decimals: 2 });
            if (service.vat === undefined && !vatRate.input.value) showError(vatRate.input, "Pasirink sąskaitoje nurodytą PVM tarifą.");
            const periodsPerYear = servicePeriod.input.value === "month" ? 12 : 1;
            return taxForPurchase(key, null, price, null, service.vat ?? Number(vatRate.input.value), periodsPerYear);
          }
          const definition = products[key];
          const byAmount = basis.input.value === "amount";
          const quantityInput = byAmount ? quantityRefinement.input : quantity.input;
          const priceInput = byAmount ? price.input : priceRefinement.input;
          const isOther = key === "other";
          const weeklyQuantity = isOther && byAmount ? null : readField(quantityInput, { required: !byAmount, min: 0.01 });
          let weeklyPrice = isOther && !byAmount ? null : readField(priceInput, { required: byAmount, min: 0.01, decimals: 2 });
          const rate = key === "other" ? Number(vatRate.input.value) : 21;
          if (isOther && !byAmount) {
            const cost = readField(unitPrice.input, { min: 0.01, decimals: 2 });
            weeklyPrice = cost === null ? null : weeklyQuantity * cost;
            if (weeklyPrice > 100_000_000) showError(unitPrice.input, "Bendra savaitės kaina gali būti iki 100 mln. €.");
          }
          let extraValue = null;
          if (weeklyQuantity !== null && key === "cigarettes") {
            extraValue = readField(maxRetail.input, { min: 0.01, max: 10000, decimals: 2 });
          } else if (weeklyQuantity !== null && definition.aboveStrength !== undefined) {
            extraValue = readField(strength.input, { required: true, max: 100 });
            if (extraValue <= definition.aboveStrength) {
              const lowerBound = definition.aboveStrength.toLocaleString("lt-LT");
              showError(strength.input, "Šios prekės stiprumas turi viršyti " + lowerBound + " %.");
            }
            if (definition.maxStrength !== undefined && extraValue > definition.maxStrength) {
              showError(strength.input, "Šios grupės gėrimo stiprumas negali viršyti " + definition.maxStrength + " %. Patikrink gėrimo rūšį etiketėje.");
            }
          }
          const tax = taxForPurchase(key, weeklyQuantity, weeklyPrice, extraValue, rate);
          if (tax.taxExceedsPrice) {
            showError(priceInput, "Apskaičiuoti mokesčiai viršija įvestą kainą. Patikrink, ar įrašei savaitės sumą už visą kiekį.");
          }
          priceWarning.hidden = !tax.cigarettePriceExceedsMaximum;
          priceWarning.textContent = tax.cigarettePriceExceedsMaximum
            ? "Įvesta suma viršija didžiausią pakelių kainą. Patikrink kiekius ir pakelių kainas."
            : "";
          return tax;
        },
      };
      resetBasis();
      updateFields();
      row.addEventListener("input", () => {
        priceWarning.hidden = true;
        priceWarning.textContent = "";
      });
      product.input.addEventListener("change", () => {
        for (const field of [quantity, price, quantityRefinement, priceRefinement, unitPrice, strength, maxRetail, servicePrice]) field.input.value = "";
        vatRate.input.value = product.input.value === "otherService" ? "" : "21";
        serviceAmounts.month = serviceAmounts.year = "";
        activeServicePeriod = servicePeriod.input.value = "month";
        priceWarning.hidden = true;
        priceWarning.textContent = "";
        refine.open = false;
        resetBasis();
        updateFields();
      });
      servicePeriod.input.addEventListener("change", () => {
        serviceAmounts[activeServicePeriod] = servicePrice.input.value;
        activeServicePeriod = servicePeriod.input.value;
        servicePrice.input.value = serviceAmounts[activeServicePeriod];
        updateServicePriceField(services[product.input.value]);
      });
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
    return { read: () => rows.map((row) => row.read()) };
  }

  window.createPurchaseEditor = createPurchaseEditor;
})();

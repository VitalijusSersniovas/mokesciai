"use strict";

const publicCalculatorUrl = document.querySelector('link[rel="canonical"]').href;

function installPublicLinkSharing() {
  const button = document.getElementById("copy-site-link");
  const field = document.getElementById("site-link-field");
  const input = document.getElementById("site-link-value");
  const status = document.getElementById("site-share-status");

  button.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(publicCalculatorUrl);
      status.textContent = "Skaičiuoklės nuoroda nukopijuota.";
      return;
    } catch {
      field.hidden = false;
      input.focus();
      input.select();
    }
    status.textContent = "Nuoroda pažymėta. Gali ją nukopijuoti ir nusiųsti draugui.";
  });
}

function installResultCardSharing(readResult) {
  const prepare = document.getElementById("prepare-share-card");
  const ready = document.getElementById("share-card-ready");
  const download = document.getElementById("share-card-download");
  const nativeShare = document.getElementById("share-card-native");
  const status = document.getElementById("share-card-status");
  let objectUrl = "";
  let file;
  let revision = 0;

  function reset() {
    revision++;
    ready.hidden = true;
    nativeShare.hidden = true;
    download.removeAttribute("href");
    prepare.disabled = false;
    status.textContent = "";
    file = undefined;
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = "";
    }
  }

  prepare.addEventListener("click", async () => {
    const data = readResult();
    if (!data) return;
    reset();
    const currentRevision = revision;
    prepare.disabled = true;
    status.textContent = "Ruošiama paveikslėlio kortelė.";
    try {
      const picture = await window.makeTaxShareCard(data);
      if (revision !== currentRevision) return;
      const filename = data.example ? "mano-mokesciu-pavyzdys.png" : "mano-mokesciu-rezultatas.png";
      objectUrl = URL.createObjectURL(picture);
      download.href = objectUrl;
      download.download = filename;
      ready.hidden = false;
      if (typeof File === "function" && typeof navigator.canShare === "function" && typeof navigator.share === "function") {
        file = new File([picture], filename, { type: "image/png" });
        nativeShare.hidden = !navigator.canShare({ files: [file] });
      }
      status.textContent = "Kortelė paruošta.";
    } catch {
      if (revision === currentRevision) status.textContent = "Kortelės paruošti nepavyko. Gali bandyti dar kartą.";
    } finally {
      if (revision === currentRevision) prepare.disabled = false;
    }
  });

  nativeShare.addEventListener("click", async () => {
    if (!file) return;
    const currentRevision = revision;
    try {
      await navigator.share({ title: "Mano mokesčių euras", files: [file] });
      if (revision === currentRevision) status.textContent = "Kortelė perduota įrenginio dalijimosi funkcijai.";
    } catch (error) {
      if (revision === currentRevision && error.name !== "AbortError") {
        status.textContent = "Gali atsisiųsti PNG ir pridėti jį prie įrašo.";
      }
    }
  });

  return { reset };
}

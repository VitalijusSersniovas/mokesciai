"use strict";

const publicCalculatorUrl = document.querySelector('link[rel="canonical"]').href;

const calculatorSocialPlatforms = [
  { name: "Facebook", endpoint: "https://www.facebook.com/sharer/sharer.php", parameter: "u" },
  { name: "WhatsApp", endpoint: "https://wa.me/", parameter: "text" },
  { name: "Telegram", endpoint: "https://t.me/share/url", parameter: "url" },
  { name: "X", endpoint: "https://twitter.com/intent/tweet", parameter: "url" },
];

function makeCalculatorSocialLink(url, { name, endpoint, parameter }) {
  const href = new URL(endpoint);
  href.searchParams.set(parameter, url);
  const link = document.createElement("a");
  link.className = "secondary-button";
  link.href = href.href;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = `Dalytis „${name}“`;
  return link;
}

function installPublicLinkSharing() {
  const facebook = document.getElementById("facebook-share");
  const button = document.getElementById("copy-site-link");
  const field = document.getElementById("site-link-field");
  const input = document.getElementById("site-link-value");
  const status = document.getElementById("site-share-status");

  const otherPlatforms = calculatorSocialPlatforms.filter((platform) => platform.name !== "Facebook");
  facebook.after(...otherPlatforms.map((platform) => makeCalculatorSocialLink(publicCalculatorUrl, platform)));

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

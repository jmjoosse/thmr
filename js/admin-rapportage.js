(async function () {
  if (!Auth.verplichtAdminSessie()) return;

  document.getElementById("uitloggen").addEventListener("click", () => {
    Auth.logoutAdmin();
    window.location.href = "index.html";
  });

  const inhoud = document.getElementById("rapport-inhoud");

  const [producten, settings, bestanden] = await Promise.all([
    fetch("../data/products.json", { cache: "no-store" }).then((r) => r.json()),
    fetch("../data/settings.json", { cache: "no-store" }).then((r) => r.json()),
    GitHubAPI.getDirectory("data/orders"),
  ]);

  const btwPercentage = settings.btwPercentage != null ? settings.btwPercentage : 9;
  const productenById = Object.fromEntries(producten.map((p) => [p.id, p]));

  const jsonBestanden = bestanden.filter((b) => b.type === "file" && b.name.endsWith(".json"));
  const orders = (
    await Promise.all(
      jsonBestanden.map(async (bestand) => {
        try {
          const { data } = await GitHubAPI.getJson(bestand.path);
          return data;
        } catch {
          return null;
        }
      })
    )
  ).filter(Boolean);

  if (orders.length === 0) {
    inhoud.innerHTML = "<p>Nog geen bestellingen om te rapporteren.</p>";
    return;
  }

  const perProduct = {};
  const perKlant = {};
  const perMaand = {};

  for (const order of orders) {
    perKlant[order.klant_id] = perKlant[order.klant_id] || {
      naam: order.klant_naam,
      omzet: 0,
      aantalBestellingen: 0,
    };
    perKlant[order.klant_id].omzet += order.totaal;
    perKlant[order.klant_id].aantalBestellingen += 1;

    const maand = (order.leverdatum || "").slice(0, 7);
    perMaand[maand] = (perMaand[maand] || 0) + order.totaal;

    for (const regel of order.regels) {
      const key = regel.product_id;
      perProduct[key] = perProduct[key] || {
        naam: regel.naam,
        eenheid: regel.eenheid,
        aantal: 0,
        omzet: 0,
      };
      perProduct[key].aantal += regel.aantal;
      perProduct[key].omzet += regel.aantal * regel.prijs;
    }
  }

  const totaleOmzet = orders.reduce((som, o) => som + o.totaal, 0);

  let productRijen = "";
  for (const [productId, info] of Object.entries(perProduct).sort((a, b) => b[1].omzet - a[1].omzet)) {
    const inkoopprijs = productenById[productId] ? productenById[productId].inkoopprijs : 0;
    const kostprijs = info.aantal * inkoopprijs;
    const marge = info.omzet - kostprijs;
    productRijen += `
      <tr>
        <td>${info.naam}</td>
        <td>${info.aantal} ${info.eenheid}</td>
        <td>${BestelUtils.formatEuro(info.omzet)}</td>
        <td>${BestelUtils.formatEuro(kostprijs)}</td>
        <td>${BestelUtils.formatEuro(marge)}</td>
      </tr>
    `;
  }

  let klantRijen = "";
  for (const [, info] of Object.entries(perKlant).sort((a, b) => b[1].omzet - a[1].omzet)) {
    klantRijen += `
      <tr>
        <td>${info.naam}</td>
        <td>${info.aantalBestellingen}</td>
        <td>${BestelUtils.formatEuro(info.omzet)}</td>
      </tr>
    `;
  }

  const maandEntries = Object.entries(perMaand).sort((a, b) => a[0].localeCompare(b[0]));
  const maxMaandOmzet = Math.max(...maandEntries.map(([, omzet]) => omzet), 1);
  let maandRijen = "";
  for (const [maand, omzet] of maandEntries) {
    const breedte = Math.round((omzet / maxMaandOmzet) * 100);
    maandRijen += `
      <div class="bar-rij">
        <span class="bar-label">${maand}</span>
        <div class="bar-track"><div class="bar-vulling" style="width: ${breedte}%"></div></div>
        <span class="bar-waarde">${BestelUtils.formatEuro(omzet)}</span>
      </div>
    `;
  }

  inhoud.innerHTML = `
    <p style="font-size: 1.1rem"><strong>Totale omzet:</strong> ${BestelUtils.formatEuro(totaleOmzet)} over ${orders.length} bestelling(en)</p>

    <h2 style="font-size: 1rem">Omzet &amp; marge per product</h2>
    <table class="product-tabel" style="margin-bottom: 32px">
      <thead><tr><th>Product</th><th>Aantal verkocht</th><th>Omzet</th><th>Kostprijs</th><th>Marge</th></tr></thead>
      <tbody>${productRijen}</tbody>
    </table>

    <h2 style="font-size: 1rem">Omzet per klant</h2>
    <table class="product-tabel" style="margin-bottom: 32px">
      <thead><tr><th>Klant</th><th>Aantal bestellingen</th><th>Omzet</th></tr></thead>
      <tbody>${klantRijen}</tbody>
    </table>

    <h2 style="font-size: 1rem">Omzet per maand (op leverdatum)</h2>
    <div class="bar-chart">${maandRijen}</div>
  `;

  function escapeCsv(waarde) {
    const tekst = String(waarde);
    if (tekst.includes(";") || tekst.includes('"') || tekst.includes("\n")) {
      return `"${tekst.replace(/"/g, '""')}"`;
    }
    return tekst;
  }

  function formatGetal(n) {
    return n.toFixed(2).replace(".", ",");
  }

  function bouwCsv(inclBtw) {
    const factor = inclBtw ? 1 + btwPercentage / 100 : 1;
    const header = [
      "Klant",
      "Besteld op",
      "Leverdatum",
      "Status",
      "Product",
      "Aantal",
      "Eenheid",
      inclBtw ? "Prijs per eenheid (incl. btw)" : "Prijs per eenheid (excl. btw)",
      inclBtw ? "Regeltotaal (incl. btw)" : "Regeltotaal (excl. btw)",
      inclBtw ? "Ordertotaal (incl. btw)" : "Ordertotaal (excl. btw)",
    ];
    const rijen = [header];

    for (const order of orders) {
      for (const regel of order.regels) {
        rijen.push([
          order.klant_naam,
          order.besteld_op,
          order.leverdatum,
          order.status,
          regel.naam,
          regel.aantal,
          regel.eenheid,
          formatGetal(regel.prijs * factor),
          formatGetal(regel.aantal * regel.prijs * factor),
          formatGetal(order.totaal * factor),
        ]);
      }
    }

    return rijen.map((rij) => rij.map(escapeCsv).join(";")).join("\r\n");
  }

  function downloadCsv(inhoudCsv, bestandsnaam) {
    const blob = new Blob(["﻿" + inhoudCsv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = bestandsnaam;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const vandaag = new Date().toISOString().slice(0, 10);
  document.getElementById("export-excl").addEventListener("click", () => {
    downloadCsv(bouwCsv(false), `bestellingen-excl-btw-${vandaag}.csv`);
  });
  document.getElementById("export-incl").addEventListener("click", () => {
    downloadCsv(bouwCsv(true), `bestellingen-incl-btw-${vandaag}.csv`);
  });
})();

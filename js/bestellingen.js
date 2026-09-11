(async function () {
  const params = new URLSearchParams(window.location.search);
  const klantIdUitLink = params.get("klant") || "";

  const klantId = Auth.verplichtKlantSessie(klantIdUitLink);
  if (!klantId) return;

  const lijstEl = document.getElementById("bestellingen-lijst");
  const klantNaamEl = document.getElementById("klant-naam");
  const linkCatalogus = document.getElementById("link-catalogus");
  linkCatalogus.href = `catalogus.html?klant=${encodeURIComponent(klantId)}`;

  document.getElementById("uitloggen").addEventListener("click", () => {
    Auth.logoutKlant();
    window.location.href = `index.html?klant=${encodeURIComponent(klantId)}`;
  });

  const klanten = await fetch("data/customers.json", { cache: "no-store" }).then((r) => r.json());
  const klant = klanten.find((k) => k.id === klantId);
  if (klant) klantNaamEl.textContent = klant.naam;

  lijstEl.innerHTML = "<p>Bestellingen laden...</p>";

  let bestanden;
  try {
    bestanden = await GitHubAPI.getDirectory("data/orders");
  } catch (e) {
    lijstEl.innerHTML = "<p>Kon bestelgeschiedenis niet laden.</p>";
    console.error(e);
    return;
  }

  const jsonBestanden = bestanden.filter((b) => b.type === "file" && b.name.endsWith(".json"));

  const orders = (
    await Promise.all(
      jsonBestanden.map(async (bestand) => {
        try {
          const { data } = await GitHubAPI.getJson(bestand.path);
          return data && data.klant_id === klantId ? { ...data, _pad: bestand.path } : null;
        } catch {
          return null;
        }
      })
    )
  )
    .filter(Boolean)
    .sort((a, b) => new Date(b.besteld_op) - new Date(a.besteld_op));

  if (orders.length === 0) {
    lijstEl.innerHTML = "<p>Nog geen bestellingen geplaatst.</p>";
    return;
  }

  const statusLabel = { ontvangen: "Ontvangen", bevestigd: "Bevestigd", geleverd: "Geleverd" };

  lijstEl.innerHTML = "";
  for (const order of orders) {
    const kaart = document.createElement("div");
    kaart.className = "kaart order-kaart";

    const regelsHtml = order.regels
      .map((r) => `<li>${r.aantal} ${r.eenheid} ${r.naam} — ${BestelUtils.formatEuro(r.aantal * r.prijs)}</li>`)
      .join("");

    kaart.innerHTML = `
      <div class="order-kop">
        <div>
          <strong>Levering: ${BestelUtils.formatDatum(new Date(order.leverdatum))}</strong>
          <div class="cart-info">Besteld op ${new Date(order.besteld_op).toLocaleString("nl-NL")}</div>
        </div>
        <span class="status-badge status-${order.status}">${statusLabel[order.status] || order.status}</span>
      </div>
      <ul class="order-regels">${regelsHtml}</ul>
      <div class="order-footer">
        <strong>${BestelUtils.formatEuro(order.totaal)}</strong>
        <a href="catalogus.html?klant=${encodeURIComponent(klantId)}&herhaal=${encodeURIComponent(order._pad)}">
          Herhaal deze bestelling
        </a>
      </div>
    `;
    lijstEl.appendChild(kaart);
  }
})();

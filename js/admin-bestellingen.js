(async function () {
  if (!Auth.verplichtAdminSessie()) return;

  document.getElementById("uitloggen").addEventListener("click", () => {
    Auth.logoutAdmin();
    window.location.href = "index.html";
  });

  const lijstEl = document.getElementById("bestellingen-lijst");
  const statusLabel = { ontvangen: "Ontvangen", bevestigd: "Bevestigd", geleverd: "Geleverd" };

  lijstEl.innerHTML = "<p>Bestellingen laden...</p>";

  let bestanden;
  try {
    bestanden = await GitHubAPI.getDirectory("data/orders");
  } catch (e) {
    lijstEl.innerHTML = "<p>Kon bestellingen niet laden.</p>";
    console.error(e);
    return;
  }

  const jsonBestanden = bestanden.filter((b) => b.type === "file" && b.name.endsWith(".json"));

  const orders = (
    await Promise.all(
      jsonBestanden.map(async (bestand) => {
        try {
          const { data } = await GitHubAPI.getJson(bestand.path);
          return data ? { ...data, _pad: bestand.path } : null;
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
          <strong>${order.klant_naam}</strong> — levering ${BestelUtils.formatDatum(new Date(order.leverdatum))}
          <div class="cart-info">Besteld op ${new Date(order.besteld_op).toLocaleString("nl-NL")}</div>
        </div>
        <select class="status-select">
          <option value="ontvangen">Ontvangen</option>
          <option value="bevestigd">Bevestigd</option>
          <option value="geleverd">Geleverd</option>
        </select>
      </div>
      <ul class="order-regels">${regelsHtml}</ul>
      <div class="order-footer">
        <strong>${BestelUtils.formatEuro(order.totaal)}</strong>
        <span class="opslag-status cart-info"></span>
      </div>
    `;
    kaart.querySelector(".status-select").value = order.status;
    kaart.querySelector(".status-select").addEventListener("change", async (e) => {
      const nieuweStatus = e.target.value;
      const statusVeld = kaart.querySelector(".opslag-status");
      statusVeld.textContent = "Opslaan...";
      try {
        const { data: actueleOrder, sha } = await GitHubAPI.getJson(order._pad);
        actueleOrder.status = nieuweStatus;
        await GitHubAPI.putJson(
          order._pad,
          actueleOrder,
          `Status bijgewerkt naar ${statusLabel[nieuweStatus]}: ${order.klant_naam}`,
          sha
        );
        statusVeld.textContent = "Opgeslagen.";
      } catch (err) {
        console.error(err);
        statusVeld.textContent = err.message.includes("token")
          ? "Opslaan mislukt: geen schrijftoegang ingesteld."
          : `Opslaan mislukt: ${err.message}`;
      }
    });
    lijstEl.appendChild(kaart);
  }
})();

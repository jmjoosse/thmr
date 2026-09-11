(async function () {
  const params = new URLSearchParams(window.location.search);
  const klantIdUitLink = params.get("klant") || "";
  const herhaalPad = params.get("herhaal") || "";

  const klantId = Auth.verplichtKlantSessie(klantIdUitLink);
  if (!klantId) return;

  const CART_KEY = `cart_${klantId}`;

  const els = {
    klantNaam: document.getElementById("klant-naam"),
    productenBody: document.getElementById("producten-body"),
    cartLijst: document.getElementById("cart-lijst"),
    cartTotaal: document.getElementById("cart-totaal"),
    leverdatum: document.getElementById("leverdatum"),
    minimumMelding: document.getElementById("minimum-melding"),
    bestelKnop: document.getElementById("bestel-knop"),
    bestelFout: document.getElementById("bestel-fout"),
    bevestiging: document.getElementById("bevestiging"),
    bevestigingTekst: document.getElementById("bevestiging-tekst"),
    bestelPaneel: document.getElementById("bestel-paneel"),
  };

  const LAGE_VOORRAAD_DREMPEL = 5;

  const [klanten, producten, voorraad] = await Promise.all([
    fetch("data/customers.json", { cache: "no-store" }).then((r) => r.json()),
    fetch("data/products.json", { cache: "no-store" }).then((r) => r.json()),
    fetch("data/stock.json", { cache: "no-store" }).then((r) => r.json()),
  ]);

  const klant = klanten.find((k) => k.id === klantId);
  if (!klant) {
    document.body.innerHTML = "<p style='padding:24px'>Klant niet gevonden.</p>";
    return;
  }

  els.klantNaam.textContent = klant.naam;

  const bestelbareProducten = producten.filter(
    (p) => p.actief && klant.prijslijst && klant.prijslijst[p.id] != null
  );

  let cart = laadCart();

  if (herhaalPad) {
    try {
      const { data: order } = await GitHubAPI.getJson(herhaalPad);
      if (order && order.klant_id === klantId) {
        cart = {};
        for (const regel of order.regels) {
          if (klant.prijslijst[regel.product_id] != null) {
            cart[regel.product_id] = regel.aantal;
          }
        }
        bewaarCart();
      }
    } catch (e) {
      console.warn("Kon herhaalbestelling niet laden:", e);
    }
  }

  renderProducten();
  renderCart();

  function laadCart() {
    try {
      return JSON.parse(sessionStorage.getItem(CART_KEY)) || {};
    } catch {
      return {};
    }
  }

  function bewaarCart() {
    sessionStorage.setItem(CART_KEY, JSON.stringify(cart));
  }

  function renderProducten() {
    const groepen = new Map();
    for (const product of bestelbareProducten) {
      const lijst = groepen.get(product.categorie) || [];
      lijst.push(product);
      groepen.set(product.categorie, lijst);
    }

    els.productenBody.innerHTML = "";

    if (bestelbareProducten.length === 0) {
      els.productenBody.innerHTML =
        "<p>Er staan nog geen producten met prijzen voor jouw account klaar. Neem contact op met de kaashandel.</p>";
      return;
    }

    for (const [categorie, lijst] of groepen) {
      const kop = document.createElement("h3");
      kop.className = "categorie-kop";
      kop.textContent = categorie;
      els.productenBody.appendChild(kop);

      const tabel = document.createElement("table");
      tabel.className = "product-tabel";
      tabel.innerHTML = `
        <thead>
          <tr><th>Product</th><th>Prijs</th><th>Aantal</th></tr>
        </thead>
        <tbody></tbody>
      `;
      const tbody = tabel.querySelector("tbody");

      for (const product of lijst) {
        const prijs = klant.prijslijst[product.id];
        const inVoorraad = voorraad[product.id];
        const uitverkocht = inVoorraad != null && inVoorraad <= 0;
        const lageVoorraad = inVoorraad != null && inVoorraad > 0 && inVoorraad <= LAGE_VOORRAAD_DREMPEL;

        const tr = document.createElement("tr");
        if (uitverkocht) delete cart[product.id];

        tr.innerHTML = `
          <td>
            ${product.naam}
            ${lageVoorraad ? `<div class="cart-info" style="color: var(--kleur-fout)">Nog maar ${inVoorraad} ${product.eenheid} op voorraad</div>` : ""}
          </td>
          <td>${BestelUtils.formatEuro(prijs)} / ${product.eenheid}</td>
          <td>
            ${
              uitverkocht
                ? `<span class="status-badge status-ontvangen">Uitverkocht</span>`
                : `<input
                    type="number"
                    min="0"
                    ${inVoorraad != null ? `max="${inVoorraad}"` : ""}
                    step="${product.eenheid === "kg" ? "0.1" : "1"}"
                    value="${cart[product.id] || ""}"
                    placeholder="0"
                    data-product-id="${product.id}"
                    class="aantal-invoer"
                  />`
            }
          </td>
        `;
        tbody.appendChild(tr);

        const input = tr.querySelector("input");
        if (input) {
          input.addEventListener("input", (e) => {
            let waarde = parseFloat(e.target.value);
            if (inVoorraad != null && waarde > inVoorraad) {
              waarde = inVoorraad;
              e.target.value = waarde;
            }
            if (!waarde || waarde <= 0) {
              delete cart[product.id];
            } else {
              cart[product.id] = waarde;
            }
            bewaarCart();
            renderCart();
          });
        }
      }

      els.productenBody.appendChild(tabel);
    }
  }

  function renderCart() {
    const regels = Object.entries(cart).filter(([, aantal]) => aantal > 0);
    els.cartLijst.innerHTML = "";

    if (regels.length === 0) {
      els.cartLijst.innerHTML = "<li class='cart-leeg'>Nog niets in je winkelwagen.</li>";
    }

    let totaal = 0;
    for (const [productId, aantal] of regels) {
      const product = producten.find((p) => p.id === productId);
      const prijs = klant.prijslijst[productId];
      const subtotaal = aantal * prijs;
      totaal += subtotaal;

      const li = document.createElement("li");
      li.innerHTML = `<span>${aantal} ${product.eenheid} ${product.naam}</span><span>${BestelUtils.formatEuro(subtotaal)}</span>`;
      els.cartLijst.appendChild(li);
    }

    els.cartTotaal.textContent = BestelUtils.formatEuro(totaal);

    const levering = BestelUtils.eerstvolgendeLevering(klant, new Date());
    els.leverdatum.textContent = levering
      ? BestelUtils.formatDatum(levering.leverdatum)
      : "Geen leverdag ingesteld — neem contact op met de kaashandel.";

    const minimum = klant.minimumbedrag;
    const onderMinimum = minimum != null && totaal < minimum;
    if (onderMinimum) {
      els.minimumMelding.textContent = `Minimumbedrag van ${BestelUtils.formatEuro(minimum)} nog niet bereikt (huidig: ${BestelUtils.formatEuro(totaal)}).`;
    } else {
      els.minimumMelding.textContent = "";
    }

    els.bestelKnop.disabled = regels.length === 0 || onderMinimum || !levering;
  }

  async function vindUniekBestandspad(leverdatumIso) {
    let pad = `data/orders/${leverdatumIso}-${klantId}.json`;
    let poging = 1;
    while (poging <= 20) {
      const bestaand = await GitHubAPI.getFile(pad);
      if (!bestaand.content) return pad;
      poging += 1;
      pad = `data/orders/${leverdatumIso}-${klantId}-${poging}.json`;
    }
    throw new Error("Kon geen unieke bestandsnaam voor de bestelling vinden.");
  }

  async function plaatsBestelling() {
    els.bestelFout.textContent = "";
    els.bestelKnop.disabled = true;
    els.bestelKnop.textContent = "Bezig met bestellen...";

    try {
      const regels = Object.entries(cart)
        .filter(([, aantal]) => aantal > 0)
        .map(([productId, aantal]) => {
          const product = producten.find((p) => p.id === productId);
          return {
            product_id: productId,
            naam: product.naam,
            eenheid: product.eenheid,
            aantal,
            prijs: klant.prijslijst[productId],
          };
        });

      const totaal = regels.reduce((som, r) => som + r.aantal * r.prijs, 0);
      const levering = BestelUtils.eerstvolgendeLevering(klant, new Date());
      const leverdatumIso = BestelUtils.isoDatum(levering.leverdatum);

      const order = {
        klant_id: klantId,
        klant_naam: klant.naam,
        besteld_op: new Date().toISOString(),
        leverdatum: leverdatumIso,
        status: "ontvangen",
        regels,
        totaal,
      };

      const pad = await vindUniekBestandspad(leverdatumIso);
      await GitHubAPI.putJson(pad, order, `Nieuwe bestelling ${klant.naam} (${leverdatumIso})`);

      try {
        const { data: alleKlanten, sha } = await GitHubAPI.getJson("data/customers.json");
        const idx = alleKlanten.findIndex((k) => k.id === klantId);
        if (idx !== -1) {
          alleKlanten[idx].laatste_bestelling = new Date().toISOString();
          await GitHubAPI.putJson(
            "data/customers.json",
            alleKlanten,
            `Laatste bestelling bijgewerkt: ${klant.naam}`,
            sha
          );
        }
      } catch (e) {
        console.warn("Kon laatste_bestelling niet bijwerken:", e);
      }

      cart = {};
      bewaarCart();
      renderProducten();
      renderCart();

      els.bestelPaneel.hidden = true;
      els.bevestiging.hidden = false;
      els.bevestigingTekst.textContent = `Bedankt! Je bestelling voor ${BestelUtils.formatDatum(levering.leverdatum)} (totaal ${BestelUtils.formatEuro(totaal)}) is ontvangen.`;
    } catch (err) {
      console.error(err);
      els.bestelFout.textContent =
        err.message.includes("token")
          ? "Bestellen is nog niet actief: er is geen schrijftoegang ingesteld. Neem contact op met de kaashandel."
          : "Er ging iets mis bij het plaatsen van de bestelling. Probeer het opnieuw.";
    } finally {
      els.bestelKnop.disabled = false;
      els.bestelKnop.textContent = "Bestelling plaatsen";
    }
  }

  document.getElementById("bestel-form").addEventListener("submit", (e) => {
    e.preventDefault();
    plaatsBestelling();
  });

  document.getElementById("nieuwe-bestelling").addEventListener("click", () => {
    els.bevestiging.hidden = true;
    els.bestelPaneel.hidden = false;
  });

  document.getElementById("uitloggen").addEventListener("click", () => {
    Auth.logoutKlant();
    window.location.href = `index.html?klant=${encodeURIComponent(klantId)}`;
  });
})();

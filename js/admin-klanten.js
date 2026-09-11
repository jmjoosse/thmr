(async function () {
  if (!Auth.verplichtAdminSessie()) return;

  document.getElementById("uitloggen").addEventListener("click", () => {
    Auth.logoutAdmin();
    window.location.href = "index.html";
  });

  const DAGEN = ["maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag", "zondag"];

  const els = {
    klantenBody: document.getElementById("klanten-body"),
    lijstSectie: document.getElementById("lijst-sectie"),
    formSectie: document.getElementById("form-sectie"),
    formTitel: document.getElementById("form-titel"),
    form: document.getElementById("klant-form"),
    naam: document.getElementById("naam"),
    klantId: document.getElementById("klant-id"),
    klantIdHint: document.getElementById("klant-id-hint"),
    actief: document.getElementById("actief"),
    pincodeNieuw: document.getElementById("pincode-nieuw"),
    pincodeHint: document.getElementById("pincode-hint"),
    minimumbedrag: document.getElementById("minimumbedrag"),
    leverdagenBody: document.getElementById("leverdagen-body"),
    sluitingsdagNieuw: document.getElementById("sluitingsdag-nieuw"),
    sluitingsdagToevoegen: document.getElementById("sluitingsdag-toevoegen"),
    sluitingsdagenLijst: document.getElementById("sluitingsdagen-lijst"),
    prijslijstBody: document.getElementById("prijslijst-body"),
    formFout: document.getElementById("form-fout"),
    nieuweKlantKnop: document.getElementById("nieuwe-klant-knop"),
    annulerenKnop: document.getElementById("annuleren-knop"),
  };

  let klanten = [];
  let producten = [];
  let bewerkKlantId = null; // null = nieuwe klant
  let sluitingsdagen = [];

  async function laad() {
    [klanten, producten] = await Promise.all([
      fetch("../data/customers.json", { cache: "no-store" }).then((r) => r.json()),
      fetch("../data/products.json", { cache: "no-store" }).then((r) => r.json()),
    ]);
    renderLijst();
  }

  function renderLijst() {
    els.klantenBody.innerHTML = "";
    for (const klant of klanten) {
      const tr = document.createElement("tr");
      const link = new URL(`../index.html?klant=${encodeURIComponent(klant.id)}`, window.location.href).href;
      tr.innerHTML = `
        <td>${klant.naam}</td>
        <td>${klant.actief === false ? "Nee" : "Ja"}</td>
        <td>${klant.laatste_login ? new Date(klant.laatste_login).toLocaleString("nl-NL") : "Nog nooit"}</td>
        <td>${klant.laatste_bestelling ? new Date(klant.laatste_bestelling).toLocaleString("nl-NL") : "Nog nooit"}</td>
        <td style="white-space: nowrap">
          <button type="button" class="link bewerk-knop" style="width: auto">Bewerken</button>
          <button type="button" class="link kopieer-knop" style="width: auto">Kopieer link</button>
        </td>
      `;
      tr.querySelector(".bewerk-knop").addEventListener("click", () => openForm(klant));
      tr.querySelector(".kopieer-knop").addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(link);
          alert(`Link gekopieerd:\n${link}`);
        } catch {
          prompt("Kopieer deze link:", link);
        }
      });
      els.klantenBody.appendChild(tr);
    }
  }

  function slugify(tekst) {
    return tekst
      .toLowerCase()
      .normalize("NFD")
      .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }

  function renderLeverdagenRijen(klant) {
    els.leverdagenBody.innerHTML = "";
    const leverdagen = new Set(klant ? klant.leverdagen || [] : []);
    const cutoff = klant ? klant.cutoff || {} : {};

    for (const dag of DAGEN) {
      const info = cutoff[dag];
      const tr = document.createElement("tr");
      tr.dataset.dag = dag;
      tr.innerHTML = `
        <td>
          <label style="display: flex; align-items: center; gap: 8px; margin: 0">
            <input type="checkbox" class="leverdag-check" style="width: auto; margin: 0" ${leverdagen.has(dag) ? "checked" : ""} />
            ${dag[0].toUpperCase() + dag.slice(1)}
          </label>
        </td>
        <td style="display: flex; gap: 8px; align-items: center">
          bestellen tot
          <select class="cutoff-dag" style="width: auto; margin: 0"></select>
          <input type="time" class="cutoff-tijd" style="width: auto; margin: 0" value="${info ? info.tijd : "18:00"}" />
        </td>
      `;
      const select = tr.querySelector(".cutoff-dag");
      for (const cutoffDag of DAGEN) {
        const optie = document.createElement("option");
        optie.value = cutoffDag;
        optie.textContent = cutoffDag[0].toUpperCase() + cutoffDag.slice(1);
        if (info && info.dag === cutoffDag) optie.selected = true;
        select.appendChild(optie);
      }
      els.leverdagenBody.appendChild(tr);
    }
  }

  function renderSluitingsdagen() {
    els.sluitingsdagenLijst.innerHTML = "";
    if (sluitingsdagen.length === 0) {
      els.sluitingsdagenLijst.innerHTML = "<li class='cart-leeg'>Geen sluitingsdagen ingesteld.</li>";
      return;
    }
    for (const datum of [...sluitingsdagen].sort()) {
      const li = document.createElement("li");
      li.innerHTML = `<span>${new Date(datum).toLocaleDateString("nl-NL")}</span>`;
      const verwijderKnop = document.createElement("button");
      verwijderKnop.type = "button";
      verwijderKnop.className = "link";
      verwijderKnop.style.width = "auto";
      verwijderKnop.textContent = "Verwijderen";
      verwijderKnop.addEventListener("click", () => {
        sluitingsdagen = sluitingsdagen.filter((d) => d !== datum);
        renderSluitingsdagen();
      });
      li.appendChild(verwijderKnop);
      els.sluitingsdagenLijst.appendChild(li);
    }
  }

  function renderPrijslijst(klant) {
    els.prijslijstBody.innerHTML = "";
    const prijslijst = klant ? klant.prijslijst || {} : {};
    for (const product of producten) {
      const tr = document.createElement("tr");
      tr.dataset.productId = product.id;
      tr.innerHTML = `
        <td>${product.naam}${product.actief ? "" : " (inactief)"}</td>
        <td>${BestelUtils.formatEuro(product.inkoopprijs)}</td>
        <td>
          <input
            type="number"
            min="0"
            step="0.01"
            class="prijs-invoer"
            placeholder="niet aangeboden"
            value="${prijslijst[product.id] != null ? prijslijst[product.id] : ""}"
          />
        </td>
      `;
      els.prijslijstBody.appendChild(tr);
    }
  }

  function openForm(klant) {
    bewerkKlantId = klant ? klant.id : null;
    els.formTitel.textContent = klant ? `Klant bewerken: ${klant.naam}` : "Nieuwe klant";
    els.formFout.textContent = "";

    els.naam.value = klant ? klant.naam : "";
    els.klantId.value = klant ? klant.id : "";
    els.klantId.disabled = !!klant;
    els.klantIdHint.textContent = klant
      ? "De klantcode kan niet worden gewijzigd (staat in de bestellink van de klant)."
      : "Wordt automatisch voorgesteld op basis van de naam; moet uniek zijn.";
    els.actief.checked = klant ? klant.actief !== false : true;

    els.pincodeNieuw.value = "";
    els.pincodeHint.textContent = klant
      ? "Laat leeg om de huidige pincode te behouden."
      : "Verplicht voor een nieuwe klant.";

    els.minimumbedrag.value = klant && klant.minimumbedrag != null ? klant.minimumbedrag : "";

    sluitingsdagen = klant ? [...(klant.sluitingsdagen || [])] : [];
    renderLeverdagenRijen(klant);
    renderSluitingsdagen();
    renderPrijslijst(klant);

    els.lijstSectie.hidden = true;
    els.formSectie.hidden = false;
    window.scrollTo(0, 0);
  }

  function sluitForm() {
    els.formSectie.hidden = true;
    els.lijstSectie.hidden = false;
  }

  els.naam.addEventListener("input", () => {
    if (!bewerkKlantId && !els.klantId.dataset.handmatig) {
      els.klantId.value = slugify(els.naam.value);
    }
  });
  els.klantId.addEventListener("input", () => {
    els.klantId.dataset.handmatig = "1";
  });

  els.nieuweKlantKnop.addEventListener("click", () => openForm(null));
  els.annulerenKnop.addEventListener("click", sluitForm);

  els.sluitingsdagToevoegen.addEventListener("click", () => {
    const waarde = els.sluitingsdagNieuw.value;
    if (!waarde) return;
    if (!sluitingsdagen.includes(waarde)) sluitingsdagen.push(waarde);
    els.sluitingsdagNieuw.value = "";
    renderSluitingsdagen();
  });

  els.form.addEventListener("submit", async (e) => {
    e.preventDefault();
    els.formFout.textContent = "";

    const naam = els.naam.value.trim();
    const klantId = els.klantId.value.trim();
    if (!naam || !klantId) {
      els.formFout.textContent = "Naam en klantcode zijn verplicht.";
      return;
    }
    if (!bewerkKlantId && klanten.some((k) => k.id === klantId)) {
      els.formFout.textContent = "Deze klantcode bestaat al, kies een andere.";
      return;
    }
    if (!bewerkKlantId && !els.pincodeNieuw.value.trim()) {
      els.formFout.textContent = "Een pincode is verplicht voor een nieuwe klant.";
      return;
    }

    const opslaanKnop = document.getElementById("opslaan-knop");
    opslaanKnop.disabled = true;
    opslaanKnop.textContent = "Opslaan...";

    try {
      const leverdagen = [];
      const cutoff = {};
      for (const tr of els.leverdagenBody.querySelectorAll("tr")) {
        if (!tr.querySelector(".leverdag-check").checked) continue;
        const dag = tr.dataset.dag;
        leverdagen.push(dag);
        cutoff[dag] = {
          dag: tr.querySelector(".cutoff-dag").value,
          tijd: tr.querySelector(".cutoff-tijd").value,
        };
      }

      const prijslijst = {};
      for (const tr of els.prijslijstBody.querySelectorAll("tr")) {
        const invoer = tr.querySelector(".prijs-invoer").value;
        if (invoer !== "") prijslijst[tr.dataset.productId] = parseFloat(invoer);
      }

      const minimumbedrag = els.minimumbedrag.value !== "" ? parseFloat(els.minimumbedrag.value) : null;

      const { data: actueleKlanten, sha } = await GitHubAPI.getJson("data/customers.json");
      const lijst = actueleKlanten || [];
      const idx = lijst.findIndex((k) => k.id === (bewerkKlantId || klantId));

      const bestaandeKlant = idx !== -1 ? lijst[idx] : null;
      let pincodeHash = bestaandeKlant ? bestaandeKlant.pincodeHash : null;
      if (els.pincodeNieuw.value.trim()) {
        pincodeHash = await hashPincode(els.pincodeNieuw.value.trim());
      }

      const nieuweKlant = {
        id: bewerkKlantId || klantId,
        naam,
        actief: els.actief.checked,
        pincodeHash,
        leverdagen,
        cutoff,
        sluitingsdagen,
        minimumbedrag,
        prijslijst,
        laatste_login: bestaandeKlant ? bestaandeKlant.laatste_login || null : null,
        laatste_bestelling: bestaandeKlant ? bestaandeKlant.laatste_bestelling || null : null,
      };

      if (idx !== -1) {
        lijst[idx] = nieuweKlant;
      } else {
        lijst.push(nieuweKlant);
      }

      await GitHubAPI.putJson(
        "data/customers.json",
        lijst,
        `Klant ${bewerkKlantId ? "bijgewerkt" : "aangemaakt"}: ${naam}`,
        sha
      );

      klanten = lijst;
      renderLijst();
      sluitForm();
    } catch (err) {
      console.error(err);
      els.formFout.textContent = err.message.includes("token")
        ? "Opslaan mislukt: geen schrijftoegang ingesteld (zie githubToken in js/config.js)."
        : `Opslaan mislukt: ${err.message}`;
    } finally {
      opslaanKnop.disabled = false;
      opslaanKnop.textContent = "Opslaan";
    }
  });

  async function hashPincode(tekst) {
    const bytes = new TextEncoder().encode(tekst);
    const buffer = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(buffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  await laad();
})();

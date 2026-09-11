(async function () {
  if (!Auth.verplichtAdminSessie()) return;

  document.getElementById("uitloggen").addEventListener("click", () => {
    Auth.logoutAdmin();
    window.location.href = "index.html";
  });

  const els = {
    lijstSectie: document.getElementById("lijst-sectie"),
    formSectie: document.getElementById("form-sectie"),
    formTitel: document.getElementById("form-titel"),
    productenBody: document.getElementById("producten-body"),
    form: document.getElementById("product-form"),
    naam: document.getElementById("naam"),
    productId: document.getElementById("product-id"),
    productIdHint: document.getElementById("product-id-hint"),
    categorie: document.getElementById("categorie"),
    categorieOpties: document.getElementById("categorie-opties"),
    eenheid: document.getElementById("eenheid"),
    inkoopprijs: document.getElementById("inkoopprijs"),
    actief: document.getElementById("actief"),
    formFout: document.getElementById("form-fout"),
    nieuwProductKnop: document.getElementById("nieuw-product-knop"),
    annulerenKnop: document.getElementById("annuleren-knop"),
  };

  let producten = [];
  let bewerkProductId = null;

  function slugify(tekst) {
    return tekst
      .toLowerCase()
      .normalize("NFD")
      .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }

  async function laad() {
    const res = await fetch("../data/products.json", { cache: "no-store" });
    producten = await res.json();
    renderLijst();
    renderCategorieOpties();
  }

  function renderCategorieOpties() {
    const categorieen = [...new Set(producten.map((p) => p.categorie))];
    els.categorieOpties.innerHTML = categorieen.map((c) => `<option value="${c}"></option>`).join("");
  }

  function renderLijst() {
    els.productenBody.innerHTML = "";
    for (const product of producten) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${product.naam}</td>
        <td>${product.categorie}</td>
        <td>${product.eenheid}</td>
        <td>${BestelUtils.formatEuro(product.inkoopprijs)}</td>
        <td>${product.actief ? "Ja" : "Nee"}</td>
        <td><button type="button" class="link bewerk-knop" style="width: auto">Bewerken</button></td>
      `;
      tr.querySelector(".bewerk-knop").addEventListener("click", () => openForm(product));
      els.productenBody.appendChild(tr);
    }
  }

  function openForm(product) {
    bewerkProductId = product ? product.id : null;
    els.formTitel.textContent = product ? `Product bewerken: ${product.naam}` : "Nieuw product";
    els.formFout.textContent = "";

    els.naam.value = product ? product.naam : "";
    els.productId.value = product ? product.id : "";
    els.productId.disabled = !!product;
    els.productId.dataset.handmatig = "";
    els.productIdHint.textContent = product
      ? "De productcode kan niet worden gewijzigd (wordt gebruikt in prijslijsten en bestellingen)."
      : "Wordt automatisch voorgesteld op basis van de naam; moet uniek zijn.";
    els.categorie.value = product ? product.categorie : "";
    els.eenheid.value = product ? product.eenheid : "stuk";
    els.inkoopprijs.value = product ? product.inkoopprijs : "";
    els.actief.checked = product ? product.actief !== false : true;

    els.lijstSectie.hidden = true;
    els.formSectie.hidden = false;
    window.scrollTo(0, 0);
  }

  function sluitForm() {
    els.formSectie.hidden = true;
    els.lijstSectie.hidden = false;
  }

  els.naam.addEventListener("input", () => {
    if (!bewerkProductId && !els.productId.dataset.handmatig) {
      els.productId.value = slugify(els.naam.value);
    }
  });
  els.productId.addEventListener("input", () => {
    els.productId.dataset.handmatig = "1";
  });

  els.nieuwProductKnop.addEventListener("click", () => openForm(null));
  els.annulerenKnop.addEventListener("click", sluitForm);

  els.form.addEventListener("submit", async (e) => {
    e.preventDefault();
    els.formFout.textContent = "";

    const naam = els.naam.value.trim();
    const productId = els.productId.value.trim();
    if (!naam || !productId || !els.categorie.value.trim() || els.inkoopprijs.value === "") {
      els.formFout.textContent = "Vul alle verplichte velden in.";
      return;
    }
    if (!bewerkProductId && producten.some((p) => p.id === productId)) {
      els.formFout.textContent = "Deze productcode bestaat al, kies een andere.";
      return;
    }

    const opslaanKnop = document.getElementById("opslaan-knop");
    opslaanKnop.disabled = true;
    opslaanKnop.textContent = "Opslaan...";

    try {
      const { data: actueleProducten, sha } = await GitHubAPI.getJson("data/products.json");
      const lijst = actueleProducten || [];
      const idx = lijst.findIndex((p) => p.id === (bewerkProductId || productId));

      const nieuwProduct = {
        id: bewerkProductId || productId,
        naam,
        categorie: els.categorie.value.trim(),
        eenheid: els.eenheid.value,
        inkoopprijs: parseFloat(els.inkoopprijs.value),
        actief: els.actief.checked,
      };

      if (idx !== -1) {
        lijst[idx] = nieuwProduct;
      } else {
        lijst.push(nieuwProduct);
      }

      await GitHubAPI.putJson(
        "data/products.json",
        lijst,
        `Product ${bewerkProductId ? "bijgewerkt" : "aangemaakt"}: ${naam}`,
        sha
      );

      producten = lijst;
      renderLijst();
      renderCategorieOpties();
      sluitForm();
    } catch (err) {
      console.error(err);
      els.formFout.textContent = err.message.includes("token")
        ? "Opslaan mislukt: geen schrijftoegang ingesteld (zie GitHub-token op het dashboard)."
        : `Opslaan mislukt: ${err.message}`;
    } finally {
      opslaanKnop.disabled = false;
      opslaanKnop.textContent = "Opslaan";
    }
  });

  await laad();
})();

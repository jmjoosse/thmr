(async function () {
  if (!Auth.verplichtAdminSessie()) return;

  document.getElementById("uitloggen").addEventListener("click", () => {
    Auth.logoutAdmin();
    window.location.href = "index.html";
  });

  const body = document.getElementById("voorraad-body");
  const formFout = document.getElementById("form-fout");

  const [producten, voorraad] = await Promise.all([
    fetch("../data/products.json", { cache: "no-store" }).then((r) => r.json()),
    fetch("../data/stock.json", { cache: "no-store" }).then((r) => r.json()),
  ]);

  body.innerHTML = "";
  for (const product of producten.filter((p) => p.actief)) {
    const tr = document.createElement("tr");
    tr.dataset.productId = product.id;
    tr.innerHTML = `
      <td>${product.naam}</td>
      <td>${product.eenheid}</td>
      <td>
        <input
          type="number"
          class="voorraad-invoer"
          min="0"
          step="${product.eenheid === "kg" ? "0.1" : "1"}"
          value="${voorraad[product.id] != null ? voorraad[product.id] : 0}"
        />
      </td>
    `;
    body.appendChild(tr);
  }

  document.getElementById("voorraad-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    formFout.textContent = "";
    const opslaanKnop = document.getElementById("opslaan-knop");
    opslaanKnop.disabled = true;
    opslaanKnop.textContent = "Opslaan...";

    try {
      const { data: actueleVoorraad, sha } = await GitHubAPI.getJson("data/stock.json");
      const nieuweVoorraad = actueleVoorraad || {};
      for (const tr of body.querySelectorAll("tr")) {
        nieuweVoorraad[tr.dataset.productId] = parseFloat(tr.querySelector(".voorraad-invoer").value) || 0;
      }
      await GitHubAPI.putJson("data/stock.json", nieuweVoorraad, "Voorraad bijgewerkt", sha);
    } catch (err) {
      console.error(err);
      formFout.textContent = err.message.includes("token")
        ? "Opslaan mislukt: geen schrijftoegang ingesteld (vul een GitHub-token in op het admin-dashboard)."
        : `Opslaan mislukt: ${err.message}`;
    } finally {
      opslaanKnop.disabled = false;
      opslaanKnop.textContent = "Alles opslaan";
    }
  });
})();

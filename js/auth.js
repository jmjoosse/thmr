// Pincode-toegang: client-side check tegen data/customers.json (klant) of
// data/settings.json (admin). Geen wachtwoordbeheer, geen accounts.

const Auth = (() => {
  const CUSTOMER_SESSION_KEY = "klant_sessie";
  const ADMIN_SESSION_KEY = "admin_sessie";
  const CUSTOMER_SESSION_UUR = 12; // klantsessie blijft geldig op dit toestel
  const ADMIN_SESSION_UUR = 2; // admin moet vaker opnieuw inloggen

  async function sha256Hex(text) {
    const bytes = new TextEncoder().encode(text);
    const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  function sessionGeldig(raw, geldigheidsduurUur) {
    if (!raw) return null;
    try {
      const sessie = JSON.parse(raw);
      const verlopen = Date.now() - sessie.ingelogdOp > geldigheidsduurUur * 60 * 60 * 1000;
      return verlopen ? null : sessie;
    } catch {
      return null;
    }
  }

  // --- Klant ---

  async function loginKlant(klantId, pincode) {
    const res = await fetch("data/customers.json", { cache: "no-store" });
    const klanten = await res.json();
    const klant = klanten.find((k) => k.id === klantId && k.actief !== false);
    if (!klant) return { ok: false, fout: "Onbekende klant." };

    const hash = await sha256Hex(pincode);
    if (hash !== klant.pincodeHash) return { ok: false, fout: "Onjuiste pincode." };

    localStorage.setItem(
      CUSTOMER_SESSION_KEY,
      JSON.stringify({ klantId, ingelogdOp: Date.now() })
    );

    // Laatste_login bijwerken is best effort: mag de login zelf nooit blokkeren.
    if (typeof GitHubAPI !== "undefined") {
      GitHubAPI.getJson("data/customers.json")
        .then(({ data: alleKlanten, sha }) => {
          if (!alleKlanten) return;
          const idx = alleKlanten.findIndex((k) => k.id === klantId);
          if (idx === -1) return;
          alleKlanten[idx].laatste_login = new Date().toISOString();
          return GitHubAPI.putJson(
            "data/customers.json",
            alleKlanten,
            `Laatste login bijgewerkt: ${klant.naam}`,
            sha
          );
        })
        .catch((e) => console.warn("Kon laatste_login niet bijwerken:", e));
    }

    return { ok: true, klant };
  }

  function klantSessie() {
    const sessie = sessionGeldig(localStorage.getItem(CUSTOMER_SESSION_KEY), CUSTOMER_SESSION_UUR);
    return sessie ? sessie.klantId : null;
  }

  // Stuurt terug naar de loginpagina van deze klant als er geen geldige sessie is.
  // Geeft het klantId terug wanneer de sessie wel geldig is.
  function verplichtKlantSessie(verwachtKlantId) {
    const klantId = klantSessie();
    if (!klantId || (verwachtKlantId && klantId !== verwachtKlantId)) {
      window.location.href = `index.html?klant=${encodeURIComponent(verwachtKlantId || "")}`;
      return null;
    }
    return klantId;
  }

  function logoutKlant() {
    localStorage.removeItem(CUSTOMER_SESSION_KEY);
  }

  // --- Admin ---

  async function loginAdmin(pincode) {
    const res = await fetch("../data/settings.json", { cache: "no-store" });
    const settings = await res.json();
    const hash = await sha256Hex(pincode);
    if (hash !== settings.adminPincodeHash) return { ok: false, fout: "Onjuiste pincode." };

    sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify({ ingelogdOp: Date.now() }));
    return { ok: true };
  }

  function adminSessie() {
    return !!sessionGeldig(sessionStorage.getItem(ADMIN_SESSION_KEY), ADMIN_SESSION_UUR);
  }

  function verplichtAdminSessie() {
    if (!adminSessie()) {
      window.location.href = "index.html";
      return false;
    }
    return true;
  }

  function logoutAdmin() {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
  }

  return {
    loginKlant,
    klantSessie,
    verplichtKlantSessie,
    logoutKlant,
    loginAdmin,
    adminSessie,
    verplichtAdminSessie,
    logoutAdmin,
  };
})();

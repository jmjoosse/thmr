// Gedeelde helpers voor catalogus.html en bestellingen.html:
// prijs/datum-formattering en de cutoff-/leverdag-berekening.

const BestelUtils = (() => {
  const DAGEN = ["zondag", "maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag"];

  function dagIndex(naam) {
    return DAGEN.indexOf((naam || "").toLowerCase());
  }

  function formatEuro(bedrag) {
    return bedrag.toLocaleString("nl-NL", { style: "currency", currency: "EUR" });
  }

  function formatDatum(datum) {
    return datum.toLocaleDateString("nl-NL", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  function eerstvolgendeDatumVoorDag(vanaf, dagIdx) {
    const d = new Date(vanaf);
    d.setHours(0, 0, 0, 0);
    const verschil = (dagIdx - d.getDay() + 7) % 7;
    d.setDate(d.getDate() + verschil);
    return d;
  }

  // Bepaalt, voor elke geconfigureerde leverdag van de klant, de eerstvolgende
  // leverdatum waarvoor de cutoff nog niet gepasseerd is en die geen
  // sluitingsdag is. Geeft de vroegste daarvan terug als
  // { leverdatum: Date, cutoffDatum: Date|null }.
  function eerstvolgendeLevering(klant, now = new Date()) {
    const kandidaten = [];
    const sluitingsdagen = new Set(klant.sluitingsdagen || []);

    for (const leverdag of klant.leverdagen || []) {
      const cutoffInfo = (klant.cutoff || {})[leverdag];
      let leverdatum = eerstvolgendeDatumVoorDag(now, dagIndex(leverdag));

      for (let poging = 0; poging < 12; poging++) {
        let cutoffDatum = null;
        if (cutoffInfo) {
          const diffDagen = (dagIndex(leverdag) - dagIndex(cutoffInfo.dag) + 7) % 7;
          cutoffDatum = new Date(leverdatum);
          cutoffDatum.setDate(cutoffDatum.getDate() - diffDagen);
          const [uu, mm] = cutoffInfo.tijd.split(":").map(Number);
          cutoffDatum.setHours(uu, mm, 0, 0);
        }

        const nogOpenbaar = !cutoffDatum || now <= cutoffDatum;
        const gesloten = sluitingsdagen.has(isoDatum(leverdatum));
        if (nogOpenbaar && !gesloten) {
          kandidaten.push({ leverdatum, cutoffDatum });
          break;
        }
        leverdatum = new Date(leverdatum);
        leverdatum.setDate(leverdatum.getDate() + 7);
      }
    }

    kandidaten.sort((a, b) => a.leverdatum - b.leverdatum);
    return kandidaten[0] || null;
  }

  function isoDatum(datum) {
    return datum.toISOString().slice(0, 10);
  }

  return { formatEuro, formatDatum, eerstvolgendeLevering, isoDatum };
})();

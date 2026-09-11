# Bestelportaal kaashandel

Statische HTML/JS-app, gehost via GitHub Pages. De GitHub API (Contents API)
dient als opslag i.p.v. een database: elke wijziging wordt een commit.

## Structuur

```
data/
  customers.json      # klanten: pincode (gehashed), prijslijst, leverdagen, cutoff
  products.json        # producten: naam, categorie, eenheid, inkoopprijs
  stock.json           # voorraad per product-id
  settings.json        # adminPincodeHash
  orders/               # één JSON-bestand per bestelling
js/
  config.js             # githubOwner/githubRepo/githubBranch + schrijftoken
  github-api.js          # lees/schrijf-laag rond de GitHub Contents API
  auth.js                 # pincode-check (klant + admin) via SHA-256 hash
  bestel-utils.js          # prijs/datum-formattering, cutoff-/leverdag-berekening
  catalogus.js              # catalogus, winkelwagen, bestelling plaatsen
  bestellingen.js            # bestelgeschiedenis + herhaalbestelling
  admin-klanten.js            # admin: klanten aanmaken/bewerken + prijzen
css/style.css
index.html              # klant-login: verwacht ?klant=<id> in de URL
catalogus.html           # klant-catalogus: producten, winkelwagen, bestellen
bestellingen.html         # bestelgeschiedenis + "herhaal deze bestelling"
admin/index.html          # admin-login
admin/dashboard.html      # admin-omgeving, link naar klanten & prijzen
admin/klanten.html         # klanten aanmaken/bewerken, prijzen, leverdagen,
                            # sluitingsdagen, laatste login/bestelling
```

## Lokaal testen

Pincode-hashing gebruikt `crypto.subtle`, wat een secure context vereist —
open de bestanden dus niet direct via `file://`. Start een lokale server
vanuit deze map, bijvoorbeeld met Python:

```bash
python -m http.server 8080
```

of, als er geen Python/Node beschikbaar is (bv. kale Windows-machine), met het
meegeleverde `serve.ps1`:

```powershell
powershell -ExecutionPolicy Bypass -File serve.ps1 -Port 8080
```

en open `http://localhost:8080/index.html?klant=hotel-amstel`.

Testdata (**wijzig dit voor productie**):

- Klant "Hotel Amstel" (`?klant=hotel-amstel`) — pincode `0000`, leverdagen
  maandag/donderdag (cutoff zondag/woensdag 18:00), minimum €25, prijzen voor
  Brie 500g en Oude kaas
- Admin (`/admin/`) — pincode `1234`

Zonder `js/config.js`'s `githubToken` ingevuld kun je de catalogus bekijken en
door de flow lopen, maar het plaatsen van een bestelling geeft een nette
foutmelding ("nog geen schrijftoegang ingesteld") — verwacht gedrag, geen bug.

Pincodes wijzigen: bereken de SHA-256 hash van de nieuwe pincode en zet die
in `pincodeHash` (klant) resp. `adminPincodeHash` (settings.json). Bijvoorbeeld
in de browserconsole:

```js
crypto.subtle.digest("SHA-256", new TextEncoder().encode("nieuwe-pincode"))
  .then(buf => console.log([...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("")));
```

## GitHub Pages opzetten

1. Maak een GitHub-repo aan en push deze map (zie `scripts/push-to-github.ps1`
   als er geen git beschikbaar is op de machine waar je vandaan werkt).
2. Zet `js/config.js` op de juiste `githubOwner`/`githubRepo`.
3. Zet in de repo-instellingen GitHub Pages aan (branch `main`, root).
4. Maak een fine-grained personal access token met alleen **Contents:
   Read and write** op deze ene repo, en vul dat rechtstreeks in
   `js/config.js` (`githubToken`) in — niet via de chat/AI delen — en commit.

**Geaccepteerd risico:** dit token wordt met de site meegepubliceerd en is
dus door elke bezoeker van de site te lezen (bv. via "bekijk paginabron"),
ongeacht of de repo private of public staat — nodig zodat klanten zelf een
bestelling kunnen wegschrijven zonder eigen account/token. Wie het token vindt
kan bij alle data in de repo, inclusief andermans prijzen. Deze repo staat
bovendien op **public**, dus `data/customers.json` (met prijzen) is sowieso
door iedereen te lezen zodra er echte data in staat, los van dit token.
Geaccepteerd voor een eerste werkende versie; te herzien zodra het platform
meer klanten/omzet gaat dragen (dan alsnog een klein stukje eigen backend
ervoor, of overstap naar Laravel, en/of de repo op private).

## Status

- Stap 1 (repo-structuur + pincode-toegang): klaar
- Stap 2 (module 1+2 — catalogus, winkelwagen, bestellen, bestelgeschiedenis,
  herhaalbestelling): klaar
- Module 4 (admin: klanten aanmaken/bewerken, prijzen per klant, leverdagen +
  cutoff, sluitingsdagen, laatste login/bestelling zichtbaar): klaar

Volgende stappen volgens de bouwvolgorde: producten beheren (module 6),
voorraad (module 3), rapportage (module 5), notificaties (module 7).

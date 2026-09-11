# Bestelportaal kaashandel

Statische HTML/JS-app, gehost via GitHub Pages. De GitHub API (Contents API)
dient als opslag i.p.v. een database: elke wijziging wordt een commit.

## Structuur

```
data/
  customers.json      # klanten: pincode (gehashed), prijslijst, leverdagen,
                       # cutoff, sluitingsdagen, laatste_login/laatste_bestelling
  products.json        # producten: naam, categorie, eenheid, in-/verkoopprijs
  stock.json           # voorraad per product-id
  settings.json        # adminPincodeHash, btwPercentage
  orders/               # één JSON-bestand per bestelling
js/
  config.js             # githubOwner/githubRepo/githubBranch + schrijftoken
  github-api.js          # lees/schrijf-laag rond de GitHub Contents API
  auth.js                 # pincode-check (klant + admin) via SHA-256 hash
  bestel-utils.js          # prijs/datum-formattering, cutoff-/leverdag-berekening
  catalogus.js              # catalogus, winkelwagen, voorraad, bestelling plaatsen
  bestellingen.js            # klant: bestelgeschiedenis + herhaalbestelling
  admin-klanten.js            # admin: klanten aanmaken/bewerken + prijzen
  admin-producten.js           # admin: producten aanmaken/bewerken
  admin-voorraad.js             # admin: voorraad per product bijwerken
  admin-bestellingen.js          # admin: alle bestellingen + status bijwerken
  admin-rapportage.js             # admin: omzet/marge-rapport + CSV-export
css/style.css
index.html              # klant-login: verwacht ?klant=<id> in de URL
catalogus.html           # klant-catalogus: producten, winkelwagen, bestellen
bestellingen.html         # klant: bestelgeschiedenis + "herhaal deze bestelling"
admin/index.html          # admin-login
admin/dashboard.html      # admin-omgeving, links naar alle beheerpagina's
admin/klanten.html         # klanten aanmaken/bewerken, prijzen, leverdagen,
                            # sluitingsdagen, laatste login/bestelling
admin/producten.html        # producten aanmaken/bewerken
admin/voorraad.html          # voorraad per product bijwerken
admin/bestellingen.html       # alle bestellingen, status bijwerken (ontvangen/
                              # bevestigd/geleverd)
admin/rapportage.html         # omzet & marge per product/klant/maand,
                              # CSV-export (excl./incl. btw)
scripts/push-to-github.ps1     # pusht alle bestanden via de GitHub Contents API
                                # (voor als er geen git beschikbaar is)
serve.ps1                       # lokale statische server zonder Python/Node
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

Testdata (**wijzig dit voor productie**) — 5 klanten, 8 producten, 45
voorbeeldbestellingen over juli/augustus/september 2026, zodat de rapportage
meteen iets te tonen heeft:

| Klant | Link | Pincode |
|---|---|---|
| Hotel Amstel | `?klant=hotel-amstel` | `0000` |
| Restaurant De Gouden Lepel | `?klant=restaurant-de-gouden-lepel` | `1111` |
| Kaaswinkel Van Dam | `?klant=kaaswinkel-van-dam` | `2222` |
| Bistro Nooitgedacht | `?klant=bistro-nooitgedacht` | `3333` |
| Café De Kroon | `?klant=cafe-de-kroon` | `4444` |

Admin (`/admin/`) — pincode `1234`.

De 45 voorbeeldbestellingen staan als losse bestanden in `data/orders/` en
zijn gegenereerd met `scripts/generate-dummy-orders.ps1` (leest de klanten/
producten uit `data/*.json`, overschrijft alle bestaande orderbestanden).
Run opnieuw met `powershell -ExecutionPolicy Bypass -File
scripts/generate-dummy-orders.ps1` om andere/verse voorbeelddata te krijgen.

**Belangrijk:** bestelgeschiedenis, admin-bestellingen en rapportage lezen
altijd via de GitHub API rechtstreeks uit de (échte) repo — nooit uit de
lokale `data/orders/`-map met een simpele `fetch()`. Die pagina's laten dus
pas iets zien zodra de orderbestanden ook echt naar `jmjoosse/thmr` zijn
gepusht (zie `scripts/push-to-github.ps1`, die inmiddels automatisch alle
bestanden in `data/orders/` meeneemt). Catalogus/inloggen werken wel meteen
lokaal, want die lezen `customers.json`/`products.json`/`stock.json` gewoon
van schijf.

Zonder `js/config.js`'s `githubToken` ingevuld kun je alle pagina's bekijken en
door de flows lopen, maar elke actie die iets wegschrijft (bestelling
plaatsen, klant/product aanmaken, voorraad of status bijwerken) geeft een
nette foutmelding ("nog geen schrijftoegang ingesteld") — verwacht gedrag,
geen bug.

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

## Status — alle MVP-modules uit de brief zijn gebouwd

- Stap 1 (repo-structuur + pincode-toegang): klaar
- Module 1+2 (catalogus, winkelwagen, bestellen, bestelgeschiedenis,
  herhaalbestelling): klaar
- Module 4 (admin: klanten aanmaken/bewerken, prijzen per klant, leverdagen +
  cutoff, sluitingsdagen, laatste login/bestelling zichtbaar): klaar
- Module 6 (producten aanmaken/bewerken): klaar
- Module 3 (voorraad: handmatig bijwerken vanuit admin, "op=op" blokkeert
  bestellen, waarschuwing bij lage voorraad in de catalogus): klaar. Voorraad
  wordt bewust **niet** automatisch verlaagd bij een bestelling (zoals de
  brief expliciet als "later" aanmerkt).
- Module 5 (rapportage: omzet & marge per product/klant, omzet per maand,
  CSV-export excl./incl. btw): klaar
- Module 7 (notificaties): de MVP-variant uit de brief — bestellingen zijn
  direct zichtbaar in `admin/bestellingen.html`, waar de status ook
  bijgewerkt wordt. Er is **geen** automatische e-mail; dat vereist een
  externe koppeling (bv. Zapier/Make op nieuwe commits in `data/orders/`,
  of een form-naar-mail service) die buiten deze statische site om moet
  worden ingericht — geen scope voor een pure GitHub Pages-opzet.

Niet in scope voor MVP (per de brief): automatische facturatie, online
betalingen, WhatsApp Business API-integratie.

## Bekende beperkingen / vervolgstappen

- Alle rapportage- en bestellijsten laden bestellingen door de hele
  `data/orders/`-map op te vragen en elk bestand afzonderlijk te lezen via de
  GitHub API. Prima bij tientallen bestellingen/week; bij veel hogere volumes
  of na lange tijd kan dit traag worden of tegen API rate limits aanlopen
  (onauthenticated: 60 requests/uur) — dan is een indexbestand of eigen
  backend een logische volgende stap.
- Rapportage gebruikt de **huidige** inkoopprijs uit `products.json` voor
  margeberekening, niet de inkoopprijs die gold op het moment van bestellen.
- Gebruikersrechten (module 8, meerdere adminaccounts) is niet gebouwd — er
  is één gedeelde adminpincode.

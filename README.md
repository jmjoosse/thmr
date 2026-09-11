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
  config.js             # githubOwner/githubRepo/githubBranch (geen token hier!)
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

Zonder een token ingesteld op het admin-dashboard (`admin/dashboard.html`)
kun je alle pagina's bekijken en door de flows lopen, maar elke actie die
iets wegschrijft (bestelling plaatsen, klant/product aanmaken, voorraad of
status bijwerken) geeft een nette foutmelding ("nog geen schrijftoegang
ingesteld") — verwacht gedrag, geen bug.

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
3. Repo blijft **Public** (GitHub Pages voor een private repo vereist GitHub
   Pro of hoger — zie de uitleg hieronder over waarom we dat niet gebruiken).
4. Zet in de repo-instellingen GitHub Pages aan (branch `main`, root).
5. Log in op `/admin/`, ga naar het dashboard, en vul daar een GitHub
   personal access token in (classic, scope `public_repo`, Expiration "No
   expiration" — zelfde aanmaakstappen als eerder). Dat token wordt **alleen
   lokaal in die browser opgeslagen, nooit gecommit**.

### Waarom het token niet in `js/config.js` staat

Eerdere opzet: het token stond gecommit in `js/config.js`, zodat élke
bezoeker (ook klanten) er zelf mee kon schrijven. Dat liep vast op een
GitHub-eigenaardigheid: **GitHub scant publieke repo's automatisch op eigen
tokenformaten (`ghp_...`, `github_pat_...`) en trekt gevonden tokens binnen
enkele minuten zelf in.** Elk token dat we committen werd zo ongeldig, hoe
zorgvuldig ook aangemaakt/gekopieerd. Een private repo voorkomt die scan wél,
maar GitHub Pages op een private repo vereist een betaald account (GitHub
Pro+) — en dat wilden we niet.

**Huidige, tijdelijke oplossing:** het token staat alleen lokaal bij de admin
(nooit in een bestand, dus nooit gescand/ingetrokken), en de repo blijft
gratis public. **Gevolg: klanten kunnen momenteel geen bestelling zelf
plaatsen vanaf hun eigen apparaat** — de catalogus en het inloggen werken wel
gewoon, maar bij "Bestelling plaatsen" krijgen ze een nette foutmelding
("nog niet actief"), omdat hun browser geen token heeft. Alleen de admin kan
dus momenteel schrijfacties doen (klanten/producten/voorraad/status
bijwerken) vanaf het eigen, ingelogde apparaat.

**Om klanten weer zelf te laten bestellen** (de kernfunctie uit de brief) is
één van deze twee nodig:
- **GitHub Pro** (~$4/maand): repo mag dan private, token mag terug in
  `js/config.js` (scope dan `repo` i.p.v. `public_repo`), alles werkt zoals
  oorspronkelijk gebouwd. Geen extra bouwwerk.
- **Een klein gratis tussenlaagje** (bv. een serverless functie op
  Cloudflare Workers/Netlify Functions, gratis tier): die bewaart het token
  veilig als secret (nooit gecommit dus nooit gescand), en klant/browser
  praat met die functie in plaats van rechtstreeks met de GitHub API. Repo
  blijft public en gratis. Vereist wel extra bouwwerk — nog niet
  geïmplementeerd.

Bewust **niet** gekozen: het token in de client-code versleutelen/verbergen
om GitHub's scan te omzeilen. Dat verandert niets aan de eigenlijke
blootstelling (de ontsleuteling staat immers ook weer in diezelfde
publieke client-side JS) en zet alleen GitHub's eigen vangnet buiten werking.

## Status — alle MVP-modules uit de brief zijn gebouwd

- Stap 1 (repo-structuur + pincode-toegang): klaar
- Module 1+2 (catalogus, winkelwagen, bestellen, bestelgeschiedenis,
  herhaalbestelling): klaar, **maar zelf bestellen door klanten staat tijdelijk
  stil** door de token-kwestie hierboven — zie "GitHub Pages opzetten" voor
  de twee opties om dit weer aan te zetten. Alle admin-modules hieronder
  werken gewoon (die schrijven via het lokale admin-token).
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

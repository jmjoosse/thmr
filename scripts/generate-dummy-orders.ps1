# Dev-only hulpscript: genereert voorbeeldbestellingen in data/orders/ op basis
# van de klanten/producten die al in data/customers.json en data/products.json
# staan. Schrijft alleen lokale bestanden (geen GitHub API/token nodig) --
# bedoeld om de rapportagepagina te kunnen testen met realistische data.
# Bestaande data/orders/*.json (behalve .gitkeep) wordt eerst verwijderd.

param(
    [string]$Root = (Split-Path $PSScriptRoot -Parent),
    [int]$Seed = 42
)

$customersPath = Join-Path $Root "data/customers.json"
$productsPath = Join-Path $Root "data/products.json"
$ordersDir = Join-Path $Root "data/orders"

$customers = Get-Content $customersPath -Raw -Encoding UTF8 | ConvertFrom-Json
$products = Get-Content $productsPath -Raw -Encoding UTF8 | ConvertFrom-Json
$productsById = @{}
foreach ($p in $products) { $productsById[$p.id] = $p }

Get-ChildItem $ordersDir -Filter "*.json" | Remove-Item -Force

$rng = New-Object System.Random($Seed)

function Get-RandomAantal($eenheid, $rng) {
    if ($eenheid -eq "kg") {
        return [Math]::Round(($rng.Next(2, 20) / 2.0), 1) # 1.0 .. 9.5 in stappen van 0.5
    } else {
        return $rng.Next(1, 11) # 1 .. 10 stuks
    }
}

function Get-Leverdatums($jaar, $maandStart, $maandEnd) {
    $datums = @()
    for ($maand = $maandStart; $maand -le $maandEnd; $maand++) {
        $datums += [datetime]::new($jaar, $maand, 1)
    }
    return $datums
}

$statussenPerMaandOffset = @{
    0 = @("geleverd", "geleverd", "geleverd")
    1 = @("geleverd", "geleverd", "bevestigd")
    2 = @("ontvangen", "bevestigd", "geleverd")
}

$maanden = @(7, 8, 9) # juli, augustus, september 2026
$jaar = 2026
$aantalBestellingenPerKlantPerMaand = 3

$teller = 0
foreach ($klant in $customers) {
    $prijslijstKeys = @($klant.prijslijst.PSObject.Properties.Name)
    if ($prijslijstKeys.Count -eq 0) { continue }

    for ($maandIdx = 0; $maandIdx -lt $maanden.Count; $maandIdx++) {
        $maand = $maanden[$maandIdx]
        $statussen = $statussenPerMaandOffset[$maanden.Count - 1 - $maandIdx]

        for ($n = 0; $n -lt $aantalBestellingenPerKlantPerMaand; $n++) {
            $dag = $rng.Next(1, 28)
            $leverdatum = [datetime]::new($jaar, $maand, $dag)
            $leverdatumIso = $leverdatum.ToString("yyyy-MM-dd")

            $aantalRegels = $rng.Next(1, [Math]::Min(4, $prijslijstKeys.Count) + 1)
            $gekozenProducten = $prijslijstKeys | Sort-Object { $rng.Next() } | Select-Object -First $aantalRegels

            $regels = @()
            $totaal = 0.0
            foreach ($productId in $gekozenProducten) {
                $product = $productsById[$productId]
                $prijs = [double]$klant.prijslijst.$productId
                $aantal = Get-RandomAantal $product.eenheid $rng
                $regels += [ordered]@{
                    product_id = $productId
                    naam       = $product.naam
                    eenheid    = $product.eenheid
                    aantal     = $aantal
                    prijs      = $prijs
                }
                $totaal += [Math]::Round($aantal * $prijs, 2)
            }

            $status = $statussen[$rng.Next(0, $statussen.Count)]
            $besteldOp = $leverdatum.AddDays(-3).AddHours($rng.Next(8, 18)).ToString("yyyy-MM-ddTHH:mm:ss.000Z")

            $order = [ordered]@{
                klant_id    = $klant.id
                klant_naam  = $klant.naam
                besteld_op  = $besteldOp
                leverdatum  = $leverdatumIso
                status      = $status
                regels      = $regels
                totaal      = [Math]::Round($totaal, 2)
            }

            $bestandsnaam = "$leverdatumIso-$($klant.id).json"
            $pad = Join-Path $ordersDir $bestandsnaam
            $poging = 1
            while (Test-Path $pad) {
                $poging++
                $bestandsnaam = "$leverdatumIso-$($klant.id)-$poging.json"
                $pad = Join-Path $ordersDir $bestandsnaam
            }

            $json = $order | ConvertTo-Json -Depth 5
            [System.IO.File]::WriteAllText($pad, $json, (New-Object System.Text.UTF8Encoding($false)))
            $teller++
        }
    }
}

New-Item -ItemType File -Path (Join-Path $ordersDir ".gitkeep") -Force | Out-Null
Write-Host "$teller voorbeeldbestellingen aangemaakt in data/orders/"

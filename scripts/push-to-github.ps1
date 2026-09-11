param(
    [string]$Token = $env:THAMAR_GH_TOKEN,
    [string]$Owner = "jmjoosse",
    [string]$Repo = "Thamar",
    [string]$Branch = "main",
    [string]$Root = (Split-Path $PSScriptRoot -Parent)
)

if (-not $Token) {
    Write-Error "Geen token opgegeven. Zet eerst `$env:THAMAR_GH_TOKEN = '<je token>'` of geef -Token mee."
    exit 1
}

$headers = @{
    Authorization = "Bearer $Token"
    Accept        = "application/vnd.github+json"
    "User-Agent"  = "thamar-setup"
}

$files = @(
    "README.md",
    "js/config.js",
    "js/auth.js",
    "js/github-api.js",
    "js/bestel-utils.js",
    "js/catalogus.js",
    "js/bestellingen.js",
    "css/style.css",
    "index.html",
    "catalogus.html",
    "bestellingen.html",
    "js/admin-klanten.js",
    "js/admin-producten.js",
    "js/admin-voorraad.js",
    "js/admin-bestellingen.js",
    "js/admin-rapportage.js",
    "admin/index.html",
    "admin/dashboard.html",
    "admin/klanten.html",
    "admin/producten.html",
    "admin/voorraad.html",
    "admin/bestellingen.html",
    "admin/rapportage.html",
    "data/customers.json",
    "data/products.json",
    "data/stock.json",
    "data/settings.json",
    "data/orders/.gitkeep",
    "serve.ps1",
    "scripts/generate-dummy-orders.ps1"
)

$ordersDir = Join-Path $Root "data/orders"
if (Test-Path $ordersDir) {
    $orderFiles = Get-ChildItem $ordersDir -Filter "*.json" | ForEach-Object { "data/orders/$($_.Name)" }
    $files += $orderFiles
}

foreach ($relPath in $files) {
    $fullPath = Join-Path $Root $relPath
    if (-not (Test-Path $fullPath)) {
        Write-Host "SKIP (niet gevonden): $relPath"
        continue
    }

    $bytes = [System.IO.File]::ReadAllBytes($fullPath)
    $base64 = [Convert]::ToBase64String($bytes)
    $apiPath = $relPath -replace "\\", "/"
    $uri = "https://api.github.com/repos/$Owner/$Repo/contents/$apiPath"

    $sha = $null
    try {
        $existing = Invoke-RestMethod -Uri "$uri`?ref=$Branch" -Headers $headers
        $sha = $existing.sha
    } catch {
        # bestaat nog niet, geen sha nodig
    }

    $commitMessage = if ($relPath -like "data/orders/*") {
        "Voorbeelddata: bestelling toegevoegd ($relPath)"
    } else {
        "Alle MVP-modules: catalogus, bestellen, admin (klanten, producten, voorraad, bestellingen, rapportage) ($relPath)"
    }
    $body = @{
        message = $commitMessage
        content = $base64
        branch  = $Branch
    }
    if ($sha) { $body.sha = $sha }

    try {
        Invoke-RestMethod -Uri $uri -Method Put -Headers $headers -Body ($body | ConvertTo-Json)
        Write-Host "OK: $relPath"
    } catch {
        Write-Host "FOUT bij $relPath : $($_.Exception.Message)"
    }
}

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
    "css/style.css",
    "index.html",
    "catalogus.html",
    "admin/index.html",
    "admin/dashboard.html",
    "data/customers.json",
    "data/products.json",
    "data/stock.json",
    "data/settings.json",
    "data/orders/.gitkeep",
    "serve.ps1"
)

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

    $body = @{
        message = "Stap 1: repo-structuur + pincode-toegang ($relPath)"
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

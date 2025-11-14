# bump-version.ps1
$manifestPath = "manifest.json"

if (-not (Test-Path $manifestPath)) {
    Write-Error "manifest.json not found at $manifestPath"
    exit 1
}

$json = Get-Content $manifestPath -Raw | ConvertFrom-Json
$versionParts = $json.version -split '\.'
if ($versionParts.Length -lt 3) {
    Write-Error "Version format must be MAJOR.MINOR.PATCH (found '$($json.version)')"
    exit 1
}

$versionInts = $versionParts | ForEach-Object { [int]$_ }

Write-Host "Current version: $($json.version)"
Write-Host "Select release type:"
Write-Host "  1) Major"
Write-Host "  2) Medium"
Write-Host "  3) Minor"
$choice = Read-Host "Enter 1, 2, or 3"

switch ($choice) {
    '1' { $versionInts[0]++ }
    '2' { $versionInts[1]++ }
    '3' { $versionInts[2]++ }
    default {
        Write-Error "Invalid selection."
        exit 1
    }
}

$json.version = ($versionInts -join '.')
$json | ConvertTo-Json -Depth 10 | Set-Content -NoNewline $manifestPath

$newVersion = $json.version
Write-Host "Updated manifest version to $newVersion"

git add *
if ($LASTEXITCODE -ne 0) {
    Write-Error "git add failed."
    exit $LASTEXITCODE
}

git commit -m "release $newVersion"
if ($LASTEXITCODE -ne 0) {
    Write-Error "git commit failed."
    exit $LASTEXITCODE
}

git tag $newVersion
if ($LASTEXITCODE -ne 0) {
    Write-Error "git tag failed."
    exit $LASTEXITCODE
}

git push
if ($LASTEXITCODE -ne 0) {
    Write-Error "git push failed."
    exit $LASTEXITCODE
}

git push --tags
if ($LASTEXITCODE -ne 0) {
    Write-Error "git push --tags failed."
    exit $LASTEXITCODE
}

Write-Host "Version bump complete. Tag '$newVersion' pushed."
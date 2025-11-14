# Build Chrome Extension Zip Script
# Creates a zip file with only the necessary files for Chrome Web Store submission

$ErrorActionPreference = "Stop"

Write-Host "Building Chrome Extension ZIP..." -ForegroundColor Cyan

# Get the script directory (project root)
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$outputZip = Join-Path $projectRoot "boisclubstudio-extension.zip"

# Remove existing zip if it exists
if (Test-Path $outputZip) {
    Write-Host "Removing existing zip file..." -ForegroundColor Yellow
    Remove-Item $outputZip -Force
}

# Files and directories to include
$filesToInclude = @(
    "manifest.json",
    "content.js",
    "inject.js",
    "data",
    "styles",
    "icons"
)

# Create temporary directory for staging
$tempDir = Join-Path $env:TEMP "bcs-extension-build-$(Get-Random)"
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

try {
    Write-Host "Copying files..." -ForegroundColor Cyan
    
    foreach ($item in $filesToInclude) {
        $sourcePath = Join-Path $projectRoot $item
        
        if (Test-Path $sourcePath) {
            $destPath = Join-Path $tempDir $item
            
            if (Test-Path $sourcePath -PathType Container) {
                # Copy directory recursively, excluding git files and .DS_Store
                Copy-Item -Path $sourcePath -Destination $destPath -Recurse -Force
                
                # Remove .git files and .DS_Store recursively
                Get-ChildItem -Path $destPath -Recurse -Force | Where-Object {
                    $_.Name -match '\.git' -or $_.Name -eq '.DS_Store'
                } | Remove-Item -Force -Recurse -ErrorAction SilentlyContinue
                
                Write-Host "  [OK] $item/" -ForegroundColor Green
            } else {
                # Copy single file
                Copy-Item -Path $sourcePath -Destination $destPath -Force
                Write-Host "  [OK] $item" -ForegroundColor Green
            }
        } else {
            Write-Host "  [WARN] $item not found, skipping..." -ForegroundColor Yellow
        }
    }
    
    # Create zip file
    Write-Host "`nCreating ZIP archive..." -ForegroundColor Cyan
    
    # Load the .NET compression assembly
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    
    # Delete zip if it exists
    if (Test-Path $outputZip) {
        Remove-Item $outputZip -Force
    }
    
    # Create zip from temp directory
    [System.IO.Compression.ZipFile]::CreateFromDirectory($tempDir, $outputZip, [System.IO.Compression.CompressionLevel]::Optimal, $false)
    
    # Get zip file size
    $zipSize = (Get-Item $outputZip).Length / 1MB
    
    Write-Host "`nExtension ZIP created successfully!" -ForegroundColor Green
    Write-Host "   Location: $outputZip" -ForegroundColor White
    Write-Host "   Size: $([math]::Round($zipSize, 2)) MB" -ForegroundColor White
    
    # List contents
    Write-Host "`nContents:" -ForegroundColor Cyan
    $zip = [System.IO.Compression.ZipFile]::OpenRead($outputZip)
    foreach ($entry in $zip.Entries) {
        if ($entry.FullName -notmatch '__MACOSX') {
            Write-Host "   $($entry.FullName)" -ForegroundColor Gray
        }
    }
    $zip.Dispose()
    
} catch {
    Write-Host "`nError building extension: $_" -ForegroundColor Red
    exit 1
} finally {
    # Cleanup temp directory
    if (Test-Path $tempDir) {
        Remove-Item $tempDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}

Write-Host "`nDone! Ready for Chrome Web Store upload." -ForegroundColor Green


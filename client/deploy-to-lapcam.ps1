# LapCam - Deploy Build to C:\LapCam

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " LapCam - Deploy to C:\LapCam" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$sourceDir = "$PSScriptRoot\dist\LapCamClient"
$destDir = "C:\LapCam"

# Check source exists
if (-not (Test-Path $sourceDir)) {
    Write-Host "[ERROR] Build not found at $sourceDir" -ForegroundColor Red
    Write-Host ""
    Write-Host "Run .\build-windows.bat first!" -ForegroundColor Yellow
    pause
    exit 1
}

# Stop service first
Write-Host "[1/4] Stopping LapCam service..." -ForegroundColor Yellow
schtasks /End /TN "LapCam Client" 2>$null
Start-Sleep -Seconds 2

# Clean destination
Write-Host "[2/4] Cleaning C:\LapCam..." -ForegroundColor Yellow
if (Test-Path $destDir) {
    Remove-Item $destDir -Recurse -Force
}
New-Item -ItemType Directory -Path $destDir | Out-Null

# Copy ALL files from dist
Write-Host "[3/4] Copying new build..." -ForegroundColor Yellow
Copy-Item -Path "$sourceDir\*" -Destination $destDir -Recurse -Force

# Verify critical files
Write-Host "[4/4] Verifying deployment..." -ForegroundColor Yellow

$requiredFiles = @(
    "C:\LapCam\LapCamClient.exe",
    "C:\LapCam\_internal\python314.dll",
    "C:\LapCam\config.aws.yaml"
)

$allGood = $true
foreach ($file in $requiredFiles) {
    if (Test-Path $file) {
        Write-Host "  [OK] $file" -ForegroundColor Green
    } else {
        Write-Host "  [MISSING] $file" -ForegroundColor Red
        $allGood = $false
    }
}

Write-Host ""

if (-not $allGood) {
    Write-Host "[ERROR] Missing files! Check build output." -ForegroundColor Red
    pause
    exit 1
}

# Test run once
Write-Host "Testing executable..." -ForegroundColor Yellow
$testProcess = Start-Process -FilePath "C:\LapCam\LapCamClient.exe" `
    -ArgumentList "--config", "C:\LapCam\config.aws.yaml" `
    -WorkingDirectory "C:\LapCam" `
    -PassThru `
    -NoNewWindow

Start-Sleep -Seconds 3

$testProcess = Get-Process -Id $testProcess.Id -ErrorAction SilentlyContinue
if ($testProcess) {
    Write-Host "[OK] Executable runs successfully!" -ForegroundColor Green
    Stop-Process -Id $testProcess.Id -Force
} else {
    Write-Host "[ERROR] Executable failed to start" -ForegroundColor Red
    Write-Host ""
    Write-Host "Install Visual C++ Redistributable:" -ForegroundColor Yellow
    Write-Host "  https://aka.ms/vs/17/release/vc_redist.x64.exe" -ForegroundColor White
    pause
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host " Deploy successful!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Now install/restart the service:" -ForegroundColor Cyan
Write-Host "  .\quick-fix-service.ps1" -ForegroundColor White
Write-Host ""

pause

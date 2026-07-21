# LapCam - Fix Config File Name Issue

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " LapCam - Config File Fix" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$lapcamDir = "C:\LapCam"

# Check what config files exist
Write-Host "Checking C:\LapCam\ for config files..." -ForegroundColor Yellow
Write-Host ""

$configFiles = Get-ChildItem -Path $lapcamDir -Filter "config*.yaml" -ErrorAction SilentlyContinue

if ($configFiles.Count -eq 0) {
    Write-Host "[ERROR] No config files found in C:\LapCam\" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please copy your config file to C:\LapCam\config.aws.yaml" -ForegroundColor Yellow
    Write-Host ""
} else {
    Write-Host "Found config files:" -ForegroundColor Green
    foreach ($file in $configFiles) {
        Write-Host "  - $($file.Name)" -ForegroundColor Gray
    }
    Write-Host ""
    
    # Check if config.aws.yaml exists
    $correctConfig = Test-Path "$lapcamDir\config.aws.yaml"
    
    if ($correctConfig) {
        Write-Host "[OK] config.aws.yaml exists!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Now reinstall the service with correct paths:" -ForegroundColor Cyan
        Write-Host "  cd C:\LapCam" -ForegroundColor White
        Write-Host "  .\install-windows-service.ps1 -Uninstall" -ForegroundColor White
        Write-Host "  .\install-windows-service.ps1" -ForegroundColor White
        Write-Host ""
    } else {
        Write-Host "[WARN] config.aws.yaml not found!" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "The service expects: C:\LapCam\config.aws.yaml" -ForegroundColor Cyan
        Write-Host ""
        
        # If there's only one config file, offer to rename it
        if ($configFiles.Count -eq 1) {
            Write-Host "Found: $($configFiles[0].Name)" -ForegroundColor Gray
            Write-Host ""
            $response = Read-Host "Rename this to config.aws.yaml? (y/n)"
            if ($response -eq 'y' -or $response -eq 'Y') {
                Rename-Item -Path $configFiles[0].FullName -NewName "config.aws.yaml" -Force
                Write-Host "[OK] Renamed to config.aws.yaml" -ForegroundColor Green
                Write-Host ""
                Write-Host "Now reinstall the service:" -ForegroundColor Cyan
                Write-Host "  cd C:\LapCam" -ForegroundColor White
                Write-Host "  .\install-windows-service.ps1 -Uninstall" -ForegroundColor White
                Write-Host "  .\install-windows-service.ps1" -ForegroundColor White
                Write-Host ""
            }
        } else {
            Write-Host "Please manually rename or copy the correct config file to:" -ForegroundColor Yellow
            Write-Host "  C:\LapCam\config.aws.yaml" -ForegroundColor White
            Write-Host ""
        }
    }
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
pause

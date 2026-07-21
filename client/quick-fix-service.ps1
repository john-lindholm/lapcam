# LapCam - Quick Service Fix and Restart

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " LapCam - Service Quick Fix" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Stop current service
Write-Host "[1/4] Stopping existing service..." -ForegroundColor Yellow
schtasks /End /TN "LapCam Client" 2>$null
Start-Sleep -Seconds 2

# 2. Uninstall
Write-Host "[2/4] Uninstalling old service..." -ForegroundColor Yellow
$taskPath = "C:\LapCam\install-windows-service.ps1"
if (Test-Path $taskPath) {
    & $taskPath -Uninstall
} else {
    schtasks /Delete /TN "LapCam Client" /F 2>$null
    Write-Host "[OK] Task deleted" -ForegroundColor Green
}
Start-Sleep -Seconds 2

# 3. Reinstall with correct paths
Write-Host "[3/4] Installing new service..." -ForegroundColor Yellow

$taskName = "LapCam Client"
$action = New-ScheduledTaskAction `
    -Execute "C:\LapCam\LapCamClient.exe" `
    -Argument "--config `"C:\LapCam\config.aws.yaml`"" `
    -WorkingDirectory "C:\LapCam"

$trigger = New-ScheduledTaskTrigger -AtStartup
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RestartCount 999 `
    -RestartInterval (New-TimeSpan -Minutes 1)

$principal = New-ScheduledTaskPrincipal `
    -UserId "SYSTEM" `
    -LogonType ServiceAccount `
    -RunLevel Highest

try {
    Register-ScheduledTask `
        -TaskName $taskName `
        -Trigger $trigger `
        -Action $action `
        -Settings $settings `
        -Principal $principal `
        -Description "LapCam surveillance camera monitoring" `
        -ErrorAction Stop | Out-Null
    
    Write-Host "[OK] Service installed" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Failed to install: $_" -ForegroundColor Red
    pause
    exit 1
}

# 4. Start service
Write-Host "[4/4] Starting service..." -ForegroundColor Yellow
Start-ScheduledTask -TaskName $taskName
Start-Sleep -Seconds 5

# Verify
$taskInfo = Get-ScheduledTaskInfo -TaskName $taskName
if ($taskInfo.LastRunResult -eq 0) {
    Write-Host "[OK] Service started successfully!" -ForegroundColor Green
} else {
    Write-Host "[WARN] Last run result: $($taskInfo.LastRunResult)" -ForegroundColor Yellow
    Write-Host "  Check if process is running..." -ForegroundColor Gray
    
    $process = Get-Process -Name "LapCamClient" -ErrorAction SilentlyContinue
    if ($process) {
        Write-Host "[OK] Process is running (PID: $($process.Id))" -ForegroundColor Green
    } else {
        Write-Host "[ERROR] Process not running" -ForegroundColor Red
        Write-Host ""
        Write-Host "Try running manually to see errors:" -ForegroundColor Cyan
        Write-Host "  C:\LapCam\LapCamClient.exe --config config.aws.yaml" -ForegroundColor White
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Done!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Now check your web UI:" -ForegroundColor Cyan
Write-Host "  https://sec.sigma-chat.biz/" -ForegroundColor White
Write-Host ""
Write-Host "desktop should show as 🟢 Live" -ForegroundColor Green
Write-Host ""

pause

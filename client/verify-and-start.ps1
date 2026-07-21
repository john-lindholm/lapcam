# LapCam - Verify Installation and Start Service

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " LapCam - Status Check" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$taskName = "LapCam Client"

# Check if task exists
Write-Host "[1/3] Checking service status..." -ForegroundColor Yellow
$task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue

if ($task) {
    Write-Host "[OK] Service is installed" -ForegroundColor Green
    Write-Host "  State: $($task.State)" -ForegroundColor Gray
    Write-Host ""
    
    # Try to start it
    Write-Host "[2/3] Starting service..." -ForegroundColor Yellow
    try {
        Start-ScheduledTask -TaskName $taskName
        Start-Sleep -Seconds 3
        
        $taskInfo = Get-ScheduledTaskInfo -TaskName $taskName
        if ($taskInfo.LastRunResult -eq 0) {
            Write-Host "[OK] Service started successfully!" -ForegroundColor Green
        } else {
            Write-Host "[WARN] Service returned code: $($taskInfo.LastRunResult)" -ForegroundColor Yellow
            Write-Host "  This might be normal - check if camera is streaming" -ForegroundColor Gray
        }
    } catch {
        Write-Host "[WARN] Could not start: $_" -ForegroundColor Yellow
    }
} else {
    Write-Host "[ERROR] Service not found!" -ForegroundColor Red
    Write-Host "Please run setup-and-install.ps1 first" -ForegroundColor Yellow
    Write-Host ""
    pause
    exit 1
}

Write-Host ""
Write-Host "[3/3] Quick Checklist" -ForegroundColor Yellow
Write-Host ""
Write-Host "Open your web browser and go to:" -ForegroundColor Cyan
Write-Host "  https://sec.sigma-chat.biz/" -ForegroundColor White
Write-Host ""
Write-Host "Verify:" -ForegroundColor Cyan
Write-Host "  [ ] desktop shows as 'Live' (green indicator)" -ForegroundColor White
Write-Host "  [ ] Wave hand in front of camera" -ForegroundColor White
Write-Host "  [ ] Screenshot appears in UI within 5 seconds" -ForegroundColor White
Write-Host ""
Write-Host "If everything works, you're ready for vacation!" -ForegroundColor Green
Write-Host ""
Write-Host "To stop the service temporarily:" -ForegroundColor Cyan
Write-Host "  schtasks /End /TN `"LapCam Client`"" -ForegroundColor White
Write-Host ""

pause

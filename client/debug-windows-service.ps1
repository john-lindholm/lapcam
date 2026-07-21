# LapCam - Debug Windows Service Issues
# Run this on your Windows machine to diagnose why the service isn't working

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " LapCam - Service Debugging" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$taskName = "LapCam Client"

# 1. Check if task exists and get details
Write-Host "[1/6] Checking scheduled task..." -ForegroundColor Yellow
$task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($task) {
    Write-Host "[OK] Task found" -ForegroundColor Green
    Write-Host "  State: $($task.State)" -ForegroundColor Gray
    Write-Host "  Enabled: $($task.Enabled)" -ForegroundColor Gray
    
    $taskInfo = Get-ScheduledTaskInfo -TaskName $taskName
    Write-Host "  Last Run: $($taskInfo.LastRunTime)" -ForegroundColor Gray
    Write-Host "  Last Result: $($taskInfo.LastRunResult)" -ForegroundColor Gray
    if ($taskInfo.LastRunResult -eq 0) {
        Write-Host "  Status: Success" -ForegroundColor Green
    } else {
        Write-Host "  Status: Failed (error code $($taskInfo.LastRunResult))" -ForegroundColor Red
    }
} else {
    Write-Host "[ERROR] Task not found!" -ForegroundColor Red
    exit 1
}

Write-Host ""

# 2. Check task configuration
Write-Host "[2/6] Checking task configuration..." -ForegroundColor Yellow
$taskXml = Get-ScheduledTask -TaskName $taskName | Export-ScheduledTask
$xml = [xml]$taskXml
$action = $taskXml.Actions.Exec
Write-Host "  Command: $($action.Command)" -ForegroundColor Gray
Write-Host "  Arguments: $($action.Arguments)" -ForegroundColor Gray
Write-Host "  WorkingDir: $($action.WorkingDir)" -ForegroundColor Gray

Write-Host ""

# 3. Verify files exist
Write-Host "[3/6] Verifying files..." -ForegroundColor Yellow
if (Test-Path $action.Command) {
    Write-Host "[OK] Executable exists: $($action.Command)" -ForegroundColor Green
} else {
    Write-Host "[ERROR] Executable NOT found: $($action.Command)" -ForegroundColor Red
}

# Extract config path from arguments
$configPath = $action.Arguments -replace '.*--config\s*"?([^"]+)"?.*', '$1'
if (Test-Path $configPath) {
    Write-Host "[OK] Config exists: $configPath" -ForegroundColor Green
} else {
    Write-Host "[ERROR] Config NOT found: $configPath" -ForegroundColor Red
}

Write-Host ""

# 4. Check if process is running
Write-Host "[4/6] Checking if process is running..." -ForegroundColor Yellow
$processName = [System.IO.Path]::GetFileNameWithoutExtension($action.Command)
$process = Get-Process -Name $processName -ErrorAction SilentlyContinue
if ($process) {
    Write-Host "[OK] Process is running!" -ForegroundColor Green
    Write-Host "  PID: $($process.Id)" -ForegroundColor Gray
    Write-Host "  CPU: $($process.CPU) ms" -ForegroundColor Gray
} else {
    Write-Host "[WARN] Process is NOT running" -ForegroundColor Yellow
    Write-Host "  Trying to start it now..." -ForegroundColor Gray
    
    # Try to start manually
    try {
        Start-ScheduledTask -TaskName $taskName
        Start-Sleep -Seconds 5
        
        $process = Get-Process -Name $processName -ErrorAction SilentlyContinue
        if ($process) {
            Write-Host "[OK] Process started successfully!" -ForegroundColor Green
        } else {
            Write-Host "[ERROR] Process failed to start" -ForegroundColor Red
        }
    } catch {
        Write-Host "[ERROR] Failed to start: $_" -ForegroundColor Red
    }
}

Write-Host ""

# 5. Test running manually
Write-Host "[5/6] Testing manual execution..." -ForegroundColor Yellow
Write-Host "(This simulates what the service does)" -ForegroundColor Gray

try {
    # Run the executable directly and capture output
    $testOutput = & $action.Command $action.Arguments 2>&1
    Write-Host "[INFO] Manual test completed" -ForegroundColor Gray
    Write-Host "  If this worked, the issue is with Task Scheduler permissions" -ForegroundColor Yellow
} catch {
    Write-Host "[ERROR] Manual execution failed: $_" -ForegroundColor Red
}

Write-Host ""

# 6. Show solutions
Write-Host "[6/6] Possible Solutions" -ForegroundColor Yellow
Write-Host ""

Write-Host "SOLUTION 1: Reinstall with correct paths" -ForegroundColor Cyan
Write-Host "  Run this in PowerShell (as Admin):" -ForegroundColor White
Write-Host "  cd C:\LapCam" -ForegroundColor White
Write-Host "  .\install-windows-service.ps1 -Uninstall" -ForegroundColor White
Write-Host "  .\install-windows-service.ps1" -ForegroundColor White
Write-Host ""

Write-Host "SOLUTION 2: Check Event Viewer for errors" -ForegroundColor Cyan
Write-Host "  1. Press Win + R" -ForegroundColor White
Write-Host "  2. Type: eventvwr.msc" -ForegroundColor White
Write-Host "  3. Go to: Windows Logs → Application" -ForegroundColor White
Write-Host "  4. Look for errors from 'LapCamClient' or 'TaskScheduler'" -ForegroundColor White
Write-Host ""

Write-Host "SOLUTION 3: Run as your user instead of SYSTEM" -ForegroundColor Cyan
Write-Host "  Edit the task to run as your user account instead of SYSTEM" -ForegroundColor White
Write-Host "  This gives it access to your desktop and network" -ForegroundColor White
Write-Host ""

Write-Host "SOLUTION 4: Use Startup folder instead (simpler)" -ForegroundColor Cyan
Write-Host "  Create a shortcut in: shell:startup" -ForegroundColor White
Write-Host "  Points to: C:\LapCam\LapCamClient.exe --config config.aws.yaml" -ForegroundColor White
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Debug info complete!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

pause

# LapCam Client - Windows Service Installer (Task Scheduler)
# Run this ONCE as Administrator to install auto-start service

param(
    [switch]$Uninstall,
    [string]$ClientPath = "C:\LapCam\LapCamClient.exe",
    [string]$ConfigPath = "C:\LapCam\config.aws.yaml"
)

$taskName = "LapCam Client"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " LapCam Client - Windows Service Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if running as administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] `
    [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole( `
    [Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "[ERROR] Please run as Administrator!" -ForegroundColor Red
    Write-Host "Right-click this script → 'Run as Administrator'" -ForegroundColor Yellow
    Write-Host ""
    pause
    exit 1
}

if ($Uninstall) {
    # Uninstall service
    Write-Host "[1/2] Removing scheduled task..." -ForegroundColor Yellow
    
    if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
        Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
        Write-Host "[OK] Task removed successfully" -ForegroundColor Green
    } else {
        Write-Host "[INFO] Task not found (already removed?)" -ForegroundColor Gray
    }
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host " LapCam service uninstalled" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    pause
    exit 0
}

# Validate paths
Write-Host "[1/4] Validating paths..." -ForegroundColor Yellow

# Check if using .exe or running from source
$usingExe = Test-Path $ClientPath
if (-not $usingExe) {
    # Try Python script instead
    $scriptPath = Join-Path (Split-Path $MyInvocation.MyCommand.Path) "main.py"
    if (Test-Path $scriptPath) {
        $usingExe = $false
        $pythonPath = (Get-Command python -ErrorAction SilentlyContinue).Source
        if (-not $pythonPath) {
            Write-Host "[ERROR] Python not found in PATH!" -ForegroundColor Red
            Write-Host "Please install Python or build the .exe first" -ForegroundColor Yellow
            Write-Host ""
            pause
            exit 1
        }
        Write-Host "[INFO] Running from Python script: $scriptPath" -ForegroundColor Gray
    } else {
        Write-Host "[ERROR] Neither executable nor script found!" -ForegroundColor Red
        Write-Host "Expected: $ClientPath" -ForegroundColor Gray
        Write-Host "Or: $scriptPath" -ForegroundColor Gray
        Write-Host ""
        Write-Host "Please either:" -ForegroundColor Yellow
        Write-Host "  1. Build the .exe: .\build-windows.bat" -ForegroundColor White
        Write-Host "  2. Or specify correct path with -ClientPath parameter" -ForegroundColor White
        Write-Host ""
        pause
        exit 1
    }
} else {
    Write-Host "[INFO] Using executable: $ClientPath" -ForegroundColor Gray
}

if (-not (Test-Path $ConfigPath)) {
    Write-Host "[ERROR] Config file not found: $ConfigPath" -ForegroundColor Red
    Write-Host "Please copy config.aws.yaml to this location" -ForegroundColor Yellow
    Write-Host ""
    pause
    exit 1
}

Write-Host "[OK] Paths validated" -ForegroundColor Green
Write-Host ""

# Create scheduled task
Write-Host "[2/4] Creating scheduled task..." -ForegroundColor Yellow

$trigger = New-ScheduledTaskTrigger -AtStartup
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RestartCount 999 `
    -RestartInterval (New-TimeSpan -Minutes 1)

if ($usingExe) {
    # Using compiled .exe
    $action = New-ScheduledTaskAction `
        -Execute "C:\LapCam\LapCamClient.exe" `
        -Argument "--config `"C:\LapCam\config.aws.yaml`"" `
        -WorkingDirectory "C:\LapCam"
} else {
    # Using Python script
    $action = New-ScheduledTaskAction `
        -Execute $pythonPath `
        -Argument "`"$scriptPath`" --config `"$ConfigPath`"" `
        -WorkingDirectory (Split-Path $scriptPath)
}

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
        -Description "LapCam surveillance camera monitoring service - runs 24/7" `
        -ErrorAction Stop
    
    Write-Host "[OK] Scheduled task created" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Failed to create task: $_" -ForegroundColor Red
    Write-Host ""
    pause
    exit 1
}

Write-Host ""

# Start the service
Write-Host "[3/4] Starting service..." -ForegroundColor Yellow

try {
    Start-ScheduledTask -TaskName $taskName
    Start-Sleep -Seconds 2
    
    $taskInfo = Get-ScheduledTaskInfo -TaskName $taskName
    if ($taskInfo.LastRunResult -eq 0) {
        Write-Host "[OK] Service started successfully" -ForegroundColor Green
    } else {
        Write-Host "[WARN] Service started but returned code: $($taskInfo.LastRunResult)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "[WARN] Could not verify start: $_" -ForegroundColor Yellow
}

Write-Host ""

# Verify installation
Write-Host "[4/4] Verifying installation..." -ForegroundColor Yellow

$task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($task) {
    Write-Host "[OK] Task '$taskName' is installed" -ForegroundColor Green
    Write-Host ""
    Write-Host "Service Details:" -ForegroundColor Cyan
    Write-Host "  Name: $taskName" -ForegroundColor Gray
    Write-Host "  Status: $($task.State)" -ForegroundColor Gray
    Write-Host "  Runs as: SYSTEM (Highest privileges)" -ForegroundColor Gray
    Write-Host "  Starts: At Windows boot" -ForegroundColor Gray
    Write-Host "  Restarts: On failure (unlimited)" -ForegroundColor Gray
} else {
    Write-Host "[ERROR] Task verification failed!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " LapCam service installed successfully!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Management Commands:" -ForegroundColor Cyan
Write-Host "  Start:   schtasks /Run /TN `"$taskName`"" -ForegroundColor White
Write-Host "  Stop:    schtasks /End /TN `"$taskName`"" -ForegroundColor White
Write-Host "  Status:  schtasks /Query /TN `"$taskName`"" -ForegroundColor White
Write-Host "  Uninstall: .\install-windows-service.ps1 -Uninstall" -ForegroundColor White
Write-Host ""
Write-Host "The camera will now start automatically when Windows boots!" -ForegroundColor Green
Write-Host ""
pause

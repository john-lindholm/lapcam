@echo off
REM LapCam - Disable Windows Sleep Mode
REM Run this ONCE as Administrator before leaving for vacation

echo ========================================
echo  LapCam - Disable Sleep Mode
echo ========================================
echo.
echo This will prevent your computer from sleeping
echo so the camera keeps monitoring 24/7.
echo.
echo Running as Administrator...
echo.

REM Set power plan to High Performance
echo [1/4] Setting power plan to High Performance...
powercfg -setactive SCHEME_MIN

REM Disable monitor timeout (keep screen on)
echo [2/4] Keeping monitor on (optional)...
powercfg -change -monitor-timeout-ac 0
powercfg -change -monitor-timeout-dc 0

REM Disable hard disk timeout
echo [3/4] Preventing hard disk from turning off...
powercfg -change -disk-timeout-ac 0
powercfg -change -disk-timeout-dc 0

REM Disable standby/sleep
echo [4/4] Disabling sleep mode...
powercfg -change -standby-timeout-ac 0
powercfg -change -standby-timeout-dc 0

echo.
echo ========================================
echo  Done! Your PC will not sleep.
echo ========================================
echo.
echo To re-enable sleep later, run:
echo   powercfg -restoredefaultschemes
echo.
pause

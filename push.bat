@echo off
setlocal EnableDelayedExpansion
title Push images to GitHub

cd /d "%~dp0"

set "AHEAD=0"
for /f %%c in ('git rev-list --count origin/main..HEAD 2^>nul') do set "AHEAD=%%c"

git add .
if errorlevel 1 goto :adderr

git diff --cached --quiet
if not errorlevel 1 goto :nothing

set "IMGCNT=0"
set "FIRSTIMG="
set "ALLCNT=0"
for /f "usebackq delims=" %%f in (`git diff --cached --name-only --diff-filter=ACM -- "*.webp" "*.png" 2^>nul`) do set /a IMGCNT+=1
for /f "usebackq delims=" %%f in (`git diff --cached --name-only --diff-filter=ACM -- "*.webp" "*.png" 2^>nul`) do if not defined FIRSTIMG set "FIRSTIMG=%%f"
for /f "usebackq delims=" %%f in (`git diff --cached --name-only --diff-filter=ACM 2^>nul`) do set /a ALLCNT+=1
set "OTHCNT=0"
set /a OTHCNT=ALLCNT-IMGCNT

set "IMGPART="
if "%IMGCNT%"=="0" goto :msg_noimg
if "%IMGCNT%"=="1" goto :msg_one
set "IMGPART=Add %IMGCNT% images"
goto :msg_imgdone
:msg_one
set "IMGPART=Add %FIRSTIMG%"
goto :msg_imgdone
:msg_noimg
:msg_imgdone
set "OTHPART="
if "%OTHCNT%"=="0" goto :msg_othdone
if not defined IMGPART set "OTHPART=Update %OTHCNT% other_file"
if defined IMGPART set "OTHPART=;_update_%OTHCNT%_other_file"
:msg_othdone
set "MSG=%IMGPART%%OTHPART%"
if not defined MSG set "MSG=Update_images"
set "MSG=!MSG: =_!"

git commit -m "%MSG%"
if errorlevel 1 goto :comiterr

:nothing
git push origin main
if errorlevel 1 goto :pusherr
echo   PUSH OK   !MSG!
exit /b 0

:adderr
echo   ERROR: git add failed. Nothing was sent.
goto :failed

:comiterr
echo   ERROR: commit failed. Nothing was sent.
goto :failed

:pusherr
echo.
echo   PUSH FAILED. Nothing was published. Git error is above.
goto :failed

:failed
echo.
pause
exit /b 1

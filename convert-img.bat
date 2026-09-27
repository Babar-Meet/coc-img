@echo off
setlocal EnableDelayedExpansion
title Convert image to webp

if "%~1"=="" (
  echo.
  echo   Drag an image onto this file to convert it.
  echo.
  echo   Example: drag  th13warme.png  onto  convert-img.bat
  echo.
  echo   Result: a smaller .webp appears in this folder, named like
  echo   th13warme_123456.webp
  echo.
  pause
  exit /b 0
)

set "ROOT=%~dp0"
set "ROOTN=%ROOT:~0,-1%"

set "MAGICK="
if not "%%~$PATH:magick"=="" set "MAGICK=magick"
if not defined MAGICK if exist "%ROOTN%\magick.exe" set "MAGICK=%ROOTN%\magick.exe"
if not defined MAGICK if exist "C:\Program Files\ImageMagick-7.1.2-Q16-HDRI\magick.exe" set "MAGICK=C:\Program Files\ImageMagick-7.1.2-Q16-HDRI\magick.exe"
if not defined MAGICK (
  echo.
  echo   ERROR: ImageMagick was not found, so nothing can be converted.
  echo   Install ImageMagick, or drop a magick.exe next to this bat file.
  echo.
  pause
  exit /b 1
)

set OK=0
set FAIL=0

:loop
if "%~1"=="" goto done
call :one "%~1"
shift
goto loop

:done
echo.
echo   Done. %OK% converted, %FAIL% failed.
echo   The .webp files are in this folder. Move them where you want them,
echo   then run push.bat to publish.
echo.
pause
exit /b 0

:one
set "SRC=%~1"

if not exist "%SRC%" (
  echo   SKIP   not found:  %SRC%
  set /a FAIL+=1
  exit /b 0
)

if exist "%SRC%\" (
  echo   SKIP   that is a folder, not an image:  %SRC%
  set /a FAIL+=1
  exit /b 0
)

for %%E in (png jpg jpeg bmp tif tiff gif webp avif heic) do (
  if /i "%~x1"==".%%E" goto :isimage
)
echo   SKIP   not an image file:  %SRC%
set /a FAIL+=1
exit /b 0

:isimage
for %%F in ("%SRC%") do set "STEM=%%~nF"

set "OUTNAME="
for /f "usebackq delims=" %%N in (`powershell -NoProfile -Command ^
  "$s = '%STEM%' -replace '[^a-zA-Z0-9]+','_'; $s = $s.Trim('_').ToLower(); if (-not $s) { $s = 'image' }; $r = '%ROOTN%'; for ($i=0; $i -lt 200; $i++) { $id = -join (1..6 | ForEach-Object { Get-Random -Minimum 0 -Maximum 10 }); $n = $s + '_' + $id + '.webp'; if (-not (Test-Path (Join-Path $r $n))) { if (-not (git -C $r ls-files -- $n 2>$null)) { $n; break } } }"`) do set "OUTNAME=%%N"

if not defined OUTNAME (
  echo   SKIP   could not find a free name after 200 tries:  %SRC%
  set /a FAIL+=1
  exit /b 0
)

set "OUT=%ROOT%%OUTNAME%"
for %%F in ("%SRC%") do set "INBYTES=%%~zF"

"%MAGICK%" "%SRC%" -define webp:method=6 -quality 80 "%OUT%"
if errorlevel 1 (
  echo   FAIL   converter error on:  %SRC%
  set /a FAIL+=1
  exit /b 0
)

for %%F in ("%OUT%") do set "OUTBYTES=%%~zF"
set /a SAVED=100-(OUTBYTES*100/INBYTES)

echo   OK     %~nx1  --^>  %OUTNAME%
echo         %INBYTES% bytes  --^>  %OUTBYTES% bytes   (-!SAVED!%%)
set /a OK+=1
exit /b 0

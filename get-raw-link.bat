@echo off
setlocal EnableDelayedExpansion
title GitHub Raw URL Generator - coc-img

:: Move to repository root directory
cd /d "%~dp0"
set "ROOT=%cd%"

:: Default GitHub settings
set "OWNER_REPO=Babar-Meet/coc-img"
set "BRANCH=main"

:: Try to detect repository and branch from git if available
for /f "tokens=*" %%r in ('git config --get remote.origin.url 2^>nul') do (
    set "GIT_REMOTE=%%r"
    set "GIT_REMOTE=!GIT_REMOTE:git@github.com:=!"
    set "GIT_REMOTE=!GIT_REMOTE:https://github.com/=!"
    set "GIT_REMOTE=!GIT_REMOTE:.git=!"
    if not "!GIT_REMOTE!"=="" set "OWNER_REPO=!GIT_REMOTE!"
)

for /f "tokens=*" %%b in ('git branch --show-current 2^>nul') do (
    if not "%%b"=="" set "BRANCH=%%b"
)

:: Check if file or folder was dragged and dropped onto this script
if not "%~1"=="" (
    set "TARGET=%~1"
    goto :handle_dragdrop
)

:interactive_loop
cls
echo ======================================================================
echo                 GitHub Raw URL Generator
echo   Repository: !OWNER_REPO! (branch: !BRANCH!)
echo ======================================================================
echo.

set "FOLDER="
echo Step 1: Enter folder path
echo   Example: Bases_img/home_village_bases/TH_18/Progress
set /p "FOLDER=Folder: "

if not defined FOLDER (
    echo [!] Folder cannot be empty.
    pause
    exit /b 1
)

:: Clean folder string
set "FOLDER=!FOLDER:"=!"
set "FOLDER=!FOLDER:\=/!"

:: Remove repo prefix if pasted with coc-img/
if /i "!FOLDER:~0,8!"=="coc-img/" set "FOLDER=!FOLDER:~8!"

:: Strip leading slashes
:trim_leading_slash
if "!FOLDER:~0,1!"=="/" (
    set "FOLDER=!FOLDER:~1!"
    goto :trim_leading_slash
)

:: Strip trailing slashes
:trim_trailing_slash
if "!FOLDER:~-1!"=="/" (
    set "FOLDER=!FOLDER:~0,-1!"
    goto :trim_trailing_slash
)

:ask_file
echo.
set "FILENAME="
echo Step 2: Enter file name
echo   Example: th18_progress_drew_118511.webp
set /p "FILENAME=File name: "

if not defined FILENAME (
    echo [!] File name cannot be empty.
    pause
    exit /b 1
)

:: Clean filename
set "FILENAME=!FILENAME:"=!"

:: Remove space before extension if user entered e.g. "name .webp"
for %%E in (.webp .png .jpg .jpeg .gif .svg .json .md .txt) do (
    set "FILENAME=!FILENAME: %%E=%%E!"
)

:: Auto-detect and fix local file matching (e.g. if spaces instead of underscores)
if defined FOLDER (
    set "FOLDER_LOCAL=!FOLDER:/=\!"
    set "LOCAL_PATH=%ROOT%\!FOLDER_LOCAL!\!FILENAME!"
    if not exist "!LOCAL_PATH!" (
        set "FILENAME_UNDERSCORE=!FILENAME: =_!"
        if exist "%ROOT%\!FOLDER_LOCAL!\!FILENAME_UNDERSCORE!" (
            set "FILENAME=!FILENAME_UNDERSCORE!"
            echo [*] Auto-matched local file: !FILENAME!
        )
    )
) else (
    set "LOCAL_PATH=%ROOT%\!FILENAME!"
    if not exist "!LOCAL_PATH!" (
        set "FILENAME_UNDERSCORE=!FILENAME: =_!"
        if exist "%ROOT%\!FILENAME_UNDERSCORE!" (
            set "FILENAME=!FILENAME_UNDERSCORE!"
            echo [*] Auto-matched local file: !FILENAME!
        )
    )
)

:generate_url
:: Encode remaining spaces as %%20 if any
set "URL_FILENAME=!FILENAME: =%%20!"

if defined FOLDER (
    set "RAW_URL=https://raw.githubusercontent.com/!OWNER_REPO!/!BRANCH!/!FOLDER!/!URL_FILENAME!"
) else (
    set "RAW_URL=https://raw.githubusercontent.com/!OWNER_REPO!/!BRANCH!/!URL_FILENAME!"
)

echo.
echo ======================================================================
echo   Generated GitHub Raw URL:
echo ======================================================================
echo   !RAW_URL!
echo ======================================================================
echo.

:: Copy to Windows Clipboard
<nul set /p="!RAW_URL!" | clip
echo [COPIED] Raw URL automatically copied to your clipboard!
echo.

:: Check HTTP Status (200 OK test)
echo Checking status on GitHub...
set "HTTP_STATUS="
where curl.exe >nul 2>&1
if not errorlevel 1 (
    for /f %%c in ('curl.exe -s -o NUL -w "%%{http_code}" "!RAW_URL!"') do set "HTTP_STATUS=%%c"
)

if "!HTTP_STATUS!"=="200" (
    echo [HTTP 200 OK] Verified live! File is accessible on GitHub.
) else if "!HTTP_STATUS!"=="404" (
    echo [HTTP 404 NOT FOUND] Warning: File was not found on GitHub.
    echo Tip: If you just added this file, remember to run push.bat first!
) else if not "!HTTP_STATUS!"=="" (
    echo [HTTP !HTTP_STATUS!] Response status from GitHub.
) else (
    echo [!] Unable to reach GitHub.
)
echo.

:: Preview prompt
set "SHOW_PREV="
set /p "SHOW_PREV=Open image preview in default browser? [Y/n]: "
if "!SHOW_PREV!"=="" set "SHOW_PREV=Y"
if /i "!SHOW_PREV!"=="Y" (
    echo Opening preview...
    start "" "!RAW_URL!"
)

echo.
set "ANOTHER="
set /p "ANOTHER=Generate another link? [Y/n]: "
if "!ANOTHER!"=="" set "ANOTHER=Y"
if /i "!ANOTHER!"=="Y" goto :interactive_loop

echo.
echo Done!
pause
exit /b 0

:: -------------------------------------------------------------------------
:handle_dragdrop
echo ======================================================================
echo   GitHub Raw URL Generator (Drag and Drop Mode)
echo ======================================================================
echo.

if not exist "!TARGET!" (
    echo [ERROR] File or folder does not exist: !TARGET!
    pause
    exit /b 1
)

:: If folder dragged
if exist "!TARGET!\" (
    for %%F in ("!TARGET!") do set "FULL_DIR=%%~fF"
    if /i "!FULL_DIR!"=="!ROOT!" (
        set "FOLDER="
    ) else (
        set "REL_DIR=!FULL_DIR:%ROOT%\=!"
        set "FOLDER=!REL_DIR:\=/!"
    )
    goto :ask_file
)

:: If file dragged
for %%F in ("!TARGET!") do (
    set "FULL_FILE=%%~fF"
    set "FULL_DIR=%%~dpF"
    set "FILENAME=%%~nxF"
)
set "FULL_DIR=!FULL_DIR:~0,-1!"
if /i "!FULL_DIR!"=="!ROOT!" (
    set "FOLDER="
) else (
    set "REL_DIR=!FULL_DIR:%ROOT%\=!"
    set "FOLDER=!REL_DIR:\=/!"
)

if defined FOLDER (
    echo Folder: !FOLDER!
) else (
    echo Folder: (repository root)
)
echo File:   !FILENAME!
goto :generate_url

@echo off
title CoC Studio
cd /d "%~dp0studio"
echo.
echo   Starting CoC Studio...
echo   Open: http://localhost:5173
echo.
npm run dev

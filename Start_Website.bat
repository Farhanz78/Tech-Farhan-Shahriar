@echo off
echo Starting Developer Portfolio...
cd /d "%~dp0"

:: Open the browser immediately (it will retry/load as server starts)
start "" http://localhost:3000

:: Start the Next.js server
echo Starting Next.js Server...
npm run dev
pause

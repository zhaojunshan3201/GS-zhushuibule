@echo off
chcp 65001 >nul
setlocal

cd /d "%~dp0"
set "PORT=5000"

echo.
echo ========================================
echo  GaoShen Zhushui LAN Startup
echo ========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js is not installed or not in PATH.
  echo Please install Node.js first, then run this file again.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm is not installed or not in PATH.
  pause
  exit /b 1
)

if not exist ".env" (
  echo [INFO] .env was not found. Creating it from .env.example...
  copy ".env.example" ".env" >nul
  echo [INFO] Please make sure DATABASE_URL in .env points to the local PostgreSQL database.
  echo [INFO] Oracle settings can stay empty while developing away from the internal network.
  echo.
)

netstat -ano | findstr /R /C:":%PORT% .*LISTENING" >nul 2>nul
if not errorlevel 1 (
  echo [INFO] Port %PORT% is already listening. The system may already be running.
  echo.
  echo Local URL: http://127.0.0.1:%PORT%/
  for /f "usebackq delims=" %%I in (`powershell -NoProfile -Command "Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and $_.PrefixOrigin -ne 'WellKnown' } | Select-Object -First 1 -ExpandProperty IPAddress"`) do echo LAN URL:   http://%%I:%PORT%/
  echo.
  pause
  exit /b 0
)

if not exist "node_modules" (
  echo [INFO] Installing dependencies with npm install...
  call npm install
  if errorlevel 1 (
    echo [ERROR] npm install failed.
    pause
    exit /b 1
  )
)

echo [INFO] Generating Prisma client...
call npx prisma generate
if errorlevel 1 (
  echo [ERROR] Prisma client generation failed.
  pause
  exit /b 1
)

echo.
echo [INFO] Starting system on port %PORT%...
echo Local URL: http://127.0.0.1:%PORT%/
for /f "usebackq delims=" %%I in (`powershell -NoProfile -Command "Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and $_.PrefixOrigin -ne 'WellKnown' } | Select-Object -First 1 -ExpandProperty IPAddress"`) do echo LAN URL:   http://%%I:%PORT%/
echo.
echo Oracle connection is optional here. Existing PostgreSQL data will be used when Oracle is unavailable.
echo Press Ctrl+C to stop the system.
echo.

call npm run dev

endlocal

@echo off
rem Starts the store app (production) and a Cloudflare quick tunnel for an online address.
rem The online address (https://....trycloudflare.com) is printed in the tunnel window and
rem changes every time this runs. Run "npm run build" once after updating the app.
cd /d "%~dp0"
if not exist ".next\BUILD_ID" (
  echo Building the app for the first time...
  call npm run build || goto :error
)
start "Store app" cmd /k "npm start"
timeout /t 6 /nobreak >nul
echo.
echo Starting the online address. Look for the https://....trycloudflare.com link below.
echo Keep both windows open while you want the app online.
echo.
"C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel --no-autoupdate --url http://localhost:3000
goto :eof
:error
echo Build failed.
pause

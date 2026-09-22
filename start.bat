@echo off
echo Starting Gravitas Development Environment...
echo.

echo Starting Backend Server...
cd backend
:: Prefer the project venv (has livekit-agents); fall back to system python
if exist "venv\Scripts\python.exe" (
  start "Gravitas Backend" cmd /k "venv\Scripts\python -m api.main"
) else (
  start "Gravitas Backend" cmd /k "python -m api.main"
)

echo.
echo Starting Voice Agent (LiveKit)...
:: Must run with the same venv, otherwise: ModuleNotFoundError: No module named 'livekit.agents'
if exist "venv\Scripts\python.exe" (
  start "Gravitas Voice" cmd /k "venv\Scripts\python -m api.livekit_server dev"
) else (
  start "Gravitas Voice" cmd /k "python -m api.livekit_server dev"
)

echo.
echo Starting Frontend Development Server...
cd ../frontend
start "Gravitas Frontend" cmd /k "npm run dev"

echo.
echo Gravitas is starting...
echo Backend: http://localhost:8000
echo Frontend: http://localhost:3000
echo Voice worker: GravitasVoice (needs LIVEKIT_URL/KEY/SECRET + inference enabled)
echo.
echo Press any key to stop all servers...
pause >nul

echo.
echo Stopping servers...
taskkill /FI "WINDOWTITLE eq Gravitas Backend*" /T >nul 2>&1
taskkill /FI "WINDOWTITLE eq Gravitas Voice*" /T >nul 2>&1
taskkill /FI "WINDOWTITLE eq Gravitas Frontend*" /T >nul 2>&1
echo Servers stopped.

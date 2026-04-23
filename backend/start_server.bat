@echo off
echo ============================================================
echo    KRSNAA MIS - BACKEND SERVER STARTER
echo ============================================================
echo.

cd /d "%~dp0"

echo Starting backend server with automatic setup...
echo.

python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

pause

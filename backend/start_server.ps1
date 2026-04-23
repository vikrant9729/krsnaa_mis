# KRSNAA MIS - Backend Server Starter (PowerShell)
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "   KRSNAA MIS - BACKEND SERVER STARTER" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

Set-Location $PSScriptRoot

Write-Host "Starting backend server with automatic setup..." -ForegroundColor Green
Write-Host ""

python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

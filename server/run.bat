@echo off
rem EMA Reader sunucusunu baslatir (127.0.0.1:8765).
cd /d "%~dp0"
if exist .venv\Scripts\python.exe (
  .venv\Scripts\python.exe -m uvicorn app:app --host 127.0.0.1 --port 8765
) else (
  python -m uvicorn app:app --host 127.0.0.1 --port 8765
)

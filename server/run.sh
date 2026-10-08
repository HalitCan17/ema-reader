#!/usr/bin/env sh
# EMA Reader sunucusunu başlatır (127.0.0.1:8765).
cd "$(dirname "$0")"
if [ -x .venv/bin/python ]; then PY=.venv/bin/python; else PY=python3; fi
exec "$PY" -m uvicorn app:app --host 127.0.0.1 --port 8765

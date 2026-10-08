@echo off
rem EMA Reader sunucusu icin ilk kurulum (Windows).
rem EMA Lightning Python 3.11, 3.12 veya 3.13 ister; 3.14 desteklenmiyor.
cd /d "%~dp0"
set PYVER=
for %%v in (3.13 3.12 3.11) do (
  if not defined PYVER py -%%v --version >nul 2>&1 && set PYVER=%%v
)
if not defined PYVER (
  echo Python 3.11, 3.12 veya 3.13 bulunamadi.
  echo Once Python 3.13 kur: winget install Python.Python.3.13
  pause
  exit /b 1
)
echo Python %PYVER% kullaniliyor.
py -%PYVER% -m venv .venv || goto :hata
.venv\Scripts\python -m pip install --upgrade pip || goto :hata
.venv\Scripts\python -m pip install -r requirements.txt || goto :hata
echo.
echo Kurulum tamam. Sunucuyu baslatmak icin run.bat dosyasini calistir.
pause
exit /b 0
:hata
echo Kurulum sirasinda hata olustu, yukaridaki mesaji kontrol et.
pause
exit /b 1

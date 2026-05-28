@echo off
rem ============================================================
rem  Bot Estoque - rodada local em modo DEBUG (Chrome visivel)
rem ============================================================

setlocal

cd /d "%~dp0"

if not exist .venv (
  echo [setup] criando venv...
  python -m venv .venv
)

call .venv\Scripts\activate.bat

echo [setup] instalando dependencias (se necessario)...
python -m pip install -q --upgrade pip
python -m pip install -q -r requirements.txt

rem ----- credenciais (edita aqui) -----------------------------
set SUPABASE_URL=https://wboelthngddvkgrvwkbu.supabase.co
rem cole o service_role do Supabase (Project Settings -> API):
set SUPABASE_SERVICE_KEY=COLE_AQUI

rem credenciais do TransNet:
set TRANSNET_USER=GUILHERMEMAXIMO
set TRANSNET_PASSWORD=COLE_AQUI
set TRANSNET_ALMOXARIFADO=046
set TRANSNET_URL=https://transnet.grupocsc.com.br/sgtweb/index.php?c=controleAcesso.CLogin&m=verTelaLogin

rem ----- modo debug -------------------------------------------
set HEADLESS=false
set BOT_DOWNLOAD_TIMEOUT=600
set DEBUG_SHOT_INTERVAL=10
set PYTHONUNBUFFERED=1
rem -----------------------------------------------------------

if "%~1"=="" (
  echo Uso: run_local_diaria.bat YYYY-MM-DD
  echo Ex.:  run_local_diaria.bat 2026-05-28
  pause
  exit /b 1
)

echo.
echo === Disparando bot diario para a data %1 ===
python -u bot_diaria.py --data-alvo %1

echo.
echo === Encerrado. Arquivos de debug em: ===
echo   %~dp0downloads
echo.
pause

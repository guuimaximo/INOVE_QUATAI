@echo off
rem ============================================================
rem  Bot Pneus - rodada local em modo DEBUG (Chrome visivel)
rem  Login TransNet -> baixa 3 relatorios CSV -> upsert Supabase
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

rem ----- credenciais (mesmas do run_local_diaria.bat) ---------
set SUPABASE_URL=https://wboelthngddvkgrvwkbu.supabase.co
set SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indib2VsdGhuZ2RkdmtncnZ3a2J1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5ODQxMzcsImV4cCI6MjA3NjU2MDEzN30.A3ylU8Tkx20VOD3EjOr3K7ir0J_jZrCfBNlzAOtODXg
set TRANSNET_USER=GUILHERMEMAXIMO
set TRANSNET_PASSWORD=Transnet@349031
set TRANSNET_URL=https://transnet.grupocsc.com.br/sgtweb/index.php?c=controleAcesso.CLogin&m=verTelaLogin
set TRANSNET_EMPRESA=046
set TRANSNET_EMPRESA_NOME=QUATAI

rem ----- modo debug (Chrome visivel) --------------------------
set HEADLESS=false
set PYTHONUNBUFFERED=1
rem -----------------------------------------------------------

echo.
echo === Disparando bot de pneus (Chrome visivel) ===
python -u bot_pneus.py

echo.
echo === Encerrado. CSVs/debug em: ===
echo   %~dp0downloads
echo.
pause

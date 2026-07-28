@echo off
setlocal
REM ============================================================
REM  Gera a Programacao Semanal de Preventivas (Garagem Quatai)
REM  Roda sozinho (agendado toda sexta) - ver Agendador do Windows.
REM ============================================================
set PYTHONIOENCODING=utf-8
set BASE=C:\Users\Guilh\Repositorios\PREVENTIVAS
cd /d "%BASE%"
if not exist "%BASE%\saidas" mkdir "%BASE%\saidas"

echo. >> "%BASE%\saidas\log.txt"
echo ==== Execucao %DATE% %TIME% ==== >> "%BASE%\saidas\log.txt"

REM garante os pacotes (idempotente)
python -m pip install --user --quiet openpyxl reportlab pymupdf 1>>"%BASE%\saidas\log.txt" 2>&1

REM 1) gera a planilha Excel (10.000 / 5.000 / Garantia)
python "%BASE%\gerar_programacao_semanal.py" 1>>"%BASE%\saidas\log.txt" 2>&1

REM 2) gera o PNG da programacao e envia no Telegram
python "%BASE%\gerar_png_programacao.py" 1>>"%BASE%\saidas\log.txt" 2>&1

endlocal

@echo off
setlocal
REM ============================================================
REM  Gera o PNG diario do painel de GARANTIAS (estilo Flash Report)
REM  Agendado todo dia - ver Agendador do Windows.
REM ============================================================
set PYTHONIOENCODING=utf-8
set BASE=C:\Users\Guilh\Repositorios\PREVENTIVAS
cd /d "%BASE%"
if not exist "%BASE%\saidas" mkdir "%BASE%\saidas"

echo. >> "%BASE%\saidas\log_garantias.txt"
echo ==== Execucao %DATE% %TIME% ==== >> "%BASE%\saidas\log_garantias.txt"

REM garante os pacotes (idempotente)
python -m pip install --user --quiet openpyxl reportlab pymupdf 1>>"%BASE%\saidas\log_garantias.txt" 2>&1

REM 1) PNG das garantias (km de cada carro + quando foi atualizado)
python "%BASE%\gerar_png_garantias.py" 1>>"%BASE%\saidas\log_garantias.txt" 2>&1

REM 2) PNG do acompanhamento da programacao (feitos x nao feitos)
python "%BASE%\gerar_png_acompanhamento.py" 1>>"%BASE%\saidas\log_garantias.txt" 2>&1

REM 3) PNG da analise de atrasados (preventivas ja vencidas)
python "%BASE%\gerar_png_atrasados.py" 1>>"%BASE%\saidas\log_garantias.txt" 2>&1

REM 4) PNG do painel da programacao da semana
python "%BASE%\gerar_png_painel.py" 1>>"%BASE%\saidas\log_garantias.txt" 2>&1

REM 5) PNG do resumo de planos vencidos (cubo 40k, concessionaria fora)
python "%BASE%\gerar_png_vencidos.py" 1>>"%BASE%\saidas\log_garantias.txt" 2>&1

endlocal

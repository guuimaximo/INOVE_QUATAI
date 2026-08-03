"""Confere se o PDF gerado tem o numero de paginas que o HTML previu.

Cada .page do HTML tem altura fixa; quando o conteudo passa disso, o weasyprint quebra a
pagina em duas e a sobra sai numa folha sem cabecalho nem rodape (as vezes totalmente em
branco). Isso ja aconteceu duas vezes sem ninguem notar - o relatorio foi entregue com 23
paginas em vez de 21. O gen_html_v3.py grava quantas espera; aqui comparamos com o PDF de
verdade e quebramos o job, porque um PDF com folha em branco no meio nao deve ser commitado.
"""
import re
import sys
from pathlib import Path

from pypdf import PdfReader

AQUI = Path(__file__).resolve().parent
PDF = AQUI / "Flash Report - Diesel.pdf"
ESPERADAS = AQUI / "paginas_esperadas.txt"

esperado = int(ESPERADAS.read_text(encoding="utf-8").strip())
paginas = PdfReader(str(PDF)).pages
obtido = len(paginas)

if obtido == esperado:
    print(f"[layout] OK: {obtido} paginas, como previsto.")
    sys.exit(0)

# Capa e indice nao tem rodape numerado; da terceira em diante, quem nao tem rodape e
# sobra de transbordo - e o que aponta a pagina culpada.
suspeitas = []
for i, pag in enumerate(paginas, 1):
    texto = pag.extract_text() or ""
    if i > 2 and not re.search(r"P.gina \d+/\d+", texto):
        titulo = next((l.strip() for l in texto.splitlines() if l.strip()), "*** EM BRANCO ***")
        suspeitas.append(f"  pagina {i}: {titulo[:60]}")

print(f"[layout] FALHOU: PDF saiu com {obtido} paginas, esperado {esperado}.")
if suspeitas:
    print("[layout] Transbordo (folhas sem rodape numerado):")
    print("\n".join(suspeitas))
print("[layout] Alguma pagina passou da altura fixa. Reduza o conteudo dela ou o grafico.")
sys.exit(1)

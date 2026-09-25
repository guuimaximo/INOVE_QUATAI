"""Dados do Painel Interativo do Flash Report Diesel.

O PDF mostra so os extremos (piores/melhores, top linhas). O painel interativo deixa clicar
no motorista e ver o dia a dia dele, clicar na linha e ver quem rodou nela, abrir cada
acompanhamento com sessoes, checklist e prontuarios - e para isso precisa do dado LINHA A
LINHA de todos os motoristas, que e justamente o que nao pode ir aberto: este repositorio
e PUBLICO, e o artefato do run tambem.

Entao o dado sai CRIPTOGRAFADO. Esquema hibrido: o JSON e comprimido (zlib), cifrado com
uma chave AES-256-GCM aleatoria, e essa chave e cifrada com a chave PUBLICA RSA
(painel_pub.pem, commitada - publica de proposito). So quem tem a chave PRIVADA abre, e
ela fica fora do repositorio, na maquina de quem monta o painel (montar_painel.py).

Conteudo (o painel tem que ter TUDO o que o Flash tem, e mais o detalhe por tras):
  - premiacao_diaria (BCNT) linha a linha e Transnet por carro/dia - ja carregados pelo gfd;
  - todos os numeros que o Flash calcula (as constantes em maiusculas do gfd, as mesmas do
    dados_flash.json) e o cronograma/paginas manuais;
  - as tabelas de acompanhamento do INOVE inteiras: acompanhamentos (+ view de ciclo),
    sessoes, eventos, checklist (itens e respostas), tratativas (+ detalhes) e sugestoes;
  - meritocracia completa do mes (premiacao_atualizada);
  - o proprio relatorio em HTML, com as imagens embutidas, para ler pagina a pagina.
"""
import base64
import json
import os
import re
import zlib
from collections import defaultdict
from pathlib import Path

# Prefixo das URLs do storage do INOVE: aparece em milhares de links (prontuarios,
# evidencias). Vai abreviado e o painel expande.
_STORAGE = "https://wboelthngddvkgrvwkbu.supabase.co/storage/v1/object/public/"


def _r1(v):
    try:
        return round(float(v), 1)
    except (TypeError, ValueError):
        return None


def _chapa(ch):
    c = str(ch or "").strip()
    return c[:-2] if c.endswith(".0") else c


# Chaves que saem em qualquer nivel: GPS do instrutor (dado de localizacao de pessoa, e
# pesado) e caminhos/ids internos que ja estao nas URLs.
_FORA_FUNDO = {"localizacao", "localizacao_inicio", "localizacao_fim", "intervencao_localizacao",
               "latitude", "longitude", "precisao", "pdf_path", "html_path", "batch_id",
               "sessao_referencia", "rota_pings", "device"}


def _conserta(s):
    """Textos gravados duas vezes em UTF-8 ("IntervenÃ§Ã£o") voltam ao normal."""
    if "Ã" in s or "Â" in s:
        try:
            return s.encode("latin-1").decode("utf-8")
        except (UnicodeEncodeError, UnicodeDecodeError):
            return s
    return s


def _enxuga(v):
    """Arredonda floats (3 casas), abrevia URLs do storage e tira GPS, recursivamente."""
    if isinstance(v, float):
        return round(v, 3)
    if isinstance(v, str):
        v = _conserta(v)
        return v.replace(_STORAGE, "§/") if _STORAGE in v else v
    if isinstance(v, list):
        return [_enxuga(x) for x in v]
    if isinstance(v, dict):
        return {k: _enxuga(x) for k, x in v.items() if k not in _FORA_FUNDO}
    return v


def _inove_todas(gfd, tabela, order="created_at"):
    url, key = gfd.supabase_creds("inove")
    if not url or not key:
        return []
    rows, off = [], 0
    while True:
        b = gfd._sb_get(url, key, tabela, [("select", "*"), ("order", order),
                                           ("limit", "1000"), ("offset", str(off))])
        rows += b
        if len(b) < 1000:
            break
        off += 1000
    return rows


# Colunas tecnicas que nao dizem nada a quem le (ids de login, caminhos internos, GPS e
# o rastro da rota do instrutor - este ultimo e pesado e e dado de localizacao de pessoa).
_FORA = {"instrutor_id", "instrutor_login", "triado_por_login", "criado_por_id", "criado_por_login",
         "tratado_por_id", "tratado_por_login", "respondido_por_login", "arquivo_pdf_path",
         "arquivo_html_path", "atualizado_em", "latitude_inicio", "longitude_inicio",
         "precisao_inicio", "capturado_em_inicio", "latitude_fim", "longitude_fim", "precisao_fim",
         "capturado_em_fim"}


def _limpa(rows, fora_md=()):
    out = []
    for r in rows:
        r = {k: v for k, v in r.items() if k not in _FORA and v not in (None, "", [], {})}
        md = r.get("metadata")
        if isinstance(md, dict):
            md = {k: v for k, v in md.items() if k not in fora_md}
            if md:
                r["metadata"] = md
            else:
                r.pop("metadata")
        out.append(_enxuga(r))
    return out


def _inove(gfd):
    """Tabelas de acompanhamento/tratativa do INOVE, inteiras. Cada uma e opcional: se uma
    falhar, o painel mostra o resto."""
    out = {}

    def pega(nome, tabela, **kw):
        try:
            out[nome] = _limpa(_inove_todas(gfd, tabela), **kw)
        except Exception as e:
            print(f"[painel] {tabela} falhou ({e}).")
            out[nome] = []

    pega("acomp", "diesel_acompanhamentos", fora_md=("intervencao_localizacao", "pdf_path", "lote_id"))
    pega("sessoes", "diesel_acompanhamento_sessoes", fora_md=("device", "rota_pings"))
    pega("eventos", "diesel_acompanhamento_eventos")
    pega("check_itens", "diesel_checklist_itens")
    pega("trat", "diesel_tratativas")
    pega("trat_det", "diesel_tratativas_detalhes")
    pega("sugestoes", "diesel_sugestoes_acompanhamento")
    for s in out["sugestoes"]:
        s.pop("detalhes_json", None)       # raio-x completo: pesado e repete o que ja esta no pd
    # a view de ciclo traz a fase calculada (dias decorridos, status do ciclo): so os campos
    # que a tabela nao tem, grudados no acompanhamento pelo id
    try:
        ciclo = {c["id"]: c for c in _inove_todas(gfd, "v_diesel_acompanhamentos_ciclo")}
        for a in out["acomp"]:
            c = ciclo.get(a.get("id")) or {}
            for k in ("status_ciclo", "dias_decorridos", "fase_monitoramento", "prontuario_pendente"):
                if c.get(k) not in (None, ""):
                    a[k] = c[k]
    except Exception as e:
        print(f"[painel] v_diesel_acompanhamentos_ciclo falhou ({e}).")
    # 18 mil respostas de checklist: em colunas, com o item por indice
    try:
        itens = {it["id"]: i for i, it in enumerate(out["check_itens"])}
        resp = _inove_todas(gfd, "diesel_checklist_respostas")
        out["check_resp"] = [[r.get("acompanhamento_id"), itens.get(r.get("checklist_item_id"), -1),
                              r.get("valor_bool"), r.get("valor_text"), str(r.get("created_at") or "")[:10]]
                             for r in resp]
    except Exception as e:
        print(f"[painel] diesel_checklist_respostas falhou ({e}).")
        out["check_resp"] = []
    return out


def _flash(gfd):
    """Todos os numeros do Flash - as mesmas constantes que vao no dados_flash.json."""
    fora = {"CHAPA_DE_NOME", "SUPABASE_PROJETOS", "DARK", "GOLD", "GREEN", "GREY", "PURPLE", "RED", "TEAL"}
    d = {}
    for k in dir(gfd):
        v = getattr(gfd, k)
        if k.isupper() and not k.startswith("_") and k not in fora \
                and isinstance(v, (list, tuple, dict, int, float, str, bool)):
            d[k] = v
    return json.loads(json.dumps(d, default=str))


def _relatorio(out_dir):
    """O HTML do relatorio (o mesmo que vira PDF) com as imagens embutidas."""
    arq = out_dir / "flash_report_diesel_v3.html"
    if not arq.exists():
        return ""
    html = arq.read_text(encoding="utf-8")

    def emb(m):
        f = out_dir / m.group(1)
        if not f.exists():
            return m.group(0)
        mime = "image/png" if f.suffix.lower() == ".png" else "image/jpeg"
        return f'src="data:{mime};base64,{base64.b64encode(f.read_bytes()).decode()}"'
    return re.sub(r'src="([^":]+\.(?:png|jpe?g))"', emb, html, flags=re.I)


def _extra(extra, out_dir):
    """Paginas manuais (cronograma, noturno). As fotos da visita noturna vao embutidas."""
    ex = json.loads(json.dumps(extra or {}, default=str))
    nt = ex.get("noturno")
    if nt:
        fotos = []
        for f in nt.get("fotos") or []:
            arq = out_dir / f
            if arq.exists():
                mime = "image/png" if arq.suffix.lower() == ".png" else "image/jpeg"
                fotos.append(f"data:{mime};base64,{base64.b64encode(arq.read_bytes()).decode()}")
        nt["fotos"] = fotos
    return ex


def montar(gfd, out_dir, extra=None):
    """Dicionario do painel. premiacao_diaria vai em colunas (arrays paralelos)."""
    pd = getattr(gfd, "_pd", None) or []
    if not pd:
        raise RuntimeError("sem premiacao_diaria carregada (credencial BCNT ausente?)")
    nome_de = getattr(gfd, "_nome_chapa", lambda c: f"MOTORISTA {c}")
    cluster_de = getattr(gfd, "_cluster_de", {}) or {}

    dias, mot, lin, car = {}, {}, {}, {}

    def idx(dic, k):
        if k not in dic:
            dic[k] = len(dic)
        return dic[k]

    cols = {k: [] for k in ("d", "m", "l", "c", "km", "lt", "li", "mi")}
    for r in pd:
        km, lt = _r1(r.get("km_rodado")), _r1(r.get("litros_consumidos"))
        if not km or not lt or km <= 0 or lt <= 0:
            continue
        dia = str(r.get("dia") or "")[:10]
        if len(dia) != 10:
            continue
        cols["d"].append(idx(dias, dia))
        cols["m"].append(idx(mot, _chapa(r.get("motorista"))))
        cols["l"].append(idx(lin, str(r.get("linha") or "?").strip()))
        cols["c"].append(idx(car, str(r.get("prefixo") or "?").strip()))
        cols["km"].append(km)
        cols["lt"].append(lt)
        cols["li"].append(_r1(r.get("litros_ideais")) or 0)
        cols["mi"].append(int(float(r.get("minutos_em_viagem") or 0)))

    # Transnet oficial por carro/dia (a telemetria acima e o que tem motorista e linha; o
    # oficial so tem o carro - o painel mostra os dois lado a lado na aba de carros).
    tn = {k: [] for k in ("d", "c", "km", "lt")}
    for r in getattr(gfd, "_transnet_rows", None) or []:
        km, lt = _r1(r.get("km_transnet")), _r1(r.get("combustivel_transnet"))
        dia = str(r.get("data_consolidada") or "")[:10]
        if not km or not lt or len(dia) != 10:
            continue
        tn["d"].append(idx(dias, dia))
        tn["c"].append(idx(car, str(r.get("veiculo") or "?").strip()))
        tn["km"].append(km)
        tn["lt"].append(lt)

    inove = _inove(gfd)
    # motorista que so aparece em acompanhamento/tratativa (sem km no periodo) tambem
    # precisa de nome no painel
    for a in inove["acomp"] + inove["trat"]:
        ch = _chapa(a.get("motorista_chapa"))
        if ch:
            idx(mot, ch)
    motoristas = [[ch, nome_de(ch) if ch else "SEM CHAPA"] for ch in mot]

    merito = [[_chapa(x.get("motorista")), x.get("valor"), x.get("km_l")]
              for x in (getattr(gfd, "_pa", None) or []) if _chapa(x.get("motorista"))]

    return {
        "versao": 2,
        "gerado_em": gfd._HOJE.isoformat(),
        "mes_ini": gfd.MES_INI.isoformat(),
        "mes_fim": gfd.MES_FIM.isoformat(),          # exclusivo
        "mes_ant_ini": gfd.MES_ANT_INI.isoformat(),
        "mes_ref_label": gfd.MES_REF_LABEL,
        "mes_ant_label": gfd.MES_ANT_LABEL,
        "periodo_label": gfd.PERIODO_LABEL,
        "meta": gfd.META,
        "storage": _STORAGE,
        "dias": list(dias),
        "motoristas": motoristas,
        "linhas": list(lin),
        "carros": [[p, cluster_de.get(p) or ""] for p in car],
        "pd": cols,
        "tn": tn,
        "inove": inove,
        "merito": merito,
        "flash": _flash(gfd),
        "extra": _extra(extra, Path(out_dir)),
        "relatorio": _relatorio(Path(out_dir)),
    }


def cifrar(dados, pub_pem):
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import padding
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

    bruto = zlib.compress(json.dumps(dados, ensure_ascii=False, separators=(",", ":"),
                                     default=str).encode("utf-8"), 9)
    chave, nonce = AESGCM.generate_key(bit_length=256), os.urandom(12)
    pub = serialization.load_pem_public_key(pub_pem)
    chave_cifrada = pub.encrypt(chave, padding.OAEP(mgf=padding.MGF1(hashes.SHA256()),
                                                    algorithm=hashes.SHA256(), label=None))
    b64 = lambda b: base64.b64encode(b).decode()
    return {"esquema": "rsa-oaep-sha256+aes-256-gcm+zlib", "chave": b64(chave_cifrada),
            "nonce": b64(nonce), "dados": b64(AESGCM(chave).encrypt(nonce, bruto, None))}


def exportar(gfd, out_dir, extra=None):
    out_dir = Path(out_dir)
    dados = montar(gfd, out_dir, extra)
    env = cifrar(dados, (out_dir / "painel_pub.pem").read_bytes())
    (out_dir / "painel_dados.enc.json").write_text(json.dumps(env), encoding="utf-8")
    ino = dados["inove"]
    print(f"[painel] painel_dados.enc.json: {len(dados['pd']['d'])} linhas de premiacao, "
          f"{len(dados['motoristas'])} motoristas, {len(ino['acomp'])} acompanhamentos, "
          f"{len(ino['sessoes'])} sessoes, {len(ino['eventos'])} eventos, "
          f"{len(ino['check_resp'])} respostas de checklist, {len(ino['trat'])} tratativas, "
          f"{len(dados['merito'])} na meritocracia, relatorio {len(dados['relatorio']) // 1000} KB "
          f"(cifrado, {len(env['dados']) // 1000} KB).")

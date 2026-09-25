"""Dados do Painel Interativo do Flash Report Diesel.

O PDF mostra so os extremos (piores/melhores, top linhas). O painel interativo deixa clicar
no motorista e ver o dia a dia dele, clicar na linha e ver quem rodou nela - e para isso
precisa do dado LINHA A LINHA de todos os motoristas, que e justamente o que nao pode ir
aberto: este repositorio e PUBLICO, e o artefato do run tambem.

Entao o dado sai CRIPTOGRAFADO. Esquema hibrido: o JSON e comprimido (zlib), cifrado com
uma chave AES-256-GCM aleatoria, e essa chave e cifrada com a chave PUBLICA RSA
(painel_pub.pem, commitada - publica de proposito). So quem tem a chave PRIVADA abre, e
ela fica fora do repositorio, na maquina de quem monta o painel (montar_painel.py).

Nao busca nada de novo no BCNT: reaproveita o que o gen_flash_diesel_v3 ja carregou
(premiacao_diaria, mapas de nome e cluster, Transnet, tratativas). So os acompanhamentos
do INOVE sao buscados aqui, porque o gfd so guarda id -> nome deles.
"""
import base64
import json
import os
import zlib
from collections import defaultdict
from pathlib import Path


def _r1(v):
    try:
        return round(float(v), 1)
    except (TypeError, ValueError):
        return None


def _chapa(ch):
    c = str(ch or "").strip()
    return c[:-2] if c.endswith(".0") else c


def _acompanhamentos(gfd):
    url, key = gfd.supabase_creds("inove")
    if not url or not key:
        return []
    rows, off = [], 0
    while True:
        b = gfd._sb_get(url, key, "diesel_acompanhamentos", [
            ("select", "motorista_chapa,motorista_nome,status,instrutor_nome,"
                       "dt_inicio_monitoramento,kml_meta,kml_inicial,created_at"),
            ("order", "created_at"), ("limit", "1000"), ("offset", str(off))])
        rows += b
        if len(b) < 1000:
            break
        off += 1000
    return rows


def montar(gfd):
    """Dicionario do painel, em colunas (arrays paralelos) para caber em poucos MB."""
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

    # Tratativas e acompanhamentos por chapa: e o que diz se o motorista ruim ja esta sendo
    # tratado ou se ninguem chegou nele ainda.
    trat = defaultdict(list)
    for t in getattr(gfd, "_tr", None) or []:
        ch = _chapa(t.get("motorista_chapa"))
        if ch:
            trat[ch].append([str(t.get("created_at") or "")[:10], t.get("status") or "",
                             t.get("prioridade") or "", t.get("linha") or ""])
    acomp = defaultdict(list)
    try:
        for a in _acompanhamentos(gfd):
            ch = _chapa(a.get("motorista_chapa"))
            if ch:
                acomp[ch].append([str(a.get("dt_inicio_monitoramento") or a.get("created_at") or "")[:10],
                                  a.get("status") or "", a.get("instrutor_nome") or "",
                                  a.get("kml_meta"), a.get("kml_inicial")])
    except Exception as e:  # opcional: o painel funciona sem
        print(f"[painel] acompanhamentos falhou ({e}).")

    motoristas = [[ch, nome_de(ch) if ch else "SEM CHAPA"] for ch in mot]

    return {
        "versao": 1,
        "gerado_em": gfd._HOJE.isoformat(),
        "mes_ini": gfd.MES_INI.isoformat(),
        "mes_fim": gfd.MES_FIM.isoformat(),          # exclusivo
        "mes_ant_ini": gfd.MES_ANT_INI.isoformat(),
        "mes_ref_label": gfd.MES_REF_LABEL,
        "mes_ant_label": gfd.MES_ANT_LABEL,
        "periodo_label": gfd.PERIODO_LABEL,
        "meta": gfd.META,
        "dias": list(dias),
        "motoristas": motoristas,
        "linhas": list(lin),
        "carros": [[p, cluster_de.get(p) or ""] for p in car],
        "pd": cols,
        "tn": tn,
        "trat": trat,
        "acomp": acomp,
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


def exportar(gfd, out_dir):
    out_dir = Path(out_dir)
    pub = out_dir / "painel_pub.pem"
    dados = montar(gfd)
    env = cifrar(dados, pub.read_bytes())
    (out_dir / "painel_dados.enc.json").write_text(json.dumps(env), encoding="utf-8")
    print(f"[painel] painel_dados.enc.json: {len(dados['pd']['d'])} linhas de premiacao, "
          f"{len(dados['motoristas'])} motoristas, {len(dados['dias'])} dias (cifrado).")

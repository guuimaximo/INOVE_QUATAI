# -*- coding: utf-8 -*-
"""
Gera um PNG diario com o painel de GARANTIAS (Euro6) no estilo do Flash Report.
Reaproveita a leitura/calculo de gerar_programacao_semanal.py.
Saida: saidas/Garantias_AAAA-MM-DD.png
"""
import os, sys, datetime, importlib.util

BASE = os.path.dirname(os.path.abspath(__file__))
SAIDA_DIR = os.path.join(BASE, 'saidas')

def _load_gerador():
    spec = importlib.util.spec_from_file_location('gps', os.path.join(BASE, 'gerar_programacao_semanal.py'))
    m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
    return m

# ---------- paleta Flash Report ----------
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_RIGHT
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle

BG    = colors.HexColor('#f4f6f9')
DARK  = colors.HexColor('#0f3540')   # teal escuro (barras de secao)
DARK2 = colors.HexColor('#0b2831')
TEAL  = colors.HexColor('#17a2a2')
MINT  = colors.HexColor('#7fd6c4')
INK   = colors.HexColor('#1a2b33')
MUT   = colors.HexColor('#6b7c85')
LINE  = colors.HexColor('#e3e8ec')
CARD  = colors.white
SOFT  = colors.HexColor('#f1f4f7')
OKG   = colors.HexColor('#1e9e63'); OKBG = colors.HexColor('#e3f5eb')
WARN  = colors.HexColor('#b7791f'); WARNBG = colors.HexColor('#fbf0d9')
RED   = colors.HexColor('#c0392b'); REDBG = colors.HexColor('#fbe4e1')

def S(n, **k):
    b = dict(fontName='Helvetica', fontSize=8.5, leading=10.5, textColor=INK); b.update(k)
    return ParagraphStyle(n, **b)

def build(D, png_path, hoje):
    hoje_d = hoje.date() if isinstance(hoje, datetime.datetime) else hoje
    gar = D.get('garantia', [])
    pend = [g for g in gar if not g.get('done')]
    feitos = [g for g in gar if g.get('done')]
    prox = pend[0] if pend else None

    H1   = S('h1', fontName='Helvetica-Bold', fontSize=19, leading=22, textColor=INK)
    SUB  = S('sub', fontSize=8.8, leading=11, textColor=MUT)
    PILL_L = S('pl', fontSize=6.6, leading=8, textColor=MINT, alignment=TA_RIGHT)
    PILL_V = S('pv', fontName='Helvetica-Bold', fontSize=11, leading=13, textColor=colors.white, alignment=TA_RIGHT)
    KL   = S('kl', fontSize=6.4, leading=8, textColor=MUT, alignment=TA_CENTER)
    KV   = S('kv', fontName='Helvetica-Bold', fontSize=17, leading=19, alignment=TA_CENTER)
    KS   = S('ks', fontSize=6.8, leading=8.5, textColor=MUT, alignment=TA_CENTER)
    SEC  = S('sec', fontName='Helvetica-Bold', fontSize=7.6, leading=9.5, textColor=colors.white)
    TH   = S('th', fontName='Helvetica-Bold', fontSize=6.9, leading=8.5, textColor=MUT, alignment=TA_CENTER)
    THL  = S('thl', fontName='Helvetica-Bold', fontSize=6.9, leading=8.5, textColor=MUT)
    TD   = S('td', fontSize=8, leading=9.5, alignment=TA_CENTER)
    TDB  = S('tdb', fontName='Helvetica-Bold', fontSize=8.2, leading=9.5)
    FOOT = S('ft', fontSize=6.4, leading=8, textColor=MUT)

    PW = A4[0] - 2*1.1*cm
    story = []

    # ---- cabecalho ----
    left = [Paragraph('GARANTIA EURO6', H1),
            Paragraph('Revisão na Concessionária &nbsp;·&nbsp; Garagem Quataí (046)', SUB)]
    pill = Table([[Paragraph('REFERÊNCIA', PILL_L)], [Paragraph(hoje.strftime('%d/%m/%Y'), PILL_V)]],
                 colWidths=[3.3*cm])
    pill.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),DARK),('LEFTPADDING',(0,0),(-1,-1),9),
        ('RIGHTPADDING',(0,0),(-1,-1),9),('TOPPADDING',(0,0),(0,0),6),('BOTTOMPADDING',(0,0),(0,0),0),
        ('TOPPADDING',(0,1),(0,1),0),('BOTTOMPADDING',(0,1),(0,1),6)]))
    hd = Table([[left, pill]], colWidths=[PW-3.5*cm, 3.5*cm])
    hd.setStyle(TableStyle([('VALIGN',(0,0),(0,0),'BOTTOM'),('VALIGN',(1,0),(1,0),'MIDDLE'),
        ('LEFTPADDING',(0,0),(-1,-1),0),('RIGHTPADDING',(0,0),(-1,-1),0),('ALIGN',(1,0),(1,0),'RIGHT')]))
    rule = Table([['']], colWidths=[PW], rowHeights=[2.2])
    rule.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),DARK)]))
    story += [hd, Spacer(1,6), rule, Spacer(1,10)]

    # ---- KPIs ----
    def kpi(v, l, sub, cor):
        t = Table([[Paragraph(str(v), S('x', parent=KV, textColor=cor))],
                   [Paragraph(l, KL)], [Paragraph(sub or ' ', KS)]], colWidths=[PW/4-6])
        t.setStyle(TableStyle([('BOX',(0,0),(-1,-1),0.6,LINE),('BACKGROUND',(0,0),(-1,-1),CARD),
            ('TOPPADDING',(0,0),(0,0),9),('BOTTOMPADDING',(0,0),(0,0),1),
            ('TOPPADDING',(0,1),(0,1),0),('BOTTOMPADDING',(0,1),(0,1),1),
            ('TOPPADDING',(0,2),(0,2),0),('BOTTOMPADDING',(0,2),(0,2),8)]))
        return t
    prox_txt = ('%s · %s' % (prox['veic'], prox['alvo'])) if prox else '—'
    kr = Table([[kpi(len(gar),'FROTA EM GARANTIA','veículos Euro6', INK),
                 kpi(len(pend),'A PROGRAMAR','revisões pendentes', TEAL),
                 kpi(len(feitos),'JÁ REALIZADAS','concluídas', OKG),
                 kpi(prox['alvo'] if prox else '—','PRÓXIMA CHAMADA', prox['veic'] if prox else '', WARN)]],
               colWidths=[PW/4]*4)
    kr.setStyle(TableStyle([('LEFTPADDING',(0,0),(-1,-1),3),('RIGHTPADDING',(0,0),(-1,-1),3),('VALIGN',(0,0),(-1,-1),'TOP')]))
    story += [kr, Spacer(1,10)]

    # ---- faixa: frescor do KM ----
    atraso = D.get('km_ref_atraso')
    if atraso is None: fc, ftxt = MUT, 'sem informação'
    elif atraso <= 1: fc, ftxt = OKG, 'dado do dia'
    elif atraso <= 3: fc, ftxt = WARN, '%d dias de defasagem' % atraso
    else: fc, ftxt = RED, '%d dias de defasagem' % atraso
    fbg = colors.HexColor('#e3f5eb') if fc is OKG else (colors.HexColor('#fbf0d9') if fc is WARN else (colors.HexColor('#fbe4e1') if fc is RED else SOFT))
    FL = S('fl', fontSize=6.6, leading=8, textColor=MUT)
    FV = S('fv', fontName='Helvetica-Bold', fontSize=11, leading=13, textColor=fc)
    FS = S('fs', fontName='Helvetica-Bold', fontSize=8.4, leading=10, textColor=fc, alignment=TA_RIGHT)
    faixa = Table([[[Paragraph('ÚLTIMA ATUALIZAÇÃO DO KM (ABASTECIMENTO)', FL),
                     Paragraph(D.get('km_ref','—'), FV)],
                    Paragraph(ftxt.upper(), FS)]], colWidths=[PW*0.62, PW*0.38])
    faixa.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),fbg),('BOX',(0,0),(-1,-1),0.6,fc),
        ('VALIGN',(0,0),(-1,-1),'MIDDLE'),('LEFTPADDING',(0,0),(0,0),10),('RIGHTPADDING',(1,0),(1,0),10),
        ('TOPPADDING',(0,0),(-1,-1),6),('BOTTOMPADDING',(0,0),(-1,-1),6)]))
    story += [faixa, Spacer(1,12)]

    # ---- ALERTA: oleo de motor vencido -> chamar a concessionaria (revisao troca o oleo junto) ----
    oleo_alert = sorted([g for g in gar if g.get('oleo_venc') is not None], key=lambda g: -g['oleo_venc'])
    if oleo_alert:
        AL = S('al', fontName='Helvetica-Bold', fontSize=8.4, leading=10.5, textColor=colors.white)
        txt = '  ·  '.join('<b>%s</b> (óleo venceu %s km)' % (g['veic'], g['oleo_venc']) for g in oleo_alert[:10])
        cab = Table([[Paragraph('⚠️  ÓLEO DE MOTOR VENCIDO — CHAMAR A CONCESSIONÁRIA JÁ (a revisão troca o óleo junto)', AL)]], colWidths=[PW])
        cab.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),RED),('LEFTPADDING',(0,0),(-1,-1),10),
            ('TOPPADDING',(0,0),(-1,-1),5),('BOTTOMPADDING',(0,0),(-1,-1),5)]))
        corpo = Table([[Paragraph(txt, S('alc', fontSize=8.4, leading=11, textColor=INK))]], colWidths=[PW])
        corpo.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),REDBG),('BOX',(0,0),(-1,-1),0.6,RED),
            ('LEFTPADDING',(0,0),(-1,-1),10),('RIGHTPADDING',(0,0),(-1,-1),10),
            ('TOPPADDING',(0,0),(-1,-1),6),('BOTTOMPADDING',(0,0),(-1,-1),6)]))
        story += [cab, corpo, Spacer(1,12)]

    # ---- barra de secao ----
    bar = Table([[Paragraph('CRONOGRAMA DE REVISÕES — ORDENADO POR URGÊNCIA', SEC)]], colWidths=[PW])
    bar.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),DARK),('LEFTPADDING',(0,0),(-1,-1),10),
        ('TOPPADDING',(0,0),(-1,-1),5),('BOTTOMPADDING',(0,0),(-1,-1),5)]))
    story += [bar]

    # ---- tabela ----
    hdr = [Paragraph('VEÍCULO', THL), Paragraph('ODÔMETRO', TH), Paragraph('KM ATUALIZ.', TH),
           Paragraph('REV.', TH), Paragraph('FALTA (KM)', TH), Paragraph('KM/DIA', TH),
           Paragraph('VENCE', TH), Paragraph('CHAMAR EM', TH), Paragraph('STATUS', TH)]
    data = [hdr]; styles = []
    for i, g in enumerate(gar, 1):
        done = g.get('done')
        # urgencia pela data alvo
        try:
            d, m, a = g['alvo'].split('/'); alvo_dt = datetime.date(int(a), int(m), int(d))
            dias = (alvo_dt - hoje_d).days
        except Exception:
            dias = 999
        oleo_v = g.get('oleo_venc') is not None
        if done: stat_txt, stat_c, stat_bg = ('OK<br/><font size=5.3>OS %s</font>' % ('ABERTA' if g.get('os_aberta') else 'FECHADA')), OKG, OKBG
        elif oleo_v: stat_txt, stat_c, stat_bg = 'CHAMAR JÁ<br/><font size=5.3>óleo vencido</font>', RED, REDBG
        elif dias <= 3: stat_txt, stat_c, stat_bg = 'URGENTE', RED, REDBG
        elif dias <= 10: stat_txt, stat_c, stat_bg = 'PRÓXIMA', WARN, WARNBG
        else: stat_txt, stat_c, stat_bg = 'PROGRAMAR', MUT, SOFT
        chamar = '—' if done else ('JÁ' if oleo_v else g['alvo'])
        atr = g.get('km_atraso')
        kmupd_c = MUT if (atr is None or atr <= 1) else (WARN if atr <= 3 else RED)
        data.append([Paragraph(g['veic'], TDB),
                     Paragraph('{:,}'.format(g['odom']).replace(',', '.'), TD),
                     Paragraph(g.get('km_upd','—'), S('ku', parent=TD, textColor=kmupd_c,
                               fontName=('Helvetica-Bold' if (atr or 0) > 3 else 'Helvetica'))),
                     Paragraph('%dk' % (g['milestone']//1000), TD),
                     Paragraph('{:,}'.format(g['falta']).replace(',', '.'), TD),
                     Paragraph(str(g['kmdia']), TD),
                     Paragraph(g['vence'], S('v', parent=TD, textColor=MUT)),
                     Paragraph(chamar, S('c', parent=TD, fontName='Helvetica-Bold',
                                         textColor=(MUT if done else (RED if dias <= 3 else INK)))),
                     Paragraph(stat_txt, S('s', parent=TD, fontName='Helvetica-Bold', fontSize=6.0, leading=7.2, textColor=stat_c))])
        styles.append(('BACKGROUND', (8,i), (8,i), stat_bg))
        if done: styles.append(('BACKGROUND', (0,i), (7,i), colors.HexColor('#f7fbf8')))
        elif i % 2 == 0: styles.append(('BACKGROUND', (0,i), (7,i), SOFT))
    cw = [2.0*cm, 1.95*cm, 1.75*cm, 1.1*cm, 1.8*cm, 1.45*cm, 1.95*cm, 2.05*cm, 1.95*cm]
    cw = [w * (PW/sum(cw)) for w in cw]
    tb = Table(data, colWidths=cw, repeatRows=1)
    tb.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#eef2f5')),
        ('LINEBELOW',(0,0),(-1,0),0.8,LINE), ('LINEBELOW',(0,1),(-1,-1),0.4,LINE),
        ('BOX',(0,0),(-1,-1),0.6,LINE), ('VALIGN',(0,0),(-1,-1),'MIDDLE'),
        ('TOPPADDING',(0,0),(-1,-1),3.6),('BOTTOMPADDING',(0,0),(-1,-1),3.6),
        ('LEFTPADDING',(0,0),(0,-1),8)] + styles))
    story += [tb, Spacer(1,8)]

    leg = Paragraph('<font color="#c0392b"><b>URGENTE</b></font> = chamar em ≤3 dias &nbsp;·&nbsp; '
        '<font color="#b7791f"><b>PRÓXIMA</b></font> = ≤10 dias &nbsp;·&nbsp; '
        '<font color="#1e9e63"><b>OK</b></font> = já realizada (<b>OS aberta</b> = feita, ainda não fechada no sistema · <b>OS fechada</b> = baixada). &nbsp; '
        '"Chamar em" já desconta o save de 500 km. Projeção pelo km/dia real de cada veículo. &nbsp; '
        '<b>KM Atualiz.</b> = último abastecimento que atualizou o odômetro daquele veículo '
        '(âmbar = 2-3 dias, vermelho = +3 dias sem leitura).', FOOT)
    story += [leg]

    def page(cv, doc):
        cv.saveState(); cv.setFillColor(BG); cv.rect(0, 0, A4[0], A4[1], stroke=0, fill=1)
        cv.setFillColor(MUT); cv.setFont('Helvetica', 6.2)
        cv.drawString(1.1*cm, 0.75*cm, 'Gerado automaticamente · Manutenção Garagem Quataí')
        cv.drawRightString(A4[0]-1.1*cm, 0.75*cm, 'Garantia Euro6 · %s' % hoje.strftime('%d/%m/%Y %H:%M'))
        cv.restoreState()

    pdf_tmp = png_path.replace('.png', '.pdf')
    doc = SimpleDocTemplate(pdf_tmp, pagesize=A4, leftMargin=1.1*cm, rightMargin=1.1*cm,
                            topMargin=1.0*cm, bottomMargin=1.2*cm, title='Garantias Euro6')
    doc.build(story, onFirstPage=page, onLaterPages=page)

    import fitz
    d = fitz.open(pdf_tmp)
    d[0].get_pixmap(dpi=170).save(png_path)
    n = d.page_count; d.close()
    try: os.remove(pdf_tmp)
    except Exception: pass
    return n

def enviar_telegram(png_path, caption, import_dir):
    """Envia o PNG pro Telegram (mesmo bot do importador). Nao-fatal."""
    import json as _json, uuid, urllib.request
    cfg_path = os.path.join(import_dir, '_telegram.json')
    if not os.path.exists(cfg_path):
        print('  [telegram] _telegram.json nao encontrado - pulando'); return False
    cfg = _json.loads(open(cfg_path, encoding='utf-8').read())
    token, chat = cfg['token'], str(cfg['chat_id'])
    boundary = '----pv' + uuid.uuid4().hex
    img = open(png_path, 'rb').read()
    parts = []
    def campo(nome, valor):
        parts.append(('--%s\r\nContent-Disposition: form-data; name="%s"\r\n\r\n%s\r\n'
                      % (boundary, nome, valor)).encode('utf-8'))
    campo('chat_id', chat); campo('caption', caption); campo('parse_mode', 'HTML')
    parts.append(('--%s\r\nContent-Disposition: form-data; name="photo"; filename="%s"\r\n'
                  'Content-Type: image/png\r\n\r\n' % (boundary, os.path.basename(png_path))).encode('utf-8'))
    parts.append(img); parts.append(('\r\n--%s--\r\n' % boundary).encode('utf-8'))
    body = b''.join(parts)
    req = urllib.request.Request('https://api.telegram.org/bot%s/sendPhoto' % token, data=body,
                                 headers={'Content-Type': 'multipart/form-data; boundary=' + boundary})
    try:
        with urllib.request.urlopen(req, timeout=90) as r:
            ok = _json.loads(r.read().decode('utf-8')).get('ok')
        print('  [telegram] enviado:', ok); return bool(ok)
    except Exception as e:
        print('  [telegram] FALHOU:', e); return False

def montar_caption(D, hoje):
    gar = D.get('garantia', [])
    pend = [g for g in gar if not g.get('done')]
    atr = D.get('km_ref_atraso')
    if atr is None: sinal, txt = '⚪', 'sem informação'
    elif atr <= 1: sinal, txt = '🟢', 'dado do dia'
    elif atr <= 3: sinal, txt = '🟡', '%d dias de defasagem' % atr
    else: sinal, txt = '🔴', '%d dias de defasagem' % atr
    linhas = ['<b>🛡️ GARANTIA EURO6 — %s</b>' % hoje.strftime('%d/%m/%Y'),
              '%s <b>KM atualizado até %s</b> (%s)' % (sinal, D.get('km_ref','—'), txt),
              '🚌 %d na frota · <b>%d a programar</b> · %d já feitas' % (len(gar), len(pend), len(gar)-len(pend))]
    if pend:
        linhas.append('')
        linhas.append('<b>Próximas chamadas:</b>')
        for g in pend[:5]:
            linhas.append('• %s — %s · faltam %s km (odôm. %s)'
                % (g['veic'], g['alvo'], '{:,}'.format(g['falta']).replace(',', '.'),
                   '{:,}'.format(g['odom']).replace(',', '.')))
    return '\n'.join(linhas)

def main():
    hoje = datetime.datetime.now()
    G = _load_gerador()
    rows = G.puxar_dados()
    D = G.montar(rows, hoje.date())
    os.makedirs(SAIDA_DIR, exist_ok=True)
    png = os.path.join(SAIDA_DIR, 'Garantias_%s.png' % hoje.strftime('%Y-%m-%d'))
    n = build(D, png, hoje)
    print('[%s] PNG gerado: %s (%d pagina(s), %d garantias) | KM ref: %s'
          % (hoje.strftime('%H:%M:%S'), png, n, len(D.get('garantia', [])), D.get('km_ref')))
    enviar_telegram(png, montar_caption(D, hoje), G.TELEGRAM_DIR)
    return png

if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print('ERRO:', e); import traceback; traceback.print_exc(); sys.exit(1)

# -*- coding: utf-8 -*-
"""
Painel da PROGRAMACAO DA SEMANA em PNG (estilo Flash Report), pra enviar no Telegram.
Cartoes por dia: Preventivas 10.000 + Inspecoes 5.000 (com HOJE) + quadros de servico.
Gera tambem o PDF (mesmo conteudo) em saidas/Painel_Programacao_AAAA-MM-DD.pdf
"""
import os, sys, datetime, importlib.util

BASE = os.path.dirname(os.path.abspath(__file__))
SAIDA_DIR = os.path.join(BASE, 'saidas')

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import cm
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_RIGHT
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle

BG=colors.HexColor('#eef1ee'); TEALD=colors.HexColor('#0c4a3c'); TEAL=colors.HexColor('#0f6e56')
INK=colors.HexColor('#16211f'); MUT=colors.HexColor('#5f716c'); LINE=colors.HexColor('#dce3df')
SKY=colors.HexColor('#bfe0d4'); AMBER=colors.HexColor('#b7791f'); AMBERBG=colors.HexColor('#fbf0d8')
RED=colors.HexColor('#c0392b'); REDBG=colors.HexColor('#fbe4e1'); NIGHT=colors.HexColor('#4a3b78')
CARD=colors.white

def _load(nome):
    spec = importlib.util.spec_from_file_location(nome.split('.')[0], os.path.join(BASE, nome))
    m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m
def S(n, **k):
    b = dict(fontName='Helvetica', fontSize=9, leading=11, textColor=INK); b.update(k); return ParagraphStyle(n, **b)
def num(x):
    try: return float(x)
    except: return None

def vencidas_10k(rows):
    s = set()
    for r in rows:
        if r['id_plano'] == '2306':
            k = num(r['km_para_proxima'])
            if k is not None and k >= 0: s.add(r['nr_ordem'])
    return s

def build(D, venc, png, hoje):
    from collections import defaultdict
    dow = [w.split('-')[0] for w in D['dow']]; dias = [x[:5] for x in D['dias_sem']]
    g10 = defaultdict(list); g5 = defaultdict(list)
    for m, v, di in D['esc10']: g10[di].append(v)
    for m, v, di in D['esc5_sem']: g5[di].append(v)
    hoje5 = [v for m, v in D['esc5_hoje']]
    PW = landscape(A4)[0] - 2*1.0*cm

    H1=S('h1', fontName='Helvetica-Bold', fontSize=18, leading=21)
    SUB=S('sub', fontSize=8.6, leading=11, textColor=MUT)
    PL=S('pl', fontSize=6.4, leading=8, textColor=SKY, alignment=TA_RIGHT)
    PV=S('pv', fontName='Helvetica-Bold', fontSize=10.5, leading=12.5, textColor=colors.white, alignment=TA_RIGHT)
    KV=S('kv', fontName='Helvetica-Bold', fontSize=17, leading=19, alignment=TA_CENTER)
    KL=S('kl', fontSize=7, leading=9, textColor=MUT, alignment=TA_CENTER)
    SECt=S('sec', fontName='Helvetica-Bold', fontSize=8.2, leading=10, textColor=TEAL)
    DAYH=S('dh', fontName='Helvetica-Bold', fontSize=8.6, leading=10.5, textColor=colors.white, alignment=TA_CENTER)
    DAYD=S('dd', fontSize=7, leading=9, textColor=SKY, alignment=TA_CENTER)
    CAR=S('car', fontName='Helvetica-Bold', fontSize=9, leading=12, textColor=INK, alignment=TA_CENTER)
    CARV=S('carv', fontName='Helvetica-Bold', fontSize=9, leading=12, textColor=RED, alignment=TA_CENTER)
    BT=S('bt', fontName='Helvetica-Bold', fontSize=6.8, leading=8.5, textColor=NIGHT)
    BV=S('bv', fontSize=8, leading=10.5, textColor=INK)
    FOOT=S('ft', fontSize=6.6, leading=8.5, textColor=MUT)

    story = []
    left = [Paragraph('Programação da Semana', H1), Paragraph('Garagem Quataí (046) · reprogramada em %s' % hoje.strftime('%d/%m/%Y'), SUB)]
    pill = Table([[Paragraph('PREVENTIVAS 10.000', PL)],[Paragraph('de amanhã até sexta', PV)]], colWidths=[4.2*cm])
    pill.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),TEALD),('LEFTPADDING',(0,0),(-1,-1),10),('RIGHTPADDING',(0,0),(-1,-1),10),
        ('TOPPADDING',(0,0),(0,0),5),('BOTTOMPADDING',(0,0),(0,0),0),('TOPPADDING',(0,1),(0,1),0),('BOTTOMPADDING',(0,1),(0,1),6)]))
    hd = Table([[left, pill]], colWidths=[PW-4.4*cm, 4.4*cm])
    hd.setStyle(TableStyle([('VALIGN',(0,0),(0,0),'BOTTOM'),('VALIGN',(1,0),(1,0),'MIDDLE'),('ALIGN',(1,0),(1,0),'RIGHT')]))
    rule = Table([['']], colWidths=[PW], rowHeights=[2.2]); rule.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),TEAL)]))
    story += [hd, Spacer(1,6), rule, Spacer(1,9)]

    def kpi(v, l, cor):
        t = Table([[Paragraph(str(v), S('x', parent=KV, textColor=cor))],[Paragraph(l, KL)]], colWidths=[PW/4-6])
        t.setStyle(TableStyle([('BOX',(0,0),(-1,-1),0.6,LINE),('BACKGROUND',(0,0),(-1,-1),CARD),
            ('TOPPADDING',(0,0),(0,0),7),('BOTTOMPADDING',(0,0),(0,0),0),('TOPPADDING',(0,1),(0,1),0),('BOTTOMPADDING',(0,1),(0,1),7)]))
        return t
    atr = D.get('km_ref_atraso'); kmc = AMBER if (atr and atr > 1) else (RED if (atr and atr > 3) else INK)
    kr = Table([[kpi(len(D['esc10']),'Preventivas 10.000', INK), kpi(len(hoje5)+sum(len(g5[i]) for i in g5),'Inspeções 5.000', INK),
                 kpi(len(venc & set(v.replace('046-','') for m,v,di in D['esc10'])),'Rev.10.000 vencidas', RED),
                 kpi(D.get('km_ref','—')[:5],'Sistema até', kmc)]], colWidths=[PW/4]*4)
    kr.setStyle(TableStyle([('LEFTPADDING',(0,0),(-1,-1),3),('RIGHTPADDING',(0,0),(-1,-1),3),('VALIGN',(0,0),(-1,-1),'TOP')]))
    story += [kr, Spacer(1,11)]

    def day_card(nome, dt, cars, w, hoje_card=False):
        hh = Table([[Paragraph(nome.upper(), DAYH)],[Paragraph(dt, DAYD)]], colWidths=[w])
        hb = AMBER if hoje_card else TEALD
        hh.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),hb),('TOPPADDING',(0,0),(0,0),3),('BOTTOMPADDING',(0,0),(0,0),0),
            ('TOPPADDING',(0,1),(0,1),0),('BOTTOMPADDING',(0,1),(0,1),4)]))
        rows_c = [[hh]]
        for v in cars:
            vv = v.replace('046-','')
            late = vv in venc
            rows_c.append([Paragraph(v + (' •' if late else ''), CARV if late else CAR)])
        for _ in range(3-len(cars)): rows_c.append([Paragraph('—', S('d', parent=CAR, textColor=MUT))])
        t = Table(rows_c, colWidths=[w])
        st = [('BOX',(0,0),(-1,-1),0.6,LINE),('TOPPADDING',(0,1),(-1,-1),3.5),('BOTTOMPADDING',(0,1),(-1,-1),3.5),
              ('LINEBELOW',(0,1),(0,-2),0.4,LINE),('TOPPADDING',(0,0),(0,0),0),('BOTTOMPADDING',(0,0),(0,0),0),
              ('LEFTPADDING',(0,0),(-1,-1),0),('RIGHTPADDING',(0,0),(-1,-1),0)]
        for i,v in enumerate(cars,1):
            if v.replace('046-','') in venc: st.append(('BACKGROUND',(0,i),(0,i),REDBG))
        t.setStyle(TableStyle(st))
        return t

    story += [Paragraph('PREVENTIVAS 10.000 — de amanhã até sexta', SECt), Spacer(1,5)]
    n = len(dias); w10 = (PW - (n-1)*6) / max(n,1)
    cells = [day_card(dow[i], dias[i], g10[i], w10) for i in range(n)]
    t10 = Table([cells], colWidths=[w10+6]*n)
    t10.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),3),('RIGHTPADDING',(0,0),(-1,-1),3)]))
    story += [t10, Spacer(1,12)]

    tem_hoje = len(hoje5) > 0
    story += [Paragraph('INSPEÇÕES 5.000 — %s' % ('hoje à noite + até sexta' if tem_hoje else 'de amanhã até sexta'), SECt), Spacer(1,5)]
    n5 = n + (1 if tem_hoje else 0); w5 = (PW - (n5-1)*6) / n5
    c5 = ([day_card('HOJE', D['hoje'][:5], hoje5, w5, True)] if tem_hoje else []) + [day_card(dow[i], dias[i], g5[i], w5) for i in range(n)]
    t5 = Table([c5], colWidths=[w5+6]*n5)
    t5.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),3),('RIGHTPADDING',(0,0),(-1,-1),3)]))
    story += [t5, Spacer(1,12)]

    boxes = [(t, D['box_veic'].get(t, [])) for t in D['boxes'] if D['box_veic'].get(t)]
    if boxes:
        story += [Paragraph('SERVIÇOS QUE VÃO JUNTO NAS PREVENTIVAS', SECt), Spacer(1,5)]
        cellsb = []
        for t, vs in boxes:
            bx = Table([[Paragraph(t, BT)],[Paragraph(' · '.join(vs), BV)]], colWidths=[(PW-3*8)/4])
            bx.setStyle(TableStyle([('BOX',(0,0),(-1,-1),0.6,LINE),('BACKGROUND',(0,0),(-1,-1),CARD),
                ('TOPPADDING',(0,0),(0,0),5),('LEFTPADDING',(0,0),(-1,-1),8),('RIGHTPADDING',(0,0),(-1,-1),8),
                ('BOTTOMPADDING',(0,1),(0,1),6),('TOPPADDING',(0,1),(0,1),2)]))
            cellsb.append(bx)
        rowsb = [cellsb[i:i+4] for i in range(0, len(cellsb), 4)]
        for rb in rowsb:
            while len(rb) < 4: rb.append('')
            tb = Table([rb], colWidths=[PW/4]*4)
            tb.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),3),('RIGHTPADDING',(0,0),(-1,-1),3),('BOTTOMPADDING',(0,0),(-1,-1),6)]))
            story += [tb]

    story += [Spacer(1,4), Paragraph('Carros em <font color="#c0392b"><b>vermelho •</b></font> = Revisão 10.000 vencida. '
        'Garantia (242xxx) faz 10.000/5.000 in-house; só a revisão da concessionária é à parte. '
        'Nível 10.000 = preventiva · 5.000 = inspeção.', FOOT)]

    def page(cv, doc):
        cv.saveState(); cv.setFillColor(BG); cv.rect(0,0,landscape(A4)[0],landscape(A4)[1], stroke=0, fill=1)
        cv.setFillColor(MUT); cv.setFont('Helvetica', 6.4)
        cv.drawString(1.0*cm, 0.62*cm, 'Gerado automaticamente · Manutenção Garagem Quataí')
        cv.drawRightString(landscape(A4)[0]-1.0*cm, 0.62*cm, 'Programação · %s' % hoje.strftime('%d/%m/%Y'))
        cv.restoreState()
    pdf = png.replace('.png', '.pdf')
    doc = SimpleDocTemplate(pdf, pagesize=landscape(A4), leftMargin=1.0*cm, rightMargin=1.0*cm, topMargin=0.9*cm, bottomMargin=1.0*cm, title='Programação da Semana')
    doc.build(story, onFirstPage=page, onLaterPages=page)
    import fitz
    d = fitz.open(pdf); d[0].get_pixmap(dpi=165).save(png); d.close()
    return pdf

def caption(D, hoje):
    return '\n'.join(['<b>🔧 PROGRAMAÇÃO DA SEMANA</b> · %s' % hoje.strftime('%d/%m'),
        'Preventivas 10.000: de amanhã até sexta (%d carros)' % len(D['esc10']),
        'Inspeções 5.000: hoje à noite + semana',
        'Sistema atualizado até %s' % D.get('km_ref','—')[:10]])

def enviar_documento(pdf_path, caption, import_dir):
    import json as _json, uuid, urllib.request
    cfg_path = os.path.join(import_dir, '_telegram.json')
    if not os.path.exists(cfg_path): return False
    cfg = _json.loads(open(cfg_path, encoding='utf-8').read())
    token, chat = cfg['token'], str(cfg['chat_id'])
    b = '----pv' + uuid.uuid4().hex; data = open(pdf_path, 'rb').read(); parts = []
    def campo(n, v): parts.append(('--%s\r\nContent-Disposition: form-data; name="%s"\r\n\r\n%s\r\n' % (b, n, v)).encode('utf-8'))
    campo('chat_id', chat); campo('caption', caption)
    parts.append(('--%s\r\nContent-Disposition: form-data; name="document"; filename="%s"\r\nContent-Type: application/pdf\r\n\r\n'
                  % (b, os.path.basename(pdf_path))).encode('utf-8'))
    parts.append(data); parts.append(('\r\n--%s--\r\n' % b).encode('utf-8'))
    req = urllib.request.Request('https://api.telegram.org/bot%s/sendDocument' % token, data=b''.join(parts),
                                 headers={'Content-Type': 'multipart/form-data; boundary=' + b})
    try:
        with urllib.request.urlopen(req, timeout=90) as r:
            ok = _json.loads(r.read().decode('utf-8')).get('ok')
        print('  [telegram] PDF enviado:', ok); return bool(ok)
    except Exception as e:
        print('  [telegram] PDF FALHOU:', e); return False

def main():
    import json as _json
    hoje = datetime.date.today()
    G = _load('gerar_programacao_semanal.py'); PG = _load('gerar_png_garantias.py')
    # Painel mostra o plano TRAVADO (programacao_vigente.json), nao re-gera.
    vig_path = os.path.join(SAIDA_DIR, 'programacao_vigente.json')
    if not os.path.exists(vig_path):
        print('Sem programacao travada. Rode gerar_programacao_semanal.py primeiro.'); return None
    D = _json.loads(open(vig_path, encoding='utf-8').read())
    # dados atuais so pro frescor (km_ref) e o overlay de vencidos (nao mexem no plano)
    rows = G.puxar_dados()
    Dfresh = G.montar(rows, hoje)
    D['km_ref'] = Dfresh.get('km_ref'); D['km_ref_atraso'] = Dfresh.get('km_ref_atraso')
    os.makedirs(SAIDA_DIR, exist_ok=True)
    png = os.path.join(SAIDA_DIR, 'Painel_Programacao_%s.png' % hoje.strftime('%Y-%m-%d'))
    pdf = build(D, vencidas_10k(rows), png, hoje)
    print('[%s] Painel do plano TRAVADO (%d prev, semana %s-%s)'
          % (datetime.datetime.now().strftime('%H:%M:%S'), len(D['esc10']), D['semana_ini'][:5], D['semana_fim'][:5]))
    PG.enviar_telegram(png, caption(D, hoje), G.TELEGRAM_DIR)
    enviar_documento(pdf, '📄 Programação da Semana (PDF) · %s' % hoje.strftime('%d/%m'), G.TELEGRAM_DIR)
    return png

if __name__ == '__main__':
    try: main()
    except Exception as e:
        print('ERRO:', e); import traceback; traceback.print_exc(); sys.exit(1)

# -*- coding: utf-8 -*-
"""
Gera o PNG da PROGRAMACAO SEMANAL de preventivas, no estilo do Flash Report,
e envia no Telegram. Reaproveita a leitura/calculo de gerar_programacao_semanal.py.
Saida: saidas/Programacao_AAAA-MM-DD.png
"""
import os, sys, datetime, importlib.util

BASE = os.path.dirname(os.path.abspath(__file__))
SAIDA_DIR = os.path.join(BASE, 'saidas')

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_RIGHT
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle

BG    = colors.HexColor('#f4f6f9')
DARK  = colors.HexColor('#0f3540')
TEAL  = colors.HexColor('#17a2a2')
MINT  = colors.HexColor('#7fd6c4')
INK   = colors.HexColor('#1a2b33')
MUT   = colors.HexColor('#6b7c85')
LINE  = colors.HexColor('#e3e8ec')
SOFT  = colors.HexColor('#f1f4f7')
NIGHT = colors.HexColor('#4a3b78')
OKG   = colors.HexColor('#1e9e63')
WARN  = colors.HexColor('#b7791f')
RED   = colors.HexColor('#c0392b')

def _load_gerador():
    spec = importlib.util.spec_from_file_location('gps', os.path.join(BASE, 'gerar_programacao_semanal.py'))
    m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
    return m

def S(n, **k):
    b = dict(fontName='Helvetica', fontSize=8.5, leading=10.5, textColor=INK); b.update(k)
    return ParagraphStyle(n, **b)

def build(D, png_path, hoje):
    H1  = S('h1', fontName='Helvetica-Bold', fontSize=19, leading=22)
    SUB = S('sub', fontSize=8.8, leading=11, textColor=MUT)
    PL  = S('pl', fontSize=6.6, leading=8, textColor=MINT, alignment=TA_RIGHT)
    PV  = S('pv', fontName='Helvetica-Bold', fontSize=11, leading=13, textColor=colors.white, alignment=TA_RIGHT)
    KL  = S('kl', fontSize=6.4, leading=8, textColor=MUT, alignment=TA_CENTER)
    KV  = S('kv', fontName='Helvetica-Bold', fontSize=17, leading=19, alignment=TA_CENTER)
    KS  = S('ks', fontSize=6.8, leading=8.5, textColor=MUT, alignment=TA_CENTER)
    SEC = S('sec', fontName='Helvetica-Bold', fontSize=7.6, leading=9.5, textColor=colors.white)
    TH  = S('th', fontName='Helvetica-Bold', fontSize=6.9, leading=8.5, textColor=MUT)
    DAY = S('day', fontName='Helvetica-Bold', fontSize=8.4, leading=10.5)
    DAT = S('dat', fontSize=7, leading=9, textColor=MUT)
    CAR = S('car', fontName='Helvetica-Bold', fontSize=8.6, leading=12, textColor=DARK)
    CARN= S('carn', fontSize=8.6, leading=12, textColor=NIGHT)
    PN  = S('pn', fontSize=8.2, leading=10)
    FOOT= S('ft', fontSize=6.4, leading=8, textColor=MUT)

    PW = A4[0] - 2*1.1*cm
    story = []

    ini, fim = D['dias_sem'][0][:5], D['dias_sem'][-1][:5]
    left = [Paragraph('PROGRAMAÇÃO DE PREVENTIVAS', H1),
            Paragraph('Garagem Quataí (046) &nbsp;·&nbsp; Semana de <b>%s a %s</b>' % (ini, fim), SUB)]
    pill = Table([[Paragraph('GERADO EM', PL)], [Paragraph(hoje.strftime('%d/%m/%Y'), PV)]], colWidths=[3.3*cm])
    pill.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),DARK),('LEFTPADDING',(0,0),(-1,-1),9),
        ('RIGHTPADDING',(0,0),(-1,-1),9),('TOPPADDING',(0,0),(0,0),6),('BOTTOMPADDING',(0,0),(0,0),0),
        ('TOPPADDING',(0,1),(0,1),0),('BOTTOMPADDING',(0,1),(0,1),6)]))
    hd = Table([[left, pill]], colWidths=[PW-3.5*cm, 3.5*cm])
    hd.setStyle(TableStyle([('VALIGN',(0,0),(0,0),'BOTTOM'),('VALIGN',(1,0),(1,0),'MIDDLE'),
        ('LEFTPADDING',(0,0),(-1,-1),0),('RIGHTPADDING',(0,0),(-1,-1),0),('ALIGN',(1,0),(1,0),'RIGHT')]))
    rule = Table([['']], colWidths=[PW], rowHeights=[2.2]); rule.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),DARK)]))
    story += [hd, Spacer(1,6), rule, Spacer(1,10)]

    # KPIs
    n10 = len(D['esc10']); n5 = len(D['esc5_sem'])
    fp, fi = len(D['feitas_prev']), len(D['feitas_insp'])
    def kpi(v, l, sub, cor):
        t = Table([[Paragraph(str(v), S('x', parent=KV, textColor=cor))],
                   [Paragraph(l, KL)], [Paragraph(sub or ' ', KS)]], colWidths=[PW/4-6])
        t.setStyle(TableStyle([('BOX',(0,0),(-1,-1),0.6,LINE),('BACKGROUND',(0,0),(-1,-1),colors.white),
            ('TOPPADDING',(0,0),(0,0),9),('BOTTOMPADDING',(0,0),(0,0),1),('TOPPADDING',(0,1),(0,1),0),
            ('BOTTOMPADDING',(0,1),(0,1),1),('TOPPADDING',(0,2),(0,2),0),('BOTTOMPADDING',(0,2),(0,2),8)]))
        return t
    kr = Table([[kpi(n10,'PREVENTIVAS 10.000','3 por dia · manhã', DARK),
                 kpi(n5,'INSPEÇÕES 5.000','3 por dia · noite', NIGHT),
                 kpi(fp+fi,'REALIZADAS','na semana que passou', OKG),
                 kpi('%s–%s' % (ini, fim),'SEMANA PROGRAMADA','segunda a sexta', TEAL)]], colWidths=[PW/4]*4)
    kr.setStyle(TableStyle([('LEFTPADDING',(0,0),(-1,-1),3),('RIGHTPADDING',(0,0),(-1,-1),3),('VALIGN',(0,0),(-1,-1),'TOP')]))
    story += [kr, Spacer(1,10)]

    # faixa km
    atraso = D.get('km_ref_atraso')
    if atraso is None: fc, ftxt = MUT, 'sem informação'
    elif atraso <= 1: fc, ftxt = OKG, 'dado do dia'
    elif atraso <= 3: fc, ftxt = WARN, '%d dias de defasagem' % atraso
    else: fc, ftxt = RED, '%d dias de defasagem' % atraso
    fbg = colors.HexColor('#e3f5eb') if fc is OKG else (colors.HexColor('#fbf0d9') if fc is WARN else (colors.HexColor('#fbe4e1') if fc is RED else SOFT))
    faixa = Table([[[Paragraph('ÚLTIMA ATUALIZAÇÃO DO KM (ABASTECIMENTO)', S('fl', fontSize=6.6, leading=8, textColor=MUT)),
                     Paragraph(D.get('km_ref','—'), S('fv', fontName='Helvetica-Bold', fontSize=11, leading=13, textColor=fc))],
                    Paragraph(ftxt.upper(), S('fs', fontName='Helvetica-Bold', fontSize=8.4, textColor=fc, alignment=TA_RIGHT))]],
                  colWidths=[PW*0.62, PW*0.38])
    faixa.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),fbg),('BOX',(0,0),(-1,-1),0.6,fc),
        ('VALIGN',(0,0),(-1,-1),'MIDDLE'),('LEFTPADDING',(0,0),(0,0),10),('RIGHTPADDING',(1,0),(1,0),10),
        ('TOPPADDING',(0,0),(-1,-1),6),('BOTTOMPADDING',(0,0),(-1,-1),6)]))
    story += [faixa, Spacer(1,12)]

    # ---- grade da semana ----
    bar = Table([[Paragraph('PROGRAMAÇÃO DA SEMANA — 3 PREVENTIVAS (MANHÃ) + 3 INSPEÇÕES (NOITE)', SEC)]], colWidths=[PW])
    bar.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),DARK),('LEFTPADDING',(0,0),(-1,-1),10),
        ('TOPPADDING',(0,0),(-1,-1),5),('BOTTOMPADDING',(0,0),(-1,-1),5)]))
    story += [bar]

    from collections import defaultdict
    m_by, n_by = defaultdict(list), defaultdict(list)
    for mec, veic, di in D['esc10']: m_by[di].append((mec, veic))
    for mec, veic, di in D['esc5_sem']: n_by[di].append((mec, veic))
    rows = [[Paragraph('DIA', TH), Paragraph('MANHÃ · PREVENTIVA 10.000', TH), Paragraph('NOITE · INSPEÇÃO 5.000', TH)]]
    sty = []
    for di in range(5):
        dia = D['dow'][di].replace('-Feira', '')
        cel_d = [Paragraph(dia, DAY), Paragraph(D['dias_sem'][di][:5], DAT)]
        man = '<br/>'.join(v for m, v in m_by[di]) or '—'
        noi = '<br/>'.join(v for m, v in n_by[di]) or '—'
        rows.append([cel_d, Paragraph(man, CAR), Paragraph(noi, CARN)])
        if di % 2 == 1: sty.append(('BACKGROUND', (0, di+1), (-1, di+1), SOFT))
    gt = Table(rows, colWidths=[2.6*cm, (PW-2.6*cm)*0.5, (PW-2.6*cm)*0.5])
    gt.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#eef2f5')),
        ('LINEBELOW',(0,0),(-1,0),0.8,LINE),('LINEBELOW',(0,1),(-1,-1),0.4,LINE),
        ('BOX',(0,0),(-1,-1),0.6,LINE),('VALIGN',(0,0),(-1,-1),'TOP'),
        ('TOPPADDING',(0,0),(-1,-1),5),('BOTTOMPADDING',(0,0),(-1,-1),5),
        ('LEFTPADDING',(0,0),(0,-1),8)] + sty))
    story += [gt, Spacer(1,12)]

    # ---- pecas ----
    pecas = sorted([(t, len(v)) for t, v in D['box_veic'].items() if v], key=lambda x: -x[1])
    if pecas:
        bar2 = Table([[Paragraph('PEÇAS DA SEMANA — CONCILIADAS NAS PREVENTIVAS 10.000', SEC)]], colWidths=[PW])
        bar2.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),DARK),('LEFTPADDING',(0,0),(-1,-1),10),
            ('TOPPADDING',(0,0),(-1,-1),5),('BOTTOMPADDING',(0,0),(-1,-1),5)]))
        story += [bar2]
        mx = pecas[0][1]; BARMAX = PW - 8.2*cm
        pr = []
        for t, q in pecas:
            w = max(0.3*cm, BARMAX * q / mx)
            fillb = Table([[Paragraph('<font color="white"><b>%d</b></font>' % q,
                          S('bq', fontSize=7.6, alignment=TA_RIGHT))]], colWidths=[w], rowHeights=[12])
            fillb.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),TEAL),('VALIGN',(0,0),(-1,-1),'MIDDLE'),
                ('RIGHTPADDING',(0,0),(-1,-1),4),('LEFTPADDING',(0,0),(-1,-1),0)]))
            pr.append([Paragraph(t.title(), PN), fillb])
        pt = Table(pr, colWidths=[7.6*cm, BARMAX+0.6*cm])
        pt.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'MIDDLE'),('TOPPADDING',(0,0),(-1,-1),2.6),
            ('BOTTOMPADDING',(0,0),(-1,-1),2.6),('LEFTPADDING',(0,0),(0,-1),8),
            ('BOX',(0,0),(-1,-1),0.6,LINE),('BACKGROUND',(0,0),(-1,-1),colors.white),
            ('ROWBACKGROUNDS',(0,0),(-1,-1),[colors.white, SOFT])]))
        story += [pt, Spacer(1,8)]

    story += [Paragraph('Preventiva 10.000 = revisão + satélites vencendo a ≤3.000 km (conciliação). '
        'Inspeção 5.000 = só inspeção, sem troca de peça. '
        'Quem foi feito na semana já saiu da programação.', FOOT)]

    def page(cv, doc):
        cv.saveState(); cv.setFillColor(BG); cv.rect(0,0,A4[0],A4[1], stroke=0, fill=1)
        cv.setFillColor(MUT); cv.setFont('Helvetica', 6.2)
        cv.drawString(1.1*cm, 0.75*cm, 'Gerado automaticamente · Manutenção Garagem Quataí')
        cv.drawRightString(A4[0]-1.1*cm, 0.75*cm, 'Programação Semanal · %s' % hoje.strftime('%d/%m/%Y %H:%M'))
        cv.restoreState()

    pdf_tmp = png_path.replace('.png', '.pdf')
    doc = SimpleDocTemplate(pdf_tmp, pagesize=A4, leftMargin=1.1*cm, rightMargin=1.1*cm,
                            topMargin=1.0*cm, bottomMargin=1.2*cm, title='Programação Semanal')
    doc.build(story, onFirstPage=page, onLaterPages=page)
    import fitz
    d = fitz.open(pdf_tmp); d[0].get_pixmap(dpi=170).save(png_path); d.close()
    try: os.remove(pdf_tmp)
    except Exception: pass

def caption(D, hoje):
    ini, fim = D['dias_sem'][0][:5], D['dias_sem'][-1][:5]
    atr = D.get('km_ref_atraso')
    sinal = '⚪' if atr is None else ('🟢' if atr <= 1 else ('🟡' if atr <= 3 else '🔴'))
    L = ['<b>🔧 PROGRAMAÇÃO DE PREVENTIVAS</b>',
         '<b>Semana %s a %s</b>' % (ini, fim),
         '%s KM atualizado até %s' % (sinal, D.get('km_ref','—')),
         '',
         '🌅 <b>%d preventivas 10.000</b> (3/dia · manhã)' % len(D['esc10']),
         '🌙 <b>%d inspeções 5.000</b> (3/dia · noite)' % len(D['esc5_sem']),
         '✅ %d realizadas na semana que passou' % (len(D['feitas_prev']) + len(D['feitas_insp']))]
    pecas = sorted([(t, len(v)) for t, v in D['box_veic'].items() if v], key=lambda x: -x[1])[:5]
    if pecas:
        L += ['', '<b>Principais peças:</b>']
        L += ['• %s — %d' % (t.title(), q) for t, q in pecas]
    return '\n'.join(L)

def main():
    hoje = datetime.datetime.now()
    G = _load_gerador()
    png_mod_path = os.path.join(BASE, 'gerar_png_garantias.py')
    spec = importlib.util.spec_from_file_location('pg', png_mod_path)
    PG = importlib.util.module_from_spec(spec); spec.loader.exec_module(PG)

    rows = G.puxar_dados()
    D = G.montar(rows, hoje.date())
    os.makedirs(SAIDA_DIR, exist_ok=True)
    png = os.path.join(SAIDA_DIR, 'Programacao_%s.png' % hoje.strftime('%Y-%m-%d'))
    build(D, png, hoje)
    print('[%s] PNG programacao gerado: %s (%d prev, %d insp)'
          % (hoje.strftime('%H:%M:%S'), png, len(D['esc10']), len(D['esc5_sem'])))
    PG.enviar_telegram(png, caption(D, hoje), G.TELEGRAM_DIR)
    return png

if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print('ERRO:', e); import traceback; traceback.print_exc(); sys.exit(1)

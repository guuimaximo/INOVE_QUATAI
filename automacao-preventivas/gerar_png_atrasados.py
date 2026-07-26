# -*- coding: utf-8 -*-
"""
Analise de ATRASADOS: carros com a preventiva 10.000 (Rev.Pesada) ou a inspecao
5.000 ja VENCIDA (km_para_proxima >= 0), inclusive os de garantia.
Layout Flash Report. Gera PNG e envia no Telegram.
"""
import os, sys, json, datetime, statistics, importlib.util

BASE = os.path.dirname(os.path.abspath(__file__))
SAIDA_DIR = os.path.join(BASE, 'saidas')

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_RIGHT
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle

BG=colors.HexColor('#f4f6f9'); DARK=colors.HexColor('#0f3540'); INK=colors.HexColor('#1a2b33')
MUT=colors.HexColor('#6b7c85'); LINE=colors.HexColor('#e3e8ec'); SOFT=colors.HexColor('#f1f4f7')
NIGHT=colors.HexColor('#4a3b78'); OKG=colors.HexColor('#1e9e63')
WARN=colors.HexColor('#b7791f'); WARNBG=colors.HexColor('#fbf0d9')
RED=colors.HexColor('#c0392b'); REDBG=colors.HexColor('#fbe4e1'); GAR=colors.HexColor('#8a4b12')

def _load(nome):
    spec = importlib.util.spec_from_file_location(nome.split('.')[0], os.path.join(BASE, nome))
    m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m
def S(n, **k):
    b = dict(fontName='Helvetica', fontSize=8.5, leading=10.5, textColor=INK); b.update(k)
    return ParagraphStyle(n, **b)
def num(x):
    try: return float(x)
    except: return None
def fdate(s):
    s = s or ''
    if len(s) >= 10:
        try: return datetime.date(int(s[:4]), int(s[5:7]), int(s[8:10]))
        except: return None
    return None

def montar_atrasados(rows, fm=None):
    fm = fm or {}
    cars = {}
    for r in rows:
        cars.setdefault(r['nr_ordem'], {})[r['id_plano']] = r
    out = []
    for v, bp in cars.items():
        # km/dia do carro
        kmd = []
        for r in bp.values():
            kr, dv, qk = num(r['km_rodado']), num(r['dias_vencido']), num(r['qt_km_intervalo'])
            if qk and qk > 0 and kr and dv and dv > 30: kmd.append(kr/dv)
        kmdia = round(statistics.median(kmd), 1) if kmd else None
        gar = ('2645' in bp) or ('2646' in bp)
        for code, nome, nivel in [('2306', 'Revisão Pesada 10.000', '10K'), ('2305', 'Inspeção 5.000', '5K')]:
            if code in fm.get(v, set()): continue   # feito manual (antes do dado atualizar)
            r = bp.get(code)
            if not r: continue
            kmp = num(r['km_para_proxima'])
            if kmp is None or kmp < 0: continue   # so vencidos (>=0)
            dias = int(round(kmp / kmdia)) if (kmdia and kmdia > 0) else None
            out.append(dict(veic='046-'+v, nome=nome, nivel=nivel, km=int(kmp), dias=dias,
                            ult=fdate(r['dt_fechamento_os']), kmdia=kmdia, gar=gar))
    out.sort(key=lambda x: -x['km'])
    return out

def build(itens, atraso_dado, km_ref, png_path, hoje):
    a10 = [i for i in itens if i['nivel'] == '10K']
    a5  = [i for i in itens if i['nivel'] == '5K']
    pior = itens[0] if itens else None

    H1 = S('h1', fontName='Helvetica-Bold', fontSize=19, leading=22)
    SUB= S('sub', fontSize=8.8, leading=11, textColor=MUT)
    PL = S('pl', fontSize=6.6, leading=8, textColor=colors.HexColor('#e08a7a'), alignment=TA_RIGHT)
    PV = S('pv', fontName='Helvetica-Bold', fontSize=11, leading=13, textColor=colors.white, alignment=TA_RIGHT)
    KL = S('kl', fontSize=6.4, leading=8, textColor=MUT, alignment=TA_CENTER)
    KV = S('kv', fontName='Helvetica-Bold', fontSize=17, leading=19, alignment=TA_CENTER)
    KS = S('ks', fontSize=6.8, leading=8.5, textColor=MUT, alignment=TA_CENTER)
    SEC= S('sec', fontName='Helvetica-Bold', fontSize=7.6, leading=9.5, textColor=colors.white)
    TH = S('th', fontName='Helvetica-Bold', fontSize=6.9, leading=8.5, textColor=MUT, alignment=TA_CENTER)
    THL= S('thl', fontName='Helvetica-Bold', fontSize=6.9, leading=8.5, textColor=MUT)
    TD = S('td', fontSize=8.2, leading=10, alignment=TA_CENTER)
    TDB= S('tdb', fontName='Helvetica-Bold', fontSize=8.4, leading=10)
    FOOT=S('ft', fontSize=6.4, leading=8, textColor=MUT)

    PW = A4[0] - 2*1.1*cm
    story = []
    left = [Paragraph('ANÁLISE DE ATRASADOS', H1),
            Paragraph('Garagem Quataí (046) &nbsp;·&nbsp; preventivas <b>já vencidas</b> (10.000 e 5.000)', SUB)]
    pill = Table([[Paragraph('POSIÇÃO EM', PL)], [Paragraph(hoje.strftime('%d/%m/%Y'), PV)]], colWidths=[3.3*cm])
    pill.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),DARK),('LEFTPADDING',(0,0),(-1,-1),9),('RIGHTPADDING',(0,0),(-1,-1),9),
        ('TOPPADDING',(0,0),(0,0),6),('BOTTOMPADDING',(0,0),(0,0),0),('TOPPADDING',(0,1),(0,1),0),('BOTTOMPADDING',(0,1),(0,1),6)]))
    hd = Table([[left, pill]], colWidths=[PW-3.5*cm, 3.5*cm])
    hd.setStyle(TableStyle([('VALIGN',(0,0),(0,0),'BOTTOM'),('VALIGN',(1,0),(1,0),'MIDDLE'),('ALIGN',(1,0),(1,0),'RIGHT')]))
    rule = Table([['']], colWidths=[PW], rowHeights=[2.2]); rule.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),RED)]))
    story += [hd, Spacer(1,6), rule, Spacer(1,10)]

    def kpi(v, l, sub, cor):
        t = Table([[Paragraph(str(v), S('x', parent=KV, textColor=cor))],[Paragraph(l, KL)],[Paragraph(sub or ' ', KS)]], colWidths=[PW/4-6])
        t.setStyle(TableStyle([('BOX',(0,0),(-1,-1),0.6,LINE),('BACKGROUND',(0,0),(-1,-1),colors.white),
            ('TOPPADDING',(0,0),(0,0),9),('BOTTOMPADDING',(0,0),(0,0),1),('TOPPADDING',(0,1),(0,1),0),
            ('BOTTOMPADDING',(0,1),(0,1),1),('TOPPADDING',(0,2),(0,2),0),('BOTTOMPADDING',(0,2),(0,2),8)]))
        return t
    pior_txt = ('%s km' % format(pior['km'], ',d').replace(',', '.')) if pior else '—'
    kr = Table([[kpi(len(itens),'ATRASADOS','total', RED if itens else OKG),
                 kpi(len(a10),'REVISÃO 10.000','vencidas', RED if a10 else MUT),
                 kpi(len(a5),'INSPEÇÃO 5.000','vencidas', WARN if a5 else MUT),
                 kpi(pior_txt,'PIOR ATRASO', pior['veic'] if pior else '', RED)]], colWidths=[PW/4]*4)
    kr.setStyle(TableStyle([('LEFTPADDING',(0,0),(-1,-1),3),('RIGHTPADDING',(0,0),(-1,-1),3),('VALIGN',(0,0),(-1,-1),'TOP')]))
    story += [kr, Spacer(1,10)]

    if atraso_dado is None: fc, ftxt = MUT, 'sem informação'
    elif atraso_dado <= 1: fc, ftxt = OKG, 'dado do dia'
    elif atraso_dado <= 3: fc, ftxt = WARN, '%d dias de defasagem' % atraso_dado
    else: fc, ftxt = RED, '%d dias de defasagem' % atraso_dado
    fbg = (WARNBG if fc is WARN else (REDBG if fc is RED else SOFT))
    faixa = Table([[[Paragraph('ÚLTIMA ATUALIZAÇÃO DO SISTEMA (KM / OS)', S('fl', fontSize=6.6, leading=8, textColor=MUT)),
                     Paragraph(km_ref or '—', S('fv', fontName='Helvetica-Bold', fontSize=11, leading=13, textColor=fc))],
                    Paragraph(ftxt.upper(), S('fs', fontName='Helvetica-Bold', fontSize=8.4, textColor=fc, alignment=TA_RIGHT))]],
                  colWidths=[PW*0.62, PW*0.38])
    faixa.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),fbg),('BOX',(0,0),(-1,-1),0.6,fc),('VALIGN',(0,0),(-1,-1),'MIDDLE'),
        ('LEFTPADDING',(0,0),(0,0),10),('RIGHTPADDING',(1,0),(1,0),10),('TOPPADDING',(0,0),(-1,-1),6),('BOTTOMPADDING',(0,0),(-1,-1),6)]))
    story += [faixa, Spacer(1,12)]

    bar = Table([[Paragraph('CARROS COM PREVENTIVA VENCIDA — DO MAIOR ATRASO AO MENOR', SEC)]], colWidths=[PW])
    bar.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),DARK),('LEFTPADDING',(0,0),(-1,-1),10),('TOPPADDING',(0,0),(-1,-1),5),('BOTTOMPADDING',(0,0),(-1,-1),5)]))
    story += [bar]

    data = [[Paragraph('VEÍCULO', THL), Paragraph('SERVIÇO VENCIDO', TH), Paragraph('VENCIDO HÁ (KM)', TH),
             Paragraph('~DIAS', TH), Paragraph('ÚLTIMA', TH), Paragraph('ORIGEM', TH)]]
    sty = []
    for i, it in enumerate(itens, 1):
        cor = RED if it['nivel'] == '10K' else WARN
        data.append([Paragraph(it['veic'], TDB),
                     Paragraph(it['nome'], S('sv', parent=TD, textColor=(DARK if it['nivel']=='10K' else NIGHT))),
                     Paragraph(format(it['km'], ',d').replace(',', '.'), S('km', parent=TD, fontName='Helvetica-Bold', textColor=cor)),
                     Paragraph(str(it['dias']) if it['dias'] is not None else '—', TD),
                     Paragraph(it['ult'].strftime('%d/%m/%y') if it['ult'] else '—', S('u', parent=TD, textColor=MUT)),
                     Paragraph('Garantia' if it['gar'] else 'In-house', S('o', parent=TD, textColor=(GAR if it['gar'] else MUT),
                               fontName=('Helvetica-Bold' if it['gar'] else 'Helvetica')))])
        if it['nivel'] == '10K': sty.append(('BACKGROUND', (0,i), (-1,i), REDBG))
        elif i % 2 == 0: sty.append(('BACKGROUND', (0,i), (-1,i), SOFT))
    cw = [2.4*cm, 4.6*cm, 2.6*cm, 1.6*cm, 2.2*cm, 2.0*cm]
    cw = [w * (PW/sum(cw)) for w in cw]
    tb = Table(data, colWidths=cw, repeatRows=1)
    tb.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#eef2f5')),('LINEBELOW',(0,0),(-1,0),0.8,LINE),
        ('LINEBELOW',(0,1),(-1,-1),0.4,LINE),('BOX',(0,0),(-1,-1),0.6,LINE),('VALIGN',(0,0),(-1,-1),'MIDDLE'),
        ('TOPPADDING',(0,0),(-1,-1),3.4),('BOTTOMPADDING',(0,0),(-1,-1),3.4),('LEFTPADDING',(0,0),(0,-1),8)] + sty))
    story += [tb, Spacer(1,8)]
    story += [Paragraph('Linhas em <font color="#c0392b"><b>vermelho</b></font> = Revisão 10.000 vencida (prioridade). '
        '"Vencido há (km)" = quanto passou do limite. "~dias" = km ÷ km/dia do carro. '
        'Garantia = Euro6 (faz 10.000/5.000 in-house; a revisão da concessionária é à parte).', FOOT)]

    def page(cv, doc):
        cv.saveState(); cv.setFillColor(BG); cv.rect(0,0,A4[0],A4[1], stroke=0, fill=1)
        cv.setFillColor(MUT); cv.setFont('Helvetica', 6.2)
        cv.drawString(1.1*cm, 0.75*cm, 'Gerado automaticamente · Manutenção Garagem Quataí')
        cv.drawRightString(A4[0]-1.1*cm, 0.75*cm, 'Atrasados · %s' % hoje.strftime('%d/%m/%Y'))
        cv.restoreState()
    pdf_tmp = png_path.replace('.png', '.pdf')
    doc = SimpleDocTemplate(pdf_tmp, pagesize=A4, leftMargin=1.1*cm, rightMargin=1.1*cm, topMargin=1.0*cm, bottomMargin=1.2*cm, title='Análise de Atrasados')
    doc.build(story, onFirstPage=page, onLaterPages=page)
    import fitz
    d = fitz.open(pdf_tmp); d[0].get_pixmap(dpi=170).save(png_path); d.close()
    try: os.remove(pdf_tmp)
    except Exception: pass
    return dict(total=len(itens), a10=len(a10), a5=len(a5), pior=pior)

def caption(itens, atraso, km_ref, hoje):
    a10 = [i for i in itens if i['nivel'] == '10K']
    a5 = [i for i in itens if i['nivel'] == '5K']
    sinal = '⚪' if atraso is None else ('🟢' if atraso <= 1 else ('🟡' if atraso <= 3 else '🔴'))
    L = ['<b>🔴 ANÁLISE DE ATRASADOS</b> · %s' % hoje.strftime('%d/%m'),
         '%s Sistema atualizado até %s' % (sinal, km_ref or '—'), '',
         '<b>%d atrasados</b>  ·  🔴 %d Revisão 10.000  ·  🟡 %d Inspeção 5.000' % (len(itens), len(a10), len(a5))]
    if a10:
        L += ['', '<b>🔴 Revisão 10.000 vencida:</b>']
        L += ['• %s — %s km (%s)' % (i['veic'], format(i['km'], ',d').replace(',', '.'), 'garantia' if i['gar'] else 'in-house') for i in a10[:12]]
    return '\n'.join(L)

def main():
    hoje = datetime.date.today()
    G = _load('gerar_programacao_semanal.py')
    PG = _load('gerar_png_garantias.py')
    rows = G.puxar_dados()
    D = G.montar(rows, hoje)
    itens = montar_atrasados(rows, G.feitos_manual())
    os.makedirs(SAIDA_DIR, exist_ok=True)
    png = os.path.join(SAIDA_DIR, 'Atrasados_%s.png' % hoje.strftime('%Y-%m-%d'))
    res = build(itens, D.get('km_ref_atraso'), D.get('km_ref'), png, datetime.datetime.now())
    print('[%s] Atrasados: %d total | %d rev10k | %d insp5k'
          % (datetime.datetime.now().strftime('%H:%M:%S'), res['total'], res['a10'], res['a5']))
    PG.enviar_telegram(png, caption(itens, D.get('km_ref_atraso'), D.get('km_ref'), hoje), G.TELEGRAM_DIR)
    return png

if __name__ == '__main__':
    try: main()
    except Exception as e:
        print('ERRO:', e); import traceback; traceback.print_exc(); sys.exit(1)

# -*- coding: utf-8 -*-
"""
Acompanhamento DIARIO da programacao: confere quais carros programados ja foram
feitos e quais nao. Gera PNG no estilo Flash Report e envia no Telegram.
Le a programacao salva em saidas/programacao_vigente.json (gravada toda sexta).
Saida: saidas/Acompanhamento_AAAA-MM-DD.png
"""
import os, sys, json, datetime, importlib.util

BASE = os.path.dirname(os.path.abspath(__file__))
SAIDA_DIR = os.path.join(BASE, 'saidas')
VIGENTE = os.path.join(SAIDA_DIR, 'programacao_vigente.json')

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_RIGHT
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle

BG   = colors.HexColor('#f4f6f9'); DARK = colors.HexColor('#0f3540')
TEAL = colors.HexColor('#17a2a2'); MINT = colors.HexColor('#7fd6c4')
INK  = colors.HexColor('#1a2b33'); MUT  = colors.HexColor('#6b7c85')
LINE = colors.HexColor('#e3e8ec'); SOFT = colors.HexColor('#f1f4f7')
NIGHT= colors.HexColor('#4a3b78')
OKG  = colors.HexColor('#1e9e63'); OKBG = colors.HexColor('#e3f5eb')
WARN = colors.HexColor('#b7791f'); WARNBG = colors.HexColor('#fbf0d9')
RED  = colors.HexColor('#c0392b'); REDBG = colors.HexColor('#fbe4e1')

def _load(nome):
    spec = importlib.util.spec_from_file_location(nome.split('.')[0], os.path.join(BASE, nome))
    m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m

def S(n, **k):
    b = dict(fontName='Helvetica', fontSize=8.5, leading=10.5, textColor=INK); b.update(k)
    return ParagraphStyle(n, **b)

def avaliar(rows, vig, hoje, fm=None, extra_manual=None):
    """Cruza a programacao vigente com o estado atual dos planos. fm = feitos manuais {veic:{codigos}}.
    extra_manual = lista crua [{veic,tipo,data}] pra somar feitos fora da vigente."""
    fm = fm or {}
    def num(x):
        try: return float(x)
        except: return None
    def fdate(s):
        s = s or ''
        if len(s) >= 10:
            try: return datetime.date(int(s[:4]), int(s[5:7]), int(s[8:10]))
            except: return None
        return None
    by = {}
    for r in rows:
        by.setdefault(r['nr_ordem'], {})[r['id_plano']] = r
    corte = fdate(vig.get('gerado_em')) or hoje
    ANC = {'10K': '2306', '5K': '2305'}
    itens = []
    for it in vig.get('itens', []):
        v, tipo = it['veic'], it['tipo']
        prog = fdate(it['data'])
        r = by.get(v, {}).get(ANC[tipo])
        feito_em = fdate(r['dt_fechamento_os']) if r else None
        feito = bool(feito_em and feito_em >= corte)
        manual = ANC[tipo] in fm.get(v, set())
        ftxt = feito_em.strftime('%d/%m') if (feito_em and feito) else ('hoje ✓' if manual else '—')
        if feito or manual: st = 'FEITO'
        elif prog and prog < hoje: st = 'ATRASADO'
        elif prog and prog == hoje: st = 'HOJE'
        else: st = 'PENDENTE'
        itens.append(dict(veic='046-'+v, tipo=tipo, prog=prog, prog_txt=prog.strftime('%d/%m') if prog else '—',
                          feito=(feito or manual), feito_txt=ftxt, st=st))
    # feitos manuais que nao estao na vigente (foram feitos adiantado / fora do plano) entram como FEITO
    ja = {(i['veic'].replace('046-',''), i['tipo']) for i in itens}
    for it in (extra_manual or []):
        if (it['veic'], it['tipo']) in ja: continue
        prog = fdate(it.get('data'))
        itens.append(dict(veic='046-'+it['veic'], tipo=it['tipo'], prog=prog,
                          prog_txt=prog.strftime('%d/%m') if prog else '—', feito=True,
                          feito_txt=(prog.strftime('%d/%m') if prog else 'hoje') + ' ✓', st='FEITO'))
    ordem = {'ATRASADO': 0, 'HOJE': 1, 'PENDENTE': 2, 'FEITO': 3}
    itens.sort(key=lambda x: (ordem[x['st']], x['prog'] or datetime.date(2099,1,1), x['veic']))
    return itens, corte

def build(itens, vig, D, png_path, hoje):
    hoje_d = hoje.date() if isinstance(hoje, datetime.datetime) else hoje
    total = len(itens)
    feitos = [i for i in itens if i['st'] == 'FEITO']
    atras  = [i for i in itens if i['st'] == 'ATRASADO']
    hojes  = [i for i in itens if i['st'] == 'HOJE']
    pend   = [i for i in itens if i['st'] == 'PENDENTE']
    devidos = len(feitos) + len(atras)          # o que ja deveria ter sido feito
    ader = (len(feitos) / devidos * 100) if devidos else None

    H1  = S('h1', fontName='Helvetica-Bold', fontSize=19, leading=22)
    SUB = S('sub', fontSize=8.8, leading=11, textColor=MUT)
    PL  = S('pl', fontSize=6.6, leading=8, textColor=MINT, alignment=TA_RIGHT)
    PV  = S('pv', fontName='Helvetica-Bold', fontSize=11, leading=13, textColor=colors.white, alignment=TA_RIGHT)
    KL  = S('kl', fontSize=6.4, leading=8, textColor=MUT, alignment=TA_CENTER)
    KV  = S('kv', fontName='Helvetica-Bold', fontSize=17, leading=19, alignment=TA_CENTER)
    KS  = S('ks', fontSize=6.8, leading=8.5, textColor=MUT, alignment=TA_CENTER)
    SEC = S('sec', fontName='Helvetica-Bold', fontSize=7.6, leading=9.5, textColor=colors.white)
    TH  = S('th', fontName='Helvetica-Bold', fontSize=6.9, leading=8.5, textColor=MUT, alignment=TA_CENTER)
    THL = S('thl', fontName='Helvetica-Bold', fontSize=6.9, leading=8.5, textColor=MUT)
    TD  = S('td', fontSize=8.2, leading=10, alignment=TA_CENTER)
    TDB = S('tdb', fontName='Helvetica-Bold', fontSize=8.4, leading=10)
    FOOT= S('ft', fontSize=6.4, leading=8, textColor=MUT)

    PW = A4[0] - 2*1.1*cm
    story = []

    left = [Paragraph('ACOMPANHAMENTO DA PROGRAMAÇÃO', H1),
            Paragraph('Garagem Quataí (046) &nbsp;·&nbsp; Semana de <b>%s a %s</b>'
                      % (vig.get('semana_ini','')[:5], vig.get('semana_fim','')[:5]), SUB)]
    pill = Table([[Paragraph('POSIÇÃO EM', PL)], [Paragraph(hoje_d.strftime('%d/%m/%Y'), PV)]], colWidths=[3.3*cm])
    pill.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),DARK),('LEFTPADDING',(0,0),(-1,-1),9),
        ('RIGHTPADDING',(0,0),(-1,-1),9),('TOPPADDING',(0,0),(0,0),6),('BOTTOMPADDING',(0,0),(0,0),0),
        ('TOPPADDING',(0,1),(0,1),0),('BOTTOMPADDING',(0,1),(0,1),6)]))
    hd = Table([[left, pill]], colWidths=[PW-3.5*cm, 3.5*cm])
    hd.setStyle(TableStyle([('VALIGN',(0,0),(0,0),'BOTTOM'),('VALIGN',(1,0),(1,0),'MIDDLE'),
        ('LEFTPADDING',(0,0),(-1,-1),0),('RIGHTPADDING',(0,0),(-1,-1),0),('ALIGN',(1,0),(1,0),'RIGHT')]))
    rule = Table([['']], colWidths=[PW], rowHeights=[2.2]); rule.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),DARK)]))
    story += [hd, Spacer(1,6), rule, Spacer(1,10)]

    def kpi(v, l, sub, cor):
        t = Table([[Paragraph(str(v), S('x', parent=KV, textColor=cor))],
                   [Paragraph(l, KL)], [Paragraph(sub or ' ', KS)]], colWidths=[PW/4-6])
        t.setStyle(TableStyle([('BOX',(0,0),(-1,-1),0.6,LINE),('BACKGROUND',(0,0),(-1,-1),colors.white),
            ('TOPPADDING',(0,0),(0,0),9),('BOTTOMPADDING',(0,0),(0,0),1),('TOPPADDING',(0,1),(0,1),0),
            ('BOTTOMPADDING',(0,1),(0,1),1),('TOPPADDING',(0,2),(0,2),0),('BOTTOMPADDING',(0,2),(0,2),8)]))
        return t
    ader_txt = ('%.0f%%' % ader) if ader is not None else '—'
    ader_cor = OKG if (ader or 0) >= 90 else (WARN if (ader or 0) >= 70 else RED)
    kr = Table([[kpi(total,'PROGRAMADOS','na semana', INK),
                 kpi(len(feitos),'REALIZADOS','concluídos', OKG),
                 kpi(len(atras),'NÃO FEITOS','dia já passou', RED if atras else MUT),
                 kpi(ader_txt,'ADERÊNCIA','do que já venceu', ader_cor)]], colWidths=[PW/4]*4)
    kr.setStyle(TableStyle([('LEFTPADDING',(0,0),(-1,-1),3),('RIGHTPADDING',(0,0),(-1,-1),3),('VALIGN',(0,0),(-1,-1),'TOP')]))
    story += [kr, Spacer(1,10)]

    # faixa km
    atraso = D.get('km_ref_atraso')
    if atraso is None: fc, ftxt = MUT, 'sem informação'
    elif atraso <= 1: fc, ftxt = OKG, 'dado do dia'
    elif atraso <= 3: fc, ftxt = WARN, '%d dias de defasagem' % atraso
    else: fc, ftxt = RED, '%d dias de defasagem' % atraso
    fbg = OKBG if fc is OKG else (WARNBG if fc is WARN else (REDBG if fc is RED else SOFT))
    faixa = Table([[[Paragraph('ÚLTIMA ATUALIZAÇÃO DO SISTEMA (KM / OS)', S('fl', fontSize=6.6, leading=8, textColor=MUT)),
                     Paragraph(D.get('km_ref','—'), S('fv', fontName='Helvetica-Bold', fontSize=11, leading=13, textColor=fc))],
                    Paragraph(ftxt.upper(), S('fs', fontName='Helvetica-Bold', fontSize=8.4, textColor=fc, alignment=TA_RIGHT))]],
                  colWidths=[PW*0.62, PW*0.38])
    faixa.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),fbg),('BOX',(0,0),(-1,-1),0.6,fc),
        ('VALIGN',(0,0),(-1,-1),'MIDDLE'),('LEFTPADDING',(0,0),(0,0),10),('RIGHTPADDING',(1,0),(1,0),10),
        ('TOPPADDING',(0,0),(-1,-1),6),('BOTTOMPADDING',(0,0),(-1,-1),6)]))
    story += [faixa, Spacer(1,12)]

    bar = Table([[Paragraph('CARRO A CARRO — O QUE FOI FEITO E O QUE FALTA', SEC)]], colWidths=[PW])
    bar.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),DARK),('LEFTPADDING',(0,0),(-1,-1),10),
        ('TOPPADDING',(0,0),(-1,-1),5),('BOTTOMPADDING',(0,0),(-1,-1),5)]))
    story += [bar]

    CORES = {'ATRASADO': (RED, REDBG, 'NÃO FEITO'), 'HOJE': (WARN, WARNBG, 'HOJE'),
             'PENDENTE': (MUT, SOFT, 'PENDENTE'), 'FEITO': (OKG, OKBG, 'FEITO')}
    data = [[Paragraph('VEÍCULO', THL), Paragraph('SERVIÇO', TH), Paragraph('PROGRAMADO', TH),
             Paragraph('REALIZADO EM', TH), Paragraph('SITUAÇÃO', TH)]]
    sty = []
    for i, it in enumerate(itens, 1):
        cor, bg, rot = CORES[it['st']]
        serv = 'Preventiva 10.000' if it['tipo'] == '10K' else 'Inspeção 5.000'
        data.append([Paragraph(it['veic'], TDB),
                     Paragraph(serv, S('sv', parent=TD, textColor=(DARK if it['tipo']=='10K' else NIGHT))),
                     Paragraph(it['prog_txt'], TD),
                     Paragraph(it['feito_txt'], S('fe', parent=TD, fontName=('Helvetica-Bold' if it['feito'] else 'Helvetica'),
                                                  textColor=(OKG if it['feito'] else MUT))),
                     Paragraph(rot, S('st', parent=TD, fontName='Helvetica-Bold', fontSize=6.9, textColor=cor))])
        sty.append(('BACKGROUND', (4,i), (4,i), bg))
        if i % 2 == 0: sty.append(('BACKGROUND', (0,i), (3,i), SOFT))
    cw = [2.6*cm, 4.2*cm, 2.6*cm, 2.8*cm, 2.6*cm]
    cw = [w * (PW/sum(cw)) for w in cw]
    tb = Table(data, colWidths=cw, repeatRows=1)
    tb.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#eef2f5')),
        ('LINEBELOW',(0,0),(-1,0),0.8,LINE),('LINEBELOW',(0,1),(-1,-1),0.4,LINE),
        ('BOX',(0,0),(-1,-1),0.6,LINE),('VALIGN',(0,0),(-1,-1),'MIDDLE'),
        ('TOPPADDING',(0,0),(-1,-1),3.4),('BOTTOMPADDING',(0,0),(-1,-1),3.4),
        ('LEFTPADDING',(0,0),(0,-1),8)] + sty))
    story += [tb, Spacer(1,8)]

    story += [Paragraph('<font color="#c0392b"><b>NÃO FEITO</b></font> = o dia programado já passou e o serviço não aparece concluído &nbsp;·&nbsp; '
        '<font color="#b7791f"><b>HOJE</b></font> = programado para hoje &nbsp;·&nbsp; '
        '<font color="#1e9e63"><b>FEITO</b></font> = OS fechada após a programação. &nbsp; '
        '<b>Aderência</b> = realizados ÷ (realizados + não feitos). Serviço feito hoje pode levar até o próximo '
        'giro do importador para aparecer.', FOOT)]

    def page(cv, doc):
        cv.saveState(); cv.setFillColor(BG); cv.rect(0,0,A4[0],A4[1], stroke=0, fill=1)
        cv.setFillColor(MUT); cv.setFont('Helvetica', 6.2)
        cv.drawString(1.1*cm, 0.75*cm, 'Gerado automaticamente · Manutenção Garagem Quataí')
        cv.drawRightString(A4[0]-1.1*cm, 0.75*cm, 'Acompanhamento · %s' % hoje.strftime('%d/%m/%Y %H:%M'))
        cv.restoreState()

    pdf_tmp = png_path.replace('.png', '.pdf')
    doc = SimpleDocTemplate(pdf_tmp, pagesize=A4, leftMargin=1.1*cm, rightMargin=1.1*cm,
                            topMargin=1.0*cm, bottomMargin=1.2*cm, title='Acompanhamento da Programação')
    doc.build(story, onFirstPage=page, onLaterPages=page)
    import fitz
    d = fitz.open(pdf_tmp); d[0].get_pixmap(dpi=170).save(png_path); d.close()
    try: os.remove(pdf_tmp)
    except Exception: pass
    return dict(total=total, feitos=len(feitos), atras=len(atras), hoje=len(hojes), pend=len(pend), ader=ader)

def caption(res, itens, vig, D, hoje):
    atr = D.get('km_ref_atraso')
    sinal = '⚪' if atr is None else ('🟢' if atr <= 1 else ('🟡' if atr <= 3 else '🔴'))
    ader = ('%.0f%%' % res['ader']) if res['ader'] is not None else '—'
    L = ['<b>📋 ACOMPANHAMENTO DA PROGRAMAÇÃO</b>',
         '<b>Semana %s a %s</b> · posição em %s' % (vig.get('semana_ini','')[:5], vig.get('semana_fim','')[:5], hoje.strftime('%d/%m')),
         '%s Sistema atualizado até %s' % (sinal, D.get('km_ref','—')),
         '',
         '✅ <b>%d realizados</b>   ❌ <b>%d não feitos</b>   ⏳ %d a fazer' % (res['feitos'], res['atras'], res['hoje'] + res['pend']),
         '📊 <b>Aderência: %s</b>' % ader]
    nf = [i for i in itens if i['st'] == 'ATRASADO']
    if nf:
        L += ['', '<b>❌ Não feitos (dia já passou):</b>']
        L += ['• %s — %s · era %s' % (i['veic'], 'Prev 10.000' if i['tipo']=='10K' else 'Insp 5.000', i['prog_txt']) for i in nf[:10]]
    hj = [i for i in itens if i['st'] == 'HOJE']
    if hj:
        L += ['', '<b>📌 Para hoje:</b>']
        L += ['• %s — %s' % (i['veic'], 'Prev 10.000' if i['tipo']=='10K' else 'Insp 5.000') for i in hj]
    return '\n'.join(L)

def main():
    hoje = datetime.datetime.now()
    if not os.path.exists(VIGENTE):
        print('Sem programacao vigente (%s). Rode gerar_programacao_semanal.py primeiro.' % VIGENTE)
        return None
    vig = json.loads(open(VIGENTE, encoding='utf-8').read())
    G = _load('gerar_programacao_semanal.py')
    PG = _load('gerar_png_garantias.py')
    rows = G.puxar_dados()
    D = G.montar(rows, hoje.date())
    itens, corte = avaliar(rows, vig, hoje.date(), G.feitos_manual(), G.feitos_manual_itens())
    os.makedirs(SAIDA_DIR, exist_ok=True)
    png = os.path.join(SAIDA_DIR, 'Acompanhamento_%s.png' % hoje.strftime('%Y-%m-%d'))
    res = build(itens, vig, D, png, hoje)
    print('[%s] Acompanhamento: %d programados | %d feitos | %d nao feitos | aderencia %s'
          % (hoje.strftime('%H:%M:%S'), res['total'], res['feitos'], res['atras'],
             ('%.0f%%' % res['ader']) if res['ader'] is not None else '-'))
    PG.enviar_telegram(png, caption(res, itens, vig, D, hoje), G.TELEGRAM_DIR)
    return png

if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print('ERRO:', e); import traceback; traceback.print_exc(); sys.exit(1)

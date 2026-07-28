# -*- coding: utf-8 -*-
"""
Resumo diario de PLANOS VENCIDOS (>0), por tipo de plano. Layout Flash Report.
Regras: Concessionaria (garantia) fora da relacao. Feitos manuais excluidos.
Gera PNG + envia no Telegram.
"""
import os, sys, json, datetime, importlib.util
from collections import defaultdict

BASE = os.path.dirname(os.path.abspath(__file__))
SAIDA_DIR = os.path.join(BASE, 'saidas')
EXCLUIR_PLANOS = {'2645', '2646'}   # concessionaria (garantia) - fora da relacao in-house

LABEL = {'2305':'Inspeção 5.000','2306':'Revisão Pesada 10.000','726':'Óleo de Motor',
 '1299':'Filtro de Ar','2167':'Limpeza Geral','757':'Óleo de Câmbio','758':'Óleo de Diferencial',
 '1300':'Revisão dos Cubos','2314':'Filtro de Arla','2965':'Limpeza Tanque Arla',
 '2966':'Limpeza Filtro DPF','2345':'Filtro APU','1132':'Revisão Sistema Embreagem',
 '1585':'Fluido de Embreagem','2505':'Pastilha/Fluido Freio','2309':'Filtro Hidráulico',
 '2311':'Limpeza Serpentina','1239':'Aferição Tacógrafo'}

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_RIGHT
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle

BG=colors.HexColor('#f4f6f9'); DARK=colors.HexColor('#0f3540'); INK=colors.HexColor('#1a2b33')
MUT=colors.HexColor('#6b7c85'); LINE=colors.HexColor('#e3e8ec'); SOFT=colors.HexColor('#f1f4f7')
OKG=colors.HexColor('#1e9e63'); WARN=colors.HexColor('#b7791f'); WARNBG=colors.HexColor('#fbf0d9')
RED=colors.HexColor('#c0392b'); REDBG=colors.HexColor('#fbe4e1'); TEAL=colors.HexColor('#17a2a2')

def _load(nome):
    spec = importlib.util.spec_from_file_location(nome.split('.')[0], os.path.join(BASE, nome))
    m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m
def S(n, **k):
    b = dict(fontName='Helvetica', fontSize=8.5, leading=10.5, textColor=INK); b.update(k); return ParagraphStyle(n, **b)
def num(x):
    try: return float(x)
    except: return None

def resumo(rows, fm=None):
    fm = fm or {}
    venc = defaultdict(int); tot = defaultdict(int); veics = set()
    for r in rows:
        pid = r['id_plano']
        if pid in EXCLUIR_PLANOS or pid not in LABEL: continue
        if pid in fm.get(r['nr_ordem'], set()): continue   # feito manual
        qk = num(r['qt_km_intervalo'])
        if qk == 0:
            val = num(r['dias_vencido'])
        else:
            val = num(r['km_para_proxima'])
        if val is None: continue
        tot[pid] += 1
        if val > 0:
            venc[pid] += 1; veics.add(r['nr_ordem'])
    itens = [(LABEL[p], venc[p], tot[p]) for p in venc if venc[p] > 0]
    itens.sort(key=lambda x: -x[1])
    return itens, sum(v for _, v, _ in itens), len(veics)

def fdate(s):
    s = s or ''
    if len(s) >= 10:
        try: return datetime.date(int(s[:4]), int(s[5:7]), int(s[8:10]))
        except: return None
    return None

def cobertura(rows, vig, fm):
    """5.000 (2305) e 10.000 (2306) vencidos x programacao travada: quantos vencidos e quantos programados."""
    fm = fm or {}
    prog = {'10K': set(), '5K': set()}
    for it in (vig.get('itens', []) if vig else []):
        if it['tipo'] in prog: prog[it['tipo']].add(it['veic'])
    by = {}
    for r in rows: by.setdefault(r['nr_ordem'], {})[str(r['id_plano'])] = r
    venc = {'5K': [], '10K': []}
    for v, bp in by.items():
        for cod, niv in (('2305', '5K'), ('2306', '10K')):
            if cod in fm.get(v, set()): continue
            r = bp.get(cod); val = num(r['km_para_proxima']) if r else None
            if val is not None and val > 0: venc[niv].append(v)
    out = {}
    for niv in ('5K', '10K'):
        fora = sorted(v for v in venc[niv] if v not in prog[niv])
        out[niv] = dict(venc=len(venc[niv]), prog=len(venc[niv]) - len(fora), fora=fora)
    return out

def demais_zera(rows, vig, fm, hoje):
    """Planos SECUNDARIOS vencidos (nao 5.000/10.000): zeram na Revisao 10.000 do carro.
    Retorna (esta_semana, projetados)."""
    import statistics
    fm = fm or {}
    by = {}
    for r in rows: by.setdefault(r['nr_ordem'], {})[str(r['id_plano'])] = r
    def kmdia(bp):
        kd = []
        for r in bp.values():
            kr, dv, qk = num(r['km_rodado']), num(r['dias_vencido']), num(r['qt_km_intervalo'])
            if qk and qk > 0 and kr and dv and dv > 30: kd.append(kr / dv)
        return round(statistics.median(kd), 1) if kd else None
    prog10 = {}
    dias_sem = vig.get('dias_sem', []); dow = [w.split('-')[0][:3] for w in vig.get('dow', [])]
    for _, x, di in vig.get('esc10', []):
        if di < len(dow): prog10[x.replace('046-', '')] = (dow[di], dias_sem[di][:5])
    esta = {}; proj = []
    for v, bp in by.items():
        secund = []
        for pid, r in bp.items():
            if pid in ('2305', '2306') or pid in EXCLUIR_PLANOS or pid not in LABEL: continue
            if pid in fm.get(v, set()): continue
            qk = num(r['qt_km_intervalo']); val = num(r['dias_vencido']) if qk == 0 else num(r['km_para_proxima'])
            if val is not None and val > 0: secund.append(LABEL[pid])
        if not secund: continue
        if v in prog10:
            esta[v] = prog10[v]
        else:
            r10 = bp.get('2306'); k = num(r10['km_para_proxima']) if r10 else None; kd = kmdia(bp)
            dt = '—'
            if k is not None and kd and kd > 0:
                d = int(round(-k / kd)) if k < 0 else 0
                dt = (hoje + datetime.timedelta(days=max(0, d))).strftime('%d/%m')
            proj.append((v, ', '.join(sorted(set(secund))), dt))
    esta_l = sorted((v, d[0], d[1]) for v, d in esta.items())
    proj.sort(key=lambda x: x[0])
    return esta_l, proj

def build(itens, total, nveic, km_ref, atraso, png, hoje, cob=None, demais=None):
    H1=S('h1', fontName='Helvetica-Bold', fontSize=19, leading=22)
    SUB=S('sub', fontSize=8.8, leading=11, textColor=MUT)
    PL=S('pl', fontSize=6.6, leading=8, textColor=colors.HexColor('#e08a7a'), alignment=TA_RIGHT)
    PV=S('pv', fontName='Helvetica-Bold', fontSize=11, leading=13, textColor=colors.white, alignment=TA_RIGHT)
    KL=S('kl', fontSize=6.6, leading=8, textColor=MUT, alignment=TA_CENTER)
    KV=S('kv', fontName='Helvetica-Bold', fontSize=18, leading=20, alignment=TA_CENTER)
    KS=S('ks', fontSize=6.9, leading=8.5, textColor=MUT, alignment=TA_CENTER)
    SEC=S('sec', fontName='Helvetica-Bold', fontSize=7.6, leading=9.5, textColor=colors.white)
    TH=S('th', fontName='Helvetica-Bold', fontSize=7, leading=8.5, textColor=MUT, alignment=TA_CENTER)
    THL=S('thl', fontName='Helvetica-Bold', fontSize=7, leading=8.5, textColor=MUT)
    TDB=S('tdb', fontName='Helvetica-Bold', fontSize=9, leading=11)
    TD=S('td', fontSize=8.8, leading=11, alignment=TA_CENTER)
    FOOT=S('ft', fontSize=6.6, leading=8.5, textColor=MUT)

    PW = A4[0] - 2*1.1*cm
    pior = itens[0] if itens else None
    story = []
    left = [Paragraph('PLANOS VENCIDOS', H1), Paragraph('Garagem Quataí (046) &nbsp;·&nbsp; resumo por tipo de plano (venc. &gt; 0)', SUB)]
    pill = Table([[Paragraph('POSIÇÃO EM', PL)],[Paragraph(hoje.strftime('%d/%m/%Y'), PV)]], colWidths=[3.3*cm])
    pill.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),DARK),('LEFTPADDING',(0,0),(-1,-1),9),('RIGHTPADDING',(0,0),(-1,-1),9),
        ('TOPPADDING',(0,0),(0,0),6),('BOTTOMPADDING',(0,0),(0,0),0),('TOPPADDING',(0,1),(0,1),0),('BOTTOMPADDING',(0,1),(0,1),6)]))
    hd = Table([[left, pill]], colWidths=[PW-3.5*cm, 3.5*cm])
    hd.setStyle(TableStyle([('VALIGN',(0,0),(0,0),'BOTTOM'),('VALIGN',(1,0),(1,0),'MIDDLE'),('ALIGN',(1,0),(1,0),'RIGHT')]))
    rule = Table([['']], colWidths=[PW], rowHeights=[2.2]); rule.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),RED)]))
    story += [hd, Spacer(1,6), rule, Spacer(1,10)]

    def kpi(v, l, sub, cor):
        t = Table([[Paragraph(str(v), S('x', parent=KV, textColor=cor))],[Paragraph(l, KL)],[Paragraph(sub or ' ', KS)]], colWidths=[PW/3-6])
        t.setStyle(TableStyle([('BOX',(0,0),(-1,-1),0.6,LINE),('BACKGROUND',(0,0),(-1,-1),colors.white),
            ('TOPPADDING',(0,0),(0,0),9),('BOTTOMPADDING',(0,0),(0,0),1),('TOPPADDING',(0,1),(0,1),0),
            ('BOTTOMPADDING',(0,1),(0,1),1),('TOPPADDING',(0,2),(0,2),0),('BOTTOMPADDING',(0,2),(0,2),8)]))
        return t
    kr = Table([[kpi(total,'PLANOS VENCIDOS','total (venc > 0)', RED if total else OKG),
                 kpi(nveic,'VEÍCULOS','com algum vencido', WARN),
                 kpi(('%d' % pior[1]) if pior else '—','PIOR PLANO', pior[0] if pior else '', RED)]], colWidths=[PW/3]*3)
    kr.setStyle(TableStyle([('LEFTPADDING',(0,0),(-1,-1),3),('RIGHTPADDING',(0,0),(-1,-1),3),('VALIGN',(0,0),(-1,-1),'TOP')]))
    story += [kr, Spacer(1,10)]

    if atraso is None: fc, ftxt = MUT, 'sem informação'
    elif atraso <= 1: fc, ftxt = OKG, 'dado do dia'
    elif atraso <= 3: fc, ftxt = WARN, '%d dias de defasagem' % atraso
    else: fc, ftxt = RED, '%d dias de defasagem' % atraso
    fbg = (WARNBG if fc is WARN else (REDBG if fc is RED else SOFT))
    faixa = Table([[[Paragraph('ÚLTIMA ATUALIZAÇÃO DO SISTEMA (KM / OS)', S('fl', fontSize=6.6, leading=8, textColor=MUT)),
                     Paragraph(km_ref or '—', S('fv', fontName='Helvetica-Bold', fontSize=11, leading=13, textColor=fc))],
                    Paragraph(ftxt.upper(), S('fs', fontName='Helvetica-Bold', fontSize=8.4, textColor=fc, alignment=TA_RIGHT))]],
                  colWidths=[PW*0.62, PW*0.38])
    faixa.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),fbg),('BOX',(0,0),(-1,-1),0.6,fc),('VALIGN',(0,0),(-1,-1),'MIDDLE'),
        ('LEFTPADDING',(0,0),(0,0),10),('RIGHTPADDING',(1,0),(1,0),10),('TOPPADDING',(0,0),(-1,-1),6),('BOTTOMPADDING',(0,0),(-1,-1),6)]))
    story += [faixa, Spacer(1,12)]

    bar = Table([[Paragraph('POR TIPO DE PLANO — DO MAIOR NÚMERO DE VENCIDOS AO MENOR', SEC)]], colWidths=[PW])
    bar.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),DARK),('LEFTPADDING',(0,0),(-1,-1),10),('TOPPADDING',(0,0),(-1,-1),5),('BOTTOMPADDING',(0,0),(-1,-1),5)]))
    story += [bar]

    maxv = max((v for _, v, _ in itens), default=1)
    BARMAX = PW - 9.4*cm
    data = [[Paragraph('PLANO', THL), Paragraph('VENC.', TH), Paragraph('', TH), Paragraph('FROTA', TH)]]
    sty = []
    for i, (nome, v, tt) in enumerate(itens, 1):
        w = max(0.3*cm, BARMAX * v / maxv)
        barcell = Table([[Paragraph("<font color='white'><b>%d</b></font>" % v, S('bn', fontSize=8, alignment=TA_RIGHT))]], colWidths=[w], rowHeights=[13])
        barcell.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),RED),('VALIGN',(0,0),(-1,-1),'MIDDLE'),('RIGHTPADDING',(0,0),(-1,-1),5),('LEFTPADDING',(0,0),(-1,-1),0)]))
        data.append([Paragraph(nome, TDB), Paragraph(str(v), S('c', parent=TD, fontName='Helvetica-Bold', textColor=RED)), barcell, Paragraph(str(tt), S('t', parent=TD, textColor=MUT))])
        if i % 2 == 0: sty.append(('BACKGROUND',(0,i),(1,i),SOFT)); sty.append(('BACKGROUND',(3,i),(3,i),SOFT))
    cw = [6.6*cm, 1.6*cm, BARMAX+0.4*cm, 1.4*cm]
    tb = Table(data, colWidths=cw, repeatRows=1)
    tb.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#eef2f5')),('LINEBELOW',(0,0),(-1,0),0.8,LINE),
        ('LINEBELOW',(0,1),(-1,-1),0.4,LINE),('BOX',(0,0),(-1,-1),0.6,LINE),('VALIGN',(0,0),(-1,-1),'MIDDLE'),
        ('TOPPADDING',(0,0),(-1,-1),4),('BOTTOMPADDING',(0,0),(-1,-1),4),('LEFTPADDING',(0,0),(0,-1),8)] + sty))
    story += [tb, Spacer(1,8)]

    # CONSIDERACAO: como a programacao da semana zera os vencidos (numeros reais)
    if cob:
        SECw = S('secw', fontName='Helvetica-Bold', fontSize=7.6, leading=9.5, textColor=colors.white)
        cbar = Table([[Paragraph('CONSIDERAÇÃO — COMO A PROGRAMAÇÃO DA SEMANA ZERA OS VENCIDOS', SECw)]], colWidths=[PW])
        cbar.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),OKG),('LEFTPADDING',(0,0),(-1,-1),10),
            ('TOPPADDING',(0,0),(-1,-1),5),('BOTTOMPADDING',(0,0),(-1,-1),5)]))
        def linha(niv, nome):
            c = cob.get(niv, {}); v, p, fora = c.get('venc',0), c.get('prog',0), c.get('fora',[])
            if v == 0: return None
            s = '<b>%s:</b> %d vencida%s → <b>%d programada%s nesta semana</b>' % (nome, v, 's' if v>1 else '', p, 's' if p>1 else '')
            if fora: s += ' · <font color="#c0392b"><b>%d ainda fora do plano (%s)</b></font>' % (len(fora), ', '.join(fora))
            else: s += ' · <font color="#1e9e63"><b>todas cobertas</b></font>'
            return '•&nbsp; ' + s
        linhas = [x for x in (linha('5K','Inspeção 5.000'), linha('10K','Revisão 10.000')) if x]
        if demais:
            esta_l, proj = demais
            dl = '•&nbsp; <b>Demais planos</b> (câmbio, diferencial, tanque arla, limpeza geral): zeram na <b>Revisão 10.000 do carro</b>.'
            if esta_l:
                dl += ' Nesta semana: ' + ', '.join('<b>%s</b> (%s %s)' % (v, dw, dt) for v, dw, dt in esta_l) + '.'
            linhas.append(dl)
            if proj:
                linhas.append('•&nbsp; <font color="#b7791f">Fora da semana (projeção km/dia): '
                              + ' · '.join('<b>%s</b> %s ~%s' % (v, pl.lower(), dt) for v, pl, dt in proj) + '.</font>')
        linhas.append('<b>Meta: chegar a atraso zero até sexta-feira.</b> Frota inclui os veículos de apoio (linha W).')
        cbody = Table([[Paragraph('<br/>'.join(linhas), S('cb', fontSize=8.6, leading=13, textColor=INK))]], colWidths=[PW])
        cbody.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),colors.HexColor('#e3f5eb')),('BOX',(0,0),(-1,-1),0.6,OKG),
            ('LEFTPADDING',(0,0),(-1,-1),10),('RIGHTPADDING',(0,0),(-1,-1),10),
            ('TOPPADDING',(0,0),(-1,-1),7),('BOTTOMPADDING',(0,0),(-1,-1),7)]))
        story += [cbar, cbody, Spacer(1,10)]

    story += [Paragraph('Vencido = passou do km/dias do plano (&gt; 0). '
        'Concessionária (garantia) fora desta relação — está na aba/painel de Garantia. Planos com 0 vencidos omitidos.', FOOT)]

    def page(cv, doc):
        cv.saveState(); cv.setFillColor(BG); cv.rect(0,0,A4[0],A4[1], stroke=0, fill=1)
        cv.setFillColor(MUT); cv.setFont('Helvetica', 6.2)
        cv.drawString(1.1*cm, 0.75*cm, 'Gerado automaticamente · Manutenção Garagem Quataí')
        cv.drawRightString(A4[0]-1.1*cm, 0.75*cm, 'Planos vencidos · %s' % hoje.strftime('%d/%m/%Y'))
        cv.restoreState()
    pdf = png.replace('.png', '.pdf')
    doc = SimpleDocTemplate(pdf, pagesize=A4, leftMargin=1.1*cm, rightMargin=1.1*cm, topMargin=1.0*cm, bottomMargin=1.2*cm, title='Planos Vencidos')
    doc.build(story, onFirstPage=page, onLaterPages=page)
    import fitz
    d = fitz.open(pdf); d[0].get_pixmap(dpi=170).save(png); d.close()
    try: os.remove(pdf)
    except Exception: pass

def caption(itens, total, nveic, km_ref, atraso, hoje):
    sinal = '⚪' if atraso is None else ('🟢' if atraso <= 1 else ('🟡' if atraso <= 3 else '🔴'))
    L = ['<b>📋 PLANOS VENCIDOS</b> · %s' % hoje.strftime('%d/%m'),
         '%s Sistema atualizado até %s' % (sinal, km_ref or '—'),
         '<b>%d vencidos</b> em <b>%d veículos</b>' % (total, nveic), '',
         '<b>Por plano:</b>']
    L += ['• %s — %d' % (nome, v) for nome, v, _ in itens[:14]]
    L += ['', 'Concessionária (garantia) à parte.']
    return '\n'.join(L)

def main():
    hoje = datetime.date.today()
    G = _load('gerar_programacao_semanal.py'); PG = _load('gerar_png_garantias.py')
    rows = G.puxar_dados(); D = G.montar(rows, hoje)
    fm = G.feitos_manual()
    itens, total, nveic = resumo(rows, fm)
    vig = None
    vpath = os.path.join(SAIDA_DIR, 'programacao_vigente.json')
    if os.path.exists(vpath):
        try: vig = json.loads(open(vpath, encoding='utf-8').read())
        except Exception: vig = None
    cob = cobertura(rows, vig, fm) if vig else None
    demais = demais_zera(rows, vig, fm, hoje) if vig else None
    os.makedirs(SAIDA_DIR, exist_ok=True)
    png = os.path.join(SAIDA_DIR, 'Planos_Vencidos_%s.png' % hoje.strftime('%Y-%m-%d'))
    build(itens, total, nveic, D.get('km_ref'), D.get('km_ref_atraso'), png, hoje, cob, demais)
    print('[%s] Planos vencidos: %d em %d veiculos' % (datetime.datetime.now().strftime('%H:%M:%S'), total, nveic))
    for nome, v, tt in itens: print('   %-30s %3d / %d' % (nome, v, tt))
    PG.enviar_telegram(png, caption(itens, total, nveic, D.get('km_ref'), D.get('km_ref_atraso'), hoje), G.TELEGRAM_DIR)
    return png

if __name__ == '__main__':
    try: main()
    except Exception as e:
        print('ERRO:', e); import traceback; traceback.print_exc(); sys.exit(1)

"""Flash Report Diario (tema Diesel) — gera 2 paginas PNG/PDF + texto e envia no Telegram.
Roda no ULTIMO dia consolidado da bilhetagem. Uso:
   python flash_diario.py            -> gera e ENVIA (precisa token/chat)
   python flash_diario.py --dry-run  -> so gera (nao envia)
Config de envio: _telegram.json ({"token","chat_id"}) nesta pasta OU no importador_supabase.
"""
from __future__ import annotations
import json, sys, urllib.request
from pathlib import Path
from datetime import datetime
import numpy as np, pandas as pd
import matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle
import matplotlib.dates as mdates

BASE=Path(__file__).resolve().parent
PROJ=BASE.parent                                   # ANALISE_PASSAGEIROS
IMPORTADOR=Path(r"C:\Users\Guilh\Repositorios\Sistemas\PONTO\importador_supabase")
SAIDA=BASE/"saida"; SAIDA.mkdir(exist_ok=True)
sys.path.insert(0,str(BASE)); sys.path.insert(0,str(IMPORTADOR))
import tema_diesel as T

DOWL=["seg","ter","qua","qui","sex","sáb","dom"]
def _cfg():
    # 1) variaveis de ambiente (GitHub Actions / .env): SUPABASE_URL, SUPABASE_ANON_KEY
    import os
    try:
        from dotenv import load_dotenv; load_dotenv(BASE/".env")
    except Exception: pass
    url=os.getenv("SUPABASE_URL") or os.getenv("SUPABASE_TRANSNET_URL")
    anon=os.getenv("SUPABASE_ANON_KEY") or os.getenv("SUPABASE_KEY") or os.getenv("SUPABASE_TRANSNET_KEY")
    if url and anon: return url.rstrip("/"), anon
    # 2) fallback: _supabase.json do importador (maquina local)
    p=IMPORTADOR/"_supabase.json"
    if p.exists():
        c=json.loads(p.read_text(encoding="utf-8")); return c["url"].rstrip("/"), c.get("anon","")
    raise RuntimeError("Supabase nao configurado (defina SUPABASE_URL e SUPABASE_ANON_KEY, ou _supabase.json)")
URL,ANON=_cfg()
def fetch(tab,params=""):
    rows,off,LIM=[],0,1000
    while True:
        ep=f"{URL}/rest/v1/{tab}?{params}&offset={off}&limit={LIM}"
        req=urllib.request.Request(ep,headers={"apikey":ANON,"Authorization":f"Bearer {ANON}"})
        with urllib.request.urlopen(req,timeout=120) as r: ch=json.loads(r.read().decode("utf-8","ignore"))
        rows+=ch
        if len(ch)<LIM: break
        off+=LIM
    return pd.DataFrame(rows)
norm=lambda s:str(s).upper().replace("-","").replace(" ","").strip()
def fn(v): return "—" if pd.isna(v) else f"{v:,.0f}".replace(",",".")
def sk(v): return "—" if pd.isna(v) else f"{v/1000:.0f}k"
def rs(v): return "—" if pd.isna(v) else ("R\\$ "+(f"{v/1e6:.2f}".replace(".",",")+"M" if v>=1e6 else f"{v/1e3:.0f}".replace(",",".")+"k"))
def rsx(v): return rs(v).replace("R\\$","R$")

def _hora_supabase(dia):
    """passageiros por hora do dia (hora de embarque), da tabela 'passageiros_hora'. None se vazio."""
    try:
        h=fetch("passageiros_hora",f"select=hora,giros&data=eq.{dia:%Y-%m-%d}")
        if h.empty: return None
        h["giros"]=pd.to_numeric(h["giros"],errors="coerce").fillna(0); h["hora"]=pd.to_numeric(h["hora"],errors="coerce")
        return h[h["hora"].between(0,23)].groupby("hora")["giros"].sum().sort_index()
    except Exception as e:
        print("[aviso] curva por hora indisponivel:",type(e).__name__,str(e)[:80]); return None

def gerar():
    bil=fetch("indicadores_bilhetagem","select=*&data=gte.2025-06-25&data=lte.2027-01-01")
    for c in bil.columns:
        if c not in ("data","linha"): bil[c]=pd.to_numeric(bil[c],errors="coerce").fillna(0)
    bil["data"]=pd.to_datetime(bil["data"],errors="coerce"); bil=bil[bil["linha"].astype(str).str.strip()!=""]
    agg=bil.groupby("data").sum(numeric_only=True); agg=agg[agg["total_giros"]>1000]
    DIA=agg.index.max(); AA=DIA-pd.Timedelta(days=364)
    corr=lambda r:(r["total_pagantes"]-r["integracao_subsidiada"]+max(r["total_integracao"]-319.0,0.0),
                   r["total_gratuidade"]-r["integracao_gratuita"]+min(r["total_integracao"],319.0))
    hoje=agg.loc[DIA]; pag,grat=corr(hoje); giros=hoje["total_giros"]; rec=hoje["receita_total"]
    yoy=agg.loc[AA] if AA in agg.index else None
    # programado do Supabase (programado_diario)
    prj=fetch("programado_diario","select=*")
    for c in prj.columns:
        if c not in ("data","tipo_dia"): prj[c]=pd.to_numeric(prj[c],errors="coerce")
    prj["data"]=pd.to_datetime(prj["data"],errors="coerce")
    prd=prj[prj["data"]==DIA]
    pg=pp=pgr=km_prog=carros_prog=float("nan")
    if not prd.empty:
        pr=prd.iloc[0]; pg=pr["giros_prog"]; pp=pr["pagantes_prog"]; pgr=pg-pp; km_prog=pr["km_prog"]; carros_prog=pr["carros_prog"]
    # km rodado (kml_viagem)
    kml=fetch("kml_viagem",f"select=linha,km_gps&data=eq.{DIA.date()}"); kml["km_gps"]=pd.to_numeric(kml["km_gps"],errors="coerce").fillna(0); kml["k"]=kml["linha"].map(norm)
    kmL=kml.groupby("k")["km_gps"].sum(); km_rod=kmL.sum(); ipk=giros/km_rod
    def merge32(s):  # junta 21+29, tira 32 (mesma regra do mensal)
        s=s.copy(); v=s.get("21-TR",0)+s.get("29-TR",0)
        s=s.drop(index=[x for x in ["21-TR","29-TR","32-TR"] if x in s.index])
        if v>0: s.loc["21+29-TR"]=v
        return s
    dh=merge32(bil[bil["data"]==DIA].groupby("linha")["total_giros"].sum()); dy=merge32(bil[bil["data"]==AA].groupby("linha")["total_giros"].sum())
    mov=pd.DataFrame({"h":dh,"y":dy}).dropna(); mov=mov[mov["y"]>150]; mov["var"]=(mov["h"]-mov["y"])/mov["y"]
    top=mov.sort_values("var",ascending=False).head(6); bot=mov.sort_values("var").head(6)
    hist=agg.tail(14)
    pct=lambda n,b:(n-b)/b if b else np.nan; at=lambda r_,p_:r_/p_ if p_ else np.nan
    curva=_hora_supabase(DIA)
    aa_g=pct(giros,yoy["total_giros"]) if yoy is not None else np.nan
    def hbanner(ax,x,w,y,txt): T._round(ax,x,y,w,2.6,T.PETROL,rad=0.7,z=2); ax.text(x+1.5,y+1.3,txt.upper(),color="white",fontsize=8,fontweight="bold",va="center",zorder=3)

    # ---------- PAGINA 1 ----------
    fig,ax=T.novo(); T.header(ax,f"Movimento consolidado do dia · {DIA:%d/%m/%Y} ({DOWL[DIA.weekday()]})","Fonte: indicadores_bilhetagem · orçamento QUATAI 2026 · dado consolidado",f"{DIA:%d/%m/%Y}",titulo2="FLASH REPORT DIÁRIO",ref_label="DATA")
    ok=giros>=pg
    T._round(ax,2.5,84.5,30,3.2,T.OK if ok else T.AMBER,rad=0.8,z=2)
    ax.text(4,86.1,("● DIA ACIMA DA META" if ok else "● DIA ABAIXO DA META"),color="white",fontsize=9.5,fontweight="bold",va="center",zorder=3)
    ax.text(35,86.1,f"Meta (orçado) {fn(pg)} · atingimento {at(giros,pg):.0%} · {aa_g:+.1%} a/a (vs {AA:%d/%m})",color=T.SOFT,fontsize=8,va="center")
    T.kpicard(ax,2.5,77,22.3,6,"Passageiros",fn(giros),f"{at(giros,pg):.0%} meta · {aa_g:+.0%} a/a",subcor=T.OK if ok else T.AMBER)
    T.kpicard(ax,26.7,77,22.3,6,"Receita",rs(rec),f"tarifa eq. R\\$ {rec/pag:.2f}".replace(".",","))
    T.kpicard(ax,50.9,77,22.3,6,"IPK do dia",f"{ipk:.2f}","pax/km")
    T.kpicard(ax,75.1,77,22.3,6,"Gratuidade",f"{grat/giros:.0%}",f"{fn(grat)} pax",subcor=T.AMBER if grat/giros>0.24 else T.OK)
    hbanner(ax,2.5,46.5,72.5,"Movimento do dia — Programado × Realizado"); T.card(ax,2.5,47.5,46.5,23.5)
    axb=fig.add_axes([0.075,0.53,0.20,0.17]); cats=["Passag.","Pagantes","Gratuid."]; rvv=[giros,pag,grat]; pvv=[pg,pp,pgr]; xx=np.arange(3)
    axb.bar(xx-0.2,pvv,0.4,color=T.FAINT,label="Prog"); axb.bar(xx+0.2,rvv,0.4,color=T.ACCENT,label="Real")
    for i in xx:
        axb.text(i+0.2,rvv[i],f"{rvv[i]/pvv[i]:.0%}",ha="center",va="bottom",fontsize=6.5,fontweight="bold",color=T.OK if rvv[i]>=pvv[i] else T.BAD)
        axb.text(i+0.2,rvv[i]*0.5,sk(rvv[i]),ha="center",va="center",fontsize=5.2,color="white",rotation=90,fontweight="bold")
        axb.text(i-0.2,pvv[i]*0.5,sk(pvv[i]),ha="center",va="center",fontsize=5.2,color="#3c4a50",rotation=90)
    axb.set_xticks(xx); axb.set_xticklabels(cats,fontsize=6.5); axb.tick_params(labelsize=6); axb.legend(fontsize=6); [s.set_visible(False) for s in [axb.spines['top'],axb.spines['right']]]; axb.grid(axis="y",ls=":",alpha=.3)
    axd=fig.add_axes([0.335,0.52,0.145,0.18]); axd.pie([pag,grat],labels=["Pag.","Grat."],autopct="%1.0f%%",colors=[T.ACCENT,T.FAINT],startangle=90,wedgeprops=dict(width=0.42,edgecolor="w"),textprops={"fontsize":6.5})
    ax.text(4,50.5,f"KM: {fn(km_rod)} rodado / {fn(km_prog)} programado ({at(km_rod,km_prog):.0%}) · frota prog. {fn(carros_prog)} carros",color=T.INK,fontsize=6.8,va="center",fontweight="bold")
    ax.text(4,48.5,f"Composição de pagantes: VT {hoje['total_vt']/pag:.0%} · dinheiro {hoje['total_dinheiro']/pag:.0%} · avulso {hoje['total_avulso']/pag:.0%}",color=T.SOFT,fontsize=6.6,va="center")
    hbanner(ax,2.5,46.5,44,"Destaques por linha (a/a)"); T.card(ax,2.5,7.5,46.5,35)
    ax.text(4,40.5,"Maiores altas",color=T.OK,fontsize=7.5,fontweight="bold"); ax.text(27,40.5,"Maiores quedas",color=T.BAD,fontsize=7.5,fontweight="bold"); yy=37.5
    for (ia,ra),(ib,rb) in zip(top.iterrows(),bot.iterrows()):
        ax.text(4,yy,f"{ia}",fontsize=6.8,va="center",color=T.INK,fontweight="bold"); ax.text(22,yy,f"{ra['var']:+.0%}",fontsize=6.8,ha="right",va="center",color=T.OK,fontweight="bold")
        ax.text(27,yy,f"{ib}",fontsize=6.8,va="center",color=T.INK,fontweight="bold"); ax.text(46,yy,f"{rb['var']:+.0%}",fontsize=6.8,ha="right",va="center",color=T.BAD,fontweight="bold"); yy-=4.6
    ax.text(4,10,"Maiores linhas do dia: "+" · ".join(f"{i} ({fn(r['h'])})" for i,r in mov.sort_values('h',ascending=False).head(3).iterrows()),color=T.SOFT,fontsize=6.6,va="center")
    hbanner(ax,50.5,47,72.5,"Tendência — últimos 14 dias"); T.card(ax,50.5,47.5,47,23.5)
    axt=fig.add_axes([0.55,0.52,0.42,0.18]); axt.bar(hist.index,hist["total_gratuidade"],width=0.7,color=T.FAINT); axt.bar(hist.index,hist["total_pagantes"],width=0.7,bottom=hist["total_gratuidade"],color=T.ACCENT)
    tbar=(hist["total_pagantes"]+hist["total_gratuidade"])
    for xd,v in zip(hist.index,tbar.values): axt.text(xd,v,sk(v),ha="center",va="bottom",fontsize=4.3,color=T.INK,rotation=90)
    axt.set_ylim(0,tbar.max()*1.22)
    axr=axt.twinx(); axr.plot(hist.index,hist["receita_total"],color=T.BAD,marker="o",ms=2.5,lw=1.4)
    axr.annotate(sk(hist["receita_total"].iloc[-1]),(hist.index[-1],hist["receita_total"].iloc[-1]),fontsize=5,color=T.BAD,ha="right",va="bottom",fontweight="bold")
    axt.xaxis.set_major_formatter(mdates.DateFormatter("%d/%m")); axt.tick_params(labelsize=5.8); axr.tick_params(labelsize=5.8,colors=T.BAD); axt.spines['top'].set_visible(False); axr.spines['top'].set_visible(False); axt.grid(axis="y",ls=":",alpha=.3)
    hbanner(ax,50.5,47,44,"Passageiros por hora — dia"); T.card(ax,50.5,7.5,47,35)
    if curva is not None and len(curva):
        axh=fig.add_axes([0.55,0.115,0.42,0.28]); axh.fill_between(curva.index,curva.values,color=T.ACCENT,alpha=0.16); axh.plot(curva.index,curva.values,color=T.ACCENT,lw=2,marker="o",ms=2.5)
        axh.set_xticks(range(3,24,2)); axh.tick_params(labelsize=6); [s.set_visible(False) for s in [axh.spines['top'],axh.spines['right']]]; axh.grid(axis="y",ls=":",alpha=.3); axh.set_xlabel("hora",fontsize=6.5); axh.set_ylim(0,curva.max()*1.18)
        axh.annotate(fn(curva.max()),(curva.idxmax(),curva.max()),fontsize=5.6,color=T.ACCENT,ha="center",va="bottom",fontweight="bold")
        ax.text(95.5,41,f"pico {int(curva.idxmax())}h · {fn(curva.max())}",color=T.ACCENT,fontsize=6.6,fontweight="bold",ha="right",va="center")
    else: ax.text(73.5,25,"(curva por hora indisponível)",color=T.FAINT,fontsize=7,ha="center")
    T.footer(ax,1,2); fig.savefig(SAIDA/"flash_diario_p1.png",dpi=130); plt.close(fig)

    # ---------- PAGINA 2 ----------
    MES,ANO=DIA.month,DIA.year
    mtd=agg[(agg.index.month==MES)&(agg.index.year==ANO)&(agg.index<=DIA)].copy(); ndias=len(mtd)
    ti=mtd["total_integracao"]; igr=np.minimum(ti,319.0); isb=np.maximum(ti-319.0,0.0)
    mpag=(mtd["total_pagantes"]-mtd["integracao_subsidiada"]+isb).sum(); mgrat=(mtd["total_gratuidade"]-mtd["integracao_gratuita"]+igr).sum()
    mgiros=mtd["total_giros"].sum(); mrec=mtd["receita_total"].sum()
    pjm=prj[(prj["data"].dt.month==MES)&(prj["data"].dt.year==ANO)&(prj["data"]<=DIA)]
    mpg=pjm["giros_prog"].sum(); mpp=pjm["pagantes_prog"].sum(); mpgr=mpg-mpp; mkm_prog=pjm["km_prog"].sum()
    kmm=fetch("kml_viagem",f"select=km_gps,data&data=gte.{ANO}-{MES:02d}-01&data=lte.{DIA:%Y-%m-%d}")
    kmm["km_gps"]=pd.to_numeric(kmm["km_gps"],errors="coerce").fillna(0); mkm_rod=kmm["km_gps"].sum()
    kmd=fetch("kml_viagem","select=data,km_gps&data=gte.2026-06-10&data=lte.2027-01-01"); kmd["km_gps"]=pd.to_numeric(kmd["km_gps"],errors="coerce").fillna(0); kmd["data"]=pd.to_datetime(kmd["data"],errors="coerce")
    kmday=kmd.groupby("data")["km_gps"].sum(); ipkday=(agg["total_giros"].reindex(kmday.index)/kmday).dropna().tail(18)
    dl=merge32(bil[bil["data"]==DIA].groupby("linha")["total_giros"].sum())
    km_of=lambda l:(kmL.get("21TR",0)+kmL.get("29TR",0)) if l=="21+29-TR" else kmL.get(norm(l),np.nan)
    ipkl={}
    for l,gv in dl.items():
        km=km_of(l)
        if km and km>0 and gv>0: ipkl[l]=gv/km
    ipklin=pd.Series(ipkl).sort_values()
    fig,ax=T.novo(); T.header(ax,f"Acumulado do mês & IPK · {DIA:%d/%m/%Y} ({DOWL[DIA.weekday()]})","Fonte: indicadores_bilhetagem · orçamento QUATAI 2026 · km: kml_viagem",f"{DIA:%d/%m/%Y}",titulo2="FLASH REPORT DIÁRIO",ref_label="DATA")
    MN=["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"][MES-1]
    hbanner(ax,2.5,95,84.5,f"Acumulado do mês ({MN}/{ANO} · {ndias} dia(s) até {DIA:%d/%m})"); T.card(ax,2.5,63,95,20.5)
    c2=[("m","Indicador",16,"l"),("r","Realizado",12,"r"),("p","Programado",12,"r"),("d","Diferença",12,"r"),("a","Atingido",9,"r")]
    x0=4; Wt=90; sc=Wt/sum(c[2] for c in c2); ed={}; x=x0
    for k,l,w,al in c2: ed[k]=(x,x+w*sc); x+=w*sc
    xr2=lambda k: ed[k][1]-0.5
    ax.add_patch(Rectangle((x0-0.5,79.6),Wt+1,2.2,color=T.HEADROW,zorder=2))
    for k,l,w,al in c2: ax.text(ed[k][0]+0.3 if al=="l" else xr2(k),80.7,l,ha="left" if al=="l" else "right",va="center",fontsize=7.5,fontweight="bold",color=T.PETROL,zorder=3)
    yy=77.6
    for nome,r_,p_ in [("Passageiros",mgiros,mpg),("Pagantes",mpag,mpp),("Gratuidade",mgrat,mpgr),("KM rodado",mkm_rod,mkm_prog),("Receita (R\\$)",mrec,None)]:
        dif=(r_-p_) if p_ else None; atg=(r_/p_) if p_ else None
        ax.text(ed["m"][0]+0.3,yy,nome,fontsize=7.5,fontweight="bold",va="center",color=T.INK,zorder=3)
        ax.text(xr2("r"),yy,rs(r_) if "Receita" in nome else fn(r_),ha="right",va="center",fontsize=7.5,color=T.INK,zorder=3)
        ax.text(xr2("p"),yy,("—" if p_ is None else fn(p_)),ha="right",va="center",fontsize=7.5,color=T.SOFT,zorder=3)
        ax.text(xr2("d"),yy,("—" if dif is None else ("+"+fn(dif) if dif>=0 else "−"+fn(abs(dif)))),ha="right",va="center",fontsize=7.5,fontweight="bold",color=(T.SOFT if dif is None else (T.OK if dif>=0 else T.BAD)),zorder=3)
        ax.text(xr2("a"),yy,("—" if atg is None else f"{atg:.0%}"),ha="right",va="center",fontsize=7.5,fontweight="bold",color=(T.SOFT if atg is None else (T.OK if atg>=1 else T.BAD)),zorder=3); yy-=2.75
    ax.text(4,64.5,"Diferença = Realizado − Programado (acumulado). Atingido = Realizado ÷ Programado.",color=T.FAINT,fontsize=6.6,va="center")
    hbanner(ax,2.5,46.5,58,"IPK consolidado — tendência diária"); T.card(ax,2.5,7.5,46.5,48.5)
    axi=fig.add_axes([0.075,0.12,0.37,0.36]); axi.plot(range(len(ipkday)),ipkday.values,color=T.ACCENT,lw=2,marker="o",ms=3)
    for i,v in enumerate(ipkday.values): axi.annotate(f"{v:.2f}",(i,v),fontsize=4.6,ha="center",va="bottom",color=T.INK)
    axi.set_ylim(ipkday.min()*0.9,ipkday.max()*1.08)
    axi.axhline(ipkday.mean(),color=T.FAINT,ls="--",lw=1); axi.text(0,ipkday.mean(),f" média {ipkday.mean():.2f}",fontsize=6.5,color=T.SOFT,va="bottom")
    axi.set_xticks(range(0,len(ipkday),3)); axi.set_xticklabels([d.strftime("%d/%m") for d in ipkday.index][::3],fontsize=6.3); axi.tick_params(labelsize=6.3); [s.set_visible(False) for s in [axi.spines['top'],axi.spines['right']]]; axi.grid(axis="y",ls=":",alpha=.3); axi.set_ylabel("IPK (pax/km)",fontsize=7)
    ax.text(4,54,f"IPK do dia {DIA:%d/%m}: {ipk:.2f} · média período: {ipkday.mean():.2f}",color=T.SOFT,fontsize=6.8,va="center")
    hbanner(ax,50.5,47,58,"IPK por linha — dia"); T.card(ax,50.5,7.5,47,48.5)
    axl=fig.add_axes([0.60,0.12,0.34,0.40]); cl=[T.BAD if v<ipk*0.8 else (T.AMBER if v<ipk else T.OK) for v in ipklin.values]
    axl.barh(range(len(ipklin)),ipklin.values,color=cl); axl.axvline(ipk,color=T.PETROL,ls="--",lw=1)
    axl.set_yticks(range(len(ipklin))); axl.set_yticklabels(ipklin.index,fontsize=6); axl.tick_params(labelsize=6.3); [s.set_visible(False) for s in [axl.spines['top'],axl.spines['right']]]; axl.grid(axis="x",ls=":",alpha=.3)
    for i,v in enumerate(ipklin.values): axl.text(v,i,f" {v:.2f}",va="center",fontsize=5.6)
    ax.text(52,54,f"Tracejado = consolidado do dia ({ipk:.2f}).",color=T.FAINT,fontsize=6.6,va="center")
    T.footer(ax,2,2); fig.savefig(SAIDA/"flash_diario_p2.png",dpi=130); plt.close(fig)

    # PDF
    try:
        import fitz
        doc=fitz.open()
        for nm in ["flash_diario_p1","flash_diario_p2"]:
            im=fitz.open(str(SAIDA/f"{nm}.png")); r=im[0].rect; pb=im.convert_to_pdf(); im.close()
            s=fitz.open("pdf",pb); pgp=doc.new_page(width=r.width,height=r.height); pgp.show_pdf_page(pgp.rect,s,0); s.close()
        doc.save(str(SAIDA/"Flash_Report_Diario.pdf")); doc.close()
    except Exception as e: print("[aviso] PDF nao gerado:",e)

    # texto resumo (HTML Telegram)
    setaA="🟢" if aa_g>=0 else "🔴"
    txt=(f"📊 <b>Flash Report Diário</b> — {DIA:%d/%m/%Y} ({DOWL[DIA.weekday()]})\n"
         f"{'✅ Dia acima da meta' if ok else '⚠️ Dia abaixo da meta'} · atingimento {at(giros,pg):.0%} · {setaA} {aa_g:+.1%} a/a\n\n"
         f"<b>Realizado × Programado (dia)</b>\n"
         f"• Passageiros: <b>{fn(giros)}</b> / {fn(pg)} ({at(giros,pg):.0%})\n"
         f"• Pagantes: {fn(pag)} / {fn(pp)} ({at(pag,pp):.0%})\n"
         f"• Gratuidade: {fn(grat)} / {fn(pgr)} ({at(grat,pgr):.0%})\n"
         f"• KM: {fn(km_rod)} rodado / {fn(km_prog)} prog ({at(km_rod,km_prog):.0%})\n"
         f"• Receita: <b>{rsx(rec)}</b> · IPK do dia: <b>{ipk:.2f}</b>\n\n"
         f"🏆 Altas: "+" · ".join(f"{i} {r['var']:+.0%}" for i,r in top.head(3).iterrows())+"\n"
         f"⚠️ Quedas: "+" · ".join(f"{i} {r['var']:+.0%}" for i,r in bot.head(3).iterrows())+"\n\n"
         f"📅 <b>Acumulado {MN}</b>: {fn(mgiros)} realizado / {fn(mpg)} programado ({at(mgiros,mpg):.0%})")
    (SAIDA/"flash_diario_texto.txt").write_text(txt.replace("<b>","").replace("</b>","").replace("\\$","$"),encoding="utf-8")
    return dict(dia=DIA, texto=txt, p1=SAIDA/"flash_diario_p1.png", p2=SAIDA/"flash_diario_p2.png", pdf=SAIDA/"Flash_Report_Diario.pdf")

def _telegram_cfg():
    # 1) variaveis de ambiente (GitHub secrets / .env): TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
    import os
    try:
        from dotenv import load_dotenv; load_dotenv(BASE/".env")
    except Exception: pass
    tok=os.getenv("TELEGRAM_BOT_TOKEN"); chat=os.getenv("TELEGRAM_CHAT_ID")
    if tok and chat: return tok, str(chat)
    # 2) fallback: _telegram.json
    for p in (BASE/"_telegram.json", IMPORTADOR/"_telegram.json"):
        if p.exists():
            c=json.loads(p.read_text(encoding="utf-8")); return c.get("token"), str(c.get("chat_id"))
    return None,None

def main():
    try: sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception: pass
    dry="--dry-run" in sys.argv
    print(f"[{datetime.now():%d/%m %H:%M}] gerando Flash Report Diário{' (dry-run)' if dry else ''}...")
    r=gerar()
    print("  dia:",r["dia"].date(),"| PNGs+PDF em:",SAIDA)
    print("  --- texto ---\n"+r["texto"].replace("<b>","").replace("</b>",""))
    if dry: print("  (dry-run: nao enviado)"); return 0
    token,chat=_telegram_cfg()
    if not token or not chat: print("  [aviso] sem _telegram.json (token/chat_id) — nao enviado. Crie o bot e configure."); return 0
    import telegram_client as tg
    tg.enviar_texto(token,chat,r["texto"])
    tg.enviar_foto(token,chat,r["p1"],"Flash Report Diário — pág. 1")
    tg.enviar_foto(token,chat,r["p2"],"Flash Report Diário — pág. 2")
    print("  enviado ao Telegram.")
    return 0

if __name__=="__main__":
    sys.exit(main())

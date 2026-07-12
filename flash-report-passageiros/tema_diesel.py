"""Tema visual estilo 'Flash Report Diesel' — cores, cabecalho, faixas, cards, capa, rodape."""
import numpy as np
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, Rectangle

PETROL="#0e4e56"; PETROL_D="#0c3b45"; ACCENT="#12a594"; MINT="#5bd0c0"
INK="#16262b"; SOFT="#5a6b72"; FAINT="#93a2a8"
PAGE="#f4f6f8"; CARD="#ffffff"; BORDER="#e0e6ea"; LIGHT="#f7f9fb"; HEADROW="#eef2f5"
OK="#1a9d6a"; BAD="#d24b4b"; AMBER="#c98a1a"
plt.rcParams.update({"font.family":"DejaVu Sans"})

def novo(landscape=True):
    fig=plt.figure(figsize=(11.69,8.27) if landscape else (8.27,11.69),dpi=150,facecolor=PAGE)
    ax=fig.add_axes([0,0,1,1]); ax.axis("off"); ax.set_xlim(0,100); ax.set_ylim(0,100)
    ax.add_patch(Rectangle((0,0),100,100,color=PAGE,zorder=0))
    return fig,ax

def _round(ax,x,y,w,h,fc,ec="none",lw=0,rad=1.0,z=1):
    ax.add_patch(FancyBboxPatch((x,y),w,h,boxstyle=f"round,pad=0,rounding_size={rad}",fc=fc,ec=ec,lw=lw,zorder=z,mutation_aspect=0.7))

def header(ax,subtitulo,fonte,mesref,titulo2="FLASH REPORT PASSAGEIROS",titulo1="MOBILIDADE URBANA — ",ref_label="MÊS DE REFERÊNCIA"):
    fig=ax.figure
    t1=ax.text(2.5,96.2,titulo1,color=INK,fontsize=15,fontweight="bold",va="center")
    fig.canvas.draw()
    bb=t1.get_window_extent(renderer=fig.canvas.get_renderer())
    xend=ax.transData.inverted().transform((bb.x1,bb.y0))[0]
    ax.text(xend+0.6,96.2,titulo2,color=ACCENT,fontsize=15,fontweight="bold",va="center")
    ax.text(2.5,93.4,subtitulo,color=SOFT,fontsize=8.5,va="center")
    ax.text(2.5,91.4,fonte,color=FAINT,fontsize=7.5,va="center")
    _round(ax,79,93.2,18.5,5.4,PETROL,rad=1.0,z=2)
    ax.text(96,96.6,ref_label,color=MINT,fontsize=6.5,ha="right",va="center",zorder=3)
    ax.text(96,94.3,mesref,color="white",fontsize=12,fontweight="bold",ha="right",va="center",zorder=3)
    ax.add_patch(Rectangle((2.5,89.6),95,0.5,color=PETROL,zorder=2))
    ax.add_patch(Rectangle((2.5,89.6),16,0.5,color=ACCENT,zorder=3))

def banner(ax,y,texto,h=2.6):
    _round(ax,2.5,y,95,h,PETROL,rad=0.7,z=2)
    ax.text(4,y+h/2,texto.upper(),color="white",fontsize=8.5,fontweight="bold",va="center",zorder=3)

def card(ax,x,y,w,h,rad=1.0):
    _round(ax,x,y,w,h,CARD,ec=BORDER,lw=1,rad=rad,z=1)

def kpicard(ax,x,y,w,h,label,valor,sub="",cor=INK,subcor=None):
    _round(ax,x,y,w,h,LIGHT,ec=BORDER,lw=0.8,rad=0.8,z=1)
    ax.text(x+w/2,y+h-1.25,label.upper(),color=SOFT,fontsize=6.6,ha="center",va="center",zorder=2)
    ax.text(x+w/2,y+h/2-0.2,valor,color=cor,fontsize=12.5,fontweight="bold",ha="center",va="center",zorder=2)
    if sub: ax.text(x+w/2,y+1.05,sub,color=subcor or FAINT,fontsize=6.6,ha="center",va="center",zorder=2)

def footer(ax,pag,total=2,rodape="Flash Report Passageiros — QUATAI"):
    ax.add_patch(Rectangle((2.5,3.4),95,0.15,color=BORDER,zorder=1))
    ax.text(2.5,2.2,f"Gerado automaticamente · Página {pag}/{total}",color=FAINT,fontsize=6.8,va="center")
    ax.text(97,2.2,rodape,color=FAINT,fontsize=6.8,ha="right",va="center")

def seta(v):
    return "↑" if v>0 else ("↓" if v<0 else "→")

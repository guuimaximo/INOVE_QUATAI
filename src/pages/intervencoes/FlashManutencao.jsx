// src/pages/intervencoes/FlashManutencao.jsx
//
// Flash Report Manutenção INTERATIVO dentro do INOVE (28/09/2026).
// O bot (bot-flash-manutencao-interativo.yml) gera o HTML 2x por dia e publica no
// bucket "relatorios" em manutencao/flash_interativo/. Aqui a página só lê o
// arquivo e mostra num iframe isolado — todas as seções, filtros e drill-downs são
// do próprio HTML, igual ao arquivo baixado.
//
// O storage do Supabase entrega .html como text/plain (proteção contra XSS), por
// isso o conteúdo vai por srcdoc, e não por src. O HTML foi feito para rodar em
// sandbox (history/localStorage/download protegidos por try/catch).
import { useCallback, useEffect, useMemo, useState } from "react";
import { FaDownload, FaExpand, FaSyncAlt } from "react-icons/fa";

const BASE = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/relatorios/manutencao/flash_interativo`;

/* A SEÇÃO EM QUE O FLASH ABRE (01/10/2026 — dono: "no Resumo PCM quero colocar esse Flash
   interativo"). O HTML escolhe a seção pelo hash da URL, e o `srcdoc` não tem hash: a linha
   abaixo é trocada antes de ir para o iframe, e o menu lateral do HTML continua navegando
   para as outras seções. Se o template mudar essa linha, o Flash só abre na capa — não quebra. */
const HASH_DO_TEMPLATE = 'let hash0="";try{hash0=location.hash}catch(e){}';
const abrirNaSecao = (html, secao) =>
  secao && /^#s\d+[a-z]?$/.test(secao) ? html.replace(HASH_DO_TEMPLATE, `let hash0="${secao}";`) : html;

const fmtInt = (v) => Math.round(Number(v) || 0).toLocaleString("pt-BR");
const fmt1 = (v) => (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmtData = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "");

export default function FlashManutencao({ secaoInicial = "" } = {}) {
  const [meta, setMeta] = useState(null);
  const [html, setHtml] = useState("");
  const htmlNaTela = useMemo(() => abrirNaSecao(html, secaoInicial), [html, secaoInicial]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro("");
    try {
      const t = Date.now();
      const [rMeta, rHtml] = await Promise.all([
        fetch(`${BASE}/meta.json?t=${t}`, { cache: "no-store" }),
        fetch(`${BASE}/atual.html?t=${t}`, { cache: "no-store" }),
      ]);
      if (!rHtml.ok) throw new Error(`Relatório ainda não publicado (HTTP ${rHtml.status}).`);
      setMeta(rMeta.ok ? await rMeta.json() : null);
      setHtml(await rHtml.text());
    } catch (e) {
      setErro(e?.message || "Falha ao carregar o Flash Report.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const nomeArquivo = useMemo(() => {
    const d = meta?.gerado_em_iso?.slice(0, 10) || new Date().toISOString().slice(0, 10);
    return `Flash Report Manutencao - Interativo ${d}.html`;
  }, [meta]);

  const blobUrl = useCallback(
    (conteudo = html) => URL.createObjectURL(new Blob([conteudo], { type: "text/html;charset=utf-8" })),
    [html],
  );

  // o arquivo baixado é o original (abre na capa); a tela cheia abre onde a tela abriu
  const baixar = () => {
    const url = blobUrl();
    const a = document.createElement("a");
    a.href = url;
    a.download = nomeArquivo;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const telaCheia = () => {
    const url = blobUrl(htmlNaTela);
    window.open(url, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  const r = meta?.resumo;

  return (
    <div className="flex flex-col gap-3" style={{ minHeight: "calc(100vh - 90px)" }}>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-2">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-widest text-blue-700 font-bold">Manutenção · Flash Report interativo</div>
          <div className="text-sm text-slate-600">
            {loading ? "Carregando…" : meta ? <>Atualizado em <b className="text-slate-800">{meta.gerado_em}</b> · atualiza sozinho às 06h30 e 12h30</> : "—"}
          </div>
        </div>

        {r && (
          <div className="flex flex-wrap gap-2 text-xs">
            <Chip rotulo="MKBF" valor={fmtInt(r.mkbf)} alerta={r.mkbf < 7000} />
            <Chip rotulo="Intervenções" valor={fmtInt(r.intervencoes)} />
            <Chip rotulo="GNS médio" valor={fmt1(r.gns_medio)} />
            <Chip rotulo="Aderência prev." valor={`${fmt1(r.aderencia_preventiva)}%`} />
            {r.periodo && <span className="self-center text-slate-500">{r.mes} · {fmtData(r.periodo[0])} a {fmtData(r.periodo[1])}</span>}
          </div>
        )}

        <div className="ml-auto flex gap-2">
          <button onClick={carregar} disabled={loading} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50" title="Buscar a versão mais recente">
            <FaSyncAlt className={loading ? "animate-spin" : ""} /> Recarregar
          </button>
          <button onClick={telaCheia} disabled={!html} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            <FaExpand /> Tela cheia
          </button>
          <button onClick={baixar} disabled={!html} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
            <FaDownload /> Baixar HTML
          </button>
        </div>
      </div>

      {erro && <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl px-4 py-3 text-sm">{erro}</div>}

      <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden" style={{ minHeight: 600 }}>
        {html ? (
          <iframe
            title="Flash Report Manutenção"
            srcDoc={htmlNaTela}
            sandbox="allow-scripts allow-downloads allow-popups allow-modals"
            className="w-full h-full border-0"
            style={{ height: "calc(100vh - 170px)", minHeight: 600 }}
          />
        ) : (
          !erro && <div className="p-10 text-center text-slate-400">Carregando o Flash Report…</div>
        )}
      </div>
    </div>
  );
}

function Chip({ rotulo, valor, alerta }) {
  return (
    <span className={`inline-flex items-baseline gap-1 rounded-full border px-2.5 py-1 ${alerta ? "border-red-200 bg-red-50 text-red-800" : "border-blue-200 bg-blue-50 text-blue-900"}`}>
      <span className="text-[10px] uppercase tracking-wide opacity-70">{rotulo}</span>
      <b className="tabular-nums">{valor}</b>
    </span>
  );
}

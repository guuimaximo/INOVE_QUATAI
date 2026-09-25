// OPERACIONAL · PASSAGEM DE TURNO — o dia (25/09/2026).
//
// Um dia por tela, como o PCM do dia, alimentado ao longo do turno. O que se digita aqui
// vai para três tabelas (ver `passagemTurno.js`) e o bloco "Fechamento" no fim é a folha
// verde que o plantão mandava em planilha — é ele que desce em PNG e PDF.
//
// O DIA NASCE NO PRIMEIRO LANÇAMENTO, não ao abrir a tela: abrir um dia para olhar não
// cria registro vazio. `garantirTurno` faz o upsert pela data (única) na primeira gravação.
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import {
  FaArrowLeft, FaChevronLeft, FaChevronRight, FaDownload, FaFileImage, FaFilePdf,
  FaPlus, FaSyncAlt, FaTrashAlt, FaUserTimes, FaClipboardList, FaDatabase, FaLock,
} from "react-icons/fa";
import { supabase } from "../../supabase";
import { AuthContext } from "../../context/AuthContext";
import FechamentoTurnoRelatorio from "./FechamentoTurnoRelatorio";
import {
  PERIODOS, TABELA_FALTAS, TABELA_INTERCORRENCIAS, TABELA_TURNOS,
  chapasNoTexto, dataPorExtenso, isoLocal, lerMotoristas, normChapa, numerosDoSistema,
  podeEditarDia, quemEsta, somaDias, veiculoNoTexto,
} from "./passagemTurno";

/* Os números do turno, na ordem da folha. `sistema` = tem "puxar do sistema". */
const CAMPOS = [
  { grupo: "Manhã", campos: [
    { id: "carros_programados", label: "Carros programados" },
    { id: "gns", label: "GNS", sistema: true },
    { id: "po_programado", label: "P.O programado" },
    { id: "faixa_amarela", label: "Faixa amarela", sistema: true },
    { id: "reservas_manha", label: "Reservas manhã", sistema: true },
  ] },
  { grupo: "Tarde", campos: [
    { id: "reservas_tarde", label: "Reservas tarde", sistema: true },
  ] },
  { grupo: "Outros", campos: [
    { id: "sos", label: "SOS", sistema: true },
    { id: "troca", label: "Troca", sistema: true },
    { id: "avaria", label: "Avaria", sistema: true },
    { id: "assalto", label: "Assalto" },
  ] },
];

const agoraHM = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
const periodoDaHora = (hm) => (String(hm || agoraHM()) < "13:00" ? "MANHA" : "TARDE");
const numOuNulo = (v) => {
  const t = String(v ?? "").trim();
  if (!t) return null;
  const n = Number.parseInt(t, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

export default function PassagemTurnoDia() {
  const { data: dataParam } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const dia = /^\d{4}-\d{2}-\d{2}$/.test(String(dataParam || "")) ? dataParam : isoLocal();
  const editavel = podeEditarDia(dia, user);
  const eu = quemEsta(user);

  const [turno, setTurno] = useState(null);
  const [faltas, setFaltas] = useState([]);
  const [inter, setInter] = useState([]);
  const [motoristas, setMotoristas] = useState(new Map());
  const [sistema, setSistema] = useState({});
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [rascunho, setRascunho] = useState({}); // campos numéricos em edição
  const [exportando, setExportando] = useState("");
  const relatorioRef = useRef(null);
  const avisoTimer = useRef(0);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro("");
    try {
      const [t, f, i] = await Promise.all([
        supabase.from(TABELA_TURNOS).select("*").eq("data_referencia", dia).maybeSingle(),
        supabase.from(TABELA_FALTAS).select("*").eq("data_referencia", dia).order("criado_em", { ascending: true }),
        supabase.from(TABELA_INTERCORRENCIAS).select("*").eq("data_referencia", dia)
          .order("hora", { ascending: true, nullsFirst: true }).order("criado_em", { ascending: true }),
      ]);
      if (t.error) throw t.error;
      if (f.error) throw f.error;
      if (i.error) throw i.error;
      setTurno(t.data || null);
      setFaltas(f.data || []);
      setInter(i.data || []);
      setRascunho({});
    } catch (e) {
      setErro(e?.message || "Não foi possível carregar a passagem de turno.");
    } finally {
      setCarregando(false);
    }
  }, [dia]);

  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => {
    lerMotoristas().then(setMotoristas).catch(() => setMotoristas(new Map()));
  }, []);
  useEffect(() => {
    numerosDoSistema(dia).then(setSistema).catch(() => setSistema({}));
  }, [dia]);

  const nomeDe = useCallback((chapa) => motoristas.get(normChapa(chapa))?.nome || "", [motoristas]);

  const mostrar = useCallback((texto) => {
    setAviso(texto);
    window.clearTimeout(avisoTimer.current);
    avisoTimer.current = window.setTimeout(() => setAviso(""), 3500);
  }, []);

  /* O dia nasce aqui, na primeira gravação. Dois plantonistas podem lançar ao mesmo
     tempo no dia que ainda não existe: a data é ÚNICA, então quem chega segundo recebe
     23505 e passa a usar o registro do primeiro (sem sobrescrever quem criou). */
  const garantirTurno = useCallback(async () => {
    if (turno?.id) return turno;
    const ins = await supabase
      .from(TABELA_TURNOS)
      .insert({ data_referencia: dia, criado_por: eu, atualizado_por: eu })
      .select("*")
      .single();
    let data = ins.data;
    if (ins.error) {
      if (ins.error.code !== "23505") throw ins.error;
      const ja = await supabase.from(TABELA_TURNOS).select("*").eq("data_referencia", dia).single();
      if (ja.error) throw ja.error;
      data = ja.data;
    }
    setTurno(data);
    return data;
  }, [turno, dia, eu]);

  const salvarCampos = useCallback(async (patch) => {
    try {
      const t = await garantirTurno();
      const { data, error } = await supabase
        .from(TABELA_TURNOS)
        .update({ ...patch, atualizado_por: eu, atualizado_em: new Date().toISOString() })
        .eq("id", t.id)
        .select("*")
        .single();
      if (error) throw error;
      setTurno(data);
      mostrar(`Salvo às ${agoraHM()}`);
    } catch (e) {
      setErro(e?.message || "Não foi possível salvar.");
    }
  }, [garantirTurno, eu, mostrar]);

  const salvarNumero = (id) => {
    if (!(id in rascunho)) return;
    const valor = numOuNulo(rascunho[id]);
    setRascunho((r) => { const n = { ...r }; delete n[id]; return n; });
    if (valor === (turno?.[id] ?? null)) return;
    salvarCampos({ [id]: valor });
  };

  const puxarDoSistema = async () => {
    const atual = await numerosDoSistema(dia).catch(() => ({}));
    setSistema(atual);
    const patch = {};
    CAMPOS.flatMap((g) => g.campos).filter((c) => c.sistema).forEach((c) => {
      if (atual[c.id] !== undefined) patch[c.id] = atual[c.id];
    });
    if (!Object.keys(patch).length) {
      mostrar("O sistema não tem números deste dia.");
      return;
    }
    await salvarCampos(patch);
  };

  /* ── faltas ── */
  const [novaFalta, setNovaFalta] = useState({ periodo: periodoDaHora(), chapa: "", linha: "", substituto_chapa: "", substituto_linha: "" });
  const incluirFalta = async (e) => {
    e?.preventDefault();
    const chapa = normChapa(novaFalta.chapa);
    if (!chapa) { setErro("Informe a chapa do motorista que faltou."); return; }
    try {
      const t = await garantirTurno();
      const sub = normChapa(novaFalta.substituto_chapa);
      const { data, error } = await supabase.from(TABELA_FALTAS).insert({
        turno_id: t.id,
        data_referencia: dia,
        periodo: novaFalta.periodo,
        chapa,
        operador: nomeDe(chapa) || null,
        linha: novaFalta.linha.trim() || null,
        substituto_chapa: sub || null,
        substituto_nome: sub ? nomeDe(sub) || null : null,
        substituto_linha: novaFalta.substituto_linha.trim() || null,
        criado_por: eu,
        atualizado_por: eu,
      }).select("*").single();
      if (error) throw error;
      setFaltas((l) => [...l, data]);
      setNovaFalta((n) => ({ ...n, chapa: "", linha: "", substituto_chapa: "", substituto_linha: "" }));
      setErro("");
      mostrar(`Falta de ${data.operador || data.chapa} lançada`);
    } catch (err) {
      setErro(err?.message || "Não foi possível lançar a falta.");
    }
  };
  const [apagando, setApagando] = useState("");
  const apagar = async (tabela, id) => {
    const { error } = await supabase.from(tabela).delete().eq("id", id);
    if (error) { setErro(error.message); return; }
    if (tabela === TABELA_FALTAS) setFaltas((l) => l.filter((x) => x.id !== id));
    else setInter((l) => l.filter((x) => x.id !== id));
    setApagando("");
    mostrar("Removido");
  };

  /* ── intercorrências ── */
  const [novaInter, setNovaInter] = useState({ periodo: periodoDaHora(), hora: "", texto: "", veiculo: "", extra: "" });
  const chapasDetectadas = useMemo(() => chapasNoTexto(novaInter.texto), [novaInter.texto]);
  const chapasExtra = useMemo(
    () => String(novaInter.extra).split(/[\s,;]+/).map(normChapa).filter((c) => c.length >= 5),
    [novaInter.extra],
  );
  const chapasDaNova = useMemo(() => [...new Set([...chapasDetectadas, ...chapasExtra])], [chapasDetectadas, chapasExtra]);
  const incluirInter = async (e) => {
    e?.preventDefault();
    const texto = novaInter.texto.trim();
    if (!texto) { setErro("Escreva a intercorrência."); return; }
    try {
      const t = await garantirTurno();
      const { data, error } = await supabase.from(TABELA_INTERCORRENCIAS).insert({
        turno_id: t.id,
        data_referencia: dia,
        periodo: novaInter.periodo,
        hora: novaInter.hora.trim() || null,
        veiculo: (novaInter.veiculo.trim() || veiculoNoTexto(texto)) || null,
        texto,
        chapas: chapasDaNova,
        criado_por: eu,
        atualizado_por: eu,
      }).select("*").single();
      if (error) throw error;
      setInter((l) => [...l, data].sort((a, b) => String(a.hora || "").localeCompare(String(b.hora || ""))));
      setNovaInter((n) => ({ ...n, hora: "", texto: "", veiculo: "", extra: "" }));
      setErro("");
      mostrar(chapasDaNova.length
        ? `Intercorrência gravada · vai para o ponto de ${chapasDaNova.length} motorista(s)`
        : "Intercorrência gravada (sem chapa: não aparece no ponto de ninguém)");
    } catch (err) {
      setErro(err?.message || "Não foi possível gravar a intercorrência.");
    }
  };

  /* ── exportar: o bloco "Fechamento" vira imagem ── */
  /* A FOTO DO FECHAMENTO. O desenho normal do html2canvas põe o texto ~5 px ABAIXO do
     lugar (medido no teste: as letras encostavam na linha de baixo de cada célula). O modo
     `foreignObjectRendering` deixa o próprio navegador desenhar e sai idêntico à tela — mas
     só acerta com o elemento no canto (0,0) da página, fora de qualquer rolagem. Então: uma
     cópia vai para um "palco" no topo, é fotografada e sai. Se o navegador recusar o modo,
     volta o desenho normal (texto um pouco baixo, mas o fechamento sai). */
  const fotografar = async () => {
    const el = relatorioRef.current;
    if (!el) throw new Error("O fechamento ainda não foi desenhado.");
    const palco = document.createElement("div");
    palco.style.cssText = "position:absolute;left:0;top:0;z-index:-1;background:#fff;pointer-events:none";
    const copia = el.cloneNode(true);
    palco.appendChild(copia);
    document.body.appendChild(palco);
    const rolagem = [window.scrollX, window.scrollY];
    window.scrollTo(0, 0);
    try {
      return await html2canvas(copia, {
        scale: 2, backgroundColor: "#ffffff", logging: false, foreignObjectRendering: true,
        x: 0, y: 0, scrollX: 0, scrollY: 0,
        windowWidth: document.documentElement.scrollWidth, windowHeight: document.documentElement.scrollHeight,
      });
    } catch {
      return await html2canvas(el, { scale: 2, backgroundColor: "#ffffff", useCORS: true, logging: false });
    } finally {
      palco.remove();
      window.scrollTo(rolagem[0], rolagem[1]);
    }
  };
  const baixarPNG = async () => {
    setExportando("png");
    try {
      const canvas = await fotografar();
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = `Fechamento_Turno_${dia}.png`;
      a.click();
    } catch (e) {
      setErro(e?.message || "Não foi possível gerar o PNG.");
    } finally {
      setExportando("");
    }
  };
  const baixarPDF = async () => {
    setExportando("pdf");
    try {
      const canvas = await fotografar();
      // Uma página A4 em pé: a folha inteira cabe (reduzida se precisar), como a
      // planilha impressa — o fechamento é lido de uma vez, não em pedaços.
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const maxW = 200;
      const maxH = 287;
      const prop = canvas.height / canvas.width;
      let w = maxW;
      let h = w * prop;
      if (h > maxH) { h = maxH; w = h / prop; }
      doc.addImage(canvas.toDataURL("image/png"), "PNG", (210 - w) / 2, 5, w, h, undefined, "FAST");
      doc.save(`Fechamento_Turno_${dia}.pdf`);
    } catch (e) {
      setErro(e?.message || "Não foi possível gerar o PDF.");
    } finally {
      setExportando("");
    }
  };

  const faltasPor = (p) => faltas.filter((f) => f.periodo === p);
  const interPor = (p) => inter.filter((i) => i.periodo === p);
  const hoje = isoLocal();

  return (
    <div className="min-h-screen bg-slate-50 p-4 space-y-4">
      {/* CABEÇALHO */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="min-w-0">
            <Link to="/operacional/passagem-turno" className="text-xs font-bold text-blue-700 inline-flex items-center gap-1">
              <FaArrowLeft /> Todos os dias
            </Link>
            <h1 className="text-2xl font-black text-slate-800 mt-1">Passagem de Turno</h1>
            <div className="flex items-center gap-2 mt-1">
              <button type="button" className="p-2 rounded-lg border border-slate-200 hover:bg-slate-100" title="Dia anterior"
                onClick={() => navigate(`/operacional/passagem-turno/${somaDias(dia, -1)}`)}>
                <FaChevronLeft />
              </button>
              <span className="font-bold text-slate-700">{dataPorExtenso(dia).replace(/^./, (c) => c.toUpperCase())}</span>
              <button type="button" className="p-2 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-30" title="Dia seguinte"
                disabled={dia >= hoje}
                onClick={() => navigate(`/operacional/passagem-turno/${somaDias(dia, 1)}`)}>
                <FaChevronRight />
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={carregar} className="px-3 py-2 rounded-xl border border-slate-200 font-bold text-slate-700 inline-flex items-center gap-2 hover:bg-slate-50">
              <FaSyncAlt /> Atualizar
            </button>
            <button type="button" onClick={baixarPNG} disabled={!!exportando} className="px-3 py-2 rounded-xl bg-teal-700 text-white font-bold inline-flex items-center gap-2 hover:bg-teal-600 disabled:opacity-50">
              <FaFileImage /> {exportando === "png" ? "Gerando…" : "Baixar PNG"}
            </button>
            <button type="button" onClick={baixarPDF} disabled={!!exportando} className="px-3 py-2 rounded-xl bg-slate-800 text-white font-bold inline-flex items-center gap-2 hover:bg-slate-700 disabled:opacity-50">
              <FaFilePdf /> {exportando === "pdf" ? "Gerando…" : "Baixar PDF"}
            </button>
          </div>
        </div>
        {!editavel && (
          <div className="mt-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm font-semibold px-3 py-2 inline-flex items-center gap-2">
            <FaLock /> Dia fechado para edição (vale até as 10h do dia seguinte, como no PCM). Só o Administrador altera.
          </div>
        )}
        {erro && <div className="mt-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-semibold px-3 py-2">{erro}</div>}
        {aviso && <div className="mt-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-semibold px-3 py-2">{aviso}</div>}
      </div>

      {carregando ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500 font-semibold">Carregando…</div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4">
          {/* ═══ COLUNA 1: o que se lança ═══ */}
          <div className="space-y-4 min-w-0">
            {/* NÚMEROS DO TURNO */}
            <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <h2 className="font-black text-slate-800 inline-flex items-center gap-2"><FaClipboardList /> Números do turno</h2>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-slate-500 font-semibold">Turno</span>
                  <input type="time" disabled={!editavel} className="border border-slate-200 rounded-lg px-2 py-1"
                    defaultValue={turno?.turno_inicio || "07:00"} key={`ini-${turno?.id || "novo"}`}
                    onBlur={(e) => e.target.value && e.target.value !== (turno?.turno_inicio || "07:00") && salvarCampos({ turno_inicio: e.target.value })} />
                  <span className="text-slate-400">às</span>
                  <input type="time" disabled={!editavel} className="border border-slate-200 rounded-lg px-2 py-1"
                    defaultValue={turno?.turno_fim || "19:00"} key={`fim-${turno?.id || "novo"}`}
                    onBlur={(e) => e.target.value && e.target.value !== (turno?.turno_fim || "19:00") && salvarCampos({ turno_fim: e.target.value })} />
                </div>
              </div>
              {editavel && (
                <button type="button" onClick={puxarDoSistema}
                  className="mb-3 px-3 py-2 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-sm font-bold inline-flex items-center gap-2 hover:bg-blue-100">
                  <FaDatabase /> Puxar do sistema (SOS, troca, avaria, GNS, faixa amarela, reservas)
                </button>
              )}
              <div className="space-y-3">
                {CAMPOS.map((g) => (
                  <div key={g.grupo}>
                    <div className="text-xs font-black uppercase tracking-wide text-teal-700 mb-1">{g.grupo}</div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {g.campos.map((c) => {
                        const valor = c.id in rascunho ? rascunho[c.id] : (turno?.[c.id] ?? "");
                        const sis = sistema[c.id];
                        const difere = c.sistema && sis !== undefined && turno?.[c.id] != null && Number(turno[c.id]) !== sis;
                        return (
                          <label key={c.id} className="block">
                            <span className="text-xs font-bold text-slate-600">{c.label}</span>
                            <input
                              type="number" min="0" inputMode="numeric" disabled={!editavel}
                              className="mt-0.5 w-full border border-slate-200 rounded-lg px-2 py-1.5 font-bold text-slate-800 disabled:bg-slate-50"
                              value={valor}
                              onChange={(e) => setRascunho((r) => ({ ...r, [c.id]: e.target.value }))}
                              onBlur={() => salvarNumero(c.id)}
                              onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                            />
                            {c.sistema && sis !== undefined && (
                              <span className={`text-[11px] ${difere ? "text-amber-700 font-bold" : "text-slate-400"}`}>
                                sistema agora: {sis}
                              </span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className="px-2 py-1 rounded-full bg-slate-100 font-bold text-slate-600">Faltas manhã: {faltasPor("MANHA").length}</span>
                <span className="px-2 py-1 rounded-full bg-slate-100 font-bold text-slate-600">Faltas tarde: {faltasPor("TARDE").length}</span>
                <span className="px-2 py-1 rounded-full bg-slate-100 font-bold text-slate-600">
                  Substituições: {faltas.filter((f) => f.substituto_chapa || f.substituto_nome).length}
                </span>
              </div>
            </section>

            {/* FALTAS */}
            <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
              <h2 className="font-black text-slate-800 inline-flex items-center gap-2 mb-3"><FaUserTimes /> Faltas</h2>
              {editavel && (
                <form onSubmit={incluirFalta} className="grid grid-cols-2 sm:grid-cols-6 gap-2 items-end mb-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <label className="col-span-1">
                    <span className="text-xs font-bold text-slate-600">Período</span>
                    <select className="w-full border border-slate-200 rounded-lg px-2 py-1.5" value={novaFalta.periodo}
                      onChange={(e) => setNovaFalta((n) => ({ ...n, periodo: e.target.value }))}>
                      {PERIODOS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                    </select>
                  </label>
                  <label className="col-span-1">
                    <span className="text-xs font-bold text-slate-600">Chapa</span>
                    <input className="w-full border border-slate-200 rounded-lg px-2 py-1.5 font-mono" inputMode="numeric" placeholder="30061096"
                      value={novaFalta.chapa} onChange={(e) => setNovaFalta((n) => ({ ...n, chapa: e.target.value }))} />
                  </label>
                  <label className="col-span-1">
                    <span className="text-xs font-bold text-slate-600">Linha</span>
                    <input className="w-full border border-slate-200 rounded-lg px-2 py-1.5" placeholder="04TR 08A"
                      value={novaFalta.linha} onChange={(e) => setNovaFalta((n) => ({ ...n, linha: e.target.value }))} />
                  </label>
                  <label className="col-span-1">
                    <span className="text-xs font-bold text-slate-600">Substituto (chapa)</span>
                    <input className="w-full border border-slate-200 rounded-lg px-2 py-1.5 font-mono" inputMode="numeric" placeholder="opcional"
                      value={novaFalta.substituto_chapa} onChange={(e) => setNovaFalta((n) => ({ ...n, substituto_chapa: e.target.value }))} />
                  </label>
                  <label className="col-span-1">
                    <span className="text-xs font-bold text-slate-600">Linha do substituto</span>
                    <input className="w-full border border-slate-200 rounded-lg px-2 py-1.5" placeholder="opcional"
                      value={novaFalta.substituto_linha} onChange={(e) => setNovaFalta((n) => ({ ...n, substituto_linha: e.target.value }))} />
                  </label>
                  <button type="submit" className="col-span-1 px-3 py-2 rounded-xl bg-teal-700 text-white font-bold inline-flex items-center justify-center gap-2 hover:bg-teal-600">
                    <FaPlus /> Lançar
                  </button>
                  <div className="col-span-2 sm:col-span-6 text-xs text-slate-500 min-h-[16px]">
                    {normChapa(novaFalta.chapa) && (nomeDe(novaFalta.chapa)
                      ? <>Faltou: <b className="text-slate-700">{nomeDe(novaFalta.chapa)}</b></>
                      : <span className="text-amber-700 font-bold">chapa {normChapa(novaFalta.chapa)} não está no cadastro de motoristas — confira</span>)}
                    {normChapa(novaFalta.substituto_chapa) && (
                      <> · Substituto: <b className="text-slate-700">{nomeDe(novaFalta.substituto_chapa) || "não encontrado no cadastro"}</b></>
                    )}
                  </div>
                </form>
              )}
              {PERIODOS.map((p) => (
                <div key={p.id} className="mb-3">
                  <div className="text-xs font-black uppercase tracking-wide text-teal-700 mb-1">Faltas {p.label.toLowerCase()} · {faltasPor(p.id).length}</div>
                  {faltasPor(p.id).length === 0 ? (
                    <div className="text-sm text-slate-400">Nenhuma falta lançada.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs text-slate-500">
                            <th className="py-1 pr-2">Operador</th><th className="pr-2">Chapa</th><th className="pr-2">Linha</th>
                            <th className="pr-2">Substituto</th><th className="pr-2">Lançado por</th><th />
                          </tr>
                        </thead>
                        <tbody>
                          {faltasPor(p.id).map((f) => (
                            <tr key={f.id} className="border-t border-slate-100">
                              <td className="py-1.5 pr-2 font-bold text-slate-800">{f.operador || nomeDe(f.chapa) || "—"}</td>
                              <td className="pr-2 font-mono">{f.chapa}</td>
                              <td className="pr-2">{f.linha || "—"}</td>
                              <td className="pr-2">
                                {f.substituto_chapa || f.substituto_nome
                                  ? <>{f.substituto_nome || nomeDe(f.substituto_chapa) || "—"} <span className="font-mono text-slate-500">{f.substituto_chapa}</span>{f.substituto_linha ? ` · ${f.substituto_linha}` : ""}</>
                                  : "—"}
                              </td>
                              <td className="pr-2 text-xs text-slate-500">{f.criado_por || "—"}</td>
                              <td className="text-right whitespace-nowrap">
                                {editavel && (apagando === f.id ? (
                                  <span className="text-xs font-bold">
                                    Remover? <button type="button" className="text-red-700 underline" onClick={() => apagar(TABELA_FALTAS, f.id)}>sim</button>{" "}
                                    <button type="button" className="text-slate-500 underline" onClick={() => setApagando("")}>não</button>
                                  </span>
                                ) : (
                                  <button type="button" title="Remover" className="text-slate-400 hover:text-red-600 p-1" onClick={() => setApagando(f.id)}><FaTrashAlt /></button>
                                ))}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </section>

            {/* INTERCORRÊNCIAS */}
            <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
              <h2 className="font-black text-slate-800 mb-1">Intercorrências</h2>
              <p className="text-xs text-slate-500 mb-3">
                Escreva a chapa de cada motorista citado (ex.: “30060914 trouxe o veículo 222214 para a garagem porque o
                30060916 passou mal”). A intercorrência aparece no ponto de <b>cada</b> motorista citado, no DP360.
              </p>
              {editavel && (
                <form onSubmit={incluirInter} className="space-y-2 mb-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    <label>
                      <span className="text-xs font-bold text-slate-600">Período</span>
                      <select className="w-full border border-slate-200 rounded-lg px-2 py-1.5" value={novaInter.periodo}
                        onChange={(e) => setNovaInter((n) => ({ ...n, periodo: e.target.value }))}>
                        {PERIODOS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                      </select>
                    </label>
                    <label>
                      <span className="text-xs font-bold text-slate-600">Hora</span>
                      <input type="time" className="w-full border border-slate-200 rounded-lg px-2 py-1.5" value={novaInter.hora}
                        onChange={(e) => setNovaInter((n) => ({ ...n, hora: e.target.value, periodo: e.target.value ? periodoDaHora(e.target.value) : n.periodo }))} />
                    </label>
                    <label>
                      <span className="text-xs font-bold text-slate-600">Veículo</span>
                      <input className="w-full border border-slate-200 rounded-lg px-2 py-1.5 font-mono" inputMode="numeric"
                        placeholder={veiculoNoTexto(novaInter.texto) || "opcional"}
                        value={novaInter.veiculo} onChange={(e) => setNovaInter((n) => ({ ...n, veiculo: e.target.value }))} />
                    </label>
                    <label className="col-span-3 sm:col-span-1">
                      <span className="text-xs font-bold text-slate-600">Outras chapas</span>
                      <input className="w-full border border-slate-200 rounded-lg px-2 py-1.5 font-mono" placeholder="se não estão no texto"
                        value={novaInter.extra} onChange={(e) => setNovaInter((n) => ({ ...n, extra: e.target.value }))} />
                    </label>
                  </div>
                  <textarea rows={3} className="w-full border border-slate-200 rounded-lg px-2 py-1.5"
                    placeholder="O que aconteceu, com a chapa de cada motorista citado"
                    value={novaInter.texto} onChange={(e) => setNovaInter((n) => ({ ...n, texto: e.target.value }))} />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap gap-1 text-xs">
                      {chapasDaNova.length === 0 ? (
                        <span className="text-slate-400">Nenhuma chapa no texto — sem chapa, não vai para o ponto de ninguém.</span>
                      ) : chapasDaNova.map((c) => (
                        <span key={c} className={`px-2 py-0.5 rounded-full font-bold ${nomeDe(c) ? "bg-teal-50 text-teal-800 border border-teal-200" : "bg-amber-50 text-amber-800 border border-amber-200"}`}>
                          {c} · {nomeDe(c) || "não está no cadastro"}
                        </span>
                      ))}
                    </div>
                    <button type="submit" className="px-3 py-2 rounded-xl bg-teal-700 text-white font-bold inline-flex items-center gap-2 hover:bg-teal-600">
                      <FaPlus /> Gravar intercorrência
                    </button>
                  </div>
                </form>
              )}
              {PERIODOS.map((p) => (
                <div key={p.id} className="mb-3">
                  <div className="text-xs font-black uppercase tracking-wide text-teal-700 mb-1">Intercorrências da {p.label.toLowerCase()} · {interPor(p.id).length}</div>
                  {interPor(p.id).length === 0 ? (
                    <div className="text-sm text-slate-400">Nada registrado.</div>
                  ) : (
                    <ul className="space-y-2">
                      {interPor(p.id).map((i) => (
                        <li key={i.id} className="rounded-xl border border-slate-200 p-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="text-sm text-slate-800 whitespace-pre-wrap">
                              {i.hora && <b className="font-mono mr-1">{i.hora}</b>}
                              {i.veiculo && <span className="px-1.5 py-0.5 rounded bg-slate-100 font-mono text-xs mr-1">🚌 {i.veiculo}</span>}
                              {i.texto}
                            </div>
                            {editavel && (apagando === i.id ? (
                              <span className="text-xs font-bold whitespace-nowrap">
                                Remover? <button type="button" className="text-red-700 underline" onClick={() => apagar(TABELA_INTERCORRENCIAS, i.id)}>sim</button>{" "}
                                <button type="button" className="text-slate-500 underline" onClick={() => setApagando("")}>não</button>
                              </span>
                            ) : (
                              <button type="button" title="Remover" className="text-slate-400 hover:text-red-600 p-1" onClick={() => setApagando(i.id)}><FaTrashAlt /></button>
                            ))}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-1 text-[11px]">
                            {(i.chapas || []).map((c) => (
                              <span key={c} className="px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200 font-bold">
                                {c} · {nomeDe(c) || "?"}
                              </span>
                            ))}
                            <span className="text-slate-400 ml-1">{i.criado_por || ""}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </section>

            {/* MALOTES E OBSERVAÇÕES */}
            <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label>
                <span className="text-xs font-black uppercase tracking-wide text-teal-700">Malotes</span>
                <textarea rows={4} disabled={!editavel} key={`mal-${turno?.id || "novo"}-${turno?.atualizado_em || ""}`}
                  className="mt-1 w-full border border-slate-200 rounded-lg px-2 py-1.5 font-mono text-sm disabled:bg-slate-50"
                  placeholder={"MF 3202119\nST 30002393\nGCM 30007663"}
                  defaultValue={turno?.malotes || ""}
                  onBlur={(e) => e.target.value !== (turno?.malotes || "") && salvarCampos({ malotes: e.target.value })} />
              </label>
              <label>
                <span className="text-xs font-black uppercase tracking-wide text-teal-700">Observações do turno</span>
                <textarea rows={4} disabled={!editavel} key={`obs-${turno?.id || "novo"}-${turno?.atualizado_em || ""}`}
                  className="mt-1 w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm disabled:bg-slate-50"
                  defaultValue={turno?.observacoes || ""}
                  onBlur={(e) => e.target.value !== (turno?.observacoes || "") && salvarCampos({ observacoes: e.target.value })} />
              </label>
            </section>
          </div>

          {/* ═══ COLUNA 2: o fechamento, como sai no PNG/PDF ═══ */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 min-w-0">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-black text-slate-800 inline-flex items-center gap-2"><FaDownload /> Fechamento (o que sai no PNG e no PDF)</h2>
            </div>
            <div className="overflow-auto border border-slate-100 rounded-lg">
              <FechamentoTurnoRelatorio
                ref={relatorioRef}
                turno={{ ...(turno || {}), data_referencia: dia }}
                faltas={faltas}
                intercorrencias={inter}
              />
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

// PCM · PASSAGEM DE TURNO DA MANUTENÇÃO — um turno (27/09/2026).
//
// Um turno por tela (dia + diurno/noturno), alimentado ao longo do turno. O que se digita
// vai para três tabelas (ver `passagemTurnoPcm.js`); o bloco da direita é o "Relatório de
// Passagem de Turno" do Word da manutenção — é ele que desce em PNG e PDF.
//
// A PASSAGEM NASCE NO PRIMEIRO LANÇAMENTO, não ao abrir a tela: abrir um turno para olhar
// não cria registro vazio. `garantirPassagem` insere pela chave (dia, turno) na primeira
// gravação; quem chega segundo recebe 23505 e passa a usar o registro do primeiro.
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import {
  FaArrowLeft, FaChevronLeft, FaChevronRight, FaDownload, FaFileImage, FaFilePdf, FaLock,
  FaPlus, FaSyncAlt, FaTrashAlt, FaTools, FaUserTimes, FaExclamationTriangle,
} from "react-icons/fa";
import { supabase } from "../../supabase";
import { AuthContext } from "../../context/AuthContext";
import PCMPassagemRelatorio from "./PCMPassagemRelatorio";
import {
  dataBR, dataPorExtenso, isoLocal, lerMotoristas, normChapa, quemEsta, somaDias, useRelogio,
} from "../operacional/passagemTurno";
import {
  MOTIVOS_AUSENCIA, TABELA_AUSENCIAS, TABELA_LIBERACOES, TABELA_PASSAGENS, TURNOS, aderencia,
  janelaDoTurno, lerEtiquetasDoTurno, lerLiberadosDoPcm, podeEditarPassagem, prazoDaPassagem,
  situacaoDaPassagem, turnoAgora, turnoPorId,
} from "./passagemTurnoPcm";

const hmDe = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
};
const numOuNulo = (v) => {
  const t = String(v ?? "").trim();
  if (!t) return null;
  const n = Number.parseInt(t, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

export default function PCMPassagemDia() {
  const { data: dataParam, turno: turnoParam } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const agora = useRelogio();
  const atual = turnoAgora(agora);
  const dia = /^\d{4}-\d{2}-\d{2}$/.test(String(dataParam || "")) ? dataParam : atual.dia;
  const turno = turnoPorId(turnoParam || atual.turno).id;
  const t = turnoPorId(turno);
  const situacao = situacaoDaPassagem(dia, turno, agora);
  const editavel = podeEditarPassagem(dia, turno, user, agora);
  const eu = quemEsta(user);

  const [passagem, setPassagem] = useState(null);
  const [liberacoes, setLiberacoes] = useState([]);
  const [ausencias, setAusencias] = useState([]);
  const [cadastro, setCadastro] = useState(new Map());
  const [doPcm, setDoPcm] = useState(null); // carros que o PCM liberou na janela
  const [etiquetas, setEtiquetas] = useState(null); // do SOS
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [exportando, setExportando] = useState("");
  const [apagando, setApagando] = useState("");
  const relatorioRef = useRef(null);
  const avisoTimer = useRef(0);

  const mostrar = useCallback((texto) => {
    setAviso(texto);
    window.clearTimeout(avisoTimer.current);
    avisoTimer.current = window.setTimeout(() => setAviso(""), 3500);
  }, []);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro("");
    try {
      const [p, l, a] = await Promise.all([
        supabase.from(TABELA_PASSAGENS).select("*").eq("data_referencia", dia).eq("turno", turno).maybeSingle(),
        supabase.from(TABELA_LIBERACOES).select("*").eq("data_referencia", dia).eq("turno", turno).order("criado_em", { ascending: true }),
        supabase.from(TABELA_AUSENCIAS).select("*").eq("data_referencia", dia).eq("turno", turno).order("criado_em", { ascending: true }),
      ]);
      for (const r of [p, l, a]) if (r.error) throw r.error;
      setPassagem(p.data || null);
      setLiberacoes(l.data || []);
      setAusencias(a.data || []);
    } catch (e) {
      setErro(e?.message || "Não foi possível carregar a passagem de turno.");
    } finally {
      setCarregando(false);
    }
  }, [dia, turno]);
  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => {
    lerMotoristas().then(setCadastro).catch(() => setCadastro(new Map()));
  }, []);

  // a janela do turno: a da passagem, se já tem horário próprio; senão, o padrão
  const inicio = passagem?.turno_inicio || t.inicio;
  const fim = passagem?.turno_fim || t.fim;
  const janela = useMemo(() => janelaDoTurno(dia, inicio, fim), [dia, inicio, fim]);
  const lerSistema = useCallback(() => {
    setDoPcm(null);
    setEtiquetas(null);
    lerLiberadosDoPcm(janela.ini, janela.fim).then(setDoPcm).catch(() => setDoPcm({ erro: true }));
    lerEtiquetasDoTurno(janela.ini, janela.fim).then(setEtiquetas).catch(() => setEtiquetas({ erro: true }));
  }, [janela]);
  useEffect(() => { lerSistema(); }, [lerSistema]);

  const pessoaDe = useCallback((chapa) => cadastro.get(normChapa(chapa)) || null, [cadastro]);

  /* ── a passagem nasce aqui, na primeira gravação ── */
  const garantirPassagem = useCallback(async () => {
    if (passagem?.id) return passagem;
    const ins = await supabase
      .from(TABELA_PASSAGENS)
      .insert({
        data_referencia: dia, turno, turno_inicio: t.inicio, turno_fim: t.fim,
        responsaveis: eu !== "—" ? eu : null, criado_por: eu, atualizado_por: eu,
      })
      .select("*")
      .single();
    let data = ins.data;
    if (ins.error) {
      if (ins.error.code !== "23505") throw ins.error;
      const ja = await supabase.from(TABELA_PASSAGENS).select("*").eq("data_referencia", dia).eq("turno", turno).single();
      if (ja.error) throw ja.error;
      data = ja.data;
    }
    setPassagem(data);
    return data;
  }, [passagem, dia, turno, t.inicio, t.fim, eu]);

  const salvarCampos = useCallback(async (patch) => {
    try {
      const p = await garantirPassagem();
      const { data, error } = await supabase
        .from(TABELA_PASSAGENS)
        .update({ ...patch, atualizado_por: eu, atualizado_em: new Date().toISOString() })
        .eq("id", p.id)
        .select("*")
        .single();
      if (error) throw error;
      setPassagem(data);
      mostrar("Salvo");
    } catch (e) {
      setErro(e?.message || "Não foi possível salvar.");
    }
  }, [garantirPassagem, eu, mostrar]);

  // campo de texto: grava ao sair do campo, e só se mudou
  const salvarTexto = (campo, valor) => {
    const v = String(valor ?? "").trim() || null;
    if (v === (passagem?.[campo] ?? null)) return;
    salvarCampos({ [campo]: v });
  };
  const salvarNumero = (campo, valor) => {
    const v = numOuNulo(valor);
    if (v === (passagem?.[campo] ?? null)) return;
    salvarCampos({ [campo]: v });
  };

  /* ── liberações ── */
  const [novaLib, setNovaLib] = useState({ frota: "", servico: "", veiculo_pcm_id: null });
  const servicoRef = useRef(null);
  const incluirLiberacao = async (e) => {
    e?.preventDefault();
    const frota = novaLib.frota.trim().toUpperCase();
    const servico = novaLib.servico.trim();
    if (!frota) { setErro("Informe o carro."); return; }
    if (!servico) { setErro("Escreva o que foi feito no carro."); return; }
    try {
      const p = await garantirPassagem();
      const { data, error } = await supabase.from(TABELA_LIBERACOES).insert({
        passagem_id: p.id, data_referencia: dia, turno, frota, servico,
        veiculo_pcm_id: novaLib.veiculo_pcm_id || null, criado_por: eu,
      }).select("*").single();
      if (error) throw error;
      setLiberacoes((l) => [...l, data]);
      setNovaLib({ frota: "", servico: "", veiculo_pcm_id: null });
      setErro("");
      mostrar(`Liberação do ${frota} lançada`);
    } catch (err) {
      setErro(err?.message || "Não foi possível lançar a liberação.");
    }
  };
  // um carro do PCM vira o começo de uma liberação: o carro e o defeito, para a pessoa
  // escrever o que FOI FEITO por cima
  const usarDoPcm = (v) => {
    setNovaLib({ frota: String(v.frota || "").trim(), servico: String(v.descricao || "").trim(), veiculo_pcm_id: v.id });
    window.setTimeout(() => servicoRef.current?.focus(), 0);
  };
  const sugestoes = useMemo(() => {
    if (!Array.isArray(doPcm)) return [];
    const ja = new Set(liberacoes.map((l) => l.veiculo_pcm_id).filter(Boolean));
    const frotas = new Set(liberacoes.map((l) => String(l.frota).trim().toUpperCase()));
    return doPcm.filter((v) => !ja.has(v.id) && !frotas.has(String(v.frota).trim().toUpperCase()));
  }, [doPcm, liberacoes]);

  /* ── ausências ── */
  const [novaAus, setNovaAus] = useState({ chapa: "", motivo: "Falta", observacao: "" });
  const pessoaNova = pessoaDe(novaAus.chapa);
  const incluirAusencia = async (e) => {
    e?.preventDefault();
    const chapa = normChapa(novaAus.chapa);
    if (!chapa) { setErro("Informe a chapa de quem faltou."); return; }
    try {
      const p = await garantirPassagem();
      const quem = pessoaDe(chapa);
      const { data, error } = await supabase.from(TABELA_AUSENCIAS).insert({
        passagem_id: p.id, data_referencia: dia, turno, chapa,
        nome: quem?.nome || null, funcao: quem?.cargo || null,
        motivo: novaAus.motivo, observacao: novaAus.observacao.trim() || null, criado_por: eu,
      }).select("*").single();
      if (error) throw error;
      setAusencias((l) => [...l, data]);
      setNovaAus((n) => ({ ...n, chapa: "", observacao: "" }));
      setErro("");
      mostrar(`Ausência de ${data.nome || data.chapa} lançada`);
    } catch (err) {
      setErro(err?.message || "Não foi possível lançar a ausência.");
    }
  };

  const apagar = async (tabela, id) => {
    const { error } = await supabase.from(tabela).delete().eq("id", id);
    if (error) { setErro(error.message); return; }
    if (tabela === TABELA_LIBERACOES) setLiberacoes((l) => l.filter((x) => x.id !== id));
    else setAusencias((l) => l.filter((x) => x.id !== id));
    setApagando("");
    mostrar("Removido");
  };

  /* ── exportar: o relatório vira imagem ──
     Mesma foto da passagem do Operacional: uma cópia vai para um "palco" no canto (0,0) e
     o navegador desenha (`foreignObjectRendering`); se ele recusar, volta o desenho normal. */
  const fotografar = async () => {
    const el = relatorioRef.current;
    if (!el) throw new Error("O relatório ainda não foi desenhado.");
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
  const nomeArquivo = `Passagem_Turno_Manutencao_${dia}_${t.label}`;
  const baixarPNG = async () => {
    setExportando("png");
    try {
      const canvas = await fotografar();
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = `${nomeArquivo}.png`;
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
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const prop = canvas.height / canvas.width;
      let w = 200;
      let h = w * prop;
      if (h > 287) { h = 287; w = h / prop; }
      doc.addImage(canvas.toDataURL("image/png"), "PNG", (210 - w) / 2, 5, w, h, undefined, "FAST");
      doc.save(`${nomeArquivo}.pdf`);
    } catch (e) {
      setErro(e?.message || "Não foi possível gerar o PDF.");
    } finally {
      setExportando("");
    }
  };

  const irPara = (d, tu) => navigate(`/pcm-passagem-turno/${d}/${String(tu).toLowerCase()}`);
  const prazo = prazoDaPassagem(dia);
  const prazoTxt = `10h de ${dataBR(isoLocal(prazo)).slice(0, 5)}`;
  const pct = aderencia(passagem?.previsto, passagem?.atendido);
  const input = "w-full border border-slate-200 rounded-lg px-2 py-1.5 disabled:bg-slate-50";

  return (
    <div className="min-h-screen bg-slate-50 p-4 space-y-4">
      {/* CABEÇALHO */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="min-w-0">
            <Link to="/pcm-passagem-turno" className="text-xs font-bold text-blue-700 inline-flex items-center gap-1">
              <FaArrowLeft /> Todas as passagens
            </Link>
            <h1 className="text-2xl font-black text-slate-800 mt-1">Passagem de turno · Manutenção</h1>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <button type="button" className="p-2 rounded-lg border border-slate-200 hover:bg-slate-100" title="Dia anterior"
                onClick={() => irPara(somaDias(dia, -1), turno)}>
                <FaChevronLeft />
              </button>
              <span className="font-bold text-slate-700">{dataPorExtenso(dia).replace(/^./, (c) => c.toUpperCase())}</span>
              <button type="button" className="p-2 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-30" title="Dia seguinte"
                disabled={dia >= atual.dia}
                onClick={() => irPara(somaDias(dia, 1), turno)}>
                <FaChevronRight />
              </button>
              <div className="inline-flex rounded-xl bg-slate-100 p-1 ml-1">
                {TURNOS.map((x) => (
                  <button key={x.id} type="button" onClick={() => irPara(dia, x.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black transition ${turno === x.id ? "bg-slate-900 text-white shadow" : "text-slate-500 hover:text-slate-800"}`}>
                    {x.label.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => { carregar(); lerSistema(); }} className="px-3 py-2 rounded-xl border border-slate-200 font-bold text-slate-700 inline-flex items-center gap-2 hover:bg-slate-50">
              <FaSyncAlt /> Atualizar
            </button>
            <button type="button" onClick={baixarPNG} disabled={!!exportando} className="px-3 py-2 rounded-xl bg-slate-900 text-white font-bold inline-flex items-center gap-2 hover:bg-slate-700 disabled:opacity-50">
              <FaFileImage /> {exportando === "png" ? "Gerando…" : "Baixar PNG"}
            </button>
            <button type="button" onClick={baixarPDF} disabled={!!exportando} className="px-3 py-2 rounded-xl bg-slate-700 text-white font-bold inline-flex items-center gap-2 hover:bg-slate-600 disabled:opacity-50">
              <FaFilePdf /> {exportando === "pdf" ? "Gerando…" : "Baixar PDF"}
            </button>
          </div>
        </div>
        {situacao === "aberto" && (
          <div className="mt-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-semibold px-3 py-2 inline-flex items-center gap-2">
            Aberto para lançamento até as {prazoTxt}. Depois fica somente para leitura.
          </div>
        )}
        {situacao === "fechado" && (
          <div className="mt-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm font-semibold px-3 py-2 inline-flex items-center gap-2">
            <FaLock /> Somente leitura: o turno ficou aberto até as {prazoTxt}.
            {editavel ? " Você altera por ser Administrador." : " Só o Administrador altera."}
          </div>
        )}
        {situacao === "futuro" && (
          <div className="mt-3 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 text-sm font-semibold px-3 py-2 inline-flex items-center gap-2">
            <FaLock /> Este turno ainda não começou: abre às {t.inicio} de {dataBR(dia).slice(0, 5)}.
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
            {/* TURNO */}
            <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="sm:col-span-2">
                <span className="text-xs font-bold text-slate-600">Responsáveis</span>
                <input disabled={!editavel} className={input} key={`resp-${passagem?.id || "novo"}`}
                  defaultValue={passagem?.responsaveis ?? (eu !== "—" ? eu : "")}
                  placeholder="Quem passa o turno"
                  onBlur={(e) => salvarTexto("responsaveis", e.target.value)} />
              </label>
              <div className="flex items-end gap-2">
                <label className="flex-1">
                  <span className="text-xs font-bold text-slate-600">Início</span>
                  <input type="time" disabled={!editavel} className={input} key={`ini-${passagem?.id || "novo"}-${turno}`}
                    defaultValue={inicio}
                    onBlur={(e) => e.target.value && e.target.value !== inicio && salvarCampos({ turno_inicio: e.target.value })} />
                </label>
                <label className="flex-1">
                  <span className="text-xs font-bold text-slate-600">Fim</span>
                  <input type="time" disabled={!editavel} className={input} key={`fim-${passagem?.id || "novo"}-${turno}`}
                    defaultValue={fim}
                    onBlur={(e) => e.target.value && e.target.value !== fim && salvarCampos({ turno_fim: e.target.value })} />
                </label>
              </div>
            </section>

            {/* 1. ALERTA */}
            <section className="bg-red-50 rounded-2xl border border-red-200 shadow-sm p-4">
              <h2 className="font-black text-red-700 inline-flex items-center gap-2 mb-2"><FaExclamationTriangle /> 1. Atenção especial / alerta prioritário</h2>
              <textarea rows={3} disabled={!editavel} key={`alerta-${passagem?.id || "novo"}-${passagem?.atualizado_em || ""}`}
                className="w-full border border-red-200 rounded-lg px-2 py-1.5 bg-white disabled:bg-red-50/40"
                placeholder="O que o próximo turno PRECISA saber primeiro (carro que não pode sair, peça que chega, serviço pela metade…)"
                defaultValue={passagem?.alerta || ""}
                onBlur={(e) => salvarTexto("alerta", e.target.value)} />
            </section>

            {/* 2. LIBERAÇÕES */}
            <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
              <h2 className="font-black text-slate-800 inline-flex items-center gap-2 mb-3"><FaTools /> 2. Liberações concluídas · {liberacoes.length}</h2>
              {editavel && (
                <form onSubmit={incluirLiberacao} className="grid grid-cols-4 sm:grid-cols-6 gap-2 items-end mb-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <label className="col-span-1">
                    <span className="text-xs font-bold text-slate-600">Carro</span>
                    <input className={`${input} font-mono`} placeholder="222235" value={novaLib.frota}
                      onChange={(e) => setNovaLib((n) => ({ ...n, frota: e.target.value, veiculo_pcm_id: null }))} />
                  </label>
                  <label className="col-span-3 sm:col-span-4">
                    <span className="text-xs font-bold text-slate-600">O que foi feito</span>
                    <input ref={servicoRef} className={input} placeholder="Trocada a abraçadeira do radiador" value={novaLib.servico}
                      onChange={(e) => setNovaLib((n) => ({ ...n, servico: e.target.value }))} />
                  </label>
                  <button type="submit" className="col-span-4 sm:col-span-1 px-3 py-2 rounded-xl bg-slate-900 text-white font-bold inline-flex items-center justify-center gap-2 hover:bg-slate-700">
                    <FaPlus /> Lançar
                  </button>
                </form>
              )}
              {liberacoes.length === 0 ? (
                <div className="text-sm text-slate-400 mb-2">Nenhuma liberação lançada.</div>
              ) : (
                <ul className="divide-y divide-slate-100 mb-2">
                  {liberacoes.map((l) => (
                    <li key={l.id} className="py-1.5 flex items-start justify-between gap-2 text-sm">
                      <div><b className="font-mono mr-2">{l.frota}</b>{l.servico}</div>
                      {editavel && (apagando === l.id ? (
                        <span className="text-xs font-bold whitespace-nowrap">
                          Remover? <button type="button" className="text-red-700 underline" onClick={() => apagar(TABELA_LIBERACOES, l.id)}>sim</button>{" "}
                          <button type="button" className="text-slate-500 underline" onClick={() => setApagando("")}>não</button>
                        </span>
                      ) : (
                        <button type="button" title="Remover" className="text-slate-400 hover:text-red-600 p-1" onClick={() => setApagando(l.id)}><FaTrashAlt /></button>
                      ))}
                    </li>
                  ))}
                </ul>
              )}
              {/* o que o PCM liberou na janela e ainda não está na lista */}
              <div className="mt-2 rounded-xl border border-dashed border-slate-300 p-3">
                <div className="text-xs font-black uppercase tracking-wide text-slate-500 mb-1">
                  Liberados no PCM neste turno {Array.isArray(doPcm) ? `· ${sugestoes.length}` : ""}
                </div>
                {!doPcm ? (
                  <div className="text-sm text-slate-400">Lendo o PCM…</div>
                ) : doPcm.erro ? (
                  <div className="text-sm text-red-600 font-semibold">Não foi possível ler o PCM.</div>
                ) : !sugestoes.length ? (
                  <div className="text-sm text-slate-400">
                    {doPcm.length ? "Todos os carros liberados no PCM já estão na lista." : "O PCM não liberou nenhum carro nesta janela."}
                  </div>
                ) : (
                  <ul className="space-y-1">
                    {sugestoes.map((v) => (
                      <li key={v.id} className="flex items-center justify-between gap-2 text-sm">
                        <div className="min-w-0">
                          <b className="font-mono mr-2">{v.frota}</b>
                          <span className="text-slate-600">{v.descricao || "—"}</span>
                          <span className="text-xs text-slate-400"> · liberado {hmDe(v.data_saida)}{v.liberado_por ? ` por ${v.liberado_por}` : ""}</span>
                        </div>
                        {editavel && (
                          <button type="button" onClick={() => usarDoPcm(v)} className="shrink-0 whitespace-nowrap px-2 py-1 rounded-lg border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100">
                            + usar
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            {/* 3. ETIQUETAS */}
            <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
                <h2 className="font-black text-slate-800">3. Gestão de etiquetas</h2>
                <span className="text-xs text-slate-500">automático, do módulo de SOS · janela {inicio}–{fim}</span>
              </div>
              {!etiquetas ? (
                <div className="text-sm text-slate-400">Lendo o SOS…</div>
              ) : etiquetas.erro ? (
                <div className="text-sm text-red-600 font-semibold">Não foi possível ler o SOS.</div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-3">
                  {[
                    ["Abertas no turno", etiquetas.abertas.length, "#dc2626"],
                    ["Fechadas no turno", etiquetas.fechadas.length, "#059669"],
                    ["Tratadas no turno", etiquetas.tratadas.length, "#2563eb"],
                    ["Em aberto (fila)", etiquetas.emAberto.length, "#d97706"],
                    ["Em andamento", etiquetas.emAndamento.length, "#475569"],
                  ].map(([rot, n, cor]) => (
                    <div key={rot} className="rounded-xl border border-slate-200 p-2" style={{ borderTop: `4px solid ${cor}` }}>
                      <div className="text-[11px] font-bold uppercase text-slate-500">{rot}</div>
                      <div className="text-2xl font-black text-slate-800">{n}</div>
                    </div>
                  ))}
                </div>
              )}
              <textarea rows={2} disabled={!editavel} key={`etq-${passagem?.id || "novo"}-${passagem?.atualizado_em || ""}`}
                className={input} placeholder="Observação sobre as etiquetas (opcional)"
                defaultValue={passagem?.etiquetas_obs || ""}
                onBlur={(e) => salvarTexto("etiquetas_obs", e.target.value)} />
            </section>

            {/* 4. AUSÊNCIAS */}
            <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
              <h2 className="font-black text-slate-800 inline-flex items-center gap-2 mb-3"><FaUserTimes /> 4. Controle de ausências · {ausencias.length}</h2>
              {editavel && (
                <form onSubmit={incluirAusencia} className="grid grid-cols-2 sm:grid-cols-6 gap-2 items-end mb-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <label className="col-span-1">
                    <span className="text-xs font-bold text-slate-600">Chapa</span>
                    <input className={`${input} font-mono`} inputMode="numeric" placeholder="30061096" value={novaAus.chapa}
                      onChange={(e) => setNovaAus((n) => ({ ...n, chapa: e.target.value }))} />
                  </label>
                  <label className="col-span-1 sm:col-span-2">
                    <span className="text-xs font-bold text-slate-600">Motivo</span>
                    <select className={input} value={novaAus.motivo} onChange={(e) => setNovaAus((n) => ({ ...n, motivo: e.target.value }))}>
                      {MOTIVOS_AUSENCIA.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </label>
                  <label className="col-span-2 sm:col-span-2">
                    <span className="text-xs font-bold text-slate-600">Observação</span>
                    <input className={input} placeholder="opcional" value={novaAus.observacao}
                      onChange={(e) => setNovaAus((n) => ({ ...n, observacao: e.target.value }))} />
                  </label>
                  <button type="submit" className="col-span-2 sm:col-span-1 px-3 py-2 rounded-xl bg-slate-900 text-white font-bold inline-flex items-center justify-center gap-2 hover:bg-slate-700">
                    <FaPlus /> Lançar
                  </button>
                  <div className="col-span-2 sm:col-span-6 text-xs min-h-[16px]">
                    {normChapa(novaAus.chapa) && (pessoaNova
                      ? <span className="text-slate-500"><b className="text-slate-700">{pessoaNova.nome}</b>{pessoaNova.cargo ? ` · ${pessoaNova.cargo}` : ""}</span>
                      : <span className="text-amber-700 font-bold">chapa {normChapa(novaAus.chapa)} não está no cadastro de funcionários — confira</span>)}
                  </div>
                </form>
              )}
              {ausencias.length === 0 ? (
                <div className="text-sm text-slate-400">Nenhuma ausência lançada.</div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {ausencias.map((a) => (
                    <li key={a.id} className="py-1.5 flex items-start justify-between gap-2 text-sm">
                      <div>
                        <b>{a.nome || a.chapa}</b>
                        {a.nome && <span className="font-mono text-slate-500 ml-1">{a.chapa}</span>}
                        {a.funcao && <span className="text-slate-500"> · {a.funcao}</span>}
                        <span className="ml-2 px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold">{a.motivo}</span>
                        {a.observacao && <span className="text-slate-500"> · {a.observacao}</span>}
                      </div>
                      {editavel && (apagando === a.id ? (
                        <span className="text-xs font-bold whitespace-nowrap">
                          Remover? <button type="button" className="text-red-700 underline" onClick={() => apagar(TABELA_AUSENCIAS, a.id)}>sim</button>{" "}
                          <button type="button" className="text-slate-500 underline" onClick={() => setApagando("")}>não</button>
                        </span>
                      ) : (
                        <button type="button" title="Remover" className="text-slate-400 hover:text-red-600 p-1" onClick={() => setApagando(a.id)}><FaTrashAlt /></button>
                      ))}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* 5. DESVIOS */}
            <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
              <h2 className="font-black text-slate-800 mb-2">5. Desvios / ocorrências do turno</h2>
              <textarea rows={4} disabled={!editavel} key={`desv-${passagem?.id || "novo"}-${passagem?.atualizado_em || ""}`}
                className={input} placeholder="O que saiu do previsto: serviço refeito, peça errada, acidente na oficina, falta de ferramenta…"
                defaultValue={passagem?.desvios || ""}
                onBlur={(e) => salvarTexto("desvios", e.target.value)} />
            </section>

            {/* 6. ADERÊNCIA */}
            <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
              <h2 className="font-black text-slate-800 mb-3">6. Indicador de aderência (previsto x liberado)</h2>
              <div className="grid grid-cols-3 gap-3 items-end">
                <label>
                  <span className="text-xs font-bold text-slate-600">Previsto</span>
                  <input type="number" min="0" inputMode="numeric" disabled={!editavel} className={`${input} font-bold`}
                    key={`prev-${passagem?.id || "novo"}-${passagem?.previsto ?? ""}`} defaultValue={passagem?.previsto ?? ""}
                    onBlur={(e) => salvarNumero("previsto", e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} />
                </label>
                <label>
                  <span className="text-xs font-bold text-slate-600">Atendido</span>
                  <input type="number" min="0" inputMode="numeric" disabled={!editavel} className={`${input} font-bold`}
                    key={`atend-${passagem?.id || "novo"}-${passagem?.atendido ?? ""}`} defaultValue={passagem?.atendido ?? ""}
                    onBlur={(e) => salvarNumero("atendido", e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} />
                </label>
                <div className="rounded-xl border border-slate-200 p-2 text-center">
                  <div className="text-[11px] font-bold uppercase text-slate-500">Aderência</div>
                  <div className={`text-2xl font-black ${pct == null ? "text-slate-300" : pct >= 100 ? "text-emerald-600" : pct >= 80 ? "text-amber-600" : "text-red-600"}`}>
                    {pct == null ? "—" : `${pct}%`}
                  </div>
                </div>
              </div>
              {editavel && liberacoes.length > 0 && Number(passagem?.atendido) !== liberacoes.length && (
                <button type="button" onClick={() => salvarCampos({ atendido: liberacoes.length })}
                  className="mt-2 text-xs font-bold text-blue-700 underline">
                  usar as {liberacoes.length} liberações lançadas como atendido
                </button>
              )}
            </section>
          </div>

          {/* ═══ COLUNA 2: o relatório, como sai no PNG/PDF ═══ */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 min-w-0">
            <h2 className="font-black text-slate-800 inline-flex items-center gap-2 mb-2"><FaDownload /> Relatório (o que sai no PNG e no PDF)</h2>
            <div className="overflow-auto border border-slate-100 rounded-lg">
              <PCMPassagemRelatorio
                ref={relatorioRef}
                passagem={passagem}
                dia={dia}
                turno={turno}
                liberacoes={liberacoes}
                ausencias={ausencias}
                etiquetas={etiquetas && !etiquetas.erro ? etiquetas : null}
              />
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

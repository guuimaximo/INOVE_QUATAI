import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaBarcode,
  FaCamera,
  FaCheck,
  FaChevronRight,
  FaDownload,
  FaRedo,
  FaRobot,
  FaSearch,
  FaTimes,
} from "react-icons/fa";
import { AuthContext } from "../../context/AuthContext";
import { supabase } from "../../supabase";
import {
  ActionButton,
  EmptyState,
  KpiCard,
  PageHero,
  Panel,
  StatusChip,
} from "./SuprimentosUI";
import { formatDateBR, formatDateTimeBR } from "./suprimentosShared";

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100";

function Field({ label, required = false, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
        {required ? <span className="ml-1 text-rose-500">*</span> : null}
      </span>
      {children}
    </label>
  );
}

function diffTone(diff) {
  if (diff === null || diff === undefined) return "slate";
  if (Number(diff) === 0) return "emerald";
  return Number(diff) > 0 ? "amber" : "rose";
}

/* ─── Scanner ─────────────────────────────────────────────── */
function BarcodeScanner({ open, onClose, onScan }) {
  const videoRef = useRef(null);
  const controlsRef = useRef(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const reader = new BrowserMultiFormatReader();
        const devices = await BrowserMultiFormatReader.listVideoInputDevices();
        const back = devices.find((d) => /back|rear|environment/i.test(d.label)) || devices[devices.length - 1];
        const deviceId = back?.deviceId;
        if (cancelled) return;
        const controls = await reader.decodeFromVideoDevice(
          deviceId,
          videoRef.current,
          (result, _err, ctrl) => {
            if (cancelled) return;
            if (result) {
              const text = result.getText();
              ctrl.stop();
              controlsRef.current = null;
              onScan(text);
            }
          }
        );
        controlsRef.current = controls;
      } catch (err) {
        setError(err?.message || "Não consegui acessar a câmera.");
      }
    })();

    return () => {
      cancelled = true;
      try { controlsRef.current?.stop?.(); } catch {}
      controlsRef.current = null;
    };
  }, [open, onScan]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex flex-col bg-slate-950/90">
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 text-white">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-blue-300">Contagem</p>
          <h2 className="text-lg font-semibold">Apontar para o código de barras</h2>
        </div>
        <button
          onClick={() => { try { controlsRef.current?.stop?.(); } catch {} onClose(); }}
          className="rounded-xl border border-white/20 px-3 py-2 text-sm font-semibold text-white hover:bg-white/10"
        >
          <FaTimes className="inline" /> Fechar
        </button>
      </div>
      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-32 w-72 rounded-2xl border-2 border-blue-400/80 shadow-[0_0_0_9999px_rgba(2,6,23,0.55)]" />
        </div>
        {error ? (
          <div className="absolute inset-x-4 bottom-6 rounded-xl bg-rose-500/90 px-4 py-3 text-sm font-semibold text-white">
            {error}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ─── Página ──────────────────────────────────────────────── */
export default function SuprimentosContagem() {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const userInfo = useMemo(() => ({
    id: Number(user?.usuario_id || user?.id || 0) || null,
    login: user?.login || user?.email || null,
    nome: user?.nome || user?.nome_completo || user?.login || user?.email || "Usuario",
  }), [user]);

  // ─── Form de novo apontamento ──────────────────────────────
  const [codigo, setCodigo] = useState("");
  const [peca, setPeca] = useState(null);
  const [naoCadastrado, setNaoCadastrado] = useState(false);
  const [quantidade, setQuantidade] = useState("");
  const [observacao, setObservacao] = useState("");
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);

  const codigoInputRef = useRef(null);
  const qtdInputRef = useRef(null);

  async function buscarPeca(codigoBusca) {
    const c = String(codigoBusca || "").trim();
    if (!c) { setPeca(null); setNaoCadastrado(false); return; }
    setBusy(true); setErro(""); setAviso("");
    const { data, error } = await supabase
      .from("suprimentos_pecas")
      .select("id, codigo, descricao, unidade_padrao, localizacao, estoque_min, estoque_max, saldo_erp")
      .or(`codigo.eq.${c},ref_fabricante.eq.${c}`)
      .limit(1)
      .maybeSingle();
    setBusy(false);
    if (error) { setErro(error.message); setPeca(null); setNaoCadastrado(false); return; }
    if (!data) {
      setPeca(null);
      setNaoCadastrado(true);
      setAviso(`Código ${c} não está na base. Pode contar mesmo assim — vai aparecer como pendente.`);
      setTimeout(() => qtdInputRef.current?.focus(), 50);
      return;
    }
    setPeca(data);
    setNaoCadastrado(false);
    setTimeout(() => qtdInputRef.current?.focus(), 50);
  }

  async function salvarContagem() {
    const codigoTrim = codigo.trim();
    if (!codigoTrim) { setErro("Informe o código contado."); return; }
    if (quantidade === "" || Number.isNaN(Number(quantidade))) { setErro("Informe uma quantidade válida."); return; }
    setBusy(true); setErro("");
    const qtd = Number(quantidade);
    const saldoErp = peca?.saldo_erp ?? null;
    const diff = saldoErp !== null && saldoErp !== undefined ? qtd - Number(saldoErp) : null;
    const payload = {
      peca_id: peca?.id || null,
      codigo: peca?.codigo || codigoTrim,
      descricao: peca?.descricao || "Sem cadastro",
      localizacao: peca?.localizacao || null,
      unidade: peca?.unidade_padrao || null,
      quantidade: qtd,
      saldo_erp: saldoErp,
      diferenca: diff,
      observacao: observacao.trim() || null,
      contado_por_id: userInfo.id,
      contado_por_login: userInfo.login,
      contado_por_nome: userInfo.nome,
    };
    const { error } = await supabase.from("suprimentos_contagens").insert(payload);
    setBusy(false);
    if (error) { setErro(error.message); return; }
    setCodigo(""); setPeca(null); setNaoCadastrado(false); setQuantidade(""); setObservacao(""); setAviso("");
    setTimeout(() => codigoInputRef.current?.focus(), 50);
    carregarLotes();
  }

  function handleScan(text) {
    setScannerOpen(false);
    setCodigo(text);
    buscarPeca(text);
  }

  // ─── Lotes (Diária = dia / Semanal = par de domingos) ─────
  const [tab, setTab] = useState("diaria");
  const [lotesDiarios, setLotesDiarios] = useState([]);
  const [lotesSemanais, setLotesSemanais] = useState([]);
  const [loadingLotes, setLoadingLotes] = useState(true);

  async function carregarLotes() {
    setLoadingLotes(true);
    const [contagensRes, auditoriasRes] = await Promise.all([
      supabase.from("suprimentos_contagens")
        .select("id,codigo,quantidade,saldo_erp,diferenca,peca_id,created_at,contado_por_nome")
        .order("created_at", { ascending: false })
        .limit(5000),
      supabase.from("suprimentos_auditorias")
        .select("*")
        .eq("tipo", "semanal")
        .order("data_fim", { ascending: false })
        .limit(50),
    ]);
    const contagens = contagensRes.data || [];
    setLotesSemanais(auditoriasRes.data || []);

    // Agrupa por dia (YYYY-MM-DD em BRT — usando created_at)
    const byDay = new Map();
    contagens.forEach((c) => {
      const d = new Date(c.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const cur = byDay.get(key) || { data: key, total: 0, divergencias: 0, sem_cadastro: 0, sem_conferir: 0, contadores: new Set() };
      cur.total += 1;
      if (!c.peca_id) cur.sem_cadastro += 1;
      if (c.saldo_erp === null || c.saldo_erp === undefined) cur.sem_conferir += 1;
      else if (Number(c.diferenca) !== 0) cur.divergencias += 1;
      if (c.contado_por_nome) cur.contadores.add(c.contado_por_nome);
      byDay.set(key, cur);
    });
    const lotes = Array.from(byDay.values()).map((l) => ({ ...l, contadores: Array.from(l.contadores) }));
    lotes.sort((a, b) => (a.data < b.data ? 1 : -1));
    setLotesDiarios(lotes);
    setLoadingLotes(false);
  }

  useEffect(() => { carregarLotes(); }, []);

  // ─── KPIs ──────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const total = lotesDiarios.reduce((sum, l) => sum + l.total, 0);
    const hoje = new Date();
    const hojeKey = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
    const hojeLote = lotesDiarios.find((l) => l.data === hojeKey);
    const divergencia = lotesDiarios.reduce((sum, l) => sum + l.divergencias, 0);
    const sem_cadastro = lotesDiarios.reduce((sum, l) => sum + l.sem_cadastro, 0);
    return { total, hojeCount: hojeLote?.total || 0, divergencia, sem_cadastro };
  }, [lotesDiarios]);

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHero
        eyebrow="Suprimentos · Contagem"
        title="Contagem de Itens"
        description="Aponte o código de barras ou digite o código para registrar a contagem física da peça."
        actions={
          <ActionButton tone="blue" onClick={() => setScannerOpen(true)}>
            <FaCamera /> Escanear código
          </ActionButton>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Contagens totais" value={kpis.total} subtitle="Registradas no histórico" icon={<FaBarcode />} tone="blue" />
        <KpiCard title="Contadas hoje" value={kpis.hojeCount} subtitle="Itens apontados no dia atual" icon={<FaCheck />} tone="cyan" />
        <KpiCard title="Com divergência" value={kpis.divergencia} subtitle="Quantidade diferente do ERP" icon={<FaRedo />} tone="amber" />
        <KpiCard title="Sem cadastro" value={kpis.sem_cadastro} subtitle="Códigos contados que não estão na base" icon={<FaTimes />} tone="rose" />
      </section>

      <Panel title="Registrar contagem" subtitle="Cada apontamento gera um registro independente.">
        <div className="grid gap-4 md:grid-cols-[1fr_1fr_0.6fr_1fr]">
          <Field label="Código" required>
            <div className="flex gap-2">
              <input
                ref={codigoInputRef}
                className={inputClass}
                placeholder="Digite ou escaneie"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); buscarPeca(codigo); } }}
                autoFocus
              />
              <button
                type="button"
                onClick={() => buscarPeca(codigo)}
                disabled={busy || !codigo.trim()}
                className="rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <FaSearch />
              </button>
              <button
                type="button"
                onClick={() => setScannerOpen(true)}
                className="rounded-xl border border-blue-200 bg-blue-50 px-4 text-sm font-semibold text-blue-700 hover:bg-blue-100"
                title="Escanear pela câmera"
              >
                <FaCamera />
              </button>
            </div>
          </Field>

          <Field label="Peça">
            <input
              className={inputClass}
              value={peca?.descricao || (naoCadastrado ? "Sem cadastro (será apontado na central)" : "")}
              placeholder="Aguardando código..."
              readOnly
            />
          </Field>

          <Field label="Quantidade contada" required>
            <input
              ref={qtdInputRef}
              type="number"
              min="0"
              step="0.01"
              className={inputClass}
              placeholder="0"
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); salvarContagem(); } }}
              disabled={!peca && !naoCadastrado}
            />
          </Field>

          <Field label="Observação">
            <input
              className={inputClass}
              placeholder="opcional"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
            />
          </Field>
        </div>

        {aviso ? (
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700">{aviso}</p>
        ) : null}
        {erro ? (
          <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700">{erro}</p>
        ) : null}

        <div className="mt-4 flex flex-wrap justify-end gap-3">
          <ActionButton onClick={() => { setCodigo(""); setPeca(null); setNaoCadastrado(false); setQuantidade(""); setObservacao(""); setErro(""); setAviso(""); }}>
            Limpar
          </ActionButton>
          <ActionButton tone="emerald" onClick={salvarContagem} disabled={busy || quantidade === "" || (!peca && !naoCadastrado)}>
            <FaCheck /> Salvar contagem
          </ActionButton>
        </div>
      </Panel>

      <Panel
        title="Lotes de contagem"
        subtitle="Cada lote agrupa as contagens daquele período. Clique para ver o detalhe."
        actions={
          <div className="flex gap-2">
            {[
              { key: "diaria", label: "Diária" },
              { key: "semanal", label: "Semanal" },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${tab === t.key ? "bg-blue-600 text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-100"}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        }
      >
        {loadingLotes ? (
          <p className="py-12 text-center text-sm font-semibold text-slate-400">Carregando...</p>
        ) : tab === "diaria" ? (
          lotesDiarios.length === 0 ? (
            <EmptyState title="Sem lotes diários" subtitle="Faça a primeira contagem para abrir um lote." />
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50">
                  <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-3">Data</th>
                    <th className="px-4 py-3 text-right">Itens contados</th>
                    <th className="px-4 py-3 text-right">Divergências</th>
                    <th className="px-4 py-3 text-right">Sem cadastro</th>
                    <th className="px-4 py-3 text-right">Pendentes</th>
                    <th className="px-4 py-3">Contadores</th>
                    <th className="px-4 py-3 text-right"></th>
                  </tr>
                </thead>
                <tbody>
                  {lotesDiarios.map((l) => (
                    <tr
                      key={l.data}
                      onClick={() => navigate(`/suprimentos/contagem/dia/${l.data}`)}
                      className="cursor-pointer border-t border-slate-100 transition hover:bg-blue-50/60"
                    >
                      <td className="px-4 py-3 font-semibold text-slate-900">{formatDateBR(l.data)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-700">{l.total}</td>
                      <td className="px-4 py-3 text-right">
                        {l.divergencias > 0 ? <StatusChip label={String(l.divergencias)} tone="amber" /> : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {l.sem_cadastro > 0 ? <StatusChip label={String(l.sem_cadastro)} tone="rose" /> : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {l.sem_conferir > 0 ? <StatusChip label={String(l.sem_conferir)} tone="slate" /> : <StatusChip label="Conferido" tone="emerald" />}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {l.contadores.slice(0, 3).join(", ")}{l.contadores.length > 3 ? ` +${l.contadores.length - 3}` : ""}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-400">
                        <FaChevronRight />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          lotesSemanais.length === 0 ? (
            <EmptyState title="Sem auditorias semanais" subtitle="O bot semanal roda toda segunda 03h. Você também pode disparar manual em GitHub Actions." />
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50">
                  <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-3">Período</th>
                    <th className="px-4 py-3 text-right">Itens</th>
                    <th className="px-4 py-3 text-right">Corretos</th>
                    <th className="px-4 py-3 text-right">Errados</th>
                    <th className="px-4 py-3 text-right">Sem contagem</th>
                    <th className="px-4 py-3">Quando</th>
                    <th className="px-4 py-3 text-right"></th>
                  </tr>
                </thead>
                <tbody>
                  {lotesSemanais.map((a) => {
                    const r = a.resumo_json || {};
                    return (
                      <tr
                        key={a.id}
                        onClick={() => navigate(`/suprimentos/contagem/semanal/${a.id}`)}
                        className="cursor-pointer border-t border-slate-100 transition hover:bg-blue-50/60"
                      >
                        <td className="px-4 py-3 font-semibold text-slate-900">
                          {formatDateBR(a.data_inicio)} → {formatDateBR(a.data_fim)}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-700">{r.itens_total ?? "—"}</td>
                        <td className="px-4 py-3 text-right text-emerald-700">{r.itens_corretos ?? "—"}</td>
                        <td className="px-4 py-3 text-right text-rose-700">{r.itens_errados ?? "—"}</td>
                        <td className="px-4 py-3 text-right text-slate-500">{r.itens_sem_contagem ?? "—"}</td>
                        <td className="px-4 py-3 text-xs text-slate-500">{formatDateTimeBR(a.created_at)}</td>
                        <td className="px-4 py-3 text-right text-slate-400">
                          {a.excel_url ? (
                            <a href={a.excel_url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 text-blue-600 hover:underline">
                              <FaDownload /> Excel
                            </a>
                          ) : <FaChevronRight />}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        )}
      </Panel>

      <BarcodeScanner open={scannerOpen} onClose={() => setScannerOpen(false)} onScan={handleScan} />
    </div>
  );
}

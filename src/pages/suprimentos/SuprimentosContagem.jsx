import { useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  FaBarcode,
  FaCamera,
  FaCheck,
  FaRedo,
  FaSearch,
  FaTimes,
  FaTrashAlt,
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
import { formatDateTimeBR } from "./suprimentosShared";

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

function diffLabel(diff) {
  if (diff === null || diff === undefined) return "Sem saldo ERP";
  const n = Number(diff);
  if (n === 0) return "Bate com ERP";
  if (n > 0) return `+${n.toLocaleString("pt-BR")} (sobra)`;
  return `${n.toLocaleString("pt-BR")} (falta)`;
}

/* ─── Scanner via @zxing/browser ─────────────────────────────── */
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
          (result, err, ctrl) => {
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

/* ─── Página principal ───────────────────────────────────────── */
export default function SuprimentosContagem() {
  const { user } = useContext(AuthContext);
  const userInfo = useMemo(() => ({
    id: Number(user?.usuario_id || user?.id || 0) || null,
    login: user?.login || user?.email || null,
    nome: user?.nome || user?.nome_completo || user?.login || user?.email || "Usuario",
  }), [user]);

  const [codigo, setCodigo] = useState("");
  const [peca, setPeca] = useState(null);
  const [naoCadastrado, setNaoCadastrado] = useState(false);
  const [quantidade, setQuantidade] = useState("");
  const [observacao, setObservacao] = useState("");
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);

  const [contagens, setContagens] = useState([]);
  const [loadingHist, setLoadingHist] = useState(true);
  const [busca, setBusca] = useState("");

  const codigoInputRef = useRef(null);
  const qtdInputRef = useRef(null);

  async function carregarContagens() {
    setLoadingHist(true);
    const { data } = await supabase
      .from("suprimentos_contagens")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    setContagens(data || []);
    setLoadingHist(false);
  }

  useEffect(() => { carregarContagens(); }, []);

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
      // Sem cadastro — deixa contar do mesmo jeito, marca para a central
      setPeca(null);
      setNaoCadastrado(true);
      setAviso(`Código ${c} não está na base. Pode contar mesmo assim — vai aparecer na central como pendente de cadastro.`);
      setTimeout(() => qtdInputRef.current?.focus(), 50);
      return;
    }
    setPeca(data);
    setNaoCadastrado(false);
    setTimeout(() => qtdInputRef.current?.focus(), 50);
  }

  async function salvarContagem() {
    const codigoTrim = codigo.trim();
    if (!peca && !naoCadastrado) {
      // se o usuário só digitou e nem buscou ainda, tenta resolver agora
      if (codigoTrim) await buscarPeca(codigoTrim);
    }
    if (!codigoTrim) { setErro("Informe o código contado."); return; }
    if (quantidade === "" || Number.isNaN(Number(quantidade))) {
      setErro("Informe uma quantidade válida.");
      return;
    }
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
    setCodigo("");
    setPeca(null);
    setNaoCadastrado(false);
    setQuantidade("");
    setObservacao("");
    setAviso("");
    setTimeout(() => codigoInputRef.current?.focus(), 50);
    carregarContagens();
  }

  async function excluir(id) {
    if (!window.confirm("Remover esta contagem?")) return;
    const { error } = await supabase.from("suprimentos_contagens").delete().eq("id", id);
    if (error) { alert(error.message); return; }
    carregarContagens();
  }

  function handleScan(text) {
    setScannerOpen(false);
    setCodigo(text);
    buscarPeca(text);
  }

  const filtered = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return contagens;
    return contagens.filter((c) =>
      [c.codigo, c.descricao, c.localizacao, c.contado_por_nome].some((v) => String(v || "").toLowerCase().includes(q))
    );
  }, [contagens, busca]);

  const kpis = useMemo(() => {
    const total = contagens.length;
    const hoje = new Date().toDateString();
    const hojeCount = contagens.filter((c) => new Date(c.created_at).toDateString() === hoje).length;
    const divergencia = contagens.filter((c) => c.diferenca !== null && Number(c.diferenca) !== 0).length;
    const semCadastro = contagens.filter((c) => !c.peca_id).length;
    return { total, hojeCount, divergencia, semCadastro };
  }, [contagens]);

  const [filtroPendentes, setFiltroPendentes] = useState(false);
  const visiveis = useMemo(() => filtroPendentes ? filtered.filter((c) => !c.peca_id) : filtered, [filtered, filtroPendentes]);

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
        <KpiCard title="Contadas hoje" value={kpis.hojeCount} subtitle="Itens apontados nas últimas 24h" icon={<FaCheck />} tone="cyan" />
        <KpiCard title="Com divergência" value={kpis.divergencia} subtitle="Quantidade diferente do ERP" icon={<FaRedo />} tone="amber" />
        <KpiCard title="Sem cadastro" value={kpis.semCadastro} subtitle="Códigos contados que não estão na base" icon={<FaTimes />} tone="rose" />
      </section>

      <Panel title="Registrar contagem" subtitle="Cada apontamento gera um registro independente, sem alterar nada do que já existe.">
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

        {peca ? (
          <div className="mt-4 grid gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-4 md:grid-cols-4">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Localização</p>
              <p className="mt-0.5 text-sm font-semibold text-slate-800">{peca.localizacao || "—"}</p>
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Estoque mín / máx</p>
              <p className="mt-0.5 text-sm font-semibold text-slate-800">
                {peca.estoque_min ?? "—"} / {peca.estoque_max ?? "—"}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Saldo ERP</p>
              <p className="mt-0.5 text-sm font-semibold text-slate-800">
                {peca.saldo_erp !== null && peca.saldo_erp !== undefined ? Number(peca.saldo_erp).toLocaleString("pt-BR") : "—"}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Unidade</p>
              <p className="mt-0.5 text-sm font-semibold text-slate-800">{peca.unidade_padrao || "un"}</p>
            </div>
          </div>
        ) : null}

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
        title="Central de contagens"
        subtitle="Últimos 200 apontamentos. Itens sem cadastro ficam destacados para tratamento."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setFiltroPendentes((v) => !v)}
              className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${filtroPendentes ? "border-rose-300 bg-rose-50 text-rose-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"}`}
            >
              {filtroPendentes ? "Mostrando só sem cadastro" : "Filtrar sem cadastro"}
            </button>
            <label className="relative block w-full sm:w-72">
              <FaSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar código, peça, usuário..."
                className={`${inputClass} pl-11`}
              />
            </label>
          </div>
        }
      >
        {loadingHist ? (
          <p className="py-12 text-center text-sm font-semibold text-slate-400">Carregando histórico...</p>
        ) : visiveis.length === 0 ? (
          <EmptyState title="Sem contagens" subtitle={filtroPendentes ? "Nada pendente — todas as contagens estão com cadastro." : "Aponte o primeiro código de barras para começar."} />
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Quando</th>
                  <th className="px-4 py-3">Código</th>
                  <th className="px-4 py-3">Peça</th>
                  <th className="px-4 py-3">Localização</th>
                  <th className="px-4 py-3 text-right">Qtd contada</th>
                  <th className="px-4 py-3 text-right">Saldo ERP</th>
                  <th className="px-4 py-3">Divergência</th>
                  <th className="px-4 py-3">Contado por</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {visiveis.map((c) => (
                  <tr key={c.id} className={`border-t border-slate-100 hover:bg-slate-50/60 ${!c.peca_id ? "bg-rose-50/40" : ""}`}>
                    <td className="px-4 py-3 text-xs font-medium text-slate-500">{formatDateTimeBR(c.created_at)}</td>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-700">{c.codigo || "—"}</td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">{c.descricao || "—"}</p>
                      {!c.peca_id ? (
                        <span className="mt-1 inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-700">
                          Sem cadastro
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{c.localizacao || "—"}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">
                      {Number(c.quantidade || 0).toLocaleString("pt-BR")} {c.unidade || ""}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600">
                      {c.saldo_erp !== null && c.saldo_erp !== undefined ? Number(c.saldo_erp).toLocaleString("pt-BR") : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusChip label={diffLabel(c.diferenca)} tone={diffTone(c.diferenca)} />
                    </td>
                    <td className="px-4 py-3 text-slate-700">{c.contado_por_nome || "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => excluir(c.id)}
                        className="rounded-xl p-2 text-rose-500 hover:bg-rose-50"
                        title="Remover"
                      >
                        <FaTrashAlt />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <BarcodeScanner open={scannerOpen} onClose={() => setScannerOpen(false)} onScan={handleScan} />
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../supabase";
import {
  FaSave,
  FaSearch,
  FaSync,
  FaTrash,
  FaUpload,
  FaTools,
  FaFileInvoice,
  FaCheckCircle,
  FaTimes,
  FaEdit,
} from "react-icons/fa";

const BUCKET_FOTOS = "embarcados";

const TIPOS_EMBARCADOS = [
  "TELEMETRIA",
  "CAMERAS",
  "VISION",
  "VALIDADOR",
  "CHIP_VALIDADOR",
  "GPS",
];

const DESTINOS_FINAIS = ["DISPONIVEL", "SUCATA"];

function sanitizeFileName(name) {
  return String(name || "arquivo")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w.\-]+/g, "_");
}

function formatDateBR(v) {
  if (!v) return "-";
  try {
    return new Date(v).toLocaleDateString("pt-BR");
  } catch {
    return "-";
  }
}

function formatMoney(v) {
  const n = Number(v || 0);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function EmptyDoc({ label = "Sem anexo" }) {
  return (
    <div className="w-full h-28 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 flex items-center justify-center text-slate-400 text-sm font-bold">
      {label}
    </div>
  );
}

export default function EmbarcadosEnvioManutencao() {
  const [embarcados, setEmbarcados] = useState([]);
  const [envios, setEnvios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [busca, setBusca] = useState("");
  const [aba, setAba] = useState("NOVO");

  const [modalEnvioId, setModalEnvioId] = useState(null);

  const [fileUploading, setFileUploading] = useState(false);
  const fileOrcamentoRef = useRef(null);

  const [proximaOS, setProximaOS] = useState(1);

  const [form, setForm] = useState({
    ordem_servico: "1",
    tipo_embarcado_servico: "",
    prestador_servico: "",
    data_envio: new Date().toISOString().slice(0, 10),
    status: "ENVIADO",
    observacao_geral: "",
    orcamento_url: "",
    itens_json: [],
  });

  async function carregar() {
    setLoading(true);

    const [r1, r2, r3] = await Promise.all([
      supabase
        .from("embarcados")
        .select("id, tipo, numero_equipamento, status_atual, foto_url, observacao")
        .eq("ativo", true)
        .neq("status_atual", "SUCATA")
        .order("numero_equipamento"),
      supabase
        .from("embarcados_envios_manutencao")
        .select("*")
        .order("numero_registro", { ascending: false }),
      supabase
        .from("embarcados_envios_manutencao")
        .select("ordem_servico")
        .not("ordem_servico", "is", null),
    ]);

    if (r1.error) console.error(r1.error);
    if (r2.error) console.error(r2.error);
    if (r3.error) console.error(r3.error);

    setEmbarcados(r1.data || []);
    setEnvios(r2.data || []);

    const numeros = (r3.data || [])
      .map((x) => Number(String(x.ordem_servico || "").replace(/\D/g, "")))
      .filter((n) => !Number.isNaN(n) && n > 0);

    const proximo = numeros.length ? Math.max(...numeros) + 1 : 1;
    setProximaOS(proximo);

    setForm((prev) => ({
      ...prev,
      ordem_servico: String(proximo),
    }));

    setLoading(false);
  }

  useEffect(() => {
    carregar();
  }, []);

  const disponiveisParaEnvio = useMemo(() => {
    return (embarcados || []).filter((e) => {
      const st = String(e.status_atual || "").toUpperCase();
      return st === "EM_VEICULO" || st === "DISPONIVEL" || st === "MANUTENCAO";
    });
  }, [embarcados]);

  const disponiveisFiltradosPorTipo = useMemo(() => {
    if (!form.tipo_embarcado_servico) return disponiveisParaEnvio;
    return disponiveisParaEnvio.filter((e) => e.tipo === form.tipo_embarcado_servico);
  }, [disponiveisParaEnvio, form.tipo_embarcado_servico]);

  const enviosFiltrados = useMemo(() => {
    const txt = busca.trim().toLowerCase();
    if (!txt) return envios;

    return (envios || []).filter((e) => {
      const itens = Array.isArray(e.itens_json) ? e.itens_json : [];
      const itensTxt = itens
        .map((i) =>
          [
            i.numero_equipamento,
            i.tipo,
            i.observacao_envio,
            i.retorno_prestador,
            i.destino_final,
            i.status_item,
          ]
            .filter(Boolean)
            .join(" ")
        )
        .join(" ");

      const blob = [
        e.numero_registro,
        e.ordem_servico,
        e.tipo_embarcado_servico,
        e.prestador_servico,
        e.status,
        e.observacao_geral,
        itensTxt,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return blob.includes(txt);
    });
  }, [envios, busca]);

  const resumo = useMemo(() => {
    const total = enviosFiltrados.length;
    const enviados = enviosFiltrados.filter((x) => x.status === "ENVIADO").length;
    const parcial = enviosFiltrados.filter((x) => x.status === "RETORNO_PARCIAL").length;
    const finalizados = enviosFiltrados.filter((x) => x.status === "FINALIZADO").length;
    return { total, enviados, parcial, finalizados };
  }, [enviosFiltrados]);

  function resetForm(proximoNumero = 1) {
    setForm({
      ordem_servico: String(proximoNumero),
      tipo_embarcado_servico: "",
      prestador_servico: "",
      data_envio: new Date().toISOString().slice(0, 10),
      status: "ENVIADO",
      observacao_geral: "",
      orcamento_url: "",
      itens_json: [],
    });
  }

  function addItem(embarcadoId) {
    const emb = disponiveisParaEnvio.find((x) => x.id === embarcadoId);
    if (!emb) return;

    if (form.tipo_embarcado_servico && emb.tipo !== form.tipo_embarcado_servico) {
      return alert("Esse equipamento não pertence ao tipo de embarcado selecionado no serviço.");
    }

    const exists = form.itens_json.some((i) => i.embarcado_id === emb.id);
    if (exists) return alert("Esse equipamento já foi adicionado.");

    setForm((prev) => ({
      ...prev,
      itens_json: [
        ...prev.itens_json,
        {
          embarcado_id: emb.id,
          numero_equipamento: emb.numero_equipamento,
          tipo: emb.tipo,
          observacao_envio: "",
          retorno_prestador: "",
          valor_cobrado: "",
          data_retorno: "",
          destino_final: "",
          status_item: "ENVIADO",
        },
      ],
    }));
  }

  function removeItem(index) {
    setForm((prev) => ({
      ...prev,
      itens_json: prev.itens_json.filter((_, i) => i !== index),
    }));
  }

  function updateItem(index, patch) {
    setForm((prev) => ({
      ...prev,
      itens_json: prev.itens_json.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    }));
  }

  async function handleUploadOrcamento(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setFileUploading(true);

      const nomeLimpo = sanitizeFileName(file.name);
      const ext = nomeLimpo.split(".").pop() || "pdf";
      const base = nomeLimpo.replace(/\.[^.]+$/, "");
      const path = `orcamentos/${Date.now()}_${base}.${ext}`;

      const { error } = await supabase.storage.from(BUCKET_FOTOS).upload(path, file, {
        cacheControl: "3600",
        upsert: true,
      });

      if (error) {
        console.error(error);
        alert(error.message || "Erro ao enviar orçamento.");
        return;
      }

      const { data } = supabase.storage.from(BUCKET_FOTOS).getPublicUrl(path);
      setForm((prev) => ({ ...prev, orcamento_url: data?.publicUrl || "" }));
    } finally {
      setFileUploading(false);
      if (e.target) e.target.value = "";
    }
  }

  function calcularStatusEnvio(itens) {
    const arr = Array.isArray(itens) ? itens : [];
    if (!arr.length) return "ABERTO";

    const total = arr.length;
    const retornados = arr.filter((i) => i.status_item === "RETORNADO" || i.status_item === "FINALIZADO").length;
    if (retornados === 0) return "ENVIADO";
    if (retornados < total) return "RETORNO_PARCIAL";
    return "FINALIZADO";
  }

  async function salvarNovoEnvio(e) {
    e.preventDefault();

    if (!form.tipo_embarcado_servico) return alert("Tipo de embarcado do serviço é obrigatório.");
    if (!form.prestador_servico.trim()) return alert("Prestador de serviço é obrigatório.");
    if (!form.data_envio) return alert("Data de envio é obrigatória.");
    if (!form.itens_json.length) return alert("Adicione ao menos um equipamento.");

    const existeTipoDiferente = form.itens_json.some(
      (item) => item.tipo !== form.tipo_embarcado_servico
    );

    if (existeTipoDiferente) {
      return alert("Todos os equipamentos enviados devem ser do mesmo tipo do serviço.");
    }

    try {
      setSaving(true);

      const statusCalculado = calcularStatusEnvio(form.itens_json);

      const payload = {
        ordem_servico: String(proximaOS),
        tipo_embarcado_servico: form.tipo_embarcado_servico,
        prestador_servico: form.prestador_servico.trim(),
        data_envio: form.data_envio,
        status: statusCalculado,
        observacao_geral: form.observacao_geral.trim() || null,
        orcamento_url: form.orcamento_url.trim() || null,
        itens_json: form.itens_json,
        ativo: true,
      };

      const { data, error } = await supabase
        .from("embarcados_envios_manutencao")
        .insert([payload])
        .select("*")
        .single();

      if (error) {
        console.error(error);
        alert(error.message || "Erro ao salvar envio.");
        return;
      }

      for (const item of form.itens_json) {
        const { error: embError } = await supabase
          .from("embarcados")
          .update({
            status_atual: "MANUTENCAO",
            localizacao_tipo: "MANUTENCAO",
            localizacao_valor: `Envio #${data.numero_registro}`,
          })
          .eq("id", item.embarcado_id);

        if (embError) console.error(embError);

        const { error: movError } = await supabase.from("embarcados_movimentacoes").insert([
          {
            embarcado_id: item.embarcado_id,
            tipo_movimentacao: "ENVIO_MANUTENCAO",
            origem_tipo: "VEICULO",
            origem_valor: null,
            destino_tipo: "MANUTENCAO",
            destino_valor: `Envio #${data.numero_registro}`,
            data_movimentacao: new Date().toISOString(),
            responsavel: null,
            observacao: `Enviado para manutenção externa - Prestador: ${payload.prestador_servico}`,
          },
        ]);

        if (movError) console.error(movError);
      }

      const proximo = Number(proximaOS) + 1;
      setProximaOS(proximo);
      resetForm(proximo);
      setAba("CONTROLE");
      await carregar();
      alert(`Envio salvo com sucesso. Registro nº ${data.numero_registro} | OS ${payload.ordem_servico}`);
    } finally {
      setSaving(false);
    }
  }

  async function salvarRetornoEnvio(envio) {
    try {
      setSaving(true);

      const itens = Array.isArray(envio.itens_json) ? envio.itens_json : [];
      const statusCalculado = calcularStatusEnvio(itens);

      const { error } = await supabase
        .from("embarcados_envios_manutencao")
        .update({
          itens_json: itens,
          status: statusCalculado,
        })
        .eq("id", envio.id);

      if (error) {
        console.error(error);
        alert(error.message || "Erro ao salvar retorno.");
        return;
      }

      for (const item of itens) {
        const statusItem = String(item.status_item || "").toUpperCase();
        const destino = String(item.destino_final || "").toUpperCase();

        if (statusItem !== "RETORNADO" && statusItem !== "FINALIZADO") continue;
        if (!item.embarcado_id) continue;

        let novoStatus = null;
        let localizacaoTipo = null;
        let localizacaoValor = null;
        let tipoMov = "RETORNO_MANUTENCAO";

        if (destino === "DISPONIVEL") {
          novoStatus = "DISPONIVEL";
          localizacaoTipo = "ESTOQUE";
          localizacaoValor = "Disponível";
        } else if (destino === "SUCATA") {
          novoStatus = "SUCATA";
          localizacaoTipo = "SUCATA";
          localizacaoValor = "Sucata";
          tipoMov = "BAIXA";
        } else {
          continue;
        }

        const { error: upEmb } = await supabase
          .from("embarcados")
          .update({
            status_atual: novoStatus,
            localizacao_tipo: localizacaoTipo,
            localizacao_valor: localizacaoValor,
          })
          .eq("id", item.embarcado_id);

        if (upEmb) console.error(upEmb);

        const { error: movError } = await supabase.from("embarcados_movimentacoes").insert([
          {
            embarcado_id: item.embarcado_id,
            tipo_movimentacao: tipoMov,
            origem_tipo: "MANUTENCAO",
            origem_valor: `Envio #${envio.numero_registro}`,
            destino_tipo: destino === "SUCATA" ? "SUCATA" : "ESTOQUE",
            destino_valor: destino === "SUCATA" ? "Sucata" : "Disponível",
            data_movimentacao: item.data_retorno || new Date().toISOString(),
            responsavel: null,
            observacao: `Retorno do prestador - ${envio.prestador_servico}`,
          },
        ]);

        if (movError) console.error(movError);
      }

      await carregar();
      setModalEnvioId(null);
      alert("Retorno da OS salvo com sucesso.");
    } finally {
      setSaving(false);
    }
  }

  function updateEnvioItem(envioId, index, patch) {
    setEnvios((prev) =>
      prev.map((envio) =>
        envio.id !== envioId
          ? envio
          : {
              ...envio,
              itens_json: (Array.isArray(envio.itens_json) ? envio.itens_json : []).map((item, i) =>
                i === index ? { ...item, ...patch } : item
              ),
            }
      )
    );
  }

  const envioModal = useMemo(() => {
    if (!modalEnvioId) return null;
    return envios.find((e) => e.id === modalEnvioId) || null;
  }, [modalEnvioId, envios]);

  return (
    <div className="min-h-screen bg-slate-50 p-4 font-sans text-slate-900">
      <div className="bg-white rounded-2xl shadow-sm border p-5">
        <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
          <div>
            <div className="text-xs font-black text-indigo-600 uppercase tracking-widest">Módulo</div>
            <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900">
              Envio para Manutenção
            </h1>
            <p className="text-sm text-slate-500 font-semibold mt-1">
              Controle de envios, retorno do prestador, valores cobrados e liberação do embarcado.
            </p>
          </div>

          <button
            onClick={carregar}
            className="h-[42px] px-4 rounded-xl bg-white border border-slate-200 text-slate-800 font-black text-sm hover:bg-slate-50 flex items-center gap-2 transition-colors"
          >
            <FaSync className="text-indigo-600" /> Atualizar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mt-4">
        <div className="bg-white rounded-2xl shadow-sm border p-4">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Total</div>
          <div className="text-2xl font-black mt-1 text-slate-800">{resumo.total}</div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border p-4">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Enviados</div>
          <div className="text-2xl font-black mt-1 text-blue-600">{resumo.enviados}</div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border p-4">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Retorno parcial</div>
          <div className="text-2xl font-black mt-1 text-amber-600">{resumo.parcial}</div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border p-4">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Finalizados</div>
          <div className="text-2xl font-black mt-1 text-emerald-600">{resumo.finalizados}</div>
        </div>
      </div>

      <div className="mt-4 bg-white rounded-2xl shadow-sm border p-2">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setAba("NOVO")}
            className={`px-4 py-2 rounded-xl text-sm font-black transition-colors ${aba === "NOVO" ? "bg-indigo-600 text-white shadow-md" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
          >
            Novo envio
          </button>
          <button
            onClick={() => setAba("CONTROLE")}
            className={`px-4 py-2 rounded-xl text-sm font-black transition-colors ${aba === "CONTROLE" ? "bg-indigo-600 text-white shadow-md" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
          >
            Controle / retorno
          </button>
        </div>
      </div>

      {aba === "NOVO" ? (
        <form onSubmit={salvarNovoEnvio} className="mt-4 grid grid-cols-1 2xl:grid-cols-[520px_1fr] gap-4">
          <div className="bg-white rounded-2xl border shadow-sm p-5 space-y-4">
            <div className="text-sm font-black uppercase text-indigo-800 flex items-center gap-2">
              <FaFileInvoice /> Cabeçalho do envio
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase mb-1 block">Ordem de serviço</label>
              <input
                className="w-full border rounded-xl px-3 py-2 text-sm font-bold bg-slate-100 outline-none text-slate-700"
                value={form.ordem_servico}
                disabled
              />
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase mb-1 block">
                Tipo de embarcado do serviço
              </label>
              <select
                className="w-full border rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                value={form.tipo_embarcado_servico}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    tipo_embarcado_servico: e.target.value,
                    itens_json: prev.itens_json.filter((item) => item.tipo === e.target.value || !e.target.value),
                  }))
                }
              >
                <option value="">Selecione...</option>
                {TIPOS_EMBARCADOS.map((tipo) => (
                  <option key={tipo} value={tipo}>
                    {tipo}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase mb-1 block">Prestador de serviço</label>
              <input
                className="w-full border rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                value={form.prestador_servico}
                onChange={(e) => setForm({ ...form, prestador_servico: e.target.value })}
                placeholder="Nome do prestador"
              />
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase mb-1 block">Data enviada para reparo</label>
              <input
                type="date"
                className="w-full border rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                value={form.data_envio}
                onChange={(e) => setForm({ ...form, data_envio: e.target.value })}
              />
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase mb-1 block">Observação geral</label>
              <textarea
                className="w-full border rounded-xl px-3 py-2 text-sm font-bold min-h-[90px] outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                value={form.observacao_geral}
                onChange={(e) => setForm({ ...form, observacao_geral: e.target.value })}
              />
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase mb-1 block">
                Orçamento do prestador
              </label>

              <div className="flex flex-col gap-3">
                {form.orcamento_url ? (
                  <a
                    href={form.orcamento_url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-xl border border-blue-200 p-3 bg-blue-50 text-blue-700 font-black text-sm transition-colors hover:bg-blue-100"
                  >
                    Abrir orçamento anexado
                  </a>
                ) : (
                  <EmptyDoc label="Sem orçamento anexado" />
                )}

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => fileOrcamentoRef.current?.click()}
                    disabled={fileUploading}
                    className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-black flex items-center gap-2 disabled:opacity-60 transition-colors"
                  >
                    <FaUpload />
                    {fileUploading ? "Enviando..." : "Anexar orçamento"}
                  </button>

                  {form.orcamento_url && (
                    <button
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, orcamento_url: "" }))}
                      className="px-4 py-2 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 text-sm font-black transition-colors"
                    >
                      Remover anexo
                    </button>
                  )}
                </div>

                <input
                  ref={fileOrcamentoRef}
                  type="file"
                  accept=".pdf,image/*,.doc,.docx,.xls,.xlsx"
                  className="hidden"
                  onChange={handleUploadOrcamento}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full px-4 py-3 mt-4 rounded-xl bg-indigo-600 text-white font-black hover:bg-indigo-700 disabled:opacity-60 flex items-center justify-center gap-2 transition-colors shadow-md"
            >
              <FaSave /> {saving ? "Salvando..." : "Salvar envio"}
            </button>
          </div>

          <div className="bg-white rounded-2xl border shadow-sm p-5">
            <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between mb-4">
              <div className="text-sm font-black uppercase text-indigo-800 flex items-center gap-2">
                <FaTools /> Equipamentos enviados
              </div>

              <select
                className="border rounded-xl px-3 py-2 text-sm font-bold bg-white min-w-[320px] outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                defaultValue=""
                onChange={(e) => {
                  if (!e.target.value) return;
                  addItem(e.target.value);
                  e.target.value = "";
                }}
                disabled={!form.tipo_embarcado_servico}
              >
                <option value="">
                  {form.tipo_embarcado_servico
                    ? "Adicionar equipamento..."
                    : "Selecione primeiro o tipo do serviço"}
                </option>
                {disponiveisFiltradosPorTipo.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.numero_equipamento} - {e.tipo} ({e.status_atual})
                  </option>
                ))}
              </select>
            </div>

            {!form.itens_json.length ? (
              <div className="p-10 text-center text-slate-400 font-black border rounded-xl bg-slate-50 border-dashed">
                Nenhum equipamento adicionado.
              </div>
            ) : (
              <div className="space-y-3">
                {form.itens_json.map((item, index) => (
                  <div key={`${item.embarcado_id}_${index}`} className="rounded-xl border p-4 bg-slate-50">
                    <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-2">
                      <div>
                        <div className="text-sm font-black text-slate-900">
                          {item.numero_equipamento} <span className="text-slate-400 mx-1">•</span> <span className="text-indigo-600">{item.tipo}</span>
                        </div>
                        <div className="text-xs font-semibold text-slate-500 mt-1">
                          Status item: {item.status_item || "ENVIADO"}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        className="px-3 py-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 border border-red-100 text-xs font-black flex items-center gap-2 transition-colors"
                      >
                        <FaTrash /> Remover
                      </button>
                    </div>

                    <div className="mt-3">
                      <label className="text-[10px] font-black text-slate-500 uppercase mb-1 block">
                        Observação do envio
                      </label>
                      <textarea
                        className="w-full border rounded-lg px-3 py-2 text-sm font-bold min-h-[80px] bg-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        value={item.observacao_envio || ""}
                        onChange={(e) => updateItem(index, { observacao_envio: e.target.value })}
                        placeholder="Defeito percebido / motivo do envio"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </form>
      ) : (
        <div className="mt-4">
          <div className="bg-white rounded-2xl shadow-sm border p-4 mb-4">
            <div className="flex items-center gap-2 border rounded-xl px-3 py-2 bg-white max-w-[380px] focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500">
              <FaSearch className="text-slate-400" />
              <input
                className="w-full outline-none text-sm font-semibold bg-transparent"
                placeholder="Buscar envio, OS, prestador..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-3">
            {loading ? (
              <div className="bg-white rounded-2xl border shadow-sm p-10 text-center font-black text-slate-500">
                Carregando envios...
              </div>
            ) : enviosFiltrados.length === 0 ? (
              <div className="bg-white rounded-2xl border shadow-sm p-10 text-center font-black text-slate-500">
                Nenhum envio encontrado.
              </div>
            ) : (
              enviosFiltrados.map((envio) => {
                const itens = Array.isArray(envio.itens_json) ? envio.itens_json : [];
                const totalCobranca = itens.reduce((acc, i) => acc + Number(i.valor_cobrado || 0), 0);

                let badgeColor = "bg-slate-100 text-slate-800";
                if (envio.status === "FINALIZADO") badgeColor = "bg-emerald-100 text-emerald-800";
                if (envio.status === "RETORNO_PARCIAL") badgeColor = "bg-amber-100 text-amber-800";
                if (envio.status === "ENVIADO") badgeColor = "bg-blue-100 text-blue-800";

                return (
                  <div key={envio.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:shadow-md transition-shadow">
                    <div className="flex flex-col md:flex-row md:items-center gap-4 flex-1">
                      <div className="min-w-[120px]">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          Reg. nº {envio.numero_registro}
                        </div>
                        <div className="text-sm font-black text-slate-800 mt-1">
                          OS: {envio.ordem_servico || "-"}
                        </div>
                      </div>

                      <div className="flex-1">
                        <div className="text-base font-black text-indigo-900 leading-tight">
                          {envio.prestador_servico}
                        </div>
                        <div className="text-xs text-slate-500 font-semibold mt-1 flex gap-2 items-center">
                          <span>Tipo: <strong className="text-slate-700">{envio.tipo_embarcado_servico || "-"}</strong></span>
                          <span className="text-slate-300">•</span>
                          <span>Data: <strong className="text-slate-700">{formatDateBR(envio.data_envio)}</strong></span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col md:flex-row items-center gap-4 min-w-[280px] md:justify-end">
                      <div className="text-right flex-1 md:flex-none">
                        <span className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider ${badgeColor}`}>
                          {envio.status}
                        </span>
                        <div className="text-xs font-black text-slate-700 mt-1.5">
                          Cobrado: {formatMoney(totalCobranca)}
                        </div>
                      </div>
                      
                      <button
                        onClick={() => setModalEnvioId(envio.id)}
                        className="w-full md:w-auto px-4 py-2 rounded-lg bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-sm font-black flex items-center justify-center gap-2 transition-colors"
                      >
                        <FaEdit /> Detalhes / Edição
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* MODAL DE DETALHES E EDIÇÃO DA OS */}
      {envioModal && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-slate-50 rounded-2xl w-full max-w-5xl max-h-[95vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95">
            
            {/* Header Fixo */}
            <div className="bg-white border-b px-6 py-4 flex items-center justify-between sticky top-0 z-10">
              <div>
                <h2 className="text-lg font-black text-slate-800 flex items-center gap-2 uppercase tracking-tight">
                  <FaTools className="text-indigo-600" /> Detalhes da Ordem de Serviço
                </h2>
                <div className="text-xs font-bold text-slate-500 mt-1">
                  Registro nº {envioModal.numero_registro} | OS: {envioModal.ordem_servico}
                </div>
              </div>
              <button
                onClick={() => setModalEnvioId(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-red-100 hover:text-red-600 transition-colors"
              >
                <FaTimes />
              </button>
            </div>

            {/* Corpo Rolável */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* SESSÃO 1: CABEÇALHO / ORÇAMENTO */}
              <div className="bg-white rounded-xl border p-5 shadow-sm">
                <div className="text-xs font-black uppercase text-indigo-800 tracking-widest mb-4 border-b pb-2">
                  1. Informações e Orçamento
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="bg-slate-50 rounded-lg p-3 border">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Prestador</div>
                    <div className="text-sm font-bold text-slate-800 mt-1">{envioModal.prestador_servico}</div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3 border">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Data de Envio</div>
                    <div className="text-sm font-bold text-slate-800 mt-1">{formatDateBR(envioModal.data_envio)}</div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3 border">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status Geral</div>
                    <div className="text-sm font-bold text-slate-800 mt-1">{envioModal.status}</div>
                  </div>
                </div>

                {envioModal.observacao_geral && (
                  <div className="mb-4">
                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Observação geral de envio:</div>
                    <div className="bg-slate-50 border rounded-lg p-3 text-sm font-medium text-slate-700">
                      {envioModal.observacao_geral}
                    </div>
                  </div>
                )}

                {envioModal.orcamento_url && (
                  <div>
                    <a
                      href={envioModal.orcamento_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 font-black text-sm hover:bg-blue-100 transition-colors"
                    >
                      <FaFileInvoice /> Ver anexo do orçamento do prestador
                    </a>
                  </div>
                )}
              </div>

              {/* SESSÃO 2: FINALIZAÇÃO DO SERVIÇO / ITENS */}
              <div className="bg-white rounded-xl border p-5 shadow-sm">
                <div className="text-xs font-black uppercase text-indigo-800 tracking-widest mb-4 border-b pb-2">
                  2. Finalização do Serviço por Equipamento
                </div>

                <div className="space-y-6">
                  {(envioModal.itens_json || []).map((item, index) => (
                    <div key={`${item.embarcado_id}_${index}`} className="border rounded-xl bg-slate-50 overflow-hidden">
                      {/* Topo do Item */}
                      <div className="bg-slate-100 border-b p-3 flex flex-col md:flex-row md:items-center justify-between gap-2">
                        <div>
                          <span className="text-sm font-black text-slate-900">{item.numero_equipamento}</span>
                          <span className="text-slate-400 mx-2">•</span>
                          <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md border border-indigo-100">{item.tipo}</span>
                        </div>
                        {item.status_item === "RETORNADO" || item.status_item === "FINALIZADO" ? (
                          <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                            <FaCheckCircle /> Retornado
                          </span>
                        ) : (
                          <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black uppercase tracking-wider">
                            Pendente
                          </span>
                        )}
                      </div>

                      <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Lado Esquerdo: O que foi relatado */}
                        <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">
                            Defeito relatado / Motivo
                          </label>
                          <div className="w-full border rounded-lg px-3 py-2 text-sm font-medium min-h-[80px] bg-slate-100 text-slate-600">
                            {item.observacao_envio || "Nenhuma observação informada no envio."}
                          </div>
                        </div>

                        {/* Lado Direito: O que foi feito (Edição) */}
                        <div className="space-y-4">
                          <div>
                            <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1.5 block">
                              O que foi feito (Retorno do Prestador)
                            </label>
                            <textarea
                              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-medium min-h-[80px] bg-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                              value={item.retorno_prestador || ""}
                              onChange={(e) => updateEnvioItem(envioModal.id, index, { retorno_prestador: e.target.value })}
                              placeholder="Descreva o serviço executado..."
                            />
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                              <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1.5 block">
                                Custo / Valor
                              </label>
                              <input
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold bg-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-slate-800"
                                value={item.valor_cobrado || ""}
                                onChange={(e) => updateEnvioItem(envioModal.id, index, { valor_cobrado: e.target.value })}
                                placeholder="0.00"
                              />
                            </div>
                            
                            <div>
                              <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1.5 block">
                                Data Retorno
                              </label>
                              <input
                                type="date"
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold bg-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-slate-800"
                                value={item.data_retorno || ""}
                                onChange={(e) => updateEnvioItem(envioModal.id, index, { 
                                  data_retorno: e.target.value,
                                  status_item: e.target.value && item.destino_final ? "RETORNADO" : item.status_item || "ENVIADO"
                                })}
                              />
                            </div>

                            <div>
                              <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1.5 block">
                                Destino Final
                              </label>
                              <select
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold bg-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-slate-800"
                                value={item.destino_final || ""}
                                onChange={(e) => updateEnvioItem(envioModal.id, index, { 
                                  destino_final: e.target.value,
                                  status_item: e.target.value && item.data_retorno ? "RETORNADO" : item.status_item || "ENVIADO"
                                })}
                              >
                                <option value="">Selecione...</option>
                                {DESTINOS_FINAIS.map((d) => (
                                  <option key={d} value={d}>{d}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer Fixo */}
            <div className="bg-white border-t px-6 py-4 flex flex-col sm:flex-row items-center justify-between sticky bottom-0 z-10 gap-4">
              <div className="text-sm font-black text-slate-700 bg-slate-100 px-4 py-2 rounded-lg border">
                Custo Total da OS: <span className="text-indigo-700 ml-1">
                  {formatMoney((envioModal.itens_json || []).reduce((acc, i) => acc + Number(i.valor_cobrado || 0), 0))}
                </span>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setModalEnvioId(null)}
                  className="flex-1 sm:flex-none px-6 py-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-black transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => salvarRetornoEnvio(envioModal)}
                  disabled={saving}
                  className="flex-1 sm:flex-none px-6 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-black flex items-center justify-center gap-2 disabled:opacity-60 transition-colors shadow-md"
                >
                  <FaSave /> {saving ? "Salvando..." : "Finalizar OS"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

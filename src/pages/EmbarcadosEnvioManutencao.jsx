import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabase";
import {
  FaPlus,
  FaSave,
  FaSearch,
  FaSync,
  FaTrash,
  FaUpload,
  FaTools,
  FaFileInvoice,
  FaCheckCircle,
} from "react-icons/fa";

const BUCKET_FOTOS = "embarcados";
const DESTINOS_FINAIS = ["DISPONIVEL", "SUCATA"];
const STATUS_ENVIO = ["ABERTO", "ENVIADO", "RETORNO_PARCIAL", "FINALIZADO", "CANCELADO"];

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
    <div className="w-full h-28 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center text-gray-400 text-sm font-bold">
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

  const [fileUploading, setFileUploading] = useState(false);
  const fileOrcamentoRef = useRef(null);

  const [proximaOS, setProximaOS] = useState(1);

  const [form, setForm] = useState({
    ordem_servico: "1",
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

    if (!form.prestador_servico.trim()) return alert("Prestador de serviço é obrigatório.");
    if (!form.data_envio) return alert("Data de envio é obrigatória.");
    if (!form.itens_json.length) return alert("Adicione ao menos um equipamento.");

    try {
      setSaving(true);

      const statusCalculado = calcularStatusEnvio(form.itens_json);

      const payload = {
        ordem_servico: String(proximaOS),
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
      alert("Retorno salvo com sucesso.");
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

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="bg-white rounded-2xl shadow-sm border p-5">
        <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
          <div>
            <div className="text-xs font-black text-gray-500 uppercase">Módulo</div>
            <h1 className="text-2xl font-black uppercase tracking-tight text-gray-900">
              Envio para Manutenção
            </h1>
            <p className="text-sm text-gray-500 font-semibold mt-1">
              Controle de envios, retorno do prestador, valores cobrados e liberação do embarcado.
            </p>
          </div>

          <button
            onClick={carregar}
            className="h-[42px] px-4 rounded-xl bg-white border text-gray-800 font-black text-sm hover:bg-gray-100 flex items-center gap-2"
          >
            <FaSync /> Atualizar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mt-4">
        <div className="bg-white rounded-2xl shadow-sm border p-4">
          <div className="text-[10px] font-black text-gray-500 uppercase">Total</div>
          <div className="text-2xl font-black mt-1">{resumo.total}</div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border p-4">
          <div className="text-[10px] font-black text-gray-500 uppercase">Enviados</div>
          <div className="text-2xl font-black mt-1 text-blue-700">{resumo.enviados}</div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border p-4">
          <div className="text-[10px] font-black text-gray-500 uppercase">Retorno parcial</div>
          <div className="text-2xl font-black mt-1 text-yellow-700">{resumo.parcial}</div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border p-4">
          <div className="text-[10px] font-black text-gray-500 uppercase">Finalizados</div>
          <div className="text-2xl font-black mt-1 text-green-700">{resumo.finalizados}</div>
        </div>
      </div>

      <div className="mt-4 bg-white rounded-2xl shadow-sm border p-2">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setAba("NOVO")}
            className={`px-4 py-2 rounded-xl text-sm font-black ${aba === "NOVO" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-800"}`}
          >
            Novo envio
          </button>
          <button
            onClick={() => setAba("CONTROLE")}
            className={`px-4 py-2 rounded-xl text-sm font-black ${aba === "CONTROLE" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-800"}`}
          >
            Controle / retorno
          </button>
        </div>
      </div>

      {aba === "NOVO" ? (
        <form onSubmit={salvarNovoEnvio} className="mt-4 grid grid-cols-1 2xl:grid-cols-[520px_1fr] gap-4">
          <div className="bg-white rounded-2xl border shadow-sm p-5 space-y-4">
            <div className="text-sm font-black uppercase text-gray-800 flex items-center gap-2">
              <FaFileInvoice /> Cabeçalho do envio
            </div>

            <div>
              <label className="text-[10px] font-black text-gray-500 uppercase mb-1 block">Ordem de serviço</label>
              <input
                className="w-full border rounded-xl px-3 py-2 text-sm font-bold bg-gray-100"
                value={form.ordem_servico}
                disabled
              />
            </div>

            <div>
              <label className="text-[10px] font-black text-gray-500 uppercase mb-1 block">Prestador de serviço</label>
              <input
                className="w-full border rounded-xl px-3 py-2 text-sm font-bold"
                value={form.prestador_servico}
                onChange={(e) => setForm({ ...form, prestador_servico: e.target.value })}
                placeholder="Nome do prestador"
              />
            </div>

            <div>
              <label className="text-[10px] font-black text-gray-500 uppercase mb-1 block">Data enviada para reparo</label>
              <input
                type="date"
                className="w-full border rounded-xl px-3 py-2 text-sm font-bold"
                value={form.data_envio}
                onChange={(e) => setForm({ ...form, data_envio: e.target.value })}
              />
            </div>

            <div>
              <label className="text-[10px] font-black text-gray-500 uppercase mb-1 block">Observação geral</label>
              <textarea
                className="w-full border rounded-xl px-3 py-2 text-sm font-bold min-h-[90px]"
                value={form.observacao_geral}
                onChange={(e) => setForm({ ...form, observacao_geral: e.target.value })}
              />
            </div>

            <div>
              <label className="text-[10px] font-black text-gray-500 uppercase mb-1 block">
                Orçamento do prestador
              </label>

              <div className="flex flex-col gap-3">
                {form.orcamento_url ? (
                  <a
                    href={form.orcamento_url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-xl border p-3 bg-blue-50 text-blue-700 font-black text-sm"
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
                    className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-black flex items-center gap-2 disabled:opacity-60"
                  >
                    <FaUpload />
                    {fileUploading ? "Enviando..." : "Anexar orçamento"}
                  </button>

                  {form.orcamento_url && (
                    <button
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, orcamento_url: "" }))}
                      className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-800 text-sm font-black"
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
              className="w-full px-4 py-3 rounded-xl bg-gray-900 text-white font-black hover:bg-black disabled:opacity-60 flex items-center justify-center gap-2"
            >
              <FaSave /> {saving ? "Salvando..." : "Salvar envio"}
            </button>
          </div>

          <div className="bg-white rounded-2xl border shadow-sm p-5">
            <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between mb-4">
              <div className="text-sm font-black uppercase text-gray-800 flex items-center gap-2">
                <FaTools /> Equipamentos enviados
              </div>

              <select
                className="border rounded-xl px-3 py-2 text-sm font-bold bg-white min-w-[320px]"
                defaultValue=""
                onChange={(e) => {
                  if (!e.target.value) return;
                  addItem(e.target.value);
                  e.target.value = "";
                }}
              >
                <option value="">Adicionar equipamento...</option>
                {disponiveisParaEnvio.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.numero_equipamento} - {e.tipo} ({e.status_atual})
                  </option>
                ))}
              </select>
            </div>

            {!form.itens_json.length ? (
              <div className="p-10 text-center text-gray-500 font-black border rounded-xl bg-gray-50">
                Nenhum equipamento adicionado.
              </div>
            ) : (
              <div className="space-y-3">
                {form.itens_json.map((item, index) => (
                  <div key={`${item.embarcado_id}_${index}`} className="rounded-xl border p-4 bg-gray-50">
                    <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-2">
                      <div>
                        <div className="text-sm font-black text-gray-900">
                          {item.numero_equipamento} • {item.tipo}
                        </div>
                        <div className="text-xs font-semibold text-gray-500 mt-1">
                          Status item: {item.status_item || "ENVIADO"}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        className="px-3 py-2 rounded-lg bg-red-100 hover:bg-red-200 text-red-700 text-xs font-black flex items-center gap-2"
                      >
                        <FaTrash /> Remover
                      </button>
                    </div>

                    <div className="mt-3">
                      <label className="text-[10px] font-black text-gray-500 uppercase mb-1 block">
                        Observação do envio
                      </label>
                      <textarea
                        className="w-full border rounded-lg px-3 py-2 text-sm font-bold min-h-[80px] bg-white"
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
            <div className="flex items-center gap-2 border rounded-xl px-3 py-2 bg-white max-w-[380px]">
              <FaSearch className="text-gray-400" />
              <input
                className="w-full outline-none text-sm font-semibold"
                placeholder="Buscar envio, OS, prestador, equipamento..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-4">
            {loading ? (
              <div className="bg-white rounded-2xl border shadow-sm p-10 text-center font-black text-gray-500">
                Carregando envios...
              </div>
            ) : enviosFiltrados.length === 0 ? (
              <div className="bg-white rounded-2xl border shadow-sm p-10 text-center font-black text-gray-500">
                Nenhum envio encontrado.
              </div>
            ) : (
              enviosFiltrados.map((envio) => {
                const itens = Array.isArray(envio.itens_json) ? envio.itens_json : [];
                const totalCobranca = itens.reduce((acc, i) => acc + Number(i.valor_cobrado || 0), 0);

                return (
                  <div key={envio.id} className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                    <div className="p-4 border-b flex flex-col xl:flex-row xl:items-start xl:justify-between gap-3">
                      <div>
                        <div className="text-[10px] font-black text-gray-500 uppercase">
                          Registro nº {envio.numero_registro}
                        </div>
                        <div className="text-lg font-black text-gray-900">
                          {envio.prestador_servico}
                        </div>
                        <div className="text-sm text-gray-500 font-semibold mt-1">
                          OS: <span className="font-black">{envio.ordem_servico || "-"}</span>
                          {" • "}
                          Data envio: <span className="font-black">{formatDateBR(envio.data_envio)}</span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="px-3 py-2 rounded-full bg-gray-900 text-white text-[11px] font-black uppercase">
                          {envio.status}
                        </span>
                        <div className="text-sm font-black text-gray-700 mt-2">
                          Total cobrado: {formatMoney(totalCobranca)}
                        </div>
                      </div>
                    </div>

                    <div className="p-4">
                      {envio.orcamento_url ? (
                        <div className="mb-4">
                          <a
                            href={envio.orcamento_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-50 text-blue-700 font-black text-sm"
                          >
                            <FaFileInvoice /> Abrir orçamento do prestador
                          </a>
                        </div>
                      ) : null}

                      {envio.observacao_geral ? (
                        <div className="mb-4 rounded-xl border bg-gray-50 p-3">
                          <div className="text-[10px] font-black text-gray-500 uppercase">Observação geral</div>
                          <div className="text-sm font-semibold text-gray-800 mt-1">
                            {envio.observacao_geral}
                          </div>
                        </div>
                      ) : null}

                      <div className="space-y-3">
                        {itens.map((item, index) => (
                          <div key={`${item.embarcado_id}_${index}`} className="rounded-xl border p-4 bg-gray-50">
                            <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-2">
                              <div>
                                <div className="text-sm font-black text-gray-900">
                                  {item.numero_equipamento} • {item.tipo}
                                </div>
                                <div className="text-xs font-semibold text-gray-500 mt-1">
                                  Status item: {item.status_item || "ENVIADO"}
                                </div>
                              </div>

                              {item.status_item === "RETORNADO" || item.status_item === "FINALIZADO" ? (
                                <span className="px-3 py-2 rounded-full bg-green-100 text-green-700 text-[11px] font-black uppercase inline-flex items-center gap-2">
                                  <FaCheckCircle /> Retornado
                                </span>
                              ) : (
                                <span className="px-3 py-2 rounded-full bg-yellow-100 text-yellow-800 text-[11px] font-black uppercase">
                                  Enviado
                                </span>
                              )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                              <div>
                                <label className="text-[10px] font-black text-gray-500 uppercase mb-1 block">
                                  Observação do envio
                                </label>
                                <textarea
                                  className="w-full border rounded-lg px-3 py-2 text-sm font-bold min-h-[70px] bg-white"
                                  value={item.observacao_envio || ""}
                                  onChange={(e) =>
                                    updateEnvioItem(envio.id, index, { observacao_envio: e.target.value })
                                  }
                                />
                              </div>

                              <div>
                                <label className="text-[10px] font-black text-gray-500 uppercase mb-1 block">
                                  Retorno do prestador
                                </label>
                                <textarea
                                  className="w-full border rounded-lg px-3 py-2 text-sm font-bold min-h-[70px] bg-white"
                                  value={item.retorno_prestador || ""}
                                  onChange={(e) =>
                                    updateEnvioItem(envio.id, index, { retorno_prestador: e.target.value })
                                  }
                                />
                              </div>

                              <div>
                                <label className="text-[10px] font-black text-gray-500 uppercase mb-1 block">
                                  Valor cobrado
                                </label>
                                <input
                                  className="w-full border rounded-lg px-3 py-2 text-sm font-bold bg-white"
                                  value={item.valor_cobrado || ""}
                                  onChange={(e) =>
                                    updateEnvioItem(envio.id, index, { valor_cobrado: e.target.value })
                                  }
                                  placeholder="Ex: 150.00"
                                />
                              </div>

                              <div>
                                <label className="text-[10px] font-black text-gray-500 uppercase mb-1 block">
                                  Data de retorno
                                </label>
                                <input
                                  type="date"
                                  className="w-full border rounded-lg px-3 py-2 text-sm font-bold bg-white"
                                  value={item.data_retorno || ""}
                                  onChange={(e) =>
                                    updateEnvioItem(envio.id, index, {
                                      data_retorno: e.target.value,
                                      status_item: e.target.value ? "RETORNADO" : item.status_item || "ENVIADO",
                                    })
                                  }
                                />
                              </div>

                              <div>
                                <label className="text-[10px] font-black text-gray-500 uppercase mb-1 block">
                                  Destino final
                                </label>
                                <select
                                  className="w-full border rounded-lg px-3 py-2 text-sm font-bold bg-white"
                                  value={item.destino_final || ""}
                                  onChange={(e) =>
                                    updateEnvioItem(envio.id, index, {
                                      destino_final: e.target.value,
                                      status_item: e.target.value ? "RETORNADO" : item.status_item || "ENVIADO",
                                    })
                                  }
                                >
                                  <option value="">Selecione...</option>
                                  {DESTINOS_FINAIS.map((d) => (
                                    <option key={d} value={d}>
                                      {d}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="mt-4 flex justify-end">
                        <button
                          type="button"
                          onClick={() => salvarRetornoEnvio(envio)}
                          disabled={saving}
                          className="px-4 py-2 rounded-lg bg-gray-900 hover:bg-black text-white text-sm font-black flex items-center gap-2 disabled:opacity-60"
                        >
                          <FaSave /> {saving ? "Salvando..." : "Salvar retorno"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

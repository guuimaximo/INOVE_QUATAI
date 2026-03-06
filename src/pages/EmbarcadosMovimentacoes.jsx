import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import {
  FaExchangeAlt,
  FaSave,
  FaSync,
  FaSearch,
  FaTruck,
  FaWarehouse,
  FaTools,
} from "react-icons/fa";

const TIPOS_MOV = [
  "INSTALACAO",
  "RETIRADA",
  "TRANSFERENCIA",
  "ENVIO_MANUTENCAO",
  "RETORNO_MANUTENCAO",
  "ENVIO_RESERVA",
  "SAIDA_RESERVA",
  "ENVIO_EXTERNO",
  "RETORNO_EXTERNO",
  "AJUSTE",
];

const LOCAIS = ["VEICULO", "ESTOQUE", "RESERVA", "MANUTENCAO", "EXTERNO", "DESCONHECIDO"];

export default function EmbarcadosMovimentacoes() {
  const [embarcados, setEmbarcados] = useState([]);
  const [prefixos, setPrefixos] = useState([]);
  const [historico, setHistorico] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [buscaHistorico, setBuscaHistorico] = useState("");

  const [form, setForm] = useState({
    embarcado_id: "",
    tipo_movimentacao: "INSTALACAO",
    origem_tipo: "ESTOQUE",
    origem_valor: "",
    destino_tipo: "VEICULO",
    destino_valor: "",
    responsavel: "",
    observacao: "",
  });

  async function carregar() {
    setLoading(true);

    const [r1, r2, r3] = await Promise.all([
      supabase.from("embarcados").select("id, tipo, numero_equipamento, status_atual, localizacao_tipo, localizacao_valor").eq("ativo", true).order("numero_equipamento"),
      supabase.from("prefixos").select("codigo, cluster").order("codigo"),
      supabase.from("embarcados_movimentacoes").select("*, embarcados(numero_equipamento, tipo)").order("data_movimentacao", { ascending: false }).limit(100),
    ]);

    if (r1.error) console.error(r1.error);
    if (r2.error) console.error(r2.error);
    if (r3.error) console.error(r3.error);

    setEmbarcados(r1.data || []);
    setPrefixos(r2.data || []);
    setHistorico(r3.data || []);
    setLoading(false);
  }

  useEffect(() => {
    carregar();
  }, []);

  const embarcadoSelecionado = useMemo(
    () => embarcados.find((x) => x.id === form.embarcado_id) || null,
    [embarcados, form.embarcado_id]
  );

  useEffect(() => {
    if (!embarcadoSelecionado) return;

    setForm((prev) => ({
      ...prev,
      origem_tipo: embarcadoSelecionado.localizacao_tipo || "ESTOQUE",
      origem_valor: embarcadoSelecionado.localizacao_valor || "",
    }));
  }, [embarcadoSelecionado]);

  const historicoFiltrado = useMemo(() => {
    const txt = buscaHistorico.trim().toLowerCase();
    if (!txt) return historico;

    return historico.filter((h) => {
      const blob = [
        h.tipo_movimentacao,
        h.origem_tipo,
        h.origem_valor,
        h.destino_tipo,
        h.destino_valor,
        h.responsavel,
        h.observacao,
        h.embarcados?.numero_equipamento,
        h.embarcados?.tipo,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return blob.includes(txt);
    });
  }, [historico, buscaHistorico]);

  async function salvarMovimentacao(e) {
    e.preventDefault();

    if (!form.embarcado_id) return alert("Selecione um embarcado.");
    if (!form.tipo_movimentacao) return alert("Tipo de movimentação é obrigatório.");
    if (!form.destino_tipo) return alert("Destino é obrigatório.");

    try {
      setSaving(true);

      const embarcado = embarcados.find((x) => x.id === form.embarcado_id);
      if (!embarcado) {
        alert("Embarcado não encontrado.");
        return;
      }

      let novoStatus = embarcado.status_atual;
      let novaLocalizacaoTipo = form.destino_tipo;
      let novaLocalizacaoValor = form.destino_valor || "";

      if (form.tipo_movimentacao === "INSTALACAO") novoStatus = "INSTALADO";
      if (form.tipo_movimentacao === "ENVIO_RESERVA") novoStatus = "RESERVA";
      if (form.tipo_movimentacao === "SAIDA_RESERVA") novoStatus = form.destino_tipo === "VEICULO" ? "INSTALADO" : "DISPONIVEL";
      if (form.tipo_movimentacao === "ENVIO_MANUTENCAO") novoStatus = "MANUTENCAO";
      if (form.tipo_movimentacao === "RETORNO_MANUTENCAO") novoStatus = form.destino_tipo === "RESERVA" ? "RESERVA" : "DISPONIVEL";
      if (form.tipo_movimentacao === "TRANSFERENCIA") novoStatus = form.destino_tipo === "VEICULO" ? "INSTALADO" : embarcado.status_atual;
      if (form.tipo_movimentacao === "RETIRADA") novoStatus = "DISPONIVEL";
      if (form.tipo_movimentacao === "ENVIO_EXTERNO") novoStatus = "DESCONECTADO";
      if (form.tipo_movimentacao === "RETORNO_EXTERNO") novoStatus = "DISPONIVEL";

      const { error: movError } = await supabase.from("embarcados_movimentacoes").insert([
        {
          embarcado_id: form.embarcado_id,
          tipo_movimentacao: form.tipo_movimentacao,
          origem_tipo: form.origem_tipo || null,
          origem_valor: form.origem_valor || null,
          destino_tipo: form.destino_tipo || null,
          destino_valor: form.destino_valor || null,
          responsavel: form.responsavel || null,
          observacao: form.observacao || null,
        },
      ]);

      if (movError) {
        console.error(movError);
        alert(movError.message || "Erro ao salvar movimentação.");
        return;
      }

      if (form.tipo_movimentacao === "INSTALACAO" || (form.tipo_movimentacao === "TRANSFERENCIA" && form.destino_tipo === "VEICULO")) {
        await supabase.from("embarcados_instalacoes").update({
          ativo: false,
          data_retirada: new Date().toISOString(),
          retirado_por: form.responsavel || null,
        }).eq("embarcado_id", form.embarcado_id).eq("ativo", true);

        const { error: instError } = await supabase.from("embarcados_instalacoes").insert([
          {
            embarcado_id: form.embarcado_id,
            veiculo: form.destino_valor,
            instalado_por: form.responsavel || null,
            observacao: form.observacao || null,
            ativo: true,
          },
        ]);

        if (instError) {
          console.error(instError);
          alert(instError.message || "Erro ao criar instalação.");
          return;
        }
      }

      if (
        ["RETIRADA", "ENVIO_MANUTENCAO", "ENVIO_RESERVA", "ENVIO_EXTERNO"].includes(form.tipo_movimentacao)
      ) {
        await supabase.from("embarcados_instalacoes").update({
          ativo: false,
          data_retirada: new Date().toISOString(),
          retirado_por: form.responsavel || null,
        }).eq("embarcado_id", form.embarcado_id).eq("ativo", true);
      }

      const { error: embError } = await supabase
        .from("embarcados")
        .update({
          status_atual: novoStatus,
          localizacao_tipo: novaLocalizacaoTipo,
          localizacao_valor: novaLocalizacaoValor,
        })
        .eq("id", form.embarcado_id);

      if (embError) {
        console.error(embError);
        alert(embError.message || "Erro ao atualizar embarcado.");
        return;
      }

      setForm({
        embarcado_id: "",
        tipo_movimentacao: "INSTALACAO",
        origem_tipo: "ESTOQUE",
        origem_valor: "",
        destino_tipo: "VEICULO",
        destino_valor: "",
        responsavel: "",
        observacao: "",
      });

      await carregar();
    } finally {
      setSaving(false);
    }
  }

  const mostraVeiculoDestino = form.destino_tipo === "VEICULO";
  const mostraVeiculoOrigem = form.origem_tipo === "VEICULO";

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="bg-white rounded-2xl shadow-sm border p-5">
        <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
          <div>
            <div className="text-xs font-black text-gray-500 uppercase">Módulo</div>
            <h1 className="text-2xl font-black uppercase tracking-tight text-gray-900">
              Movimentações de Embarcados
            </h1>
            <p className="text-sm text-gray-500 font-semibold mt-1">
              Instalação, retirada, transferência, reserva, manutenção e envio.
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

      <div className="grid grid-cols-1 2xl:grid-cols-[520px_1fr] gap-4 mt-4">
        <form onSubmit={salvarMovimentacao} className="bg-white rounded-2xl border shadow-sm p-5 space-y-4">
          <div className="text-sm font-black uppercase text-gray-800 flex items-center gap-2">
            <FaExchangeAlt /> Nova movimentação
          </div>

          <div>
            <label className="text-[10px] font-black text-gray-500 uppercase mb-1 block">Embarcado</label>
            <select
              className="w-full border rounded-xl px-3 py-2 text-sm font-bold"
              value={form.embarcado_id}
              onChange={(e) => setForm({ ...form, embarcado_id: e.target.value })}
            >
              <option value="">Selecione...</option>
              {embarcados.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.numero_equipamento} - {e.tipo} ({e.status_atual})
                </option>
              ))}
            </select>
          </div>

          {embarcadoSelecionado && (
            <div className="rounded-xl border bg-gray-50 p-3 text-sm font-semibold text-gray-700">
              Origem atual: <span className="font-black">{embarcadoSelecionado.localizacao_tipo || "-"}</span>
              {" • "}
              <span className="font-black">{embarcadoSelecionado.localizacao_valor || "-"}</span>
            </div>
          )}

          <div>
            <label className="text-[10px] font-black text-gray-500 uppercase mb-1 block">Tipo de movimentação</label>
            <select
              className="w-full border rounded-xl px-3 py-2 text-sm font-bold"
              value={form.tipo_movimentacao}
              onChange={(e) => setForm({ ...form, tipo_movimentacao: e.target.value })}
            >
              {TIPOS_MOV.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-black text-gray-500 uppercase mb-1 block">Origem tipo</label>
              <select
                className="w-full border rounded-xl px-3 py-2 text-sm font-bold"
                value={form.origem_tipo}
                onChange={(e) => setForm({ ...form, origem_tipo: e.target.value, origem_valor: "" })}
              >
                {LOCAIS.map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-black text-gray-500 uppercase mb-1 block">Destino tipo</label>
              <select
                className="w-full border rounded-xl px-3 py-2 text-sm font-bold"
                value={form.destino_tipo}
                onChange={(e) => setForm({ ...form, destino_tipo: e.target.value, destino_valor: "" })}
              >
                {LOCAIS.map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-black text-gray-500 uppercase mb-1 block">Origem valor</label>
              {mostraVeiculoOrigem ? (
                <select
                  className="w-full border rounded-xl px-3 py-2 text-sm font-bold"
                  value={form.origem_valor}
                  onChange={(e) => setForm({ ...form, origem_valor: e.target.value })}
                >
                  <option value="">Selecione veículo...</option>
                  {prefixos.map((p) => (
                    <option key={p.codigo} value={p.codigo}>
                      {p.codigo} {p.cluster ? `- ${p.cluster}` : ""}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className="w-full border rounded-xl px-3 py-2 text-sm font-bold"
                  value={form.origem_valor}
                  onChange={(e) => setForm({ ...form, origem_valor: e.target.value })}
                  placeholder="Ex: Estoque Central / Oficina"
                />
              )}
            </div>

            <div>
              <label className="text-[10px] font-black text-gray-500 uppercase mb-1 block">Destino valor</label>
              {mostraVeiculoDestino ? (
                <select
                  className="w-full border rounded-xl px-3 py-2 text-sm font-bold"
                  value={form.destino_valor}
                  onChange={(e) => setForm({ ...form, destino_valor: e.target.value })}
                >
                  <option value="">Selecione veículo...</option>
                  {prefixos.map((p) => (
                    <option key={p.codigo} value={p.codigo}>
                      {p.codigo} {p.cluster ? `- ${p.cluster}` : ""}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className="w-full border rounded-xl px-3 py-2 text-sm font-bold"
                  value={form.destino_valor}
                  onChange={(e) => setForm({ ...form, destino_valor: e.target.value })}
                  placeholder="Ex: Reserva / Oficina / Terceiro"
                />
              )}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black text-gray-500 uppercase mb-1 block">Responsável</label>
            <input
              className="w-full border rounded-xl px-3 py-2 text-sm font-bold"
              value={form.responsavel}
              onChange={(e) => setForm({ ...form, responsavel: e.target.value })}
              placeholder="Nome do responsável"
            />
          </div>

          <div>
            <label className="text-[10px] font-black text-gray-500 uppercase mb-1 block">Observação</label>
            <textarea
              className="w-full border rounded-xl px-3 py-2 text-sm font-bold min-h-[90px]"
              value={form.observacao}
              onChange={(e) => setForm({ ...form, observacao: e.target.value })}
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full px-4 py-3 rounded-xl bg-gray-900 text-white font-black hover:bg-black disabled:opacity-60 flex items-center justify-center gap-2"
          >
            <FaSave /> {saving ? "Salvando..." : "Salvar movimentação"}
          </button>
        </form>

        <div className="bg-white rounded-2xl border shadow-sm p-5">
          <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between mb-4">
            <div className="text-sm font-black uppercase text-gray-800">Histórico de movimentações</div>

            <div className="flex items-center gap-2 border rounded-xl px-3 py-2 bg-white min-w-[280px]">
              <FaSearch className="text-gray-400" />
              <input
                className="w-full outline-none text-sm font-semibold"
                placeholder="Buscar histórico..."
                value={buscaHistorico}
                onChange={(e) => setBuscaHistorico(e.target.value)}
              />
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-center text-gray-500 font-black">Carregando histórico...</div>
          ) : historicoFiltrado.length === 0 ? (
            <div className="p-8 text-center text-gray-500 font-black">Nenhuma movimentação encontrada.</div>
          ) : (
            <div className="space-y-3">
              {historicoFiltrado.map((h) => (
                <div key={h.id} className="rounded-xl border bg-gray-50 p-4">
                  <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-2">
                    <div>
                      <div className="text-sm font-black text-gray-900">
                        {h.tipo_movimentacao} • {h.embarcados?.numero_equipamento || "-"}
                      </div>
                      <div className="text-xs font-semibold text-gray-500 mt-1">
                        {h.embarcados?.tipo || "-"} • {new Date(h.data_movimentacao || h.created_at).toLocaleString("pt-BR")}
                      </div>
                    </div>

                    <div className="text-xs font-black text-gray-600">
                      {h.responsavel || "Sem responsável"}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                    <div className="rounded-lg bg-white border p-3">
                      <div className="text-[10px] font-black text-gray-500 uppercase flex items-center gap-2">
                        <FaTruck /> Origem
                      </div>
                      <div className="text-sm font-black mt-1">{h.origem_tipo || "-"}</div>
                      <div className="text-xs text-gray-500 font-semibold mt-1">{h.origem_valor || "-"}</div>
                    </div>

                    <div className="rounded-lg bg-white border p-3">
                      <div className="text-[10px] font-black text-gray-500 uppercase flex items-center gap-2">
                        {h.destino_tipo === "RESERVA" ? <FaWarehouse /> : h.destino_tipo === "MANUTENCAO" ? <FaTools /> : <FaTruck />}
                        Destino
                      </div>
                      <div className="text-sm font-black mt-1">{h.destino_tipo || "-"}</div>
                      <div className="text-xs text-gray-500 font-semibold mt-1">{h.destino_valor || "-"}</div>
                    </div>
                  </div>

                  <div className="text-sm text-gray-700 font-semibold mt-3">
                    {h.observacao || "Sem observações."}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// src/pages/SOSFechamento.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../../supabase";
import { FaCheckCircle, FaTimes, FaWrench } from "react-icons/fa";

/* =======================
   AJUSTE DE DATA (CORRETO)
   - Preferir data_sos (DATE) -> não sofre fuso
   - Fallback: created_at exibindo em UTC -> não cai 1 dia
======================= */
function formatDateBRFromDateOnly(value) {
  // value esperado: "YYYY-MM-DD"
  if (!value) return "";
  const s = String(value).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "";
  const [, yyyy, mm, dd] = m;

  // cria a data como LOCAL (sem shift UTC)
  const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("pt-BR");
}

function formatDateBRFromUtcTimestamp(value) {
  // value esperado: ISO/timestamptz (created_at)
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  // Força a data em UTC para não “voltar 1 dia”
  return d.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

function formatDataSOS(row) {
  const ds = formatDateBRFromDateOnly(row?.data_sos);
  if (ds) return ds;
  return formatDateBRFromUtcTimestamp(row?.created_at);
}

export default function SOSFechamento() {
  const [acionamentos, setAcionamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  async function carregarSOS() {
    setLoading(true);

    const { data, error } = await supabase
      .from("sos_acionamentos")
      .select("*")
      .eq("status", "Aberto")
      // ordena pelo que você está exibindo (data_sos)
      .order("data_sos", { ascending: false, nullsFirst: false })
      // fallback de ordenação
      .order("created_at", { ascending: false });

    if (!error) setAcionamentos(data || []);
    setLoading(false);
  }

  useEffect(() => {
    carregarSOS();
  }, []);

  return (
    <div className="max-w-7xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">
        Fechamento do Acionamento - Operação
      </h1>

      <div className="bg-white shadow-lg rounded-lg overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-blue-600 text-white">
            <tr>
              <th className="py-3 px-4 text-left text-sm font-semibold">Número</th>
              <th className="py-3 px-4 text-left text-sm font-semibold">Data</th>
              <th className="py-3 px-4 text-left text-sm font-semibold">Prefixo</th>
              <th className="py-3 px-4 text-left text-sm font-semibold">Motorista</th>
              <th className="py-3 px-4 text-left text-sm font-semibold">Linha</th>
              <th className="py-3 px-4 text-left text-sm font-semibold">Local</th>
              <th className="py-3 px-4 text-center text-sm font-semibold">Ações</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan="7" className="text-center py-6 text-gray-600">
                  Carregando SOS...
                </td>
              </tr>
            ) : acionamentos.length === 0 ? (
              <tr>
                <td colSpan="7" className="text-center py-6 text-gray-600">
                  Nenhum SOS em aberto
                </td>
              </tr>
            ) : (
              acionamentos.map((a) => (
                <tr key={a.id} className="border-t hover:bg-gray-50 transition-colors">
                  <td className="py-3 px-4">{a.numero_sos}</td>

                  {/* DATA corrigida */}
                  <td className="py-3 px-4">{formatDataSOS(a)}</td>

                  <td className="py-3 px-4">{a.veiculo}</td>
                  <td className="py-3 px-4">{a.motorista_nome}</td>
                  <td className="py-3 px-4">{a.linha}</td>
                  <td className="py-3 px-4">{a.local_ocorrencia}</td>

                  <td className="py-3 px-4 text-center">
                    <button
                      onClick={() => setSelected(a)}
                      className="bg-yellow-400 hover:bg-yellow-500 text-black px-4 py-2 rounded-md text-sm flex items-center justify-center gap-2 font-medium transition"
                    >
                      <FaWrench className="text-black" /> Fechar Etiqueta
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <FechamentoModal
          sos={selected}
          onClose={() => setSelected(null)}
          onAtualizar={carregarSOS}
        />
      )}
    </div>
  );
}

// 🟨 Modal de Fechamento (sem alteração de campos)
function FechamentoModal({ sos, onClose, onAtualizar }) {
  const [form, setForm] = useState({
    avaliador: "",
    procedencia_socorrista: "Procedente",
    ocorrencia: "",
    carro_substituto: "",
    sr_numero: "",
  });

  const [saving, setSaving] = useState(false);
  const [prefixos, setPrefixos] = useState([]);

  // 🔹 Aqui foi feita a alteração: incluído "SOS"
  const ocorrencias = [
    "SEGUIU VIAGEM",
    "RECOLHEU",
    "TROCA",
    "AVARIA",
    "SOS",
    "IMPROCEDENTE",
  ];

  useEffect(() => {
    async function carregarPrefixos() {
      const { data } = await supabase.from("prefixos").select("codigo").order("codigo");
      setPrefixos(data || []);
    }
    carregarPrefixos();
  }, []);

  async function salvarFechamento() {
    if (!form.avaliador || !form.ocorrencia) {
      alert("Preencha todos os campos obrigatórios!");
      return;
    }

    setSaving(true);

    const { error } = await supabase
      .from("sos_acionamentos")
      .update({
        avaliador: form.avaliador,
        procedencia_socorrista: form.procedencia_socorrista,
        ocorrencia: form.ocorrencia,
        carro_substituto: form.carro_substituto,
        sr_numero: form.sr_numero,
        data_fechamento: new Date().toISOString(),
        status: "Em Andamento",
      })
      .eq("id", sos.id);

    setSaving(false);

    if (error) {
      alert("Erro ao salvar: " + error.message);
      return;
    }

    alert("Fechamento registrado com sucesso ✅");
    onAtualizar();
    onClose();
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 p-4 z-50">
      <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full animate-fadeIn overflow-y-auto max-h-[90vh]">
        {/* Cabeçalho */}
        <div className="flex justify-between items-center p-4 border-b bg-blue-50 rounded-t-lg">
          <h2 className="text-xl font-semibold text-gray-800">
            Fechamento do SOS #{sos.numero_sos}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-red-500 transition">
            <FaTimes size={20} />
          </button>
        </div>

        {/* Corpo */}
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-500 mb-1">Avaliador</label>
              <input
                type="text"
                className="w-full border rounded p-2"
                value={form.avaliador}
                onChange={(e) => setForm({ ...form, avaliador: e.target.value })}
                placeholder="Ex: Fernando"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-500 mb-1">Procedência</label>
              <select
                className="w-full border rounded p-2"
                value={form.procedencia_socorrista}
                onChange={(e) => setForm({ ...form, procedencia_socorrista: e.target.value })}
              >
                <option>Procedente</option>
                <option>Improcedente</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-500 mb-1">Ocorrência</label>
            <select
              className="w-full border rounded p-2"
              value={form.ocorrencia}
              onChange={(e) => setForm({ ...form, ocorrencia: e.target.value })}
            >
              <option value="">Selecione...</option>
              {ocorrencias.map((o, idx) => (
                <option key={idx} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-500 mb-1">
                Carro que entrou no lugar
              </label>
              <select
                className="w-full border rounded p-2"
                value={form.carro_substituto}
                onChange={(e) => setForm({ ...form, carro_substituto: e.target.value })}
              >
                <option value="">Selecione...</option>
                {prefixos.map((p) => (
                  <option key={p.codigo} value={p.codigo}>
                    {p.codigo}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-500 mb-1">SR (Operação)</label>
              <input
                type="text"
                className="w-full border rounded p-2"
                value={form.sr_numero}
                onChange={(e) => setForm({ ...form, sr_numero: e.target.value })}
                placeholder="Ex: SR12345"
              />
            </div>
          </div>
        </div>

        {/* Rodapé */}
        <div className="flex justify-end gap-3 p-4 border-t bg-gray-50 rounded-b-lg">
          <button
            onClick={salvarFechamento}
            disabled={saving}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md flex items-center gap-2 transition disabled:opacity-60"
          >
            <FaCheckCircle />
            {saving ? "Salvando..." : "Confirmar Fechamento"}
          </button>
        </div>
      </div>
    </div>
  );
}

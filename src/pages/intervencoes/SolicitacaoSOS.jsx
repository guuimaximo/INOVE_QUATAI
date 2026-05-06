// src/pages/SolicitacaoSOS.jsx
import { useState, useEffect } from "react";
import { supabase } from "../../supabase";
import CampoMotorista from "../../components/CampoMotorista";

// ✅ pega data/hora no fuso de São Paulo (para salvar no banco sem +3h)
function nowSP() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const get = (t) => parts.find((p) => p.type === t)?.value;

  const yyyy = get("year");
  const mm = get("month");
  const dd = get("day");
  const hh = get("hour");
  const mi = get("minute");
  const ss = get("second");

  return {
    data_sos: `${yyyy}-${mm}-${dd}`, // YYYY-MM-DD
    hora_sos: `${hh}:${mi}:${ss}`, // HH:MM:SS
  };
}

function formatDateBR(value) {
  if (!value) return "—";

  const txt = String(value).trim();

  if (txt.includes("T")) {
    const [date] = txt.split("T");
    const [yyyy, mm, dd] = date.split("-");
    return dd && mm && yyyy ? `${dd}/${mm}/${yyyy}` : txt;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(txt)) {
    const [yyyy, mm, dd] = txt.split("-");
    return `${dd}/${mm}/${yyyy}`;
  }

  return txt;
}

function calcularDiasDecorridos(dataInicio, dataFim) {
  if (!dataInicio || !dataFim) return null;

  const inicio = String(dataInicio).split("T")[0];
  const fim = String(dataFim).split("T")[0];

  const dt1 = new Date(`${inicio}T00:00:00`);
  const dt2 = new Date(`${fim}T00:00:00`);

  if (Number.isNaN(dt1.getTime()) || Number.isNaN(dt2.getTime())) return null;

  const diffMs = dt2.getTime() - dt1.getTime();
  return Math.max(0, Math.floor(diffMs / 86400000));
}

function montarResumoPreventiva(item, tipo, dias) {
  if (!item) {
    return `*${tipo}:* Não localizada`;
  }

  const numeroOS = item.numero_os || item.os || item.cd_ordem_servico || "—";
  const data = formatDateBR(item.data_realizacao || item.data || item.created_at);
  const km = item.km_veiculo || item.km || item.hodometro || "—";

  return [
    `*${tipo}:* OS ${numeroOS}`,
    `   Data: ${data}`,
    `   KM: ${km}`,
    `   Dias desde a execução: ${dias ?? "—"}`,
  ].join("\n");
}

export default function SolicitacaoSOS() {
  const [motorista, setMotorista] = useState({ chapa: "", nome: "" });

  const [form, setForm] = useState({
    plantonista: "",
    veiculo: "",
    reclamacao_motorista: "",
    local_ocorrencia: "",
    linha: "",
    tabela_operacional: "",
  });

  const [tabelas, setTabelas] = useState([]);
  const [linhas, setLinhas] = useState([]);
  const [prefixos, setPrefixos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [numeroSOS, setNumeroSOS] = useState(null);

  const agora = new Date();

  const dataAtual = agora.toLocaleDateString("pt-BR");

  const horaAtual = agora.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  useEffect(() => {
    async function carregarListas() {
      const { data: linhasData } = await supabase
        .from("linhas")
        .select("codigo, descricao")
        .order("codigo");

      const { data: tabelasData } = await supabase
        .from("tabelas_operacionais")
        .select("codigo, descricao");

      const { data: prefixosData } = await supabase
        .from("prefixos")
        .select("codigo")
        .order("codigo");

      setLinhas(linhasData || []);
      setTabelas(tabelasData || []);
      setPrefixos(prefixosData || []);
    }

    async function getNextSOS() {
      const { data, error } = await supabase
        .from("sos_acionamentos")
        .select("numero_sos")
        .order("numero_sos", { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== "PGRST116") console.error(error);

      setNumeroSOS(data ? Number(data.numero_sos) + 1 : 3000);
    }

    carregarListas();
    getNextSOS();
  }, []);

  async function buscarUltimaPreventivaInspecao(veiculo) {
    const prefixo = String(veiculo || "").trim();

    if (!prefixo) {
      return {
        preventiva: null,
        inspecao: null,
      };
    }

    const [prevResp, inspResp] = await Promise.all([
      supabase
        .from("preventivas")
        .select("*")
        .eq("prefixo", prefixo)
        .eq("tipo", "Preventiva - 10.000")
        .order("data_realizacao", { ascending: false })
        .limit(1)
        .maybeSingle(),

      supabase
        .from("preventivas")
        .select("*")
        .eq("prefixo", prefixo)
        .eq("tipo", "Inspeção - 5.000")
        .order("data_realizacao", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (prevResp.error) {
      console.warn("Erro ao buscar última preventiva:", prevResp.error);
    }

    if (inspResp.error) {
      console.warn("Erro ao buscar última inspeção:", inspResp.error);
    }

    return {
      preventiva: prevResp.data || null,
      inspecao: inspResp.data || null,
    };
  }

  async function salvarSOS() {
    if (
      !form.veiculo ||
      !motorista.chapa ||
      !motorista.nome ||
      !form.reclamacao_motorista
    ) {
      alert("Preencha veículo, motorista e reclamação!");
      return;
    }

    setLoading(true);

    try {
      // ✅ data/hora SP no momento do clique (evita salvar +3h no Supabase)
      const { data_sos, hora_sos } = nowSP();

      const { preventiva, inspecao } = await buscarUltimaPreventivaInspecao(
        form.veiculo
      );

      const diasUltimaPreventiva = preventiva?.data_realizacao
        ? calcularDiasDecorridos(preventiva.data_realizacao, data_sos)
        : null;

      const diasUltimaInspecao = inspecao?.data_realizacao
        ? calcularDiasDecorridos(inspecao.data_realizacao, data_sos)
        : null;

      const payload = {
        numero_sos: numeroSOS,
        plantonista: form.plantonista,
        veiculo: form.veiculo,
        motorista_id: motorista.chapa,
        motorista_nome: motorista.nome,
        reclamacao_motorista: form.reclamacao_motorista,
        local_ocorrencia: form.local_ocorrencia,
        linha: form.linha,
        tabela_operacional: form.tabela_operacional,
        status: "Aberto",

        // ✅ campos corretos para o dashboard
        data_sos,
        hora_sos,

        // ✅ vínculo com última preventiva/inspeção
        os_ultima_preventiva:
          preventiva?.numero_os ||
          preventiva?.os ||
          preventiva?.cd_ordem_servico ||
          null,

        os_ultima_inspecao:
          inspecao?.numero_os ||
          inspecao?.os ||
          inspecao?.cd_ordem_servico ||
          null,

        dias_ultima_preventiva: diasUltimaPreventiva,
        dias_ultima_inspecao: diasUltimaInspecao,
      };

      const { error } = await supabase.from("sos_acionamentos").insert(payload);

      if (error) throw error;

      const mensagem = [
        `*Acionamento:* ${numeroSOS}`,
        `*Data:* ${formatDateBR(data_sos)}`,
        `*Hora:* ${hora_sos.slice(0, 5)}`,
        `*Veículo:* ${form.veiculo}`,
        `*Motorista:* ${motorista.chapa} - ${motorista.nome}`,
        `*Linha:* ${form.linha || "—"}`,
        `*Local:* ${form.local_ocorrencia || "—"}`,
        `*Defeito:* ${form.reclamacao_motorista}`,
        `*Plantonista:* ${form.plantonista || "—"}`,
        "",
        "*Histórico do veículo:*",
        montarResumoPreventiva(
          preventiva,
          "Última Preventiva",
          diasUltimaPreventiva
        ),
        "",
        montarResumoPreventiva(
          inspecao,
          "Última Inspeção",
          diasUltimaInspecao
        ),
      ].join("\n");

      await navigator.clipboard.writeText(mensagem);

      alert("Solicitação registrada! Mensagem copiada para WhatsApp ✅");

      setForm({
        plantonista: "",
        veiculo: "",
        reclamacao_motorista: "",
        local_ocorrencia: "",
        linha: "",
        tabela_operacional: "",
      });

      setMotorista({ chapa: "", nome: "" });
      setNumeroSOS((prev) => Number(prev || numeroSOS) + 1);
    } catch (err) {
      console.error(err);
      alert("Erro ao salvar: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto bg-white p-6 rounded shadow">
      <h1 className="text-2xl font-bold mb-4 text-gray-800">
        Acionamentos de Intervenção - Operação
      </h1>

      {/* Cabeçalho */}
      <div className="flex justify-between mb-4">
        <div>
          <p className="text-sm text-gray-500">Número do Acionamento</p>
          <p className="text-xl font-semibold text-blue-600">
            {numeroSOS || "..."}
          </p>
        </div>

        <div className="text-right">
          <p className="text-sm text-gray-500">Data e Hora</p>
          <p className="text-xl font-semibold text-gray-700">
            {dataAtual} • {horaAtual}
          </p>
        </div>
      </div>

      {/* Formulário */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-sm text-gray-600">Plantonista</label>

          <input
            type="text"
            className="w-full border rounded p-2"
            value={form.plantonista}
            onChange={(e) => setForm({ ...form, plantonista: e.target.value })}
          />
        </div>

        {/* Prefixo do veículo */}
        <div>
          <label className="text-sm text-gray-600">Prefixo do Veículo</label>

          <select
            className="w-full border rounded p-2"
            value={form.veiculo}
            onChange={(e) => setForm({ ...form, veiculo: e.target.value })}
          >
            <option value="">Selecione...</option>

            {prefixos.map((p) => (
              <option key={p.codigo} value={p.codigo}>
                {p.codigo}
              </option>
            ))}
          </select>
        </div>

        {/* Motorista (componente padrão) */}
        <div className="md:col-span-2">
          <CampoMotorista value={motorista} onChange={setMotorista} />
        </div>

        <div>
          <label className="text-sm text-gray-600">Local</label>

          <input
            type="text"
            className="w-full border rounded p-2"
            value={form.local_ocorrencia}
            onChange={(e) =>
              setForm({ ...form, local_ocorrencia: e.target.value })
            }
          />
        </div>

        <div>
          <label className="text-sm text-gray-600">Linha</label>

          <select
            className="w-full border rounded p-2"
            value={form.linha}
            onChange={(e) => setForm({ ...form, linha: e.target.value })}
          >
            <option value="">Selecione</option>

            {linhas.map((l) => (
              <option key={l.codigo} value={l.codigo}>
                {l.codigo} - {l.descricao}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm text-gray-600">Tabela Operacional</label>

          <select
            className="w-full border rounded p-2"
            value={form.tabela_operacional}
            onChange={(e) =>
              setForm({ ...form, tabela_operacional: e.target.value })
            }
          >
            <option value="">Selecione</option>

            {tabelas.map((t) => (
              <option key={t.codigo} value={t.codigo}>
                {t.descricao}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="text-sm text-gray-600">Reclamação / Defeito</label>

          <textarea
            rows="3"
            className="w-full border rounded p-2"
            value={form.reclamacao_motorista}
            onChange={(e) =>
              setForm({ ...form, reclamacao_motorista: e.target.value })
            }
          />
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <button
          onClick={salvarSOS}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
        >
          {loading ? "Salvando..." : "Enviar SOS"}
        </button>
      </div>
    </div>
  );
}

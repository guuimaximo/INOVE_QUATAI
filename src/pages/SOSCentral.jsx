// src/pages/SOSCentral.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import {
  FaSearch,
  FaEye,
  FaTimes,
  FaLock,
  FaEdit,
  FaSave,
  FaSort,
  FaSortUp,
  FaSortDown,
} from "react-icons/fa";

/* =======================
   AJUSTES (NOVO)
======================= */
const OCORRENCIAS_CARDS = [
  "SOS",
  "RECOLHEU",
  "TROCA",
  "AVARIA",
  "IMPROCEDENTE",
  "SEGUIU VIAGEM",
];

// campo principal de data para filtro/ordenação/exibição
const DATE_FIELD = "data_sos";

function pickBestDate(row) {
  return (
    row?.[DATE_FIELD] ||
    row?.data_sos ||
    row?.data_fechamento ||
    row?.data_encerramento ||
    row?.created_at ||
    null
  );
}

function parseToDate(value) {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const s = String(value).trim();

  // DD/MM/YYYY (local)
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) {
    const [, dd, mm, yyyy] = br;
    const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // YYYY-MM-DD (local)
  const isoDate = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoDate) {
    const [, yyyy, mm, dd] = isoDate;
    const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDateBR(value) {
  const d = parseToDate(value);
  return d ? d.toLocaleDateString("pt-BR") : "—";
}

function monthRange(yyyyMm) {
  if (!yyyyMm) return { start: "", end: "" };
  const [y, m] = yyyyMm.split("-").map(Number);

  const pad2 = (n) => String(n).padStart(2, "0");
  const start = `${y}-${pad2(m)}-01`;

  const lastDay = new Date(y, m, 0).getDate();
  const end = `${y}-${pad2(m)}-${pad2(lastDay)}`;

  return { start, end };
}

function calcularDiasDecorridos(data) {
  if (!data) return null;

  const hoje = new Date();
  const base = new Date(`${data}T00:00:00`);

  if (Number.isNaN(base.getTime())) return null;

  hoje.setHours(0, 0, 0, 0);
  base.setHours(0, 0, 0, 0);

  const diffMs = hoje.getTime() - base.getTime();
  return diffMs < 0 ? 0 : Math.floor(diffMs / 86400000);
}

/* =======================
   STATUS: LABEL + TAG
======================= */
function statusLabel(status) {
  const s = String(status || "").toUpperCase().trim();
  if (s === "ABERTO") return "AG. OPERAÇÃO";
  if (s === "EM ANDAMENTO") return "AG. MANUTENÇÃO";
  return "";
}

function StatusTag({ status }) {
  const label = statusLabel(status);
  if (!label) return null;
  return (
    <span className="bg-red-600 text-white px-2 py-1 rounded text-xs font-semibold">
      {label}
    </span>
  );
}

/* --- Modal de Login --- */
function LoginModal({ onConfirm, onCancel, title = "Acesso Restrito" }) {
  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setLoading(true);
    const { data, error } = await supabase
      .from("usuarios_aprovadores")
      .select("*")
      .eq("login", login)
      .eq("senha", senha)
      .eq("ativo", true)
      .single();
    setLoading(false);

    if (error || !data) {
      alert("Login ou senha incorretos!");
      return;
    }
    onConfirm({ nome: data.nome, login: data.login });
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-60 z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg w-80">
        <h2 className="text-xl font-bold mb-4 text-gray-800 flex items-center gap-2">
          <FaLock /> {title}
        </h2>
        <input
          type="text"
          placeholder="Login"
          className="w-full mb-3 p-2 border rounded"
          value={login}
          onChange={(e) => setLogin(e.target.value)}
        />
        <input
          type="password"
          placeholder="Senha"
          className="w-full mb-4 p-2 border rounded"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
        />
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
          >
            Cancelar
          </button>
          <button
            onClick={handleLogin}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            {loading ? "Verificando..." : "Entrar"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* --- Modal de Detalhes do SOS --- */
function DetalheSOSModal({ sos, onClose, onAtualizar }) {
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({});
  const [loginModalOpen, setLoginModalOpen] = useState(false);

  useEffect(() => {
    if (sos) setFormData(sos);
  }, [sos]);

  function solicitarLogin() {
    setLoginModalOpen(true);
  }

  async function onLoginConfirm() {
    setLoginModalOpen(false);
    setEditMode(true);
  }

  async function salvarAlteracoes() {
    const dataPrev = formData.data_ultima_preventiva || null;
    const dataInsp = formData.data_ultima_inspecao || null;

    const { error } = await supabase
      .from("sos_acionamentos")
      .update({
        ...formData,
        dias_ultima_preventiva: calcularDiasDecorridos(dataPrev),
        dias_ultima_inspecao: calcularDiasDecorridos(dataInsp),
        atualizado_em: new Date().toISOString(),
      })
      .eq("id", sos.id);

    if (error) {
      alert("Erro ao salvar: " + error.message);
      return;
    }

    alert("Alterações salvas com sucesso ✅");
    onAtualizar(true);
    setEditMode(false);
    onClose();
  }

  const renderField = (
    label,
    field,
    multiline = false,
    type = "text",
    readOnly = false
  ) => (
    <div>
      <label className="text-sm text-gray-500">{label}</label>
      {editMode && !readOnly ? (
        multiline ? (
          <textarea
            className="border p-2 rounded w-full"
            rows="2"
            value={formData[field] || ""}
            onChange={(e) =>
              setFormData({ ...formData, [field]: e.target.value })
            }
          />
        ) : (
          <input
            type={type}
            className="border p-2 rounded w-full"
            value={formData[field] || ""}
            onChange={(e) =>
              setFormData({ ...formData, [field]: e.target.value })
            }
          />
        )
      ) : (
        <p className="bg-gray-50 p-2 border rounded">
          {formData[field] || "—"}
        </p>
      )}
    </div>
  );

  const renderReadCalcField = (label, value) => (
    <div>
      <label className="text-sm text-gray-500">{label}</label>
      <p className="bg-gray-50 p-2 border rounded">{value ?? "—"}</p>
    </div>
  );

  const renderControlabilidadeField = () => (
    <div>
      <label className="text-sm text-gray-500">Classificação</label>
      {editMode ? (
        <div className="flex flex-wrap gap-2 mt-1">
          <button
            type="button"
            onClick={() =>
              setFormData({
                ...formData,
                classificacao_controlabilidade: "Não Controlável",
              })
            }
            className={`px-3 py-2 rounded text-sm font-semibold border transition ${
              formData.classificacao_controlabilidade === "Não Controlável"
                ? "bg-yellow-400 border-yellow-500 text-gray-900"
                : "bg-white border-yellow-300 text-yellow-700 hover:bg-yellow-50"
            }`}
          >
            Não controlável
          </button>

          <button
            type="button"
            onClick={() =>
              setFormData({
                ...formData,
                classificacao_controlabilidade: "Controlável",
              })
            }
            className={`px-3 py-2 rounded text-sm font-semibold border transition ${
              formData.classificacao_controlabilidade === "Controlável"
                ? "bg-red-600 border-red-700 text-white"
                : "bg-white border-red-300 text-red-700 hover:bg-red-50"
            }`}
          >
            Controlável
          </button>
        </div>
      ) : (
        <div className="mt-1">
          {formData.classificacao_controlabilidade === "Não Controlável" ? (
            <span className="inline-flex bg-yellow-400 text-gray-900 px-3 py-2 rounded text-sm font-semibold">
              Não controlável
            </span>
          ) : formData.classificacao_controlabilidade === "Controlável" ? (
            <span className="inline-flex bg-red-600 text-white px-3 py-2 rounded text-sm font-semibold">
              Controlável
            </span>
          ) : (
            <p className="bg-gray-50 p-2 border rounded">—</p>
          )}
        </div>
      )}
    </div>
  );

  const diasPreventiva =
    formData.dias_ultima_preventiva ??
    calcularDiasDecorridos(formData.data_ultima_preventiva);

  const diasInspecao =
    formData.dias_ultima_inspecao ??
    calcularDiasDecorridos(formData.data_ultima_inspecao);

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-60 z-40 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-bold text-gray-800">
            Detalhes do SOS #{sos.numero_sos}
          </h2>
          <div className="flex items-center gap-2">
            {!editMode ? (
              <button
                onClick={solicitarLogin}
                className="bg-yellow-500 text-white px-3 py-1 rounded flex items-center gap-1 hover:bg-yellow-600"
              >
                <FaEdit /> Editar
              </button>
            ) : (
              <button
                onClick={salvarAlteracoes}
                className="bg-blue-600 text-white px-3 py-1 rounded flex items-center gap-1 hover:bg-blue-700"
              >
                <FaSave /> Salvar
              </button>
            )}
            <button
              onClick={onClose}
              className="text-gray-600 hover:text-gray-900"
            >
              <FaTimes size={20} />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto text-sm">
          <h3 className="font-semibold text-blue-700">Informações Gerais</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {renderField("Criado em", "created_at")}
            {renderField("Número SOS", "numero_sos")}
            {renderField("Plantonista", "plantonista")}
            {renderField("Data SOS", "data_sos", false, "date")}
            {renderField("Hora SOS", "hora_sos")}
            {renderField("Veículo", "veiculo")}
          </div>

          <h3 className="font-semibold text-yellow-700 mt-4">
            Dados do Motorista e Ocorrência
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {renderField("Motorista ID", "motorista_id")}
            {renderField("Motorista Nome", "motorista_nome")}
            {renderField("Reclamação Motorista", "reclamacao_motorista", true)}
            {renderField("Local Ocorrência", "local_ocorrencia")}
            {renderField("Linha", "linha")}
            {renderField("Tabela Operacional", "tabela_operacional")}
          </div>

          <h3 className="font-semibold text-green-700 mt-4">
            Atendimento e Manutenção
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {renderField("Avaliador Manutenção", "avaliador_manutencao")}
            {renderField("Procedência do Socorro", "procedencia_socorro")}
            {renderField("Ocorrência", "ocorrencia")}
            {renderField("SR Número", "sr_numero")}
            {renderField("Setor Manutenção", "setor_manutencao")}
            {renderField("Grupo Manutenção", "grupo_manutencao")}
            {renderField("Problema Encontrado", "problema_encontrado", true)}
            {renderField("Mecânico Executor", "mecanico_executor")}
            {renderField("Número OS Corretiva", "numero_os_corretiva")}
          </div>

          <h3 className="font-semibold text-orange-700 mt-4">
            Preventiva e Inspeção
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {renderField(
              "Data da Última Preventiva",
              "data_ultima_preventiva",
              false,
              "date"
            )}
            {renderField("KM Rodado Preventiva", "km_rodado_preventiva")}
            {renderReadCalcField("Dias desde a Preventiva", diasPreventiva)}

            {renderField(
              "Data da Última Inspeção",
              "data_ultima_inspecao",
              false,
              "date"
            )}
            {renderField("KM Rodado Inspeção", "km_rodado_inspecao")}
            {renderReadCalcField("Dias desde a Inspeção", diasInspecao)}
          </div>

          <h3 className="font-semibold text-purple-700 mt-4">
            Classificação
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {renderControlabilidadeField()}
          </div>

          <h3 className="font-semibold text-red-700 mt-4">Fechamento</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {renderField("Solucionador", "solucionador")}
            {renderField("Solução", "solucao", true)}
          </div>
        </div>

        {loginModalOpen && (
          <LoginModal
            onConfirm={onLoginConfirm}
            onCancel={() => setLoginModalOpen(false)}
          />
        )}
      </div>
    </div>
  );
}

/* --- Página Principal: CENTRAL SOS --- */
export default function SOSCentral() {
  const PAGE_SIZE = 200;

  const [sosList, setSosList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const [busca, setBusca] = useState("");
  const [selected, setSelected] = useState(null);

  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");

  const [mesRef, setMesRef] = useState("");
  const [ocorrenciaFiltro, setOcorrenciaFiltro] = useState("");

  const [sortBy, setSortBy] = useState(DATE_FIELD);
  const [sortAsc, setSortAsc] = useState(false);

  const [page, setPage] = useState(0);

  function buildQuery() {
    let query = supabase.from("sos_acionamentos").select("*");

    if (mesRef) {
      const { start, end } = monthRange(mesRef);
      if (start) query = query.gte(DATE_FIELD, start);
      if (end) query = query.lte(DATE_FIELD, end);
    }

    if (dataInicio) query = query.gte(DATE_FIELD, dataInicio);
    if (dataFim) query = query.lte(DATE_FIELD, dataFim);

    if (ocorrenciaFiltro) {
      query = query.ilike("ocorrencia", ocorrenciaFiltro);
    }

    query = query.order(sortBy, { ascending: sortAsc, nullsFirst: false });

    return query;
  }

  async function carregarSOS(reset = false) {
    if (reset) {
      setLoading(true);
      setPage(0);
      setHasMore(true);
    } else {
      setLoadingMore(true);
    }

    const currentPage = reset ? 0 : page;
    const from = currentPage * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, error } = await buildQuery().range(from, to);

    if (error) {
      console.error(error.message);
      setLoading(false);
      setLoadingMore(false);
      return;
    }

    const newRows = data || [];
    const merged = reset ? newRows : [...sosList, ...newRows];
    setSosList(merged);

    setHasMore(newRows.length === PAGE_SIZE);

    setPage(currentPage + 1);
    setLoading(false);
    setLoadingMore(false);
  }

  useEffect(() => {
    carregarSOS(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    carregarSOS(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataInicio, dataFim, mesRef, sortBy, sortAsc, ocorrenciaFiltro]);

  const filtrados = useMemo(() => {
    const termo = busca.toLowerCase().trim();
    if (!termo) return sosList;

    return sosList.filter((s) => {
      return (
        s.numero_sos?.toString().toLowerCase().includes(termo) ||
        s.veiculo?.toLowerCase().includes(termo) ||
        s.motorista_nome?.toLowerCase().includes(termo) ||
        s.ocorrencia?.toLowerCase().includes(termo)
      );
    });
  }, [busca, sosList]);

  const counts = useMemo(() => {
    const obj = {};
    OCORRENCIAS_CARDS.forEach((key) => {
      obj[key] = filtrados.filter(
        (item) => String(item.ocorrencia || "").toUpperCase().trim() === key
      ).length;
    });
    return obj;
  }, [filtrados]);

  function toggleSort(field) {
    if (sortBy === field) {
      setSortAsc((v) => !v);
    } else {
      setSortBy(field);
      setSortAsc(true);
    }
  }

  function SortIcon({ field }) {
    if (sortBy !== field) return <FaSort className="inline ml-2 opacity-70" />;
    return sortAsc ? (
      <FaSortUp className="inline ml-2" />
    ) : (
      <FaSortDown className="inline ml-2" />
    );
  }

  function handleCardClick(card) {
    setOcorrenciaFiltro((prev) => (prev === card ? "" : card));
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">
        Central de Intervenções
      </h1>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
        {OCORRENCIAS_CARDS.map((key) => (
          <CardResumo
            key={key}
            titulo={key}
            valor={counts[key] || 0}
            cor={cores[key]}
            ativo={ocorrenciaFiltro === key}
            onClick={() => handleCardClick(key)}
          />
        ))}
      </div>

      <div className="bg-white shadow rounded-lg p-4 mb-6 flex flex-wrap gap-3 items-center">
        <FaSearch className="text-gray-500" />
        <input
          type="text"
          placeholder="Buscar por número, veículo, motorista ou ocorrência..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="border rounded-md px-3 py-2 flex-1"
        />

        <input
          type="month"
          value={mesRef}
          onChange={(e) => setMesRef(e.target.value)}
          className="border rounded-md px-3 py-2"
          title="Filtrar por mês"
        />

        <input
          type="date"
          value={dataInicio}
          onChange={(e) => setDataInicio(e.target.value)}
          className="border rounded-md px-3 py-2"
        />
        <input
          type="date"
          value={dataFim}
          onChange={(e) => setDataFim(e.target.value)}
          className="border rounded-md px-3 py-2"
        />

        <select
          value={ocorrenciaFiltro}
          onChange={(e) => setOcorrenciaFiltro(e.target.value)}
          className="border rounded-md px-3 py-2"
        >
          <option value="">Todas ocorrências</option>
          {OCORRENCIAS_CARDS.map((oc) => (
            <option key={oc} value={oc}>
              {oc}
            </option>
          ))}
        </select>

        <button
          onClick={() => carregarSOS(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
        >
          Aplicar
        </button>
      </div>

      <div className="bg-white shadow rounded-lg overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-blue-600 text-white">
            <tr>
              <ThSortable label="Número" onClick={() => toggleSort("numero_sos")}>
                <SortIcon field="numero_sos" />
              </ThSortable>

              <ThSortable label="Data" onClick={() => toggleSort(DATE_FIELD)}>
                <SortIcon field={DATE_FIELD} />
              </ThSortable>

              <ThSortable label="Prefixo" onClick={() => toggleSort("veiculo")}>
                <SortIcon field="veiculo" />
              </ThSortable>

              <ThSortable
                label="Motorista"
                onClick={() => toggleSort("motorista_nome")}
              >
                <SortIcon field="motorista_nome" />
              </ThSortable>

              <ThSortable
                label="Ocorrência"
                onClick={() => toggleSort("ocorrencia")}
              >
                <SortIcon field="ocorrencia" />
              </ThSortable>

              <th className="py-3 px-4 text-center">Ações</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan="6" className="text-center py-6 text-gray-600">
                  Carregando...
                </td>
              </tr>
            ) : filtrados.length === 0 ? (
              <tr>
                <td colSpan="6" className="text-center py-6 text-gray-600">
                  Nenhum SOS encontrado.
                </td>
              </tr>
            ) : (
              filtrados.map((s) => {
                const st = String(s.status || "").toUpperCase().trim();
                const isPendente = st === "ABERTO" || st === "EM ANDAMENTO";

                return (
                  <tr
                    key={s.id}
                    className={`border-t transition ${
                      isPendente
                        ? "bg-red-50 hover:bg-red-100"
                        : "hover:bg-gray-50"
                    }`}
                  >
                    <td className="py-3 px-4">{s.numero_sos}</td>

                    <td className="py-3 px-4">
                      {formatDateBR(pickBestDate(s))}
                    </td>

                    <td className="py-3 px-4">{s.veiculo}</td>
                    <td className="py-3 px-4">{s.motorista_nome}</td>

                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <OcorrenciaTag ocorrencia={s.ocorrencia} />
                        <StatusTag status={s.status} />
                      </div>
                    </td>

                    <td className="py-3 px-4 text-center">
                      <button
                        className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1.5 rounded-md text-sm flex items-center gap-2 mx-auto"
                        onClick={() => setSelected(s)}
                      >
                        <FaEye /> Consultar
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {!loading && hasMore && (
          <div className="p-4 border-t flex justify-center">
            <button
              onClick={() => carregarSOS(false)}
              disabled={loadingMore}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-60"
            >
              {loadingMore ? "Carregando..." : "Carregar mais"}
            </button>
          </div>
        )}
      </div>

      {selected && (
        <DetalheSOSModal
          sos={selected}
          onClose={() => setSelected(null)}
          onAtualizar={() => {
            carregarSOS(true);
          }}
        />
      )}
    </div>
  );
}

/* --- Helpers UI --- */
function ThSortable({ label, onClick, children }) {
  return (
    <th
      className="py-3 px-4 text-left cursor-pointer select-none hover:bg-blue-700 transition"
      onClick={onClick}
      title="Clique para ordenar"
    >
      <span className="inline-flex items-center">
        {label} {children}
      </span>
    </th>
  );
}

const cores = {
  SOS: "bg-red-600 text-white",
  RECOLHEU: "bg-blue-600 text-white",
  TROCA: "bg-yellow-400 text-black",
  AVARIA: "bg-gray-700 text-white",
  IMPROCEDENTE: "bg-purple-600 text-white",
  "SEGUIU VIAGEM": "bg-green-600 text-white",
};

function CardResumo({ titulo, valor, cor, ativo, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${cor} rounded-lg shadow p-3 text-center transition w-full ${
        ativo ? "ring-4 ring-offset-2 ring-blue-300 scale-[1.02]" : "opacity-95 hover:opacity-100"
      }`}
    >
      <h3 className="text-xs font-medium">{titulo}</h3>
      <p className="text-2xl font-bold mt-1">{valor}</p>
    </button>
  );
}

function OcorrenciaTag({ ocorrencia }) {
  const o = (ocorrencia || "").toUpperCase();
  const estilo = cores[o] || "bg-gray-300 text-gray-700";
  return (
    <span className={`${estilo} px-2 py-1 rounded text-xs font-semibold`}>
      {o || "—"}
    </span>
  );
}

// src/pages/AtasResumo.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import * as XLSX from "xlsx";

function toISODateOnly(d) {
  if (!d) return "";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toISOString().slice(0, 10);
}

function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return toISODateOnly(d);
}

function normStr(v) {
  return String(v ?? "").trim();
}

function ilikeContains(hay, needle) {
  return normStr(hay).toLowerCase().includes(normStr(needle).toLowerCase());
}

function countBy(arr, keyFn) {
  const m = new Map();
  for (const it of arr) {
    const k = keyFn(it);
    m.set(k, (m.get(k) || 0) + 1);
  }
  return m;
}

function sortMapDesc(m) {
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

function Badge({ children, tone = "gray" }) {
  const cls =
    {
      gray: "bg-gray-100 text-gray-700 border-gray-200",
      blue: "bg-blue-50 text-blue-700 border-blue-200",
      green: "bg-green-50 text-green-700 border-green-200",
      yellow: "bg-yellow-50 text-yellow-700 border-yellow-200",
      red: "bg-red-50 text-red-700 border-red-200",
      purple: "bg-purple-50 text-purple-700 border-purple-200",
      indigo: "bg-indigo-50 text-indigo-700 border-indigo-200",
    }[tone] || "bg-gray-100 text-gray-700 border-gray-200";

  return <span className={`inline-flex items-center px-2 py-1 text-xs border rounded ${cls}`}>{children}</span>;
}

function Card({ title, children, right = null }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <div className="font-semibold text-gray-800">{title}</div>
        {right}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function CardResumo({ titulo, valor, cor }) {
  return (
    <div className={`${cor} rounded-xl shadow-sm border border-gray-200 p-6 text-center`}>
      <h3 className="text-sm font-medium text-gray-700">{titulo}</h3>
      <p className="text-4xl font-extrabold mt-2 text-gray-900">{valor}</p>
    </div>
  );
}

function ListItemButton({ label, value, onClick, active = false, sub = null }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left flex items-center justify-between gap-3 px-3 py-2 rounded-lg border transition ${
        active ? "bg-blue-50 border-blue-200" : "bg-white border-gray-200 hover:bg-gray-50"
      }`}
    >
      <div className="min-w-0">
        <div className="text-sm font-medium text-gray-800 truncate">{label}</div>
        {sub ? <div className="text-xs text-gray-500 truncate">{sub}</div> : null}
      </div>
      <div className="shrink-0">
        <span className="text-xs font-semibold px-2 py-1 rounded bg-gray-100 text-gray-700">{value}</span>
      </div>
    </button>
  );
}

export default function AtasResumo() {
  const [filtros, setFiltros] = useState({
    dataInicio: "",
    dataFim: "",
    busca: "",
    setor: "",
    status: "",
  });

  const [setoresDisponiveis, setSetoresDisponiveis] = useState([]);

  const [loading, setLoading] = useState(false);
  const [atas, setAtas] = useState([]);
  const [detalhes, setDetalhes] = useState([]);

  // Drill-down (cliques)
  const [selOcorrencia, setSelOcorrencia] = useState("");
  const [selMotorista, setSelMotorista] = useState(""); // chave: chapa|nome
  const [selAcao, setSelAcao] = useState("");
  const [selLinha, setSelLinha] = useState(""); 

  // Cards (igual Central)
  const [totalCount, setTotalCount] = useState(0);
  const [pendentesCount, setPendentesCount] = useState(0);
  const [concluidasCount, setConcluidasCount] = useState(0);
  const [atrasadasCount, setAtrasadasCount] = useState(0);

  // default período: mês atual e carrega setores
  useEffect(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    setFiltros((f) => ({
      ...f,
      dataInicio: toISODateOnly(start),
      dataFim: toISODateOnly(end),
    }));

    async function carregarSetores() {
      const { data } = await supabase.from("tratativas").select("setor_origem");
      if (data) {
        const unicos = [...new Set(data.map((d) => d.setor_origem).filter(Boolean))];
        setSetoresDisponiveis(unicos.sort());
      }
    }
    
    carregarSetores();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resetDrill() {
    setSelOcorrencia("");
    setSelMotorista("");
    setSelAcao("");
    setSelLinha(""); 
  }

  function computeCardsFromList(list) {
    const total = list.length;

    const pend = list.filter((t) => ilikeContains(t.status, "pend")).length;

    const conc = list.filter(
      (t) => ilikeContains(t.status, "conclu") || ilikeContains(t.status, "resolvid")
    ).length;

    const date10DaysAgo = new Date();
    date10DaysAgo.setDate(date10DaysAgo.getDate() - 10);
    const atr = list.filter((t) => {
      if (!ilikeContains(t.status, "pend")) return false;
      if (!t.created_at) return false;
      const d = new Date(t.created_at);
      return !Number.isNaN(d.getTime()) && d < date10DaysAgo;
    }).length;

    setTotalCount(total);
    setPendentesCount(pend);
    setConcluidasCount(conc);
    setAtrasadasCount(atr);
  }

  async function carregar() {
    setLoading(true);
    try {
      resetDrill();

      const LINHA_FIELD = "linha"; 

      let q = supabase.from("tratativas").select(
        `
          id,
          motorista_id,
          motorista_nome,
          motorista_chapa,
          tipo_ocorrencia,
          setor_origem,
          prioridade,
          status,
          descricao,
          ${LINHA_FIELD},
          created_at
        `
      );

      if (filtros.busca) {
        const b = filtros.busca.trim();
        q = q.or(
          `motorista_nome.ilike.%${b}%,motorista_chapa.ilike.%${b}%,descricao.ilike.%${b}%,tipo_ocorrencia.ilike.%${b}%,${LINHA_FIELD}.ilike.%${b}%`
        );
      }
      if (filtros.setor) q = q.eq("setor_origem", filtros.setor);
      if (filtros.status) q = q.ilike("status", `%${filtros.status}%`);

      if (filtros.dataInicio) q = q.gte("created_at", filtros.dataInicio);
      if (filtros.dataFim) q = q.lt("created_at", addDays(filtros.dataFim, 1));

      const { data: tData, error: tErr } = await q.order("created_at", { ascending: false }).limit(100000);
      if (tErr) throw tErr;

      const listAtas = tData || [];
      setAtas(listAtas);
      computeCardsFromList(listAtas);

      const ids = listAtas.map((x) => x.id).filter(Boolean);
      if (!ids.length) {
        setDetalhes([]);
        return;
      }

      const CHUNK = 500;
      const allDet = [];
      for (let i = 0; i < ids.length; i += CHUNK) {
        const part = ids.slice(i, i + CHUNK);
        const { data: dData, error: dErr } = await supabase
          .from("tratativas_detalhes")
          .select(
            `
              id,
              created_at,
              tratativa_id,
              acao_aplicada,
              observacoes,
              tratado_por_login,
              tratado_por_nome
            `
          )
          .in("tratativa_id", part)
          .order("created_at", { ascending: false });

        if (dErr) throw dErr;
        allDet.push(...(dData || []));
      }

      setDetalhes(allDet);
    } catch (e) {
      console.error("Erro ao carregar resumo de atas:", e);
      alert("Erro ao carregar Resumo de Atas. Verifique o console.");
    } finally {
      setLoading(false);
    }
  }

  async function aplicar() {
    await carregar();
  }

  const ataById = useMemo(() => {
    const m = new Map();
    for (const t of atas) m.set(t.id, t);
    return m;
  }, [atas]);

  const detalhesJoin = useMemo(() => {
    return (detalhes || []).map((d) => {
      const t = ataById.get(d.tratativa_id);
      return {
        ...d,
        motorista_nome: t?.motorista_nome ?? "",
        motorista_chapa: t?.motorista_chapa ?? "",
        motorista_id: t?.motorista_id ?? "",
        tipo_ocorrencia: t?.tipo_ocorrencia ?? "",
        setor_origem: t?.setor_origem ?? "",
        prioridade: t?.prioridade ?? "",
        status: t?.status ?? "",
        linha: t?.linha ?? "",
        ata_created_at: t?.created_at ?? "",
      };
    });
  }, [detalhes, ataById]);

  const recorteDrill = useMemo(() => {
    let baseAtas = [...atas];
    let baseDet = [...detalhesJoin];

    if (selOcorrencia) {
      baseAtas = baseAtas.filter((t) => normStr(t.tipo_ocorrencia) === normStr(selOcorrencia));
      const ids = new Set(baseAtas.map((t) => t.id));
      baseDet = baseDet.filter((d) => ids.has(d.tratativa_id));
    }

    if (selLinha) {
      baseAtas = baseAtas.filter((t) => normStr(t.linha) === normStr(selLinha));
      const ids = new Set(baseAtas.map((t) => t.id));
      baseDet = baseDet.filter((d) => ids.has(d.tratativa_id));
    }

    if (selMotorista) {
      baseAtas = baseAtas.filter(
        (t) => `${normStr(t.motorista_chapa)}|${normStr(t.motorista_nome)}` === selMotorista
      );
      const ids = new Set(baseAtas.map((t) => t.id));
      baseDet = baseDet.filter((d) => ids.has(d.tratativa_id));
    }

    if (selAcao) {
      baseDet = baseDet.filter((d) => normStr(d.acao_aplicada) === normStr(selAcao));
      const ids = new Set(baseDet.map((d) => d.tratativa_id));
      baseAtas = baseAtas.filter((t) => ids.has(t.id));
    }

    return { baseAtas, baseDet };
  }, [atas, detalhesJoin, selOcorrencia, selLinha, selMotorista, selAcao]);

  const topOcorrencias = useMemo(() => {
    const m = countBy(recorteDrill.baseAtas, (t) => normStr(t.tipo_ocorrencia) || "Sem ocorrência");
    return sortMapDesc(m).slice(0, 12);
  }, [recorteDrill.baseAtas]);

  const topLinhas = useMemo(() => {
    const m = countBy(recorteDrill.baseAtas, (t) => normStr(t.linha) || "Sem linha");
    return sortMapDesc(m).slice(0, 12);
  }, [recorteDrill.baseAtas]);

  const topMotoristas = useMemo(() => {
    const key = (t) => `${normStr(t.motorista_chapa)}|${normStr(t.motorista_nome)}`.trim() || "Sem motorista";
    const m = countBy(recorteDrill.baseAtas, (t) => key(t));
    return sortMapDesc(m)
      .slice(0, 12)
      .map(([k, total]) => {
        const [chapa, nome] = k.split("|");
        const pend = recorteDrill.baseAtas.filter(
          (t) => `${normStr(t.motorista_chapa)}|${normStr(t.motorista_nome)}` === k && ilikeContains(t.status, "pend")
        ).length;

        const conc = recorteDrill.baseAtas.filter(
          (t) =>
            `${normStr(t.motorista_chapa)}|${normStr(t.motorista_nome)}` === k &&
            (ilikeContains(t.status, "conclu") || ilikeContains(t.status, "resolvid"))
        ).length;

        return { k, chapa, nome, total, pend, conc };
      });
  }, [recorteDrill.baseAtas]);

  const topAcoes = useMemo(() => {
    const m = countBy(recorteDrill.baseDet, (d) => normStr(d.acao_aplicada) || "Não aplicada");
    return sortMapDesc(m).slice(0, 12);
  }, [recorteDrill.baseDet]);

  const headerChips = useMemo(() => {
    const chips = [];
    if (selOcorrencia) chips.push({ k: "oc", label: `Ocorrência: ${selOcorrencia}`, tone: "purple" });
    if (selLinha) chips.push({ k: "li", label: `Linha: ${selLinha}`, tone: "indigo" });
    if (selMotorista) {
      const [chapa, nome] = selMotorista.split("|");
      chips.push({ k: "mo", label: `Motorista: ${nome} (${chapa})`, tone: "blue" });
    }
    if (selAcao) chips.push({ k: "ac", label: `Ação: ${selAcao}`, tone: "green" });
    return chips;
  }, [selOcorrencia, selLinha, selMotorista, selAcao]);

  function baixarExcelUnificado() {
    const { baseAtas } = recorteDrill;

    const ids = new Set(baseAtas.map((t) => t.id));
    const detFiltrado = detalhesJoin.filter((d) => ids.has(d.tratativa_id));

    const sheetAtas = baseAtas.map((t) => ({
      id: t.id,
      created_at: t.created_at,
      motorista_chapa: t.motorista_chapa,
      motorista_nome: t.motorista_nome,
      linha: t.linha,
      tipo_ocorrencia: t.tipo_ocorrencia,
      setor_origem: t.setor_origem,
      prioridade: t.prioridade,
      status: t.status,
      descricao: t.descricao,
    }));

    const sheetDet = detFiltrado.map((d) => ({
      id: d.id,
      created_at: d.created_at,
      ata_id: d.tratativa_id,
      acao_aplicada: d.acao_aplicada,
      observacoes: d.observacoes,
      tratado_por_login: d.tratado_por_login,
      tratado_por_nome: d.tratado_por_nome,
    }));

    const detByAta = new Map();
    for (const d of detFiltrado) {
      if (!detByAta.has(d.tratativa_id)) detByAta.set(d.tratativa_id, []);
      detByAta.get(d.tratativa_id).push(d);
    }

    const sheetUni = [];
    for (const t of baseAtas) {
      const list = detByAta.get(t.id) || [];
      if (!list.length) {
        sheetUni.push({
          ata_id: t.id,
          ata_created_at: t.created_at,
          motorista_chapa: t.motorista_chapa,
          motorista_nome: t.motorista_nome,
          linha: t.linha,
          tipo_ocorrencia: t.tipo_ocorrencia,
          setor_origem: t.setor_origem,
          prioridade: t.prioridade,
          status: t.status,
          descricao: t.descricao,
          detalhe_id: "",
          detalhe_created_at: "",
          acao_aplicada: "",
          observacoes: "",
          tratado_por_login: "",
          tratado_por_nome: "",
        });
      } else {
        for (const d of list) {
          sheetUni.push({
            ata_id: t.id,
            ata_created_at: t.created_at,
            motorista_chapa: t.motorista_chapa,
            motorista_nome: t.motorista_nome,
            linha: t.linha,
            tipo_ocorrencia: t.tipo_ocorrencia,
            setor_origem: t.setor_origem,
            prioridade: t.prioridade,
            status: t.status,
            descricao: t.descricao,
            detalhe_id: d.id,
            detalhe_created_at: d.created_at,
            acao_aplicada: d.acao_aplicada,
            observacoes: d.observacoes,
            tratado_por_login: d.tratado_por_login,
            tratado_por_nome: d.tratado_por_nome,
          });
        }
      }
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheetAtas), "Atas");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheetDet), "Detalhes");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheetUni), "Unificado");

    const nome = `atas_resumo_${filtros.dataInicio || "inicio"}_${filtros.dataFim || "fim"}.xlsx`;
    XLSX.writeFile(wb, nome);
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Resumo de Atas</h1>
          <p className="text-sm text-gray-500">Clique nos TOPs para filtrar como BI e exporte um único Excel unificado.</p>
        </div>

        <button
          onClick={baixarExcelUnificado}
          disabled={loading || atas.length === 0}
          className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:bg-gray-300"
        >
          Baixar Excel (Unificado)
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <input
            type="date"
            value={filtros.dataInicio}
            onChange={(e) => setFiltros((f) => ({ ...f, dataInicio: e.target.value }))}
            className="border rounded-md px-3 py-2"
          />
          <input
            type="date"
            value={filtros.dataFim}
            onChange={(e) => setFiltros((f) => ({ ...f, dataFim: e.target.value }))}
            className="border rounded-md px-3 py-2"
          />
          <input
            type="text"
            placeholder="Busca (motorista, ocorrência, descrição...)"
            value={filtros.busca}
            onChange={(e) => setFiltros((f) => ({ ...f, busca: e.target.value }))}
            className="border rounded-md px-3 py-2"
          />
          <select
            value={filtros.setor}
            onChange={(e) => setFiltros((f) => ({ ...f, setor: e.target.value }))}
            className="border rounded-md px-3 py-2 bg-white"
          >
            <option value="">Todos os Setores</option>
            {setoresDisponiveis.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            value={filtros.status}
            onChange={(e) => setFiltros((f) => ({ ...f, status: e.target.value }))}
            className="border rounded-md px-3 py-2 bg-white"
          >
            <option value="">Todos os Status</option>
            <option value="Pendente">Pendente</option>
            <option value="Resolvido">Resolvido</option>
            <option value="Concluída">Concluída</option>
          </select>
        </div>

        <div className="flex items-center justify-between mt-4 gap-3">
          <div className="flex flex-wrap gap-2">
            {headerChips.map((c) => (
              <Badge key={c.k} tone={c.tone}>
                {c.label}
              </Badge>
            ))}
            {(selOcorrencia || selLinha || selMotorista || selAcao) && (
              <button onClick={resetDrill} className="text-xs px-3 py-1 rounded border border-gray-200 hover:bg-gray-50">
                Limpar seleção
              </button>
            )}
          </div>

          <button
            onClick={aplicar}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300"
          >
            {loading ? "Carregando..." : "Aplicar"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <CardResumo titulo="Total" valor={totalCount} cor="bg-blue-100" />
        <CardResumo titulo="Pendentes" valor={pendentesCount} cor="bg-yellow-100" />
        <CardResumo titulo="Concluídas" valor={concluidasCount} cor="bg-green-100" />
        <CardResumo titulo="Atrasadas (>10d)" valor={atrasadasCount} cor="bg-red-100" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        <Card title="Top Motoristas (Atas)" right={<Badge tone="blue">{recorteDrill.baseAtas.length} atas</Badge>}>
          <div className="space-y-2">
            {topMotoristas.length === 0 ? (
              <div className="text-sm text-gray-500">Sem dados no recorte.</div>
            ) : (
              topMotoristas.map((m) => (
                <ListItemButton
                  key={m.k}
                  label={m.nome || "Sem nome"}
                  sub={m.chapa ? `Chapa ${m.chapa}` : "Chapa -"}
                  value={`Total ${m.total} | Pend ${m.pend} | Conc ${m.conc}`}
                  active={selMotorista === m.k}
                  onClick={() => {
                    setSelMotorista((cur) => (cur === m.k ? "" : m.k));
                    setSelAcao("");
                  }}
                />
              ))
            )}
          </div>
        </Card>

        <Card title="Top Ocorrências" right={<Badge tone="purple">{topOcorrencias.reduce((a, b) => a + b[1], 0)}</Badge>}>
          <div className="space-y-2">
            {topOcorrencias.length === 0 ? (
              <div className="text-sm text-gray-500">Sem dados no recorte.</div>
            ) : (
              topOcorrencias.map(([label, qtd]) => (
                <ListItemButton
                  key={label}
                  label={label}
                  value={qtd}
                  active={selOcorrencia === label}
                  onClick={() => {
                    setSelOcorrencia((cur) => (cur === label ? "" : label));
                    setSelMotorista("");
                    setSelAcao("");
                  }}
                />
              ))
            )}
          </div>
        </Card>

        <Card title="Top Linhas" right={<Badge tone="indigo">{topLinhas.reduce((a, b) => a + b[1], 0)}</Badge>}>
          <div className="space-y-2">
            {topLinhas.length === 0 ? (
              <div className="text-sm text-gray-500">Sem linhas no recorte.</div>
            ) : (
              topLinhas.map(([label, qtd]) => (
                <ListItemButton
                  key={label}
                  label={label}
                  value={qtd}
                  active={selLinha === label}
                  onClick={() => {
                    setSelLinha((cur) => (cur === label ? "" : label));
                    setSelMotorista("");
                    setSelAcao("");
                  }}
                />
              ))
            )}
          </div>
        </Card>

        <Card title="Top Ações Aplicadas (Detalhes)" right={<Badge tone="green">{recorteDrill.baseDet.length} ações</Badge>}>
          <div className="space-y-2">
            {topAcoes.length === 0 ? (
              <div className="text-sm text-gray-500">
                Sem ações no recorte.
              </div>
            ) : (
              topAcoes.map(([label, qtd]) => (
                <ListItemButton
                  key={label}
                  label={label}
                  value={qtd}
                  active={selAcao === label}
                  onClick={() => setSelAcao((cur) => (cur === label ? "" : label))}
                />
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

import React, { useMemo, useEffect, useState } from "react";
import {
  FaCheck,
  FaTimes as FaX,
  FaQuestionCircle,
  FaClock,
  FaClipboardList,
} from "react-icons/fa";
import { supabase } from "../../supabase"; // ajuste o path se precisar

function n(v) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function normalizeStatus(s) {
  const st = String(s || "").toUpperCase().trim();
  if (!st) return "AGUARDANDO_INSTRUTOR";

  if (st === "AGUARDANDO INSTRUTOR") return "AGUARDANDO_INSTRUTOR";
  if (st === "CONCLUIDO") return "AGUARDANDO_INSTRUTOR";
  if (st === "AG_ACOMPANHAMENTO") return "AGUARDANDO_INSTRUTOR";
  if (st === "TRATATIVA") return "ATAS";
  return st;
}

function hasLancamento(item) {
  if (!item) return false;
  return Boolean(
    item?.intervencao_hora_inicio ||
      item?.dt_inicio_monitoramento ||
      item?.instrutor_login ||
      item?.instrutor_nome ||
      item?.intervencao_checklist ||
      (item?.intervencao_media_teste != null &&
        String(item?.intervencao_media_teste) !== "")
  );
}

function formatDateBR(value) {
  if (!value) return "—";
  try {
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m, d] = value.split("-").map(Number);
      return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
    }

    const dt = value instanceof Date ? value : new Date(String(value));
    if (Number.isNaN(dt.getTime())) return String(value);

    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(dt);
  } catch {
    return String(value);
  }
}

function badgeConducao(val) {
  if (val === true)
    return {
      label: "SIM",
      cls: "bg-emerald-600 text-white border-emerald-700",
      Icon: FaCheck,
    };
  if (val === false)
    return {
      label: "NÃO",
      cls: "bg-rose-600 text-white border-rose-700",
      Icon: FaX,
    };
  return {
    label: "—",
    cls: "bg-slate-100 text-slate-600 border-slate-200",
    Icon: FaClock,
  };
}

function badgeTecnica(val) {
  const v = String(val || "").toUpperCase();
  if (v === "SIM")
    return {
      label: "Sim",
      cls: "bg-emerald-50 border-emerald-200 text-emerald-700",
      Icon: FaCheck,
    };
  if (v === "NAO" || v === "NÃO")
    return {
      label: "Não",
      cls: "bg-rose-50 border-rose-200 text-rose-700",
      Icon: FaX,
    };
  if (v === "DUVIDAS" || v === "DÚVIDAS")
    return {
      label: "Dúvidas",
      cls: "bg-amber-50 border-amber-200 text-amber-700",
      Icon: FaQuestionCircle,
    };
  return {
    label: "—",
    cls: "bg-slate-100 border-slate-200 text-slate-600",
    Icon: FaClock,
  };
}

function extractChecklist(raw) {
  if (!raw || typeof raw !== "object")
    return { versao: null, conducao: {}, tecnica: {}, itens: {} };

  return {
    versao: raw.versao || null,
    // legado
    conducao: raw.conducao && typeof raw.conducao === "object" ? raw.conducao : {},
    tecnica: raw.tecnica && typeof raw.tecnica === "object" ? raw.tecnica : {},
    // novo recomendado
    itens: raw.itens && typeof raw.itens === "object" ? raw.itens : {},
  };
}

// Você pode manter sua avaliação técnica fixa (se não mudou)
const AVALIACAO_TECNICA = [
  { id: "freio_motor", pergunta: "O motorista demonstra saber utilizar o Freio Motor corretamente?" },
  { id: "regeneracao_dpf", pergunta: "O motorista conhece o procedimento para a Regeneração (DPF)?" },
  { id: "acelerador_cenarios", pergunta: "O motorista sabe utilizar o acelerador em cada cenário (plano, aclive e declive)?" },
];

export default function ResumoLancamentoInstrutor({ item }) {
  const st = normalizeStatus(item?.status);

  const tem = useMemo(() => hasLancamento(item), [item]);
  const checklist = useMemo(() => extractChecklist(item?.intervencao_checklist), [item]);

  // ✅ Itens do checklist vindo do Supabase
  const [itensConducao, setItensConducao] = useState([]);
  const [loadingItens, setLoadingItens] = useState(false);

  useEffect(() => {
    let alive = true;

    async function loadItens() {
      setLoadingItens(true);
      try {
        const { data, error } = await supabase
          .from("diesel_checklist_itens")
          .select("id, ordem, grupo, codigo, descricao, ajuda")
          .eq("ativo", true)
          .eq("grupo", "CONDUCAO_INTELIGENTE")
          .order("ordem", { ascending: true });

        if (error) throw error;
        if (!alive) return;
        setItensConducao(data || []);
      } catch (e) {
        if (!alive) return;
        setItensConducao([]);
        console.error("Erro ao carregar diesel_checklist_itens:", e?.message || e);
      } finally {
        if (alive) setLoadingItens(false);
      }
    }

    loadItens();
    return () => {
      alive = false;
    };
  }, []);

  if (!tem) {
    return (
      <div className="p-4 rounded-lg border bg-gray-50 text-sm text-gray-500">
        Ainda não há lançamento do instrutor para esta ordem.
      </div>
    );
  }

  const inicioBR = formatDateBR(item?.dt_inicio_monitoramento);
  const fimBR = formatDateBR(item?.dt_fim_previsao);

  // ✅ pega valor do checklist salvo (novo ou legado)
  function getValConducao(codigo) {
    // novo recomendado: checklist.itens[codigo]
    if (Object.prototype.hasOwnProperty.call(checklist.itens, codigo)) {
      return checklist.itens[codigo];
    }
    // fallback legado: checklist.conducao[codigo]
    if (Object.prototype.hasOwnProperty.call(checklist.conducao, codigo)) {
      return checklist.conducao[codigo];
    }
    return null;
  }

  return (
    <div className="p-4 rounded-xl border bg-white space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-extrabold text-slate-700 uppercase">
            Resumo do lançamento do instrutor
          </div>
          <div className="text-[12px] text-slate-500">
            Status atual: <span className="font-bold">{st}</span>
            {checklist.versao ? (
              <span className="ml-2 font-mono text-[11px] text-slate-400">
                ({checklist.versao})
              </span>
            ) : null}
          </div>
        </div>

        <div className="text-right text-[12px] text-slate-600">
          <div className="font-bold">{item?.instrutor_nome || "—"}</div>
          <div className="text-slate-400 font-mono">{item?.instrutor_login || "—"}</div>
        </div>
      </div>

      {/* Prova + Período */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3 rounded border bg-slate-50">
          <div className="text-[10px] font-bold text-slate-500">Hora Início</div>
          <div className="text-sm font-extrabold text-slate-800">
            {item?.intervencao_hora_inicio || "—"}
          </div>
        </div>

        <div className="p-3 rounded border bg-slate-50">
          <div className="text-[10px] font-bold text-slate-500">Hora Fim</div>
          <div className="text-sm font-extrabold text-slate-800">
            {item?.intervencao_hora_fim || "—"}
          </div>
        </div>

        <div className="p-3 rounded border bg-slate-50">
          <div className="text-[10px] font-bold text-slate-500">KM Início</div>
          <div className="text-sm font-extrabold text-slate-800">
            {item?.intervencao_km_inicio != null ? n(item.intervencao_km_inicio).toFixed(0) : "—"}
          </div>
        </div>

        <div className="p-3 rounded border bg-slate-50">
          <div className="text-[10px] font-bold text-slate-500">KM Fim</div>
          <div className="text-sm font-extrabold text-slate-800">
            {item?.intervencao_km_fim != null ? n(item.intervencao_km_fim).toFixed(0) : "—"}
          </div>
        </div>

        <div className="p-3 rounded border bg-blue-50 border-blue-200 col-span-2 md:col-span-2">
          <div className="text-[10px] font-bold text-blue-700">Média do Teste (KM/L)</div>
          <div className="text-lg font-extrabold text-blue-800">
            {item?.intervencao_media_teste != null && String(item?.intervencao_media_teste) !== ""
              ? n(item.intervencao_media_teste).toFixed(2)
              : "—"}
          </div>
        </div>

        <div className="p-3 rounded border bg-gray-50 col-span-2 md:col-span-2">
          <div className="text-[10px] font-bold text-slate-500">Período Monitoramento</div>
          <div className="text-sm font-extrabold text-slate-800">
            {inicioBR} → {fimBR}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Nível {item?.nivel ?? "—"} • {item?.dias_monitoramento ?? "—"} dias
          </div>
        </div>
      </div>

      {/* ✅ Checklist Condução Inteligente (dinâmico) */}
      <div>
        <div className="text-xs font-extrabold text-slate-700 mb-3 flex items-center gap-2">
          <FaClipboardList /> Checklist de Condução Inteligente
        </div>

        {loadingItens ? (
          <div className="p-3 rounded border bg-slate-50 text-sm text-slate-500">
            Carregando itens do checklist...
          </div>
        ) : itensConducao.length === 0 ? (
          <div className="p-3 rounded border bg-amber-50 text-sm text-amber-700">
            Nenhum item encontrado em <b>diesel_checklist_itens</b> para o grupo{" "}
            <b>CONDUCAO_INTELIGENTE</b>.
          </div>
        ) : (
          <div className="space-y-3">
            {itensConducao.map((it) => {
              const val = getValConducao(it.codigo); // true/false/null
              const b = badgeConducao(val);
              const Icon = b.Icon;

              return (
                <div key={it.id} className="p-3 border rounded-lg bg-white">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs font-extrabold text-slate-700">
                        {String(it.ordem).padStart(2, "0")} • {it.descricao}
                      </div>
                      {it.ajuda ? (
                        <div className="text-sm text-slate-600">{it.ajuda}</div>
                      ) : null}
                    </div>

                    <div className="shrink-0">
                      <span
                        className={`px-3 py-2 rounded border text-xs font-bold inline-flex items-center gap-2 ${b.cls}`}
                      >
                        <Icon /> {b.label}
                      </span>
                    </div>
                  </div>

                  {val === null && (
                    <div className="mt-2 text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded px-2 py-1 inline-block">
                      Não informado
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Avaliação Técnica (se continuar existindo) */}
      <div>
        <div className="text-xs font-extrabold text-slate-700 mb-3 uppercase">
          Avaliação Técnica (Sistemas)
        </div>

        <div className="space-y-3">
          {AVALIACAO_TECNICA.map((q) => {
            const v = checklist.tecnica?.[q.id] || "";
            const b = badgeTecnica(v);
            const Icon = b.Icon;

            return (
              <div key={q.id} className="p-3 border rounded-lg bg-gray-50">
                <div className="text-sm text-slate-700 font-semibold mb-2">{q.pergunta}</div>

                <div
                  className={`px-3 py-2 rounded border text-xs font-bold inline-flex items-center gap-2 ${b.cls}`}
                >
                  <Icon /> {b.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Observação */}
      <div className="p-3 rounded border bg-gray-50">
        <div className="text-[10px] font-bold text-slate-500 uppercase">
          Observação do Instrutor
        </div>
        <div className="text-sm text-slate-700 whitespace-pre-wrap">
          {item?.intervencao_obs || "—"}
        </div>
      </div>
    </div>
  );
}

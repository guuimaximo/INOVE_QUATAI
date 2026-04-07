import React, { useMemo, useEffect, useState } from "react";
import {
  FaCheck,
  FaTimes as FaX,
  FaQuestionCircle,
  FaClock,
  FaClipboardList,
} from "react-icons/fa";
import { supabase } from "../../supabase";

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

function extractChecklist(raw) {
  if (!raw || typeof raw !== "object") {
    return { versao: null, conducao: {}, tecnica: {}, itens: {} };
  }

  return {
    versao: raw.versao || null,
    conducao: raw.conducao && typeof raw.conducao === "object" ? raw.conducao : {},
    tecnica: raw.tecnica && typeof raw.tecnica === "object" ? raw.tecnica : {},
    itens: raw.itens && typeof raw.itens === "object" ? raw.itens : {},
  };
}

function getNotaInstrutorValue(nota) {
  if (nota == null || nota === "") return null;
  const valor = Number(nota);
  if (!Number.isFinite(valor)) return null;
  return Math.max(0, Math.min(100, valor));
}

function getNotaInstrutorColors(nota) {
  const valor = getNotaInstrutorValue(nota);

  if (valor == null) {
    return {
      box: "bg-slate-50 border-slate-200",
      text: "text-slate-700",
      badge: "bg-slate-100 text-slate-700 border-slate-200",
      label: "text-slate-500",
    };
  }

  if (valor < 50) {
    return {
      box: "bg-rose-50 border-rose-200",
      text: "text-rose-700",
      badge: "bg-rose-100 text-rose-700 border-rose-200",
      label: "text-rose-600",
    };
  }

  if (valor < 80) {
    return {
      box: "bg-amber-50 border-amber-200",
      text: "text-amber-700",
      badge: "bg-amber-100 text-amber-700 border-amber-200",
      label: "text-amber-600",
    };
  }

  return {
    box: "bg-emerald-50 border-emerald-200",
    text: "text-emerald-700",
    badge: "bg-emerald-100 text-emerald-700 border-emerald-200",
    label: "text-emerald-600",
  };
}

function getNotaInstrutorFaixa(nota) {
  const valor = getNotaInstrutorValue(nota);
  if (valor == null) return "Sem nota";
  if (valor < 50) return "Crítica";
  if (valor < 80) return "Atenção";
  return "Boa";
}

function badgeConducao(itemChecklist, val) {
  if (val !== true && val !== false) {
    return {
      label: "—",
      cls: "bg-slate-100 text-slate-600 border-slate-200",
      Icon: FaClock,
      hint: "Não informado",
    };
  }

  const simEhBom = itemChecklist?.bool_true_is_good !== false;
  const respostaBoa = simEhBom ? val === true : val === false;
  const label = val ? "SIM" : "NÃO";
  const Icon = val ? FaCheck : FaX;

  if (respostaBoa) {
    return {
      label,
      cls: "bg-emerald-600 text-white border-emerald-700",
      Icon,
      hint: "Resposta adequada",
    };
  }

  return {
    label,
    cls: "bg-rose-600 text-white border-rose-700",
    Icon,
    hint: "Ponto de atenção",
  };
}

function badgeTecnica(val) {
  const v = String(val || "").toUpperCase();
  if (v === "SIM") {
    return {
      label: "Sim",
      cls: "bg-emerald-50 border-emerald-200 text-emerald-700",
      Icon: FaCheck,
    };
  }
  if (v === "NAO" || v === "NÃO") {
    return {
      label: "Não",
      cls: "bg-rose-50 border-rose-200 text-rose-700",
      Icon: FaX,
    };
  }
  if (v === "DUVIDAS" || v === "DÚVIDAS") {
    return {
      label: "Dúvidas",
      cls: "bg-amber-50 border-amber-200 text-amber-700",
      Icon: FaQuestionCircle,
    };
  }
  return {
    label: "—",
    cls: "bg-slate-100 border-slate-200 text-slate-600",
    Icon: FaClock,
  };
}

export default function ResumoLancamentoInstrutor({ item }) {
  const st = normalizeStatus(item?.status);
  const tem = useMemo(() => hasLancamento(item), [item]);

  const checklistLegado = useMemo(
    () => extractChecklist(item?.intervencao_checklist),
    [item?.intervencao_checklist]
  );

  const [itensConducao, setItensConducao] = useState([]);
  const [itensTecnica, setItensTecnica] = useState([]);
  const [loadingItens, setLoadingItens] = useState(false);

  const [respByItemId, setRespByItemId] = useState(new Map());
  const [loadingResp, setLoadingResp] = useState(false);

  const notaInstrutor = useMemo(
    () => getNotaInstrutorValue(item?.intervencao_nota),
    [item?.intervencao_nota]
  );
  const notaColors = useMemo(
    () => getNotaInstrutorColors(item?.intervencao_nota),
    [item?.intervencao_nota]
  );
  const notaFaixa = useMemo(
    () => getNotaInstrutorFaixa(item?.intervencao_nota),
    [item?.intervencao_nota]
  );

  useEffect(() => {
    let alive = true;

    async function loadItens() {
      setLoadingItens(true);
      try {
        const { data, error } = await supabase
          .from("diesel_checklist_itens")
          .select(
            "id, ordem, grupo, codigo, descricao, ajuda, tipo_resposta, ativo, bool_true_is_good"
          )
          .eq("ativo", true)
          .in("grupo", ["CONDUCAO_INTELIGENTE", "AVALIACAO_TECNICA"])
          .order("grupo", { ascending: true })
          .order("ordem", { ascending: true });

        if (error) throw error;
        if (!alive) return;

        const condu = (data || []).filter((x) => x.grupo === "CONDUCAO_INTELIGENTE");
        const tec = (data || []).filter((x) => x.grupo === "AVALIACAO_TECNICA");

        setItensConducao(condu);
        setItensTecnica(tec);
      } catch (e) {
        if (!alive) return;
        console.error("Erro ao carregar diesel_checklist_itens:", e?.message || e);
        setItensConducao([]);
        setItensTecnica([]);
      } finally {
        if (alive) setLoadingItens(false);
      }
    }

    loadItens();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;

    async function loadRespostas() {
      if (!item?.id) {
        setRespByItemId(new Map());
        return;
      }

      setLoadingResp(true);
      try {
        const { data, error } = await supabase
          .from("diesel_checklist_respostas")
          .select("checklist_item_id, valor_bool, valor_text, updated_at")
          .eq("acompanhamento_id", item.id);

        if (error) throw error;
        if (!alive) return;

        const m = new Map();
        (data || []).forEach((r) => {
          if (!r?.checklist_item_id) return;
          m.set(r.checklist_item_id, {
            valor_bool: r.valor_bool,
            valor_text: r.valor_text,
            updated_at: r.updated_at,
          });
        });
        setRespByItemId(m);
      } catch (e) {
        if (!alive) return;
        console.error("Erro ao carregar diesel_checklist_respostas:", e?.message || e);
        setRespByItemId(new Map());
      } finally {
        if (alive) setLoadingResp(false);
      }
    }

    loadRespostas();
    return () => {
      alive = false;
    };
  }, [item?.id]);

  if (!tem) {
    return (
      <div className="p-4 rounded-lg border bg-gray-50 text-sm text-gray-500">
        Ainda não há lançamento do instrutor para esta ordem.
      </div>
    );
  }

  const inicioBR = formatDateBR(item?.dt_inicio_monitoramento);
  const fimBR = formatDateBR(item?.dt_fim_previsao);

  function getValConducaoFromItem(it) {
    const r = respByItemId.get(it.id);
    if (r && (r.valor_bool === true || r.valor_bool === false)) return r.valor_bool;

    const codigo = it.codigo;
    if (Object.prototype.hasOwnProperty.call(checklistLegado.itens, codigo)) {
      return checklistLegado.itens[codigo];
    }
    if (Object.prototype.hasOwnProperty.call(checklistLegado.conducao, codigo)) {
      return checklistLegado.conducao[codigo];
    }
    return null;
  }

  function getValTecnicaFromItem(it) {
    const r = respByItemId.get(it.id);
    const v = String(r?.valor_text || "").trim();
    if (v) return v;

    const codigo = it.codigo;
    if (Object.prototype.hasOwnProperty.call(checklistLegado.itens, codigo)) {
      return checklistLegado.itens[codigo];
    }
    if (Object.prototype.hasOwnProperty.call(checklistLegado.tecnica, codigo)) {
      return checklistLegado.tecnica[codigo];
    }
    return "";
  }

  const versaoMostrada =
    checklistLegado?.versao ||
    (item?.intervencao_checklist?.versao ? item.intervencao_checklist.versao : null) ||
    "FORM_ACOMPANHAMENTO_TELEMETRIA_v2";

  return (
    <div className="p-4 rounded-xl border bg-white space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-extrabold text-slate-700 uppercase">
            Resumo do lançamento do instrutor
          </div>
          <div className="text-[12px] text-slate-500">
            Status atual: <span className="font-bold">{st}</span>
            {versaoMostrada ? (
              <span className="ml-2 font-mono text-[11px] text-slate-400">
                ({versaoMostrada})
              </span>
            ) : null}
          </div>
          {loadingItens || loadingResp ? (
            <div className="mt-1 text-[11px] text-slate-400">
              Carregando itens/respostas do checklist...
            </div>
          ) : null}
        </div>

        <div className="text-right text-[12px] text-slate-600">
          <div className="font-bold">{item?.instrutor_nome || "—"}</div>
          <div className="text-slate-400 font-mono">{item?.instrutor_login || "—"}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className={`rounded-lg border p-3 ${notaColors.box}`}>
          <div className={`text-xs font-bold uppercase tracking-wider mb-2 ${notaColors.label}`}>
            Nota do Instrutor (0 a 100)
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className={`text-2xl font-black ${notaColors.text}`}>
              {notaInstrutor != null ? `${notaInstrutor}/100` : "-"}
            </div>

            <span
              className={`px-2.5 py-1 rounded-full text-[11px] font-black border ${notaColors.badge}`}
            >
              {notaFaixa}
            </span>
          </div>
        </div>

        <div className="rounded-lg border p-3 bg-slate-50 border-slate-200">
          <div className="text-xs font-bold uppercase tracking-wider mb-2 text-slate-500">
            Parecer do Instrutor
          </div>
          <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
            {item?.intervencao_obs || "Sem parecer do instrutor registrado."}
          </div>
        </div>
      </div>

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
            Nenhum item encontrado para o grupo <b>CONDUCAO_INTELIGENTE</b>.
          </div>
        ) : (
          <div className="space-y-3">
            {itensConducao.map((it) => {
              const val = getValConducaoFromItem(it);
              const b = badgeConducao(it, val);
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

                    <div className="shrink-0 flex items-center gap-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">
                        {b.hint}
                      </span>

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

      <div>
        <div className="text-xs font-extrabold text-slate-700 mb-3 uppercase">
          Avaliação Técnica (Sistemas)
        </div>

        {loadingItens ? (
          <div className="p-3 rounded border bg-slate-50 text-sm text-slate-500">
            Carregando itens...
          </div>
        ) : itensTecnica.length === 0 ? (
          <div className="p-3 rounded border bg-amber-50 text-sm text-amber-700">
            Nenhum item encontrado para o grupo <b>AVALIACAO_TECNICA</b>.
          </div>
        ) : (
          <div className="space-y-3">
            {itensTecnica.map((q) => {
              const v = getValTecnicaFromItem(q) || "";
              const b = badgeTecnica(v);
              const Icon = b.Icon;

              return (
                <div key={q.id} className="p-3 border rounded-lg bg-gray-50">
                  <div className="text-sm text-slate-700 font-semibold mb-2">
                    {String(q.ordem).padStart(2, "0")} • {q.descricao}
                  </div>
                  {q.ajuda ? <div className="text-xs text-slate-500 mb-2">{q.ajuda}</div> : null}

                  <div className={`px-3 py-2 rounded border text-xs font-bold inline-flex items-center gap-2 ${b.cls}`}>
                    <Icon /> {b.label}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

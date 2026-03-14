import React, { useEffect, useMemo, useState } from "react";
import {
  FaRoad,
  FaTimes,
  FaClock,
  FaClipboardList,
  FaQuestionCircle,
  FaCheck,
  FaSave,
  FaTimes as FaX,
} from "react-icons/fa";
import { supabase } from "../../supabase";

function n(v) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function spDateISO(d = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function addDaysISO(isoYMD, days) {
  const [y, m, d] = isoYMD.split("-").map(Number);
  const base = new Date(Date.UTC(y, m - 1, d));
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

function normGrupo(g) {
  const s = String(g || "")
    .toUpperCase()
    .trim()
    .replace(/\s+/g, "_");

  if (
    s === "CONDUCAO_INTELIGENTE" ||
    s === "CONDUCAO" ||
    s === "CHECKLIST_CONDUCAO"
  ) {
    return "CONDUCAO_INTELIGENTE";
  }

  if (
    s === "AVALIACAO_TECNICA" ||
    s === "AVALIACAO" ||
    s === "TECNICA" ||
    s === "AVAL_TECNICA"
  ) {
    return "AVALIACAO_TECNICA";
  }

  return s;
}

function isAtivo(v) {
  if (v === true) return true;
  const s = String(v ?? "").toLowerCase().trim();
  return s === "true" || s === "t" || s === "1" || s === "sim" || s === "yes";
}

const TEC_OPCOES = [
  {
    value: "SIM",
    label: "Sim",
    icon: FaCheck,
    cls: "bg-emerald-50 border-emerald-200 text-emerald-700",
  },
  {
    value: "NAO",
    label: "Não",
    icon: FaX,
    cls: "bg-rose-50 border-rose-200 text-rose-700",
  },
  {
    value: "DUVIDAS",
    label: "Dúvidas",
    icon: FaQuestionCircle,
    cls: "bg-amber-50 border-amber-200 text-amber-700",
  },
];

const NIVEIS = {
  1: {
    label: "Nível 1",
    color: "bg-blue-50 border-blue-200 text-blue-700",
  },
  2: {
    label: "Nível 2",
    color: "bg-amber-50 border-amber-200 text-amber-700",
  },
  3: {
    label: "Nível 3",
    color: "bg-rose-50 border-rose-200 text-rose-700",
  },
};

export default function ModalLancamentoIntervencao({
  item,
  user,
  userRoleData,
  onClose,
  onSaved,
  buildNomeSobrenome,
}) {
  const [itensConducao, setItensConducao] = useState([]);
  const [itensTecnica, setItensTecnica] = useState([]);
  const [loadingItens, setLoadingItens] = useState(false);
  const [itensError, setItensError] = useState("");
  const [salvando, setSalvando] = useState(false);

  const [form, setForm] = useState({
    horaInicio: "",
    horaFim: "",
    kmInicio: "",
    kmFim: "",
    mediaTeste: "",
    nivel: 2,
    obs: "",
    checklistConducao: {},
    avaliacaoTecnica: {},
  });

  useEffect(() => {
    carregarItensChecklist();
  }, []);

  function buildEmptyRespostas(conducaoList, tecnicaList) {
    const c = {};
    (conducaoList || []).forEach((it) => (c[it.codigo] = null));
    const t = {};
    (tecnicaList || []).forEach((it) => (t[it.codigo] = ""));
    return { c, t };
  }

  async function carregarItensChecklist() {
    setLoadingItens(true);
    setItensError("");

    try {
      const { data, error } = await supabase
        .from("diesel_checklist_itens")
        .select(`
          id, ordem, grupo, codigo, descricao, ajuda, tipo_resposta, ativo, bool_true_is_good,
          pontos_true_100, pontos_false_100, pontos_max_100,
          opcao_score_sim, opcao_score_duvidas, opcao_score_nao
        `)
        .order("ordem", { ascending: true });

      if (error) throw error;

      const ativos = (data || []).filter((x) => isAtivo(x.ativo));

      const condu = ativos
        .map((x) => ({ ...x, grupo_norm: normGrupo(x.grupo) }))
        .filter((x) => x.grupo_norm === "CONDUCAO_INTELIGENTE")
        .sort((a, b) => n(a.ordem) - n(b.ordem));

      const tec = ativos
        .map((x) => ({ ...x, grupo_norm: normGrupo(x.grupo) }))
        .filter((x) => x.grupo_norm === "AVALIACAO_TECNICA")
        .sort((a, b) => n(a.ordem) - n(b.ordem));

      setItensConducao(condu);
      setItensTecnica(tec);

      const { c, t } = buildEmptyRespostas(condu, tec);
      setForm((prev) => ({
        ...prev,
        checklistConducao: c,
        avaliacaoTecnica: t,
      }));
    } catch (e) {
      console.error("Erro ao carregar itens checklist:", e?.message || e);
      setItensConducao([]);
      setItensTecnica([]);
      setItensError(e?.message ? String(e.message) : String(e));
    } finally {
      setLoadingItens(false);
    }
  }

  const setConducao = (codigo, val) =>
    setForm((prev) => ({
      ...prev,
      checklistConducao: { ...prev.checklistConducao, [codigo]: val },
    }));

  const setTecnica = (codigo, val) =>
    setForm((prev) => ({
      ...prev,
      avaliacaoTecnica: { ...prev.avaliacaoTecnica, [codigo]: val },
    }));

  async function salvarIntervencao() {
    if (!item?.id) return;

    if (!form.horaInicio || !form.kmInicio || !form.mediaTeste) {
      alert("Preencha: Hora Início, KM Início e Média do Teste.");
      return;
    }

    setSalvando(true);

    const dias = 30;
    const inicioISO = spDateISO(new Date());
    const fimISO = addDaysISO(inicioISO, dias - 1);

    const instrutorLogin = user?.login || user?.email || null;
    const instrutorNome =
      buildNomeSobrenome(user) || userRoleData?.nome_completo || instrutorLogin;

    let notaTotal = 0;
    const mapByCodigo = new Map();
    [...itensConducao, ...itensTecnica].forEach((it) =>
      mapByCodigo.set(it.codigo, it)
    );

    Object.entries(form.checklistConducao || {}).forEach(([codigo, val]) => {
      const it = mapByCodigo.get(codigo);
      if (!it) return;
      if (val === true) notaTotal += n(it.pontos_true_100);
      if (val === false) notaTotal += n(it.pontos_false_100);
    });

    Object.entries(form.avaliacaoTecnica || {}).forEach(([codigo, val]) => {
      const it = mapByCodigo.get(codigo);
      if (!it) return;
      const maxPts = n(it.pontos_max_100);
      if (val === "SIM") notaTotal += maxPts * n(it.opcao_score_sim);
      if (val === "DUVIDAS") notaTotal += maxPts * n(it.opcao_score_duvidas);
      if (val === "NAO") notaTotal += maxPts * n(it.opcao_score_nao);
    });

    const notaFinal = Math.round(Math.max(0, Math.min(100, notaTotal)));

    try {
      const intervencaoChecklist = {
        versao: "FORM_ACOMPANHAMENTO_TELEMETRIA_v3",
        itens: {
          ...(form.checklistConducao || {}),
          ...(form.avaliacaoTecnica || {}),
        },
        conducao: form.checklistConducao || {},
        tecnica: form.avaliacaoTecnica || {},
        nota_calculada: notaFinal,
      };

      const payload = {
        status: "EM_MONITORAMENTO",
        nivel: form.nivel,
        dias_monitoramento: dias,
        dt_inicio_monitoramento: inicioISO,
        dt_fim_previsao: fimISO,
        instrutor_login: instrutorLogin,
        instrutor_nome: instrutorNome,
        intervencao_hora_inicio: form.horaInicio,
        intervencao_hora_fim: form.horaFim || null,
        intervencao_km_inicio: n(form.kmInicio),
        intervencao_km_fim: form.kmFim ? n(form.kmFim) : null,
        intervencao_media_teste: n(form.mediaTeste),
        intervencao_checklist: intervencaoChecklist,
        intervencao_obs: form.obs || null,
        intervencao_nota: notaFinal,
        prontuario_10_gerado_em: null,
        prontuario_20_gerado_em: null,
        prontuario_30_gerado_em: null,
        updated_at: new Date().toISOString(),
      };

      const { error: errUpd } = await supabase
        .from("diesel_acompanhamentos")
        .update(payload)
        .eq("id", item.id);

      if (errUpd) throw errUpd;

      const { error: errDel } = await supabase
        .from("diesel_checklist_respostas")
        .delete()
        .eq("acompanhamento_id", item.id);

      if (errDel) throw errDel;

      const rows = [];

      Object.entries(form.checklistConducao || {}).forEach(([codigo, val]) => {
        const it = mapByCodigo.get(codigo);
        if (!it?.id) return;
        if (val === true || val === false) {
          rows.push({
            acompanhamento_id: item.id,
            checklist_item_id: it.id,
            valor_bool: val,
            valor_text: null,
            versao: "FORM_ACOMPANHAMENTO_TELEMETRIA_v3",
            respondido_por_login: instrutorLogin,
            respondido_por_nome: instrutorNome,
            origem: "LANCAMENTO_INSTRUTOR",
            updated_at: new Date().toISOString(),
          });
        }
      });

      Object.entries(form.avaliacaoTecnica || {}).forEach(([codigo, val]) => {
        const it = mapByCodigo.get(codigo);
        if (!it?.id) return;
        const v = String(val || "").trim();
        if (v) {
          rows.push({
            acompanhamento_id: item.id,
            checklist_item_id: it.id,
            valor_bool: null,
            valor_text: v,
            versao: "FORM_ACOMPANHAMENTO_TELEMETRIA_v3",
            respondido_por_login: instrutorLogin,
            respondido_por_nome: instrutorNome,
            origem: "LANCAMENTO_INSTRUTOR",
            updated_at: new Date().toISOString(),
          });
        }
      });

      if (rows.length > 0) {
        const { error: errIns } = await supabase
          .from("diesel_checklist_respostas")
          .insert(rows);

        if (errIns) throw errIns;
      }

      alert(
        `Monitoramento iniciado com sucesso!\nNota Final do Check-list: ${notaFinal}/100`
      );
      onClose();
      onSaved?.();
    } catch (e) {
      alert("Erro ao salvar: " + (e?.message || String(e)));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-4 border-b bg-slate-50 sticky top-0 z-10">
          <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
            <FaRoad /> Lançar Intervenção Técnica
          </h3>
          <button onClick={onClose}>
            <FaTimes className="text-gray-400 hover:text-red-500 text-xl" />
          </button>
        </div>

        <div className="p-4 md:p-6 space-y-6">
          {itensError && (
            <div className="p-3 rounded border bg-rose-50 text-sm text-rose-700">
              Erro ao carregar checklist: <b>{itensError}</b>
            </div>
          )}

          <div className="p-4 rounded-lg border bg-slate-50">
            <div className="text-sm">
              <span className="font-bold text-slate-700">Motorista:</span>{" "}
              {item?.motorista_nome || "-"}{" "}
              <span className="text-slate-400 font-mono">
                ({item?.motorista_chapa || "-"})
              </span>
            </div>
            <div className="text-sm mt-1">
              <span className="font-bold text-slate-700">Foco:</span>{" "}
              {item?.motivo || "-"}
            </div>
            <div className="text-xs mt-2 text-blue-700 font-bold">
              O monitoramento agora será fixo em 30 dias, dividido em 3 checkpoints
              automáticos: 10, 20 e 30 dias.
            </div>
          </div>

          <div className="p-4 md:p-5 border rounded-lg bg-gray-50">
            <h4 className="font-bold text-slate-700 text-sm mb-4 flex items-center gap-2">
              <FaClock /> Dados da Viagem de Teste
            </h4>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="text-xs font-bold text-gray-500 mb-1 block">
                  Hora Início *
                </label>
                <input
                  type="time"
                  value={form.horaInicio}
                  onChange={(e) =>
                    setForm({ ...form, horaInicio: e.target.value })
                  }
                  className="w-full p-2.5 border rounded text-sm outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 mb-1 block">
                  Hora Fim
                </label>
                <input
                  type="time"
                  value={form.horaFim}
                  onChange={(e) => setForm({ ...form, horaFim: e.target.value })}
                  className="w-full p-2.5 border rounded text-sm outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 mb-1 block">
                  KM Início *
                </label>
                <input
                  type="number"
                  value={form.kmInicio}
                  onChange={(e) => setForm({ ...form, kmInicio: e.target.value })}
                  className="w-full p-2.5 border rounded text-sm outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 mb-1 block">
                  KM Fim
                </label>
                <input
                  type="number"
                  value={form.kmFim}
                  onChange={(e) => setForm({ ...form, kmFim: e.target.value })}
                  className="w-full p-2.5 border rounded text-sm outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="text-xs font-bold text-blue-600 block mb-1">
                MÉDIA REALIZADA NO TESTE (KM/L) *
              </label>
              <input
                type="number"
                step="0.01"
                value={form.mediaTeste}
                onChange={(e) => setForm({ ...form, mediaTeste: e.target.value })}
                className="w-full p-2.5 border border-blue-300 rounded text-sm font-bold text-blue-800 bg-blue-50 outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ex: 2.80"
              />
            </div>
          </div>

          <div>
            <h4 className="font-bold text-slate-700 text-sm mb-3 flex items-center gap-2">
              <FaClipboardList /> Condução Inteligente
            </h4>
            <div className="space-y-2">
              {itensConducao.map((it) => {
                const val = form.checklistConducao[it.codigo];
                const isSimGood = it.bool_true_is_good !== false;

                return (
                  <div
                    key={it.id}
                    className="p-3 border rounded-lg bg-white flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm"
                  >
                    <div>
                      <div className="text-sm font-extrabold text-slate-700 leading-tight">
                        {String(it.ordem).padStart(2, "0")} • {it.descricao}
                      </div>
                      {it.ajuda && (
                        <div className="text-xs text-slate-500 mt-1">
                          {it.ajuda}
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 shrink-0 w-full md:w-auto">
                      <button
                        type="button"
                        onClick={() => setConducao(it.codigo, true)}
                        className={`flex-1 md:flex-none px-4 py-2 rounded border text-xs font-bold transition-all ${
                          val === true
                            ? isSimGood
                              ? "bg-emerald-600 text-white border-emerald-700 shadow-inner"
                              : "bg-rose-600 text-white border-rose-700 shadow-inner"
                            : isSimGood
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                            : "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
                        }`}
                      >
                        SIM
                      </button>

                      <button
                        type="button"
                        onClick={() => setConducao(it.codigo, false)}
                        className={`flex-1 md:flex-none px-4 py-2 rounded border text-xs font-bold transition-all ${
                          val === false
                            ? !isSimGood
                              ? "bg-emerald-600 text-white border-emerald-700 shadow-inner"
                              : "bg-rose-600 text-white border-rose-700 shadow-inner"
                            : !isSimGood
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                            : "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
                        }`}
                      >
                        NÃO
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <h4 className="font-bold text-slate-700 text-sm mb-3">
              Avaliação Técnica
            </h4>
            <div className="space-y-3">
              {itensTecnica.map((q) => (
                <div
                  key={q.id}
                  className="p-3 border rounded-lg bg-gray-50 flex flex-col gap-2 shadow-sm"
                >
                  <div>
                    <div className="text-sm text-slate-700 font-semibold leading-tight">
                      {String(q.ordem).padStart(2, "0")} • {q.descricao}
                    </div>
                    {q.ajuda && (
                      <div className="text-xs text-slate-500 mt-1">{q.ajuda}</div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 mt-1">
                    {TEC_OPCOES.map((op) => (
                      <button
                        key={op.value}
                        type="button"
                        onClick={() => setTecnica(q.codigo, op.value)}
                        className={`px-3 py-2 rounded border text-xs font-bold flex items-center gap-1.5 transition-all ${
                          form.avaliacaoTecnica[q.codigo] === op.value
                            ? "bg-slate-900 text-white border-slate-900 shadow-inner"
                            : `${op.cls} hover:brightness-95`
                        }`}
                      >
                        <op.icon size={12} /> {op.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-bold text-slate-700 text-sm mb-2">
                Severidade da Intervenção
              </h4>
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3].map((lvl) => (
                  <button
                    key={lvl}
                    onClick={() => setForm({ ...form, nivel: lvl })}
                    className={`p-3 rounded-lg border text-center transition-all ${
                      form.nivel === lvl
                        ? "ring-2 ring-offset-1 ring-slate-500 bg-white"
                        : NIVEIS[lvl].color
                    }`}
                    type="button"
                  >
                    <div className="font-bold text-sm">{NIVEIS[lvl].label}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-bold text-slate-700 text-sm mb-2">
                Observação (opcional)
              </h4>
              <textarea
                rows={3}
                value={form.obs}
                onChange={(e) => setForm({ ...form, obs: e.target.value })}
                className="w-full p-2.5 border rounded-lg text-sm outline-none focus:border-blue-500"
                placeholder="Ex.: ajustes aplicados e pontos de atenção..."
              />
            </div>
          </div>

          <div className="pt-4 border-t">
            <button
              onClick={salvarIntervencao}
              disabled={salvando || loadingItens}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-black text-lg rounded-xl shadow-md flex justify-center items-center gap-2"
            >
              <FaSave /> {salvando ? "SALVANDO..." : "SALVAR LANÇAMENTO"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

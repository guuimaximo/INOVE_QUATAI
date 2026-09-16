// Controle de Pneus — página única (16/09/2026, pedido do dono). Junta a antiga
// Troca de Pneus (lançamentos) e o antigo Controle de Pneus (conferência com o
// TransNet) em abas, com o Resumo na frente:
//   Resumo · Lançamentos (Troca, Auditoria, Contagem de estoque, Consertos,
//   Riscados) · Conferência TransNet (Veículos, Estoque, Recapadora, Sucata).
// A aba fica na URL (?aba=). As duas rotas antigas abrem esta página; cada grupo
// de abas continua exigindo a permissão da tela de onde veio.
// No app do celular nada muda: lá a rota /pcm-troca-pneus abre só a Troca.
import { lazy, Suspense, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import {
  FaChartBar, FaExchangeAlt, FaClipboardCheck, FaWarehouse, FaTools, FaExclamationTriangle,
  FaBus, FaBoxes, FaRecycle, FaTrashAlt, FaSync, FaCarSide,
} from "react-icons/fa";
import { supabase } from "../../supabase";
import { AuthContext } from "../../context/AuthContext";
import { useAccessGovernance } from "../../context/AccessContext";
import { canUserAccessPageKey } from "../../utils/access";
import PCMControlePneus from "./PCMControlePneus";
import PneusResumo from "./PneusResumo";
import { montarResumoLancamentos } from "./pneusLogic";

// A Troca é grande (câmera, fila offline, PDFs): só carrega quando alguém abre
// uma aba dela — e, ao abrir, ela grava avisos de alerta no banco, como sempre fez.
const PCMTrocaPneus = lazy(() => import("./PCMTrocaPneus"));

const ABAS = [
  { k: "resumo", label: "Resumo", Icone: FaChartBar, grupo: "resumo" },
  { k: "troca", label: "Troca", Icone: FaExchangeAlt, grupo: "lancamentos" },
  { k: "auditoria", label: "Auditoria", Icone: FaClipboardCheck, grupo: "lancamentos" },
  { k: "estoque", label: "Contagem de estoque", Icone: FaWarehouse, grupo: "lancamentos" },
  { k: "consertos", label: "Consertos", Icone: FaTools, grupo: "lancamentos" },
  { k: "riscados", label: "Riscados", Icone: FaExclamationTriangle, grupo: "lancamentos" },
  { k: "veiculos", label: "Veículos", Icone: FaBus, grupo: "conferencia" },
  { k: "estoque-transnet", label: "Estoque", Icone: FaBoxes, grupo: "conferencia", controle: "estoque" },
  { k: "recapadora", label: "Recapadora", Icone: FaRecycle, grupo: "conferencia" },
  { k: "sucata", label: "Sucata", Icone: FaTrashAlt, grupo: "conferencia" },
];
const NOME_GRUPO = { lancamentos: "Lançamentos", conferencia: "Conferência TransNet" };

// Lê todas as linhas: o PostgREST corta em 1000 por resposta.
async function lerTudo(montar) {
  const passo = 1000;
  const todas = [];
  for (let de = 0; ; de += passo) {
    const { data, error } = await montar().range(de, de + passo - 1);
    if (error) throw error;
    todas.push(...(data || []));
    if (!data || data.length < passo) break;
  }
  return todas;
}

const carregandoAba = (
  <div className="grid place-items-center py-20 text-gray-400">
    <FaSync className="animate-spin text-3xl" />
  </div>
);

export default function PCMPneus() {
  if (Capacitor.isNativePlatform()) {
    return (
      <Suspense fallback={carregandoAba}>
        <PCMTrocaPneus />
      </Suspense>
    );
  }
  return <PneusWeb />;
}

function PneusWeb() {
  const { user } = useContext(AuthContext);
  const { profileMap } = useAccessGovernance();
  const podeLancamentos = canUserAccessPageKey(user, "pcm_troca_pneus", profileMap);
  const podeConferencia = canUserAccessPageKey(user, "pcm_controle_pneus", profileMap);

  const abas = ABAS.filter(
    (a) => a.grupo === "resumo" || (a.grupo === "lancamentos" ? podeLancamentos : podeConferencia)
  );
  const [params, setParams] = useSearchParams();
  const abaUrl = params.get("aba");
  const aba = abas.find((a) => a.k === abaUrl) || abas[0];
  const setAba = useCallback(
    (k) =>
      setParams(
        (p) => {
          const n = new URLSearchParams(p);
          if (k === "resumo") n.delete("aba");
          else n.set("aba", k);
          return n;
        },
        { replace: true }
      ),
    [setParams]
  );

  // A Conferência fica montada (escondida) desde o início: é dela que o Resumo
  // tira os números. Quando escondida, ela guarda a última aba aberta.
  const [abaConferencia, setAbaConferencia] = useState("veiculos");
  useEffect(() => {
    if (aba.grupo === "conferencia") setAbaConferencia(aba.controle || aba.k);
  }, [aba]);

  const [resumoConferencia, setResumoConferencia] = useState(null);
  const [dadosLancamentos, setDadosLancamentos] = useState(null);
  const [erroLancamentos, setErroLancamentos] = useState(null);
  const [versao, setVersao] = useState(0);

  const carregarLancamentos = useCallback(async () => {
    if (!podeLancamentos) return;
    try {
      const [trocas, auditorias, prefixos, consertos, riscados] = await Promise.all([
        lerTudo(() =>
          supabase
            .from("pcm_troca_pneus")
            .select("id, ficha_troca, tipo_troca, prefixo_retirada, prefixo_instalacao, numero_fogo_retirado, numero_fogo_colocado, created_at, transnet_lancado_em")
            .order("id")
        ),
        lerTudo(() => supabase.from("pcm_auditoria_pneus").select("id, prefixo, created_at").order("id")),
        lerTudo(() => supabase.from("prefixos").select("id, codigo, cluster").order("codigo")),
        lerTudo(() =>
          supabase.from("pcm_consertos_pneus").select("id, ficha_conserto, numero_fogo, prefixo, status, created_at").order("id")
        ),
        lerTudo(() =>
          supabase.from("pcm_riscados_pneus").select("id, ficha_riscado, numero_fogo, prefixo, status, data_riscado, created_at").order("id")
        ),
      ]);
      setDadosLancamentos({ trocas, auditorias, prefixos, consertos, riscados });
      setErroLancamentos(null);
    } catch (e) {
      console.error("Falha ao carregar os lançamentos de pneus:", e);
      setErroLancamentos(e?.message || String(e));
    }
  }, [podeLancamentos]);

  // Toda vez que o Resumo aparece, os números dos lançamentos são relidos
  // (alguém pode ter lançado numa aba de Lançamentos). O que já está na tela fica
  // até chegar a leitura nova.
  useEffect(() => {
    if (aba.k === "resumo") carregarLancamentos();
  }, [aba.k, carregarLancamentos, versao]);

  const lancamentos = useMemo(
    () => (dadosLancamentos ? montarResumoLancamentos(dadosLancamentos) : null),
    [dadosLancamentos]
  );

  // Contador nas abas: o que está pedindo ação.
  const pendentes = {
    troca: lancamentos?.trocasSemLancar.length,
    auditoria: lancamentos?.auditoriaAtrasada.length,
    consertos: lancamentos?.consertosAbertos.length,
    riscados: lancamentos?.riscadosAbertos.length,
    veiculos: resumoConferencia?.comDivergencia.length,
  };

  const snapshot = resumoConferencia?.snapshot ? new Date(resumoConferencia.snapshot) : null;
  const atualizar = () => {
    setResumoConferencia(null);
    setVersao((v) => v + 1);
  };

  let grupoAnterior = null;

  return (
    <div className="w-full max-w-[98vw] 2xl:max-w-[1800px] mx-auto p-4 md:p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-emerald-700 text-white grid place-items-center">
            <FaCarSide className="text-lg" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100 leading-tight">Controle de Pneus</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">Troca, auditoria, estoque e conferência com o TransNet</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {podeConferencia && (
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
              TransNet em {snapshot && !Number.isNaN(snapshot.getTime())
                ? snapshot.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
                : "…"}
            </span>
          )}
          <button
            type="button"
            onClick={atualizar}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-100 text-sm font-medium transition"
          >
            <FaSync /> Atualizar
          </button>
        </div>
      </div>

      <nav className="flex flex-wrap items-end gap-x-1 gap-y-2 border-b border-gray-200 dark:border-gray-700" aria-label="Abas de pneus">
        {abas.map((a) => {
          const novoGrupo = a.grupo !== "resumo" && a.grupo !== grupoAnterior;
          grupoAnterior = a.grupo;
          const ativa = aba.k === a.k;
          const n = pendentes[a.k];
          return (
            <span key={a.k} className="contents">
              {novoGrupo && (
                // O nome do grupo só cabe em tela bem larga; nas outras fica o divisor.
                <span
                  title={NOME_GRUPO[a.grupo]}
                  className="ml-2 mr-0.5 mb-3 pl-2 min-h-[16px] border-l border-gray-300 dark:border-gray-600 text-[10px] font-bold uppercase tracking-wide text-gray-400 self-end"
                >
                  <span className="hidden 2xl:inline">{NOME_GRUPO[a.grupo]}</span>
                </span>
              )}
              <button
                type="button"
                onClick={() => setAba(a.k)}
                aria-current={ativa ? "page" : undefined}
                className={`flex items-center gap-1.5 px-2.5 py-2.5 text-sm font-semibold border-b-2 -mb-px transition whitespace-nowrap ${
                  ativa
                    ? "border-emerald-600 text-emerald-700 dark:text-emerald-400"
                    : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                }`}
              >
                <a.Icone className="text-xs" aria-hidden /> {a.label}
                {n > 0 && (
                  <span className="min-w-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold leading-[18px] text-center">
                    {n}
                  </span>
                )}
              </button>
            </span>
          );
        })}
      </nav>

      {aba.k === "resumo" && (
        <PneusResumo
          conferencia={podeConferencia ? resumoConferencia : undefined}
          lancamentos={podeLancamentos ? lancamentos : undefined}
          erroLancamentos={erroLancamentos}
          onIrPara={setAba}
        />
      )}

      {aba.grupo === "lancamentos" && (
        <Suspense fallback={carregandoAba}>
          <PCMTrocaPneus key={`troca-${versao}`} embutido aba={aba.k} onAba={setAba} />
        </Suspense>
      )}

      {podeConferencia && (
        <div hidden={aba.grupo !== "conferencia"}>
          <PCMControlePneus
            key={`conferencia-${versao}`}
            embutido
            aba={aba.grupo === "conferencia" ? aba.controle || aba.k : abaConferencia}
            onResumo={setResumoConferencia}
          />
        </div>
      )}
    </div>
  );
}

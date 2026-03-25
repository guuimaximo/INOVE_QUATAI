import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import {
  FaCar,
  FaCheckCircle,
  FaExclamationTriangle,
  FaExchangeAlt,
  FaFileExcel,
  FaHistory,
  FaPlus,
  FaSave,
  FaSync,
  FaTable,
  FaTimes,
  FaTimesCircle,
  FaTools,
} from "react-icons/fa";
import * as XLSX from "xlsx";

const TIPOS_EMBARCADOS = [
  "TELEMETRIA",
  "CAMERAS",
  "VISION",
  "VALIDADOR",
  "CHIP_VALIDADOR",
  "GPS",
];

const DESTINOS = ["VEICULO", "ESTOQUE", "MANUTENCAO", "SUCATA", "RESERVA", "EXTERNO"];

export default function EmbarcadosMovimentacoes() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("PAINEL");

  // Dados globais
  const [prefixos, setPrefixos] = useState([]);
  const [disponiveisGlobais, setDisponiveisGlobais] = useState([]);
  const [instaladosGlobais, setInstaladosGlobais] = useState([]);
  const [usuarioLogado, setUsuarioLogado] = useState("SISTEMA");

  // Analítico
  const [loadingAnalitico, setLoadingAnalitico] = useState(false);
  const [buscaAnalitico, setBuscaAnalitico] = useState("");
  const [analiticoRows, setAnaliticoRows] = useState([]);

  // Seleção de Veículo
  const [buscaVeiculo, setBuscaVeiculo] = useState("");
  const [veiculoSelecionado, setVeiculoSelecionado] = useState("");

  // Dados do veículo selecionado
  const [embarcadosVeiculo, setEmbarcadosVeiculo] = useState([]);
  const [reparosAtivos, setReparosAtivos] = useState([]);
  const [historicoVeiculo, setHistoricoVeiculo] = useState([]);

  // Controle de Modais
  const [modalAcao, setModalAcao] = useState(null); // 'INSTALAR', 'MOVIMENTAR', 'HISTORICO'
  const [tipoSelecionado, setTipoSelecionado] = useState("");
  const [deviceSelecionado, setDeviceSelecionado] = useState(null);

  // Formulários
  const [formInstalar, setFormInstalar] = useState({ embarcado_id: "", observacao: "" });
  const [formMovimentar, setFormMovimentar] = useState({
    destino_tipo: "ESTOQUE",
    destino_valor: "",
    observacao: "",
  });

  async function carregarIniciais() {
    setLoading(true);

    const { data: authData } = await supabase.auth.getSession();
    const email = authData?.session?.user?.email;
    if (email) {
      setUsuarioLogado(email.split("@")[0].toUpperCase());
    }

    const [resPrefixos, resDisponiveis, resInstalados] = await Promise.all([
      supabase.from("prefixos").select("codigo, cluster").order("codigo"),
      supabase
        .from("embarcados")
        .select("id, tipo, numero_equipamento, status_atual")
        .eq("ativo", true)
        .in("status_atual", ["DISPONIVEL", "RESERVA", "RETORNADO"])
        .order("numero_equipamento"),
      supabase
        .from("embarcados")
        .select("tipo")
        .eq("ativo", true)
        .eq("localizacao_tipo", "VEICULO"),
    ]);

    if (resPrefixos.data) setPrefixos(resPrefixos.data);
    if (resDisponiveis.data) setDisponiveisGlobais(resDisponiveis.data);
    if (resInstalados.data) setInstaladosGlobais(resInstalados.data);

    setLoading(false);
  }

  async function carregarAnalitico() {
    try {
      setLoadingAnalitico(true);

      const [resPrefixos, resInstalados] = await Promise.all([
        supabase.from("prefixos").select("codigo, cluster").order("codigo"),
        supabase
          .from("embarcados")
          .select("id, tipo, numero_equipamento, localizacao_tipo, localizacao_valor, ativo")
          .eq("ativo", true)
          .eq("localizacao_tipo", "VEICULO"),
      ]);

      const listaPrefixos = resPrefixos.data || [];
      const listaInstalados = resInstalados.data || [];

      const mapaVeiculos = {};

      listaPrefixos.forEach((p) => {
        mapaVeiculos[p.codigo] = {
          carro: p.codigo,
          cluster: p.cluster || "",
        };

        TIPOS_EMBARCADOS.forEach((tipo) => {
          mapaVeiculos[p.codigo][tipo] = false;
          mapaVeiculos[p.codigo][`${tipo}_NUMERO`] = "";
        });
      });

      listaInstalados.forEach((item) => {
        const veiculo = item.localizacao_valor;
        if (!veiculo) return;

        if (!mapaVeiculos[veiculo]) {
          mapaVeiculos[veiculo] = {
            carro: veiculo,
            cluster: "",
          };

          TIPOS_EMBARCADOS.forEach((tipo) => {
            mapaVeiculos[veiculo][tipo] = false;
            mapaVeiculos[veiculo][`${tipo}_NUMERO`] = "";
          });
        }

        mapaVeiculos[veiculo][item.tipo] = true;
        mapaVeiculos[veiculo][`${item.tipo}_NUMERO`] = item.numero_equipamento || "";
      });

      const rows = Object.values(mapaVeiculos).map((row) => {
        const totalInstalados = TIPOS_EMBARCADOS.reduce((acc, tipo) => acc + (row[tipo] ? 1 : 0), 0);
        return {
          ...row,
          totalInstalados,
          pendencias: TIPOS_EMBARCADOS.length - totalInstalados,
        };
      });

      rows.sort((a, b) => String(a.carro).localeCompare(String(b.carro), "pt-BR", { numeric: true }));

      setAnaliticoRows(rows);
    } catch (err) {
      console.error("Erro ao carregar analítico:", err);
      alert("Erro ao carregar a visão analítica.");
    } finally {
      setLoadingAnalitico(false);
    }
  }

  async function carregarDadosVeiculo(veiculo) {
    if (!veiculo) {
      setEmbarcadosVeiculo([]);
      setReparosAtivos([]);
      setHistoricoVeiculo([]);
      return;
    }

    setLoading(true);
    const [resEmb, resRep, resHist] = await Promise.all([
      supabase
        .from("embarcados")
        .select("*")
        .eq("ativo", true)
        .eq("localizacao_tipo", "VEICULO")
        .eq("localizacao_valor", veiculo),
      supabase
        .from("embarcados_solicitacoes_reparo")
        .select("id, veiculo, tipo_embarcado, status")
        .eq("veiculo", veiculo)
        .in("status", ["ABERTA", "EM_ANALISE", "EM_EXECUCAO", "AG_PECAS"]),
      supabase
        .from("embarcados_movimentacoes")
        .select("*, embarcados(numero_equipamento, tipo)")
        .or(`origem_valor.eq.${veiculo},destino_valor.eq.${veiculo}`)
        .order("data_movimentacao", { ascending: false })
        .limit(50),
    ]);

    if (resEmb.data) setEmbarcadosVeiculo(resEmb.data);
    if (resRep.data) setReparosAtivos(resRep.data);
    if (resHist.data) setHistoricoVeiculo(resHist.data);
    setLoading(false);
  }

  useEffect(() => {
    carregarIniciais();
    carregarAnalitico();
  }, []);

  useEffect(() => {
    carregarDadosVeiculo(veiculoSelecionado);
  }, [veiculoSelecionado]);

  async function handleInstalar(e) {
    e.preventDefault();
    if (!formInstalar.embarcado_id) return alert("Selecione um equipamento disponível.");

    try {
      setSaving(true);
      const embarcado = disponiveisGlobais.find((d) => d.id === formInstalar.embarcado_id);

      const { error: movError } = await supabase.from("embarcados_movimentacoes").insert([
        {
          embarcado_id: embarcado.id,
          tipo_movimentacao: "INSTALACAO",
          origem_tipo: "ESTOQUE",
          origem_valor: "Disponível",
          destino_tipo: "VEICULO",
          destino_valor: veiculoSelecionado,
          responsavel: usuarioLogado,
          observacao: formInstalar.observacao || null,
        },
      ]);
      if (movError) throw movError;

      await supabase
        .from("embarcados_instalacoes")
        .update({
          ativo: false,
          data_retirada: new Date().toISOString(),
          retirado_por: usuarioLogado,
        })
        .eq("embarcado_id", embarcado.id)
        .eq("ativo", true);

      await supabase.from("embarcados_instalacoes").insert([
        {
          embarcado_id: embarcado.id,
          veiculo: veiculoSelecionado,
          instalado_por: usuarioLogado,
          observacao: formInstalar.observacao || null,
          ativo: true,
        },
      ]);

      const { error: embError } = await supabase
        .from("embarcados")
        .update({
          status_atual: "EM_VEICULO",
          localizacao_tipo: "VEICULO",
          localizacao_valor: veiculoSelecionado,
        })
        .eq("id", embarcado.id);
      if (embError) throw embError;

      alert("Equipamento instalado com sucesso!");
      setModalAcao(null);
      carregarIniciais();
      carregarDadosVeiculo(veiculoSelecionado);
      carregarAnalitico();
    } catch (err) {
      console.error(err);
      alert("Erro ao instalar equipamento.");
    } finally {
      setSaving(false);
    }
  }

  async function handleMovimentar(e) {
    e.preventDefault();
    if (!formMovimentar.destino_tipo) return alert("Selecione um destino.");

    const destValor =
      formMovimentar.destino_tipo === "VEICULO"
        ? formMovimentar.destino_valor
        : formMovimentar.destino_tipo;

    if (formMovimentar.destino_tipo === "VEICULO" && !formMovimentar.destino_valor) {
      return alert("Selecione o veículo de destino.");
    }

    try {
      setSaving(true);

      if (formMovimentar.destino_tipo === "VEICULO") {
        const { data: checkData } = await supabase
          .from("embarcados")
          .select("id")
          .eq("localizacao_tipo", "VEICULO")
          .eq("localizacao_valor", formMovimentar.destino_valor)
          .eq("tipo", deviceSelecionado.tipo)
          .eq("ativo", true);

        if (checkData && checkData.length > 0) {
          alert(
            `Operação cancelada: O veículo ${formMovimentar.destino_valor} já tem um equipamento do tipo ${deviceSelecionado.tipo} instalado.`
          );
          return;
        }
      }

      let tipoMov = "RETIRADA";
      if (formMovimentar.destino_tipo === "VEICULO") tipoMov = "TRANSFERENCIA";
      if (formMovimentar.destino_tipo === "MANUTENCAO") tipoMov = "ENVIO_MANUTENCAO";
      if (formMovimentar.destino_tipo === "RESERVA") tipoMov = "ENVIO_RESERVA";

      let novoStatus = "DISPONIVEL";
      if (formMovimentar.destino_tipo === "VEICULO") novoStatus = "EM_VEICULO";
      if (formMovimentar.destino_tipo === "MANUTENCAO") novoStatus = "MANUTENCAO";
      if (formMovimentar.destino_tipo === "RESERVA") novoStatus = "RESERVA";
      if (formMovimentar.destino_tipo === "SUCATA") novoStatus = "SUCATA";

      const { error: movError } = await supabase.from("embarcados_movimentacoes").insert([
        {
          embarcado_id: deviceSelecionado.id,
          tipo_movimentacao: tipoMov,
          origem_tipo: "VEICULO",
          origem_valor: veiculoSelecionado,
          destino_tipo: formMovimentar.destino_tipo,
          destino_valor: destValor,
          responsavel: usuarioLogado,
          observacao: formMovimentar.observacao || null,
        },
      ]);
      if (movError) throw movError;

      await supabase
        .from("embarcados_instalacoes")
        .update({
          ativo: false,
          data_retirada: new Date().toISOString(),
          retirado_por: usuarioLogado,
        })
        .eq("embarcado_id", deviceSelecionado.id)
        .eq("ativo", true);

      if (formMovimentar.destino_tipo === "VEICULO") {
        await supabase.from("embarcados_instalacoes").insert([
          {
            embarcado_id: deviceSelecionado.id,
            veiculo: formMovimentar.destino_valor,
            instalado_por: usuarioLogado,
            observacao: formMovimentar.observacao || null,
            ativo: true,
          },
        ]);
      }

      const { error: embError } = await supabase
        .from("embarcados")
        .update({
          status_atual: novoStatus,
          localizacao_tipo: formMovimentar.destino_tipo,
          localizacao_valor: destValor,
        })
        .eq("id", deviceSelecionado.id);
      if (embError) throw embError;

      alert("Equipamento movimentado com sucesso!");
      setModalAcao(null);
      carregarIniciais();
      carregarDadosVeiculo(veiculoSelecionado);
      carregarAnalitico();
    } catch (err) {
      console.error(err);
      alert("Erro ao movimentar equipamento.");
    } finally {
      setSaving(false);
    }
  }

  const prefixosFiltrados = useMemo(() => {
    const txt = buscaVeiculo.toLowerCase().trim();
    if (!txt) return prefixos;
    return prefixos.filter(
      (p) => p.codigo.toLowerCase().includes(txt) || (p.cluster && p.cluster.toLowerCase().includes(txt))
    );
  }, [prefixos, buscaVeiculo]);

  const analiticoFiltrado = useMemo(() => {
    const txt = buscaAnalitico.toLowerCase().trim();
    if (!txt) return analiticoRows;

    return analiticoRows.filter((row) => {
      return (
        String(row.carro || "").toLowerCase().includes(txt) ||
        String(row.cluster || "").toLowerCase().includes(txt)
      );
    });
  }, [analiticoRows, buscaAnalitico]);

  function exportarExcelAnalitico() {
    try {
      const dados = analiticoFiltrado.map((row) => ({
        Carro: row.carro,
        Cluster: row.cluster || "",
        Telemetria: row.TELEMETRIA ? "✓" : "X",
        Cameras: row.CAMERAS ? "✓" : "X",
        Vision: row.VISION ? "✓" : "X",
        Validador: row.VALIDADOR ? "✓" : "X",
        Chip_Validador: row.CHIP_VALIDADOR ? "✓" : "X",
        GPS: row.GPS ? "✓" : "X",
        Total_Instalados: row.totalInstalados,
        Pendencias: row.pendencias,
        Numero_Telemetria: row.TELEMETRIA_NUMERO || "",
        Numero_Cameras: row.CAMERAS_NUMERO || "",
        Numero_Vision: row.VISION_NUMERO || "",
        Numero_Validador: row.VALIDADOR_NUMERO || "",
        Numero_Chip_Validador: row.CHIP_VALIDADOR_NUMERO || "",
        Numero_GPS: row.GPS_NUMERO || "",
      }));

      const ws = XLSX.utils.json_to_sheet(dados);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Analitico");

      XLSX.writeFile(wb, `embarcados_analitico_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err) {
      console.error(err);
      alert("Erro ao gerar Excel.");
    }
  }

  function renderIconStatus(ok, numero) {
    if (ok) {
      return (
        <div className="flex flex-col items-center justify-center">
          <FaCheckCircle className="text-emerald-600 text-lg" />
          {numero ? <span className="text-[10px] mt-1 font-bold text-slate-500">{numero}</span> : null}
        </div>
      );
    }

    return <FaTimesCircle className="text-red-500 text-lg" />;
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6 font-sans text-slate-900">
      <div className="mx-auto max-w-[1700px] space-y-4">
        {/* RESUMO GLOBAL */}
        <div className="bg-indigo-900 border border-indigo-800 rounded-3xl p-4 flex flex-nowrap overflow-x-auto hide-scrollbar items-center lg:justify-center gap-4 text-sm md:text-base font-black text-white uppercase tracking-widest shadow-md whitespace-nowrap">
          <span className="text-indigo-200 mr-2 flex-shrink-0">Total Instalados Frota:</span>
          {TIPOS_EMBARCADOS.map((tipo) => {
            const qtd = instaladosGlobais.filter((e) => e.tipo === tipo).length;
            return (
              <span
                key={tipo}
                className="flex items-center gap-2 bg-indigo-800/50 px-4 py-2 rounded-xl border border-indigo-700/50 shadow-sm flex-shrink-0"
              >
                {tipo}:{" "}
                <span className={qtd > 0 ? "text-emerald-400 text-lg" : "text-indigo-300 text-lg"}>
                  {qtd}
                </span>
              </span>
            );
          })}
        </div>

        {/* HEADER */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
          <div className="flex flex-col 2xl:flex-row 2xl:items-end 2xl:justify-between gap-4">
            <div>
              <div className="text-[11px] font-black tracking-[0.18em] text-indigo-600 uppercase">
                Módulo Veicular
              </div>
              <h1 className="text-3xl font-black tracking-tight text-slate-900">
                Painel de Equipamentos do Veículo
              </h1>
              <p className="text-sm text-slate-500 font-semibold mt-1">
                Selecione um carro para ver, instalar, remover ou acompanhar a visão analítica da frota.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => {
                  carregarIniciais();
                  carregarDadosVeiculo(veiculoSelecionado);
                  carregarAnalitico();
                }}
                className="h-[44px] px-4 rounded-2xl bg-white border border-slate-300 text-slate-800 font-black text-sm hover:bg-slate-50 flex items-center justify-center gap-2 transition-colors"
              >
                <FaSync className="text-indigo-600" />
                Atualizar Dados
              </button>
            </div>
          </div>
        </div>

        {/* ABAS */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-3">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActiveTab("PAINEL")}
              className={`px-5 py-3 rounded-2xl font-black text-sm flex items-center gap-2 transition-colors ${
                activeTab === "PAINEL"
                  ? "bg-indigo-600 text-white shadow-md"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              <FaTools />
              Painel do Veículo
            </button>

            <button
              onClick={() => setActiveTab("ANALITICO")}
              className={`px-5 py-3 rounded-2xl font-black text-sm flex items-center gap-2 transition-colors ${
                activeTab === "ANALITICO"
                  ? "bg-indigo-600 text-white shadow-md"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              <FaTable />
              Analítico
            </button>
          </div>
        </div>

        {/* ===================== ABA PAINEL ===================== */}
        {activeTab === "PAINEL" && (
          <>
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 flex flex-col lg:flex-row items-center justify-between gap-4">
              <div className="w-full lg:w-1/2">
                <label className="text-xs font-black uppercase text-slate-500 mb-2 block tracking-widest">
                  Selecione o Veículo
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <FaCar className="text-slate-400" />
                  </div>
                  <input
                    type="text"
                    className="w-full border border-slate-300 rounded-2xl pl-10 pr-4 py-3 text-lg font-black bg-slate-50 focus:bg-white outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all text-slate-800"
                    placeholder="Ex: 1234, 5090..."
                    value={veiculoSelecionado ? veiculoSelecionado : buscaVeiculo}
                    onChange={(e) => {
                      setVeiculoSelecionado("");
                      setBuscaVeiculo(e.target.value);
                    }}
                  />
                  {!veiculoSelecionado && buscaVeiculo && prefixosFiltrados.length > 0 && (
                    <div className="absolute z-20 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                      {prefixosFiltrados.map((p) => (
                        <div
                          key={p.codigo}
                          onClick={() => {
                            setVeiculoSelecionado(p.codigo);
                            setBuscaVeiculo("");
                          }}
                          className="px-4 py-3 hover:bg-indigo-50 cursor-pointer font-bold text-slate-700 border-b last:border-0 flex justify-between items-center"
                        >
                          <span>{p.codigo}</span>
                          <span className="text-xs text-slate-400 font-semibold">{p.cluster || "S/N"}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {veiculoSelecionado && (
                <button
                  onClick={() => setModalAcao("HISTORICO")}
                  className="h-[52px] px-6 rounded-2xl bg-indigo-50 text-indigo-700 border border-indigo-200 font-black text-sm hover:bg-indigo-100 flex items-center justify-center gap-2 transition-colors w-full lg:w-auto mt-6 lg:mt-0"
                >
                  <FaHistory />
                  Ver Histórico do Veículo
                </button>
              )}
            </div>

            {veiculoSelecionado && (
              <div className="space-y-4 animate-in slide-in-from-bottom-4">
                <h2 className="text-xl font-black text-slate-800 flex items-center gap-2 px-2 mt-4">
                  <FaTools className="text-slate-400" /> Status do Veículo:{" "}
                  <span className="text-indigo-600">{veiculoSelecionado}</span>
                </h2>

                {loading ? (
                  <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-12 text-center text-slate-400 font-black">
                    Carregando embarcados...
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {TIPOS_EMBARCADOS.map((tipo) => {
                      const embarcado = embarcadosVeiculo.find((e) => e.tipo === tipo);
                      const temReparo = reparosAtivos.some((r) => r.tipo_embarcado === tipo);

                      if (!embarcado) {
                        return (
                          <div
                            key={tipo}
                            className="bg-red-50 border-2 border-dashed border-red-200 rounded-3xl p-6 flex flex-col items-center justify-center text-center transition-all hover:bg-red-100/50"
                          >
                            <div className="w-14 h-14 rounded-full bg-red-100 text-red-400 flex items-center justify-center mb-4">
                              <FaTimesCircle size={28} />
                            </div>
                            <h3 className="text-lg font-black text-red-900 mb-1">{tipo}</h3>
                            <p className="text-xs font-bold text-red-500 uppercase tracking-widest mb-5">
                              Não Instalado
                            </p>
                            <button
                              onClick={() => {
                                setTipoSelecionado(tipo);
                                setFormInstalar({ embarcado_id: "", observacao: "" });
                                setModalAcao("INSTALAR");
                              }}
                              className="px-5 py-2.5 rounded-xl bg-white border border-red-200 text-red-700 font-black text-sm shadow-sm hover:bg-red-50 flex items-center gap-2 transition-colors"
                            >
                              <FaPlus /> Instalar Equipamento
                            </button>
                          </div>
                        );
                      }

                      if (temReparo) {
                        return (
                          <div
                            key={tipo}
                            className="bg-amber-50 border border-amber-300 rounded-3xl p-6 relative overflow-hidden shadow-sm transition-all hover:shadow-md"
                          >
                            <div className="absolute top-0 right-0 bg-amber-400 text-amber-900 text-[10px] font-black px-4 py-1.5 rounded-bl-xl uppercase tracking-widest flex items-center gap-1.5 shadow-sm">
                              <FaExclamationTriangle /> Reparo Solicitado
                            </div>
                            <div className="mb-4">
                              <h3 className="text-sm font-black text-amber-900/50 uppercase tracking-widest">
                                {tipo}
                              </h3>
                              <div className="text-2xl font-black text-amber-900 mt-1">
                                {embarcado.numero_equipamento}
                              </div>
                            </div>
                            <div className="text-xs font-bold text-amber-700 bg-amber-100/50 rounded-lg p-3 border border-amber-200/50 mb-5">
                              Atenção: Existe uma OS aberta para este equipamento. Verifique antes de movimentar.
                            </div>
                            <button
                              onClick={() => {
                                setDeviceSelecionado(embarcado);
                                setFormMovimentar({
                                  destino_tipo: "ESTOQUE",
                                  destino_valor: "",
                                  observacao: "",
                                });
                                setModalAcao("MOVIMENTAR");
                              }}
                              className="w-full px-5 py-3 rounded-xl bg-white border border-amber-300 text-amber-800 font-black text-sm shadow-sm hover:bg-amber-100 flex items-center justify-center gap-2 transition-colors"
                            >
                              <FaExchangeAlt /> Retirar / Movimentar
                            </button>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={tipo}
                          className="bg-emerald-50 border border-emerald-200 rounded-3xl p-6 relative overflow-hidden shadow-sm transition-all hover:shadow-md"
                        >
                          <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[10px] font-black px-4 py-1.5 rounded-bl-xl uppercase tracking-widest flex items-center gap-1.5 shadow-sm">
                            <FaCheckCircle /> Operacional
                          </div>
                          <div className="mb-4 mt-2">
                            <h3 className="text-sm font-black text-emerald-800/50 uppercase tracking-widest">
                              {tipo}
                            </h3>
                            <div className="text-2xl font-black text-emerald-900 mt-1">
                              {embarcado.numero_equipamento}
                            </div>
                          </div>
                          <div className="text-xs font-bold text-emerald-700 bg-emerald-100/50 rounded-lg p-3 border border-emerald-200/50 mb-5 opacity-80">
                            Nenhuma falha relatada. Operando normalmente.
                          </div>
                          <button
                            onClick={() => {
                              setDeviceSelecionado(embarcado);
                              setFormMovimentar({
                                destino_tipo: "ESTOQUE",
                                destino_valor: "",
                                observacao: "",
                              });
                              setModalAcao("MOVIMENTAR");
                            }}
                            className="w-full px-5 py-3 rounded-xl bg-white border border-emerald-200 text-emerald-700 font-black text-sm shadow-sm hover:bg-emerald-100 flex items-center justify-center gap-2 transition-colors"
                          >
                            <FaExchangeAlt /> Retirar / Movimentar
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ===================== ABA ANALÍTICO ===================== */}
        {activeTab === "ANALITICO" && (
          <div className="space-y-4 animate-in slide-in-from-bottom-4">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
              <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
                <div>
                  <div className="text-[11px] font-black tracking-[0.18em] text-indigo-600 uppercase">
                    Visão Geral
                  </div>
                  <h2 className="text-2xl font-black text-slate-900 mt-1">
                    Tabela Analítica da Frota
                  </h2>
                  <p className="text-sm text-slate-500 font-semibold mt-1">
                    Visualize todos os carros e identifique rapidamente quais módulos estão instalados.
                  </p>
                </div>

                <div className="flex flex-col md:flex-row gap-3 w-full xl:w-auto">
                  <input
                    type="text"
                    value={buscaAnalitico}
                    onChange={(e) => setBuscaAnalitico(e.target.value)}
                    placeholder="Buscar carro ou cluster..."
                    className="h-[44px] min-w-[260px] px-4 rounded-2xl border border-slate-300 bg-slate-50 focus:bg-white outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 text-sm font-bold"
                  />

                  <button
                    onClick={exportarExcelAnalitico}
                    className="h-[44px] px-5 rounded-2xl bg-emerald-600 text-white font-black text-sm hover:bg-emerald-700 flex items-center justify-center gap-2 transition-colors shadow-sm"
                  >
                    <FaFileExcel />
                    Baixar Excel
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4">
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5">
                <div className="text-xs font-black uppercase tracking-widest text-slate-400">Total Carros</div>
                <div className="text-3xl font-black text-slate-900 mt-2">{analiticoFiltrado.length}</div>
              </div>

              {TIPOS_EMBARCADOS.map((tipo) => {
                const qtd = analiticoFiltrado.filter((r) => r[tipo]).length;
                return (
                  <div key={tipo} className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5">
                    <div className="text-xs font-black uppercase tracking-widest text-slate-400">{tipo}</div>
                    <div className="text-3xl font-black text-indigo-700 mt-2">{qtd}</div>
                  </div>
                );
              })}
            </div>

            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="px-4 py-4 text-left font-black text-slate-700 uppercase tracking-wider">Carro</th>
                      <th className="px-4 py-4 text-left font-black text-slate-700 uppercase tracking-wider">Cluster</th>
                      {TIPOS_EMBARCADOS.map((tipo) => (
                        <th
                          key={tipo}
                          className="px-4 py-4 text-center font-black text-slate-700 uppercase tracking-wider"
                        >
                          {tipo}
                        </th>
                      ))}
                      <th className="px-4 py-4 text-center font-black text-slate-700 uppercase tracking-wider">
                        Total
                      </th>
                      <th className="px-4 py-4 text-center font-black text-slate-700 uppercase tracking-wider">
                        Pendências
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {loadingAnalitico ? (
                      <tr>
                        <td colSpan={10} className="px-4 py-12 text-center font-black text-slate-400">
                          Carregando visão analítica...
                        </td>
                      </tr>
                    ) : analiticoFiltrado.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="px-4 py-12 text-center font-black text-slate-400">
                          Nenhum registro encontrado.
                        </td>
                      </tr>
                    ) : (
                      analiticoFiltrado.map((row) => (
                        <tr key={row.carro} className="border-t border-slate-100 hover:bg-slate-50">
                          <td className="px-4 py-4 font-black text-slate-900">{row.carro}</td>
                          <td className="px-4 py-4 font-bold text-slate-600">{row.cluster || "-"}</td>

                          <td className="px-4 py-4 text-center">{renderIconStatus(row.TELEMETRIA, row.TELEMETRIA_NUMERO)}</td>
                          <td className="px-4 py-4 text-center">{renderIconStatus(row.CAMERAS, row.CAMERAS_NUMERO)}</td>
                          <td className="px-4 py-4 text-center">{renderIconStatus(row.VISION, row.VISION_NUMERO)}</td>
                          <td className="px-4 py-4 text-center">{renderIconStatus(row.VALIDADOR, row.VALIDADOR_NUMERO)}</td>
                          <td className="px-4 py-4 text-center">{renderIconStatus(row.CHIP_VALIDADOR, row.CHIP_VALIDADOR_NUMERO)}</td>
                          <td className="px-4 py-4 text-center">{renderIconStatus(row.GPS, row.GPS_NUMERO)}</td>

                          <td className="px-4 py-4 text-center">
                            <span className="inline-flex items-center justify-center min-w-[36px] px-2 py-1 rounded-xl bg-indigo-100 text-indigo-700 font-black">
                              {row.totalInstalados}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-center">
                            <span
                              className={`inline-flex items-center justify-center min-w-[36px] px-2 py-1 rounded-xl font-black ${
                                row.pendencias > 0
                                  ? "bg-red-100 text-red-700"
                                  : "bg-emerald-100 text-emerald-700"
                              }`}
                            >
                              {row.pendencias}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: INSTALAR */}
        {modalAcao === "INSTALAR" && (
          <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95">
              <div className="bg-indigo-600 px-6 py-4 flex items-center justify-between">
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  <FaPlus /> Instalar {tipoSelecionado}
                </h2>
                <button onClick={() => setModalAcao(null)} className="text-white/70 hover:text-white transition-colors">
                  <FaTimes size={20} />
                </button>
              </div>

              <form onSubmit={handleInstalar} className="p-6 space-y-4">
                <div>
                  <label className="text-xs font-black uppercase text-slate-500 mb-1.5 block">
                    Equipamento Disponível
                  </label>
                  <select
                    className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 bg-slate-50 focus:bg-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    value={formInstalar.embarcado_id}
                    onChange={(e) =>
                      setFormInstalar({ ...formInstalar, embarcado_id: e.target.value })
                    }
                  >
                    <option value="">Selecione para instalar...</option>
                    {disponiveisGlobais
                      .filter((d) => d.tipo === tipoSelecionado)
                      .map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.numero_equipamento} - Status: {d.status_atual}
                        </option>
                      ))}
                  </select>
                  {disponiveisGlobais.filter((d) => d.tipo === tipoSelecionado).length === 0 && (
                    <p className="text-xs font-bold text-red-500 mt-2">
                      Nenhum equipamento deste tipo no estoque.
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-xs font-black uppercase text-slate-500 mb-1.5 block">
                    Responsável (Lançamento)
                  </label>
                  <input
                    type="text"
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-500 bg-slate-100 cursor-not-allowed"
                    value={usuarioLogado}
                    disabled
                    title="Usuário logado no sistema"
                  />
                </div>

                <div>
                  <label className="text-xs font-black uppercase text-slate-500 mb-1.5 block">
                    Observação (Opcional)
                  </label>
                  <textarea
                    className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 bg-slate-50 focus:bg-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 min-h-[80px]"
                    value={formInstalar.observacao}
                    onChange={(e) =>
                      setFormInstalar({ ...formInstalar, observacao: e.target.value })
                    }
                    placeholder="Detalhes adicionais..."
                  />
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setModalAcao(null)}
                    className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-700 font-black hover:bg-slate-200 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving || !formInstalar.embarcado_id}
                    className="flex-1 py-3 rounded-xl bg-indigo-600 text-white font-black hover:bg-indigo-700 transition-colors disabled:opacity-50 flex justify-center items-center gap-2 shadow-md"
                  >
                    <FaSave /> {saving ? "Salvando..." : "Confirmar Instalação"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: MOVIMENTAR */}
        {modalAcao === "MOVIMENTAR" && deviceSelecionado && (
          <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95">
              <div className="bg-amber-500 px-6 py-4 flex items-center justify-between">
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  <FaExchangeAlt /> Movimentar {deviceSelecionado.numero_equipamento}
                </h2>
                <button onClick={() => setModalAcao(null)} className="text-white/70 hover:text-white transition-colors">
                  <FaTimes size={20} />
                </button>
              </div>

              <div className="px-6 pt-4">
                <div className="bg-slate-100 rounded-xl p-3 flex justify-between items-center border border-slate-200">
                  <span className="text-xs font-black uppercase text-slate-500">Origem atual:</span>
                  <span className="text-sm font-black text-slate-800">{veiculoSelecionado}</span>
                </div>
              </div>

              <form onSubmit={handleMovimentar} className="p-6 space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 md:col-span-1">
                    <label className="text-xs font-black uppercase text-slate-500 mb-1.5 block">
                      Destino (Tipo)
                    </label>
                    <select
                      className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 bg-slate-50 focus:bg-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                      value={formMovimentar.destino_tipo}
                      onChange={(e) =>
                        setFormMovimentar({
                          ...formMovimentar,
                          destino_tipo: e.target.value,
                          destino_valor: "",
                        })
                      }
                    >
                      {DESTINOS.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-2 md:col-span-1">
                    <label className="text-xs font-black uppercase text-slate-500 mb-1.5 block">
                      Valor do Destino
                    </label>
                    {formMovimentar.destino_tipo === "VEICULO" ? (
                      <select
                        className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 bg-slate-50 focus:bg-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        value={formMovimentar.destino_valor}
                        onChange={(e) =>
                          setFormMovimentar({ ...formMovimentar, destino_valor: e.target.value })
                        }
                      >
                        <option value="">Escolher carro...</option>
                        {prefixos
                          .filter((p) => p.codigo !== veiculoSelecionado)
                          .map((p) => (
                            <option key={p.codigo} value={p.codigo}>
                              {p.codigo}
                            </option>
                          ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 bg-slate-100 cursor-not-allowed"
                        value={formMovimentar.destino_tipo}
                        disabled
                      />
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-black uppercase text-slate-500 mb-1.5 block">
                    Responsável (Lançamento)
                  </label>
                  <input
                    type="text"
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-500 bg-slate-100 cursor-not-allowed"
                    value={usuarioLogado}
                    disabled
                    title="Usuário logado no sistema"
                  />
                </div>

                <div>
                  <label className="text-xs font-black uppercase text-slate-500 mb-1.5 block">
                    Motivo / Observação
                  </label>
                  <textarea
                    className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 bg-slate-50 focus:bg-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 min-h-[80px]"
                    value={formMovimentar.observacao}
                    onChange={(e) =>
                      setFormMovimentar({ ...formMovimentar, observacao: e.target.value })
                    }
                    placeholder="Motivo da retirada..."
                  />
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setModalAcao(null)}
                    className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-700 font-black hover:bg-slate-200 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 py-3 rounded-xl bg-amber-500 text-white font-black hover:bg-amber-600 transition-colors disabled:opacity-50 flex justify-center items-center gap-2 shadow-md"
                  >
                    <FaSave /> {saving ? "Processando..." : "Confirmar Movimentação"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: HISTÓRICO */}
        {modalAcao === "HISTORICO" && (
          <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl animate-in zoom-in-95">
              <div className="border-b border-slate-200 px-6 py-5 flex items-center justify-between bg-slate-50 rounded-t-3xl">
                <div>
                  <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                    <FaHistory className="text-indigo-600" /> Histórico do Veículo: {veiculoSelecionado}
                  </h2>
                  <p className="text-xs font-bold text-slate-500 mt-1 uppercase tracking-widest">
                    Últimas 50 movimentações
                  </p>
                </div>
                <button
                  onClick={() => setModalAcao(null)}
                  className="w-10 h-10 bg-white border border-slate-300 rounded-full flex items-center justify-center text-slate-500 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors shadow-sm"
                >
                  <FaTimes size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 bg-slate-50 space-y-4">
                {historicoVeiculo.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 font-black">
                    Nenhum histórico encontrado para este veículo.
                  </div>
                ) : (
                  historicoVeiculo.map((h) => {
                    const dataFormatada = new Date(h.data_movimentacao || h.created_at).toLocaleString("pt-BR");
                    const isEntrada = h.destino_valor === veiculoSelecionado;

                    return (
                      <div
                        key={h.id}
                        className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row gap-4 md:items-center relative overflow-hidden"
                      >
                        <div
                          className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                            isEntrada ? "bg-emerald-500" : "bg-amber-500"
                          }`}
                        ></div>

                        <div className="flex-1 ml-2">
                          <div className="flex items-center gap-2 mb-1">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                                isEntrada
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-amber-100 text-amber-800"
                              }`}
                            >
                              {h.tipo_movimentacao}
                            </span>
                            <span className="text-xs font-bold text-slate-400">{dataFormatada}</span>
                          </div>
                          <div className="text-base font-black text-slate-900 mt-2">
                            {h.embarcados?.numero_equipamento || "Equipamento Desconhecido"}{" "}
                            <span className="text-indigo-600 font-bold ml-1">• {h.embarcados?.tipo}</span>
                          </div>

                          <div className="grid grid-cols-2 gap-4 mt-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                            <div>
                              <div className="text-[10px] font-black uppercase text-slate-400">Origem</div>
                              <div className="text-xs font-bold text-slate-700 truncate">
                                {h.origem_tipo} - {h.origem_valor}
                              </div>
                            </div>
                            <div>
                              <div className="text-[10px] font-black uppercase text-slate-400">Destino</div>
                              <div className="text-xs font-bold text-slate-700 truncate">
                                {h.destino_tipo} - {h.destino_valor}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="md:w-1/3 md:pl-4 md:border-l border-slate-100 ml-2 md:ml-0 flex flex-col justify-center">
                          <div className="text-[10px] font-black uppercase text-slate-400 mb-1">Responsável</div>
                          <div className="text-sm font-bold text-slate-800 mb-3">
                            {h.responsavel || "Não informado"}
                          </div>

                          <div className="text-[10px] font-black uppercase text-slate-400 mb-1">Observação</div>
                          <div
                            className="text-xs font-semibold text-slate-600 line-clamp-2"
                            title={h.observacao || "Sem observação"}
                          >
                            {h.observacao || "-"}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

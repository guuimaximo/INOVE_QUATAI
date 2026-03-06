import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import {
  FaCar,
  FaCheckCircle,
  FaExclamationTriangle,
  FaExchangeAlt,
  FaHistory,
  FaPlus,
  FaSave,
  FaSearch,
  FaSync,
  FaTimes,
  FaTimesCircle,
  FaTools,
} from "react-icons/fa";

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

  // Dados globais
  const [prefixos, setPrefixos] = useState([]);
  const [disponiveisGlobais, setDisponiveisGlobais] = useState([]);
  const [usuarioLogado, setUsuarioLogado] = useState("SISTEMA"); // Estado para o responsável automático

  // Seleção de Veículo
  const [buscaVeiculo, setBuscaVeiculo] = useState("");
  const [veiculoSelecionado, setVeiculoSelecionado] = useState("");

  // Dados do veículo selecionado
  const [embarcadosVeiculo, setEmbarcadosVeiculo] = useState([]);
  const [reparosAtivos, setReparosAtivos] = useState([]);
  const [historicoVeiculo, setHistoricoVeiculo] = useState([]);

  // Controle de Modais
  const [modalAcao, setModalAcao] = useState(null); // 'INSTALAR', 'MOVIMENTAR', 'HISTORICO'
  const [tipoSelecionado, setTipoSelecionado] = useState(""); // Usado para instalar
  const [deviceSelecionado, setDeviceSelecionado] = useState(null); // Usado para movimentar

  // Formulários (responsavel removido daqui, pois será automático)
  const [formInstalar, setFormInstalar] = useState({ embarcado_id: "", observacao: "" });
  const [formMovimentar, setFormMovimentar] = useState({
    destino_tipo: "ESTOQUE",
    destino_valor: "",
    observacao: "",
  });

  async function carregarIniciais() {
    setLoading(true);

    // Busca o usuário logado para o campo "Responsável"
    const { data: authData } = await supabase.auth.getSession();
    const email = authData?.session?.user?.email;
    if (email) {
      setUsuarioLogado(email.split("@")[0].toUpperCase());
    }

    const [resPrefixos, resDisponiveis] = await Promise.all([
      supabase.from("prefixos").select("codigo, cluster").order("codigo"),
      supabase
        .from("embarcados")
        .select("id, tipo, numero_equipamento, status_atual")
        .eq("ativo", true)
        .in("status_atual", ["DISPONIVEL", "RESERVA", "RETORNADO"])
        .order("numero_equipamento"),
    ]);

    if (resPrefixos.data) setPrefixos(resPrefixos.data);
    if (resDisponiveis.data) setDisponiveisGlobais(resDisponiveis.data);
    setLoading(false);
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
      // 1. Embarcados atualmente neste veículo
      supabase
        .from("embarcados")
        .select("*")
        .eq("ativo", true)
        .eq("localizacao_tipo", "VEICULO")
        .eq("localizacao_valor", veiculo),
      // 2. Reparos ativos deste veículo
      supabase
        .from("embarcados_solicitacoes_reparo")
        .select("id, veiculo, tipo_embarcado, status")
        .eq("veiculo", veiculo)
        .in("status", ["ABERTA", "EM_ANALISE", "EM_EXECUCAO", "AG_PECAS"]),
      // 3. Histórico de movimentação envolvendo o veículo
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
  }, []);

  useEffect(() => {
    carregarDadosVeiculo(veiculoSelecionado);
  }, [veiculoSelecionado]);

  // Função para executar a Instalação (Entrada no Veículo)
  async function handleInstalar(e) {
    e.preventDefault();
    if (!formInstalar.embarcado_id) return alert("Selecione um equipamento disponível.");

    try {
      setSaving(true);
      const embarcado = disponiveisGlobais.find((d) => d.id === formInstalar.embarcado_id);

      // 1. Inserir Movimentação usando usuarioLogado
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

      // 2. Encerrar instalação anterior se houver
      await supabase
        .from("embarcados_instalacoes")
        .update({
          ativo: false,
          data_retirada: new Date().toISOString(),
          retirado_por: usuarioLogado,
        })
        .eq("embarcado_id", embarcado.id)
        .eq("ativo", true);

      // 3. Criar nova instalação
      await supabase.from("embarcados_instalacoes").insert([
        {
          embarcado_id: embarcado.id,
          veiculo: veiculoSelecionado,
          instalado_por: usuarioLogado,
          observacao: formInstalar.observacao || null,
          ativo: true,
        },
      ]);

      // 4. Atualizar o cadastro do embarcado
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
    } catch (err) {
      console.error(err);
      alert("Erro ao instalar equipamento.");
    } finally {
      setSaving(false);
    }
  }

  // Função para executar a Retirada/Movimentação (Saída do Veículo ou Troca)
  async function handleMovimentar(e) {
    e.preventDefault();
    if (!formMovimentar.destino_tipo) return alert("Selecione um destino.");

    const destValor = formMovimentar.destino_tipo === "VEICULO" ? formMovimentar.destino_valor : formMovimentar.destino_tipo;
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
          alert(`Operação cancelada: O veículo ${formMovimentar.destino_valor} já tem um equipamento do tipo ${deviceSelecionado.tipo} instalado.`);
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

      // 1. Inserir Movimentação usando usuarioLogado
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

      // 2. Encerrar instalação atual
      await supabase
        .from("embarcados_instalacoes")
        .update({
          ativo: false,
          data_retirada: new Date().toISOString(),
          retirado_por: usuarioLogado,
        })
        .eq("embarcado_id", deviceSelecionado.id)
        .eq("ativo", true);

      // 3. Se for transferência para outro carro, criar nova instalação lá
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

      // 4. Atualizar o cadastro do embarcado
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
    } catch (err) {
      console.error(err);
      alert("Erro ao movimentar equipamento.");
    } finally {
      setSaving(false);
    }
  }

  // Filtro inteligente de veículos para o Dropdown
  const prefixosFiltrados = useMemo(() => {
    const txt = buscaVeiculo.toLowerCase().trim();
    if (!txt) return prefixos;
    return prefixos.filter(
      (p) => p.codigo.toLowerCase().includes(txt) || (p.cluster && p.cluster.toLowerCase().includes(txt))
    );
  }, [prefixos, buscaVeiculo]);

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6 font-sans text-slate-900">
      <div className="mx-auto max-w-[1700px] space-y-4">
        
        {/* HEADER PRINCIPAL */}
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
                Selecione um carro para ver, instalar ou remover componentes embarcados.
              </p>
            </div>

            <button
              onClick={() => { carregarIniciais(); carregarDadosVeiculo(veiculoSelecionado); }}
              className="h-[44px] px-4 rounded-2xl bg-white border border-slate-300 text-slate-800 font-black text-sm hover:bg-slate-50 flex items-center justify-center gap-2 transition-colors"
            >
              <FaSync className="text-indigo-600" />
              Atualizar Dados
            </button>
          </div>
        </div>

        {/* CONTROLE DE SELEÇÃO E HISTÓRICO */}
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
                  setVeiculoSelecionado(""); // Limpa seleção se digitar de novo
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

        {/* DASHBOARD DO VEÍCULO (CARDS) */}
        {veiculoSelecionado && (
          <div className="space-y-4 animate-in slide-in-from-bottom-4">
            
            {/* RESUMO EM LINHA ÚNICA DOS EQUIPAMENTOS INSTALADOS */}
            <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-3 flex flex-wrap items-center justify-center gap-4 text-xs font-black text-indigo-800 uppercase tracking-widest shadow-sm">
              <span className="text-slate-500 mr-2">Resumo Instalados:</span>
              {TIPOS_EMBARCADOS.map(tipo => {
                const qtd = embarcadosVeiculo.filter(e => e.tipo === tipo).length;
                return (
                  <span key={tipo} className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-md border border-indigo-100 shadow-sm">
                    {tipo}: <span className={qtd > 0 ? "text-emerald-600" : "text-indigo-300"}>{qtd}</span>
                  </span>
                );
              })}
            </div>

            <h2 className="text-xl font-black text-slate-800 flex items-center gap-2 px-2 mt-4">
              <FaTools className="text-slate-400" /> Status do Veículo: <span className="text-indigo-600">{veiculoSelecionado}</span>
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
                    // CARD VAZIO (NÃO TEM)
                    return (
                      <div key={tipo} className="bg-red-50 border-2 border-dashed border-red-200 rounded-3xl p-6 flex flex-col items-center justify-center text-center transition-all hover:bg-red-100/50">
                        <div className="w-14 h-14 rounded-full bg-red-100 text-red-400 flex items-center justify-center mb-4">
                          <FaTimesCircle size={28} />
                        </div>
                        <h3 className="text-lg font-black text-red-900 mb-1">{tipo}</h3>
                        <p className="text-xs font-bold text-red-500 uppercase tracking-widest mb-5">Não Instalado</p>
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

                  // CARD PREENCHIDO
                  if (temReparo) {
                    // COM REPARO ATIVO (AMARELO)
                    return (
                      <div key={tipo} className="bg-amber-50 border border-amber-300 rounded-3xl p-6 relative overflow-hidden shadow-sm transition-all hover:shadow-md">
                        <div className="absolute top-0 right-0 bg-amber-400 text-amber-900 text-[10px] font-black px-4 py-1.5 rounded-bl-xl uppercase tracking-widest flex items-center gap-1.5 shadow-sm">
                          <FaExclamationTriangle /> Reparo Solicitado
                        </div>
                        <div className="mb-4">
                          <h3 className="text-sm font-black text-amber-900/50 uppercase tracking-widest">{tipo}</h3>
                          <div className="text-2xl font-black text-amber-900 mt-1">{embarcado.numero_equipamento}</div>
                        </div>
                        <div className="text-xs font-bold text-amber-700 bg-amber-100/50 rounded-lg p-3 border border-amber-200/50 mb-5">
                          Atenção: Existe uma OS aberta para este equipamento. Verifique antes de movimentar.
                        </div>
                        <button
                          onClick={() => {
                            setDeviceSelecionado(embarcado);
                            setFormMovimentar({ destino_tipo: "ESTOQUE", destino_valor: "", observacao: "" });
                            setModalAcao("MOVIMENTAR");
                          }}
                          className="w-full px-5 py-3 rounded-xl bg-white border border-amber-300 text-amber-800 font-black text-sm shadow-sm hover:bg-amber-100 flex items-center justify-center gap-2 transition-colors"
                        >
                          <FaExchangeAlt /> Retirar / Movimentar
                        </button>
                      </div>
                    );
                  }

                  // TUDO OK (VERDE)
                  return (
                    <div key={tipo} className="bg-emerald-50 border border-emerald-200 rounded-3xl p-6 relative overflow-hidden shadow-sm transition-all hover:shadow-md">
                      <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[10px] font-black px-4 py-1.5 rounded-bl-xl uppercase tracking-widest flex items-center gap-1.5 shadow-sm">
                        <FaCheckCircle /> Operacional
                      </div>
                      <div className="mb-4 mt-2">
                        <h3 className="text-sm font-black text-emerald-800/50 uppercase tracking-widest">{tipo}</h3>
                        <div className="text-2xl font-black text-emerald-900 mt-1">{embarcado.numero_equipamento}</div>
                      </div>
                      <div className="text-xs font-bold text-emerald-700 bg-emerald-100/50 rounded-lg p-3 border border-emerald-200/50 mb-5 opacity-80">
                        Nenhuma falha relatada. Operando normalmente.
                      </div>
                      <button
                        onClick={() => {
                          setDeviceSelecionado(embarcado);
                          setFormMovimentar({ destino_tipo: "ESTOQUE", destino_valor: "", observacao: "" });
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

        {/* ================= MODALS ================= */}

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
                  <label className="text-xs font-black uppercase text-slate-500 mb-1.5 block">Equipamento Disponível</label>
                  <select
                    className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 bg-slate-50 focus:bg-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    value={formInstalar.embarcado_id}
                    onChange={(e) => setFormInstalar({ ...formInstalar, embarcado_id: e.target.value })}
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
                    <p className="text-xs font-bold text-red-500 mt-2">Nenhum equipamento deste tipo no estoque.</p>
                  )}
                </div>

                <div>
                  <label className="text-xs font-black uppercase text-slate-500 mb-1.5 block">Responsável (Lançamento)</label>
                  <input
                    type="text"
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-500 bg-slate-100 cursor-not-allowed"
                    value={usuarioLogado}
                    disabled
                    title="Usuário logado no sistema"
                  />
                </div>

                <div>
                  <label className="text-xs font-black uppercase text-slate-500 mb-1.5 block">Observação (Opcional)</label>
                  <textarea
                    className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 bg-slate-50 focus:bg-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 min-h-[80px]"
                    value={formInstalar.observacao}
                    onChange={(e) => setFormInstalar({ ...formInstalar, observacao: e.target.value })}
                    placeholder="Detalhes adicionais..."
                  />
                </div>

                <div className="pt-4 flex gap-3">
                  <button type="button" onClick={() => setModalAcao(null)} className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-700 font-black hover:bg-slate-200 transition-colors">
                    Cancelar
                  </button>
                  <button type="submit" disabled={saving || !formInstalar.embarcado_id} className="flex-1 py-3 rounded-xl bg-indigo-600 text-white font-black hover:bg-indigo-700 transition-colors disabled:opacity-50 flex justify-center items-center gap-2 shadow-md">
                    <FaSave /> {saving ? "Salvando..." : "Confirmar Instalação"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: MOVIMENTAR / RETIRAR */}
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
                    <label className="text-xs font-black uppercase text-slate-500 mb-1.5 block">Destino (Tipo)</label>
                    <select
                      className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 bg-slate-50 focus:bg-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                      value={formMovimentar.destino_tipo}
                      onChange={(e) => setFormMovimentar({ ...formMovimentar, destino_tipo: e.target.value, destino_valor: "" })}
                    >
                      {DESTINOS.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-2 md:col-span-1">
                    <label className="text-xs font-black uppercase text-slate-500 mb-1.5 block">Valor do Destino</label>
                    {formMovimentar.destino_tipo === "VEICULO" ? (
                      <select
                        className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 bg-slate-50 focus:bg-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        value={formMovimentar.destino_valor}
                        onChange={(e) => setFormMovimentar({ ...formMovimentar, destino_valor: e.target.value })}
                      >
                        <option value="">Escolher carro...</option>
                        {prefixos.filter(p => p.codigo !== veiculoSelecionado).map((p) => (
                          <option key={p.codigo} value={p.codigo}>{p.codigo}</option>
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
                  <label className="text-xs font-black uppercase text-slate-500 mb-1.5 block">Responsável (Lançamento)</label>
                  <input
                    type="text"
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-500 bg-slate-100 cursor-not-allowed"
                    value={usuarioLogado}
                    disabled
                    title="Usuário logado no sistema"
                  />
                </div>

                <div>
                  <label className="text-xs font-black uppercase text-slate-500 mb-1.5 block">Motivo / Observação</label>
                  <textarea
                    className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 bg-slate-50 focus:bg-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 min-h-[80px]"
                    value={formMovimentar.observacao}
                    onChange={(e) => setFormMovimentar({ ...formMovimentar, observacao: e.target.value })}
                    placeholder="Motivo da retirada..."
                  />
                </div>

                <div className="pt-4 flex gap-3">
                  <button type="button" onClick={() => setModalAcao(null)} className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-700 font-black hover:bg-slate-200 transition-colors">
                    Cancelar
                  </button>
                  <button type="submit" disabled={saving} className="flex-1 py-3 rounded-xl bg-amber-500 text-white font-black hover:bg-amber-600 transition-colors disabled:opacity-50 flex justify-center items-center gap-2 shadow-md">
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
                  <p className="text-xs font-bold text-slate-500 mt-1 uppercase tracking-widest">Últimas 50 movimentações</p>
                </div>
                <button onClick={() => setModalAcao(null)} className="w-10 h-10 bg-white border border-slate-300 rounded-full flex items-center justify-center text-slate-500 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors shadow-sm">
                  <FaTimes size={18} />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 bg-slate-50 space-y-4">
                {historicoVeiculo.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 font-black">Nenhum histórico encontrado para este veículo.</div>
                ) : (
                  historicoVeiculo.map((h) => {
                    const dataFormatada = new Date(h.data_movimentacao || h.created_at).toLocaleString("pt-BR");
                    const isEntrada = h.destino_valor === veiculoSelecionado;
                    
                    return (
                      <div key={h.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row gap-4 md:items-center relative overflow-hidden">
                        {/* Linha colorida indicadora (Entrada verde, Saída vermelha/laranja) */}
                        <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${isEntrada ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
                        
                        <div className="flex-1 ml-2">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${isEntrada ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                              {h.tipo_movimentacao}
                            </span>
                            <span className="text-xs font-bold text-slate-400">{dataFormatada}</span>
                          </div>
                          <div className="text-base font-black text-slate-900 mt-2">
                            {h.embarcados?.numero_equipamento || "Equipamento Desconhecido"} <span className="text-indigo-600 font-bold ml-1">• {h.embarcados?.tipo}</span>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4 mt-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                            <div>
                              <div className="text-[10px] font-black uppercase text-slate-400">Origem</div>
                              <div className="text-xs font-bold text-slate-700 truncate">{h.origem_tipo} - {h.origem_valor}</div>
                            </div>
                            <div>
                              <div className="text-[10px] font-black uppercase text-slate-400">Destino</div>
                              <div className="text-xs font-bold text-slate-700 truncate">{h.destino_tipo} - {h.destino_valor}</div>
                            </div>
                          </div>
                        </div>

                        <div className="md:w-1/3 md:pl-4 md:border-l border-slate-100 ml-2 md:ml-0 flex flex-col justify-center">
                          <div className="text-[10px] font-black uppercase text-slate-400 mb-1">Responsável</div>
                          <div className="text-sm font-bold text-slate-800 mb-3">{h.responsavel || "Não informado"}</div>
                          
                          <div className="text-[10px] font-black uppercase text-slate-400 mb-1">Observação</div>
                          <div className="text-xs font-semibold text-slate-600 line-clamp-2" title={h.observacao || "Sem observação"}>
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

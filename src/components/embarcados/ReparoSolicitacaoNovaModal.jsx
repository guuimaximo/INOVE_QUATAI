import { useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../../supabase";
import { AuthContext } from "../../context/AuthContext";
import {
  FaTimes,
  FaSave,
  FaPlus,
  FaBus,
  FaMicrochip,
  FaMapMarkerAlt,
  FaAlignLeft,
  FaExclamationTriangle,
  FaImage,
  FaSearch,
  FaTrash,
} from "react-icons/fa";

const PRIORIDADES = ["BAIXA", "MEDIA", "ALTA", "CRITICA"];
const TIPOS = [
  "TELEMETRIA",
  "CAMERAS",
  "VISION",
  "VALIDADOR",
  "CHIP_VALIDADOR",
  "GPS",
];

const BUCKET_EVIDENCIAS = "embarcados";

function isValidUUID(v) {
  if (!v) return false;
  const s = String(v).trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

function buildNomeSobrenome(u) {
  const nome = String(u?.nome || "").trim();
  const sobrenome = String(u?.sobrenome || "").trim();
  const nomeCompleto = String(u?.nome_completo || "").trim();

  if (nomeCompleto) return nomeCompleto;
  if (nome && sobrenome) return `${nome} ${sobrenome}`;
  if (nome) return nome;
  return null;
}

function prioridadeLabel(p) {
  switch (p) {
    case "MEDIA":
      return "MÉDIA";
    case "CRITICA":
      return "CRÍTICA";
    default:
      return p || "-";
  }
}

function sanitizeFileName(name) {
  return String(name || "arquivo")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w.\-]+/g, "_");
}

function safeText(v) {
  const s = String(v ?? "").trim();
  return s || null;
}

// use somente se no futuro você confirmar que a coluna é UUID
function pickUserUuid(user) {
  if (isValidUUID(user?.auth_user_id)) return user.auth_user_id;
  if (isValidUUID(user?.id)) return user.id;
  return null;
}

export default function ReparoSolicitacaoNovaModal({
  open,
  onClose,
  onSuccess,
}) {
  const { user } = useContext(AuthContext);

  const [salvando, setSalvando] = useState(false);
  const [carregandoPrefixos, setCarregandoPrefixos] = useState(false);

  const [nomeUsuario, setNomeUsuario] = useState("");
  const [loginUsuario, setLoginUsuario] = useState("");
  const [usuarioUuid, setUsuarioUuid] = useState(null);

  const [prefixos, setPrefixos] = useState([]);
  const [buscaVeiculo, setBuscaVeiculo] = useState("");
  const [veiculoSelecionado, setVeiculoSelecionado] = useState("");

  const [arquivoEvidencia, setArquivoEvidencia] = useState(null);
  const [previewEvidencia, setPreviewEvidencia] = useState("");

  const [form, setForm] = useState({
    tipo_embarcado: "TELEMETRIA",
    problema: "",
    descricao: "",
    local_problema: "",
    prioridade: "MEDIA",
  });

  useEffect(() => {
    if (!open) return;

    async function carregarUsuarioSessao() {
      try {
        const loginSessao = safeText(user?.login || user?.email);
        const uuidSessao = pickUserUuid(user);

        let nomeSessao =
          buildNomeSobrenome(user) ||
          safeText(user?.nome) ||
          safeText(user?.nome_completo) ||
          null;

        if (!nomeSessao && loginSessao) {
          const { data: u } = await supabase
            .from("usuarios_aprovadores")
            .select("nome, sobrenome, nome_completo")
            .eq("login", loginSessao)
            .maybeSingle();

          if (u) {
            nomeSessao =
              safeText(u?.nome_completo) ||
              safeText([u?.nome, u?.sobrenome].filter(Boolean).join(" ")) ||
              safeText(u?.nome);
          }
        }

        setNomeUsuario(nomeSessao || loginSessao || "");
        setLoginUsuario(loginSessao || "");
        setUsuarioUuid(uuidSessao || null);
      } catch {
        setNomeUsuario(safeText(user?.login || user?.email) || "");
        setLoginUsuario(safeText(user?.login || user?.email) || "");
        setUsuarioUuid(pickUserUuid(user));
      }
    }

    carregarUsuarioSessao();
  }, [open, user]);

  useEffect(() => {
    if (!open) return;

    setForm({
      tipo_embarcado: "TELEMETRIA",
      problema: "",
      descricao: "",
      local_problema: "",
      prioridade: "MEDIA",
    });
    setBuscaVeiculo("");
    setVeiculoSelecionado("");
    setArquivoEvidencia(null);
    setPreviewEvidencia("");
  }, [open]);

  useEffect(() => {
    if (!open) return;

    async function carregarPrefixos() {
      try {
        setCarregandoPrefixos(true);

        const { data, error } = await supabase
          .from("prefixos")
          .select("codigo, cluster")
          .order("codigo");

        if (error) {
          console.error(error);
          alert("Erro ao carregar veículos.");
          return;
        }

        setPrefixos(data || []);
      } finally {
        setCarregandoPrefixos(false);
      }
    }

    carregarPrefixos();
  }, [open]);

  useEffect(() => {
    return () => {
      if (previewEvidencia) {
        URL.revokeObjectURL(previewEvidencia);
      }
    };
  }, [previewEvidencia]);

  const prefixosFiltrados = useMemo(() => {
    const txt = buscaVeiculo.toLowerCase().trim();
    if (!txt) return prefixos;

    return prefixos.filter(
      (p) =>
        String(p.codigo || "").toLowerCase().includes(txt) ||
        String(p.cluster || "").toLowerCase().includes(txt)
    );
  }, [prefixos, buscaVeiculo]);

  async function gerarHistorico(solicitacaoId, fotoUrl) {
    const payload = {
      solicitacao_id: solicitacaoId,
      status_evento: "ABERTA",
      acao_executada: "ABERTURA DA SOLICITAÇÃO",
      diagnostico: "Solicitação criada no sistema.",
      observacao: `Solicitação aberta por ${safeText(nomeUsuario || loginUsuario) || "Usuário"}.`,
      executado_por: null,
      foto_url: fotoUrl || null,
      criado_por_login: safeText(loginUsuario),
      criado_por_nome: safeText(nomeUsuario || loginUsuario),
      // REMOVIDO criado_por_id para não quebrar se a coluna não for UUID
      // criado_por_id: usuarioUuid || null,
    };

    const { error } = await supabase
      .from("embarcados_solicitacoes_reparo_eventos")
      .insert([payload]);

    if (error) throw error;
  }

  async function uploadEvidencia() {
    if (!arquivoEvidencia) return null;

    const ext = arquivoEvidencia.name.split(".").pop()?.toLowerCase() || "jpg";
    const nomeBase = sanitizeFileName(arquivoEvidencia.name.replace(/\.[^/.]+$/, ""));
    const arquivoNome = `${Date.now()}_${nomeBase}.${ext}`;
    const pasta = veiculoSelecionado || "sem_veiculo";
    const path = `solicitacoes_reparo/${pasta}/${arquivoNome}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_EVIDENCIAS)
      .upload(path, arquivoEvidencia, {
        cacheControl: "3600",
        upsert: false,
        contentType: arquivoEvidencia.type || undefined,
      });

    if (uploadError) throw uploadError;

    const { data: publicData } = supabase.storage
      .from(BUCKET_EVIDENCIAS)
      .getPublicUrl(path);

    return publicData?.publicUrl || null;
  }

  function handleArquivoChange(e) {
    const file = e.target.files?.[0] || null;

    if (!file) return;

    const tiposPermitidos = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
      "application/pdf",
    ];

    if (!tiposPermitidos.includes(file.type)) {
      alert("Selecione uma imagem (JPG, PNG, WEBP) ou PDF.");
      e.target.value = "";
      return;
    }

    if (previewEvidencia) {
      URL.revokeObjectURL(previewEvidencia);
    }

    setArquivoEvidencia(file);

    if (file.type === "application/pdf") {
      setPreviewEvidencia("");
    } else {
      setPreviewEvidencia(URL.createObjectURL(file));
    }
  }

  function removerEvidencia() {
    if (previewEvidencia) {
      URL.revokeObjectURL(previewEvidencia);
    }
    setPreviewEvidencia("");
    setArquivoEvidencia(null);
  }

  async function salvar() {
    if (!veiculoSelecionado) {
      alert("Selecione o veículo.");
      return;
    }

    if (!form.problema.trim()) {
      alert("Informe o problema.");
      return;
    }

    if (!arquivoEvidencia) {
      alert("Anexe uma evidência.");
      return;
    }

    try {
      setSalvando(true);

      const fotoUrl = await uploadEvidencia();

      const payload = {
        veiculo: safeText(veiculoSelecionado),
        tipo_embarcado: safeText(form.tipo_embarcado),
        problema: safeText(form.problema),
        descricao: safeText(form.descricao),
        local_problema: safeText(form.local_problema),
        prioridade: safeText(form.prioridade),
        status: "ABERTA",
        foto_url: fotoUrl || null,

        // CAMPOS DE TEXTO
        solicitante: safeText(nomeUsuario || loginUsuario),
        criado_por_login: safeText(loginUsuario),
        criado_por_nome: safeText(nomeUsuario || loginUsuario),

        // REMOVIDO PARA NÃO QUEBRAR COM COLUNA INTEGER/UUID INCERTA
        // criado_por_id: usuarioUuid || null,
      };

      const { data, error } = await supabase
        .from("embarcados_solicitacoes_reparo")
        .insert([payload])
        .select("id")
        .single();

      if (error) {
        console.error(error);
        alert(error.message || "Erro ao abrir solicitação.");
        return;
      }

      await gerarHistorico(data.id, fotoUrl);

      alert("Solicitação de reparo aberta com sucesso.");
      onSuccess?.();
      onClose?.();
    } catch (e) {
      console.error(e);
      alert(e?.message || "Erro ao registrar solicitação.");
    } finally {
      setSalvando(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-4">
      <div className="w-full max-w-5xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-200 bg-slate-50">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                Nova solicitação
              </div>
              <h2 className="text-2xl font-black tracking-tight text-slate-900 mt-1">
                Abrir Solicitação de Reparo
              </h2>
              <p className="text-sm text-slate-500 font-semibold mt-1">
                Preencha os dados do embarcado e registre o problema encontrado.
              </p>
            </div>

            <button
              onClick={onClose}
              className="w-11 h-11 rounded-2xl border border-slate-300 bg-white hover:bg-slate-100 flex items-center justify-center text-slate-700"
            >
              <FaTimes />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4 max-h-[82vh] overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="xl:col-span-1 relative">
              <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">
                Veículo *
              </label>

              <div className="flex items-center gap-2 border border-slate-300 rounded-2xl px-3 py-3 bg-white">
                <FaBus className="text-slate-400" />
                <input
                  className="w-full outline-none text-sm font-bold"
                  placeholder={carregandoPrefixos ? "Carregando..." : "Buscar veículo"}
                  value={veiculoSelecionado || buscaVeiculo}
                  onChange={(e) => {
                    setVeiculoSelecionado("");
                    setBuscaVeiculo(e.target.value);
                  }}
                />
                <FaSearch className="text-slate-400" />
              </div>

              {!veiculoSelecionado && buscaVeiculo.trim() && prefixosFiltrados.length > 0 && (
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
                      <span className="text-xs text-slate-400 font-semibold">
                        {p.cluster || "S/N"}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {!veiculoSelecionado && buscaVeiculo.trim() && prefixosFiltrados.length === 0 && (
                <div className="absolute z-20 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-xl px-4 py-3 text-sm font-bold text-slate-500">
                  Nenhum veículo encontrado.
                </div>
              )}
            </div>

            <div className="xl:col-span-1">
              <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">
                Tipo do embarcado
              </label>
              <div className="flex items-center gap-2 border border-slate-300 rounded-2xl px-3 py-3 bg-white">
                <FaMicrochip className="text-slate-400" />
                <select
                  className="w-full outline-none text-sm font-bold bg-transparent"
                  value={form.tipo_embarcado}
                  onChange={(e) => setForm({ ...form, tipo_embarcado: e.target.value })}
                >
                  {TIPOS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="xl:col-span-1">
              <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">
                Local do problema
              </label>
              <div className="flex items-center gap-2 border border-slate-300 rounded-2xl px-3 py-3 bg-white">
                <FaMapMarkerAlt className="text-slate-400" />
                <input
                  className="w-full outline-none text-sm font-bold"
                  placeholder="Ex.: Painel / Validador"
                  value={form.local_problema}
                  onChange={(e) => setForm({ ...form, local_problema: e.target.value })}
                />
              </div>
            </div>

            <div className="xl:col-span-1">
              <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">
                Prioridade
              </label>
              <div className="flex items-center gap-2 border border-slate-300 rounded-2xl px-3 py-3 bg-white">
                <FaExclamationTriangle className="text-slate-400" />
                <select
                  className="w-full outline-none text-sm font-bold bg-transparent"
                  value={form.prioridade}
                  onChange={(e) => setForm({ ...form, prioridade: e.target.value })}
                >
                  {PRIORIDADES.map((p) => (
                    <option key={p} value={p}>
                      {prioridadeLabel(p)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4">
            <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">
              Problema *
            </label>
            <input
              className="w-full border border-slate-300 rounded-2xl px-4 py-3 text-base font-bold text-slate-900"
              placeholder="Ex.: Validador sem comunicação"
              value={form.problema}
              onChange={(e) => setForm({ ...form, problema: e.target.value })}
            />
          </div>

          <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4">
            <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">
              Descrição
            </label>
            <div className="flex items-start gap-2 border border-slate-300 rounded-2xl px-3 py-3 bg-white">
              <FaAlignLeft className="text-slate-400 mt-1" />
              <textarea
                className="w-full outline-none text-sm font-semibold min-h-[140px] resize-none"
                placeholder="Descreva o problema com mais detalhes..."
                value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
              />
            </div>
          </div>

          <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-3">
            <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">
              Evidência *
            </label>

            <div className="flex flex-col md:flex-row gap-3 md:items-center">
              <label className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-sm font-black cursor-pointer">
                <FaImage />
                Selecionar arquivo
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp,application/pdf"
                  className="hidden"
                  onChange={handleArquivoChange}
                />
              </label>

              {arquivoEvidencia && (
                <div className="text-sm font-bold text-slate-700 break-all">
                  {arquivoEvidencia.name}
                </div>
              )}

              {arquivoEvidencia && (
                <button
                  type="button"
                  onClick={removerEvidencia}
                  className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-red-50 border border-red-200 hover:bg-red-100 text-red-700 text-sm font-black"
                >
                  <FaTrash />
                  Remover
                </button>
              )}
            </div>

            {previewEvidencia ? (
              <div className="rounded-2xl overflow-hidden border border-slate-200 bg-white">
                <img
                  src={previewEvidencia}
                  alt="Pré-visualização da evidência"
                  className="w-full max-h-[320px] object-contain bg-slate-50"
                />
              </div>
            ) : arquivoEvidencia?.type === "application/pdf" ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
                <div className="text-sm font-black text-slate-800">PDF selecionado</div>
                <div className="text-xs font-semibold text-slate-500 mt-1">
                  O arquivo será enviado como evidência.
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white p-8 text-center">
                <div className="text-sm font-black text-slate-500">
                  Anexe uma imagem ou PDF da evidência
                </div>
              </div>
            )}
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
            <div className="text-[10px] font-black uppercase text-blue-700">
              Solicitante
            </div>
            <div className="mt-1 text-sm font-black text-blue-900">
              {nomeUsuario || loginUsuario || "Usuário não identificado"}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 bg-white flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-3 rounded-2xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-sm font-black"
          >
            Cancelar
          </button>

          <button
            onClick={salvar}
            disabled={salvando}
            className="px-4 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-black flex items-center gap-2 disabled:opacity-60"
          >
            {salvando ? <FaSave /> : <FaPlus />}
            {salvando ? "Salvando..." : "Abrir solicitação"}
          </button>
        </div>
      </div>
    </div>
  );
}

import { useContext, useEffect, useState } from "react";
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

function isValidUUID(v) {
  if (!v) return false;
  const s = String(v).trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

function pickUserUuid(user) {
  if (isValidUUID(user?.auth_user_id)) return user.auth_user_id;
  if (isValidUUID(user?.id)) return user.id;
  return null;
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

export default function ReparoSolicitacaoNovaModal({
  open,
  onClose,
  onSuccess,
}) {
  const { user } = useContext(AuthContext);

  const [salvando, setSalvando] = useState(false);
  const [nomeUsuario, setNomeUsuario] = useState("");
  const [loginUsuario, setLoginUsuario] = useState("");
  const [usuarioId, setUsuarioId] = useState(null);

  const [form, setForm] = useState({
    veiculo: "",
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
        const loginSessao = user?.login || user?.email || null;
        const idSessao = pickUserUuid(user);

        let nomeSessao =
          buildNomeSobrenome(user) ||
          (user?.nome ? String(user.nome).trim() : null) ||
          (user?.nome_completo ? String(user.nome_completo).trim() : null) ||
          null;

        if (!nomeSessao && loginSessao) {
          const { data: u } = await supabase
            .from("usuarios_aprovadores")
            .select("nome, sobrenome, nome_completo")
            .eq("login", loginSessao)
            .maybeSingle();

          if (u) {
            nomeSessao =
              u?.nome_completo ||
              [u?.nome, u?.sobrenome].filter(Boolean).join(" ") ||
              u?.nome ||
              null;
          }
        }

        setNomeUsuario(nomeSessao || loginSessao || "");
        setLoginUsuario(loginSessao || "");
        setUsuarioId(idSessao || null);
      } catch {
        setNomeUsuario(user?.login || user?.email || "");
        setLoginUsuario(user?.login || user?.email || "");
        setUsuarioId(pickUserUuid(user));
      }
    }

    carregarUsuarioSessao();
  }, [open, user]);

  useEffect(() => {
    if (!open) return;

    setForm({
      veiculo: "",
      tipo_embarcado: "TELEMETRIA",
      problema: "",
      descricao: "",
      local_problema: "",
      prioridade: "MEDIA",
    });
  }, [open]);

  async function gerarHistorico(solicitacaoId) {
    const payload = {
      solicitacao_id: solicitacaoId,
      status_evento: "ABERTA",
      acao_executada: "ABERTURA DA SOLICITAÇÃO",
      diagnostico: "Solicitação criada no sistema.",
      observacao: `Solicitação aberta por ${nomeUsuario || loginUsuario}.`,
      executado_por: null,
      foto_url: null,
      criado_por_login: loginUsuario || null,
      criado_por_nome: nomeUsuario || loginUsuario || null,
      criado_por_id: usuarioId || null,
    };

    const { error } = await supabase
      .from("embarcados_solicitacoes_reparo_eventos")
      .insert([payload]);

    if (error) throw error;
  }

  async function salvar() {
    if (!form.veiculo.trim()) {
      alert("Informe o veículo.");
      return;
    }

    if (!form.problema.trim()) {
      alert("Informe o problema.");
      return;
    }

    try {
      setSalvando(true);

      const payload = {
        veiculo: form.veiculo.trim(),
        tipo_embarcado: form.tipo_embarcado,
        problema: form.problema.trim(),
        descricao: form.descricao.trim() || null,
        local_problema: form.local_problema.trim() || null,
        prioridade: form.prioridade,
        status: "ABERTA",
        solicitante: nomeUsuario || loginUsuario || null,
        criado_por_login: loginUsuario || null,
        criado_por_nome: nomeUsuario || loginUsuario || null,
        criado_por_id: usuarioId || null,
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

      await gerarHistorico(data.id);

      alert("Solicitação de reparo aberta com sucesso.");
      onSuccess?.();
      onClose?.();
    } catch (e) {
      console.error(e);
      alert(e?.message || "Erro ao registrar histórico da solicitação.");
    } finally {
      setSalvando(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
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
            <div className="xl:col-span-1">
              <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">
                Veículo *
              </label>
              <div className="flex items-center gap-2 border border-slate-300 rounded-2xl px-3 py-3 bg-white">
                <FaBus className="text-slate-400" />
                <input
                  className="w-full outline-none text-sm font-bold"
                  placeholder="Ex.: 24015"
                  value={form.veiculo}
                  onChange={(e) => setForm({ ...form, veiculo: e.target.value })}
                />
              </div>
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
                  placeholder="Ex.: Painel / Validador traseiro"
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

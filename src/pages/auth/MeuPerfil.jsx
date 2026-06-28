import { useEffect, useMemo, useRef, useState } from "react";
import {
  Loader2,
  Save,
  User,
  Briefcase,
  IdCard,
  Mail,
  Lock,
  Camera,
  Search,
  Check,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import { supabase } from "../../supabase";
import { useAuth } from "../../context/AuthContext";
import { isValidEmail, isPlaceholderEmail } from "../../utils/authBridge";
import { buscarCargoFuncionarioAtivo } from "../../utils/funcionariosBCNT";

const SETORES = [
  "Manutencao",
  "Recursos humanos",
  "Departamento Pessoal",
  "SESMT",
  "Operacao",
  "Ouvidoria",
  "Financeiro",
];

const AZUL = "#0057b8";

function iniciais(nome) {
  const parts = String(nome || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function MeuPerfil() {
  const { user, refreshUser } = useAuth();

  const [nome, setNome] = useState("");
  const [apelido, setApelido] = useState("");
  const [email, setEmail] = useState("");
  const [setor, setSetor] = useState("");
  const [registro, setRegistro] = useState("");
  const [funcao, setFuncao] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");

  const [chapaTravada, setChapaTravada] = useState(false);
  const [buscandoChapa, setBuscandoChapa] = useState(false);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const fileRef = useRef(null);

  const emailOriginal = String(user?.email || "").trim().toLowerCase();
  const emailPendente = !isValidEmail(emailOriginal) || isPlaceholderEmail(emailOriginal);

  useEffect(() => {
    if (!user) return;
    setNome(user.nome || "");
    setApelido(user.login || "");
    setEmail(isValidEmail(user.email) && !isPlaceholderEmail(user.email) ? user.email : "");
    setSetor(user.setor || "");

    let ativo = true;
    (async () => {
      const { data } = await supabase
        .from("usuarios_aprovadores")
        .select("registro, funcao, avatar_url")
        .eq("auth_user_id", user.auth_user_id || user.id)
        .maybeSingle();
      if (!ativo || !data) return;
      setRegistro(data.registro || "");
      setFuncao(data.funcao || "");
      setAvatarUrl(data.avatar_url || "");
      if (data.registro) setChapaTravada(true);
    })();
    return () => {
      ativo = false;
    };
  }, [user]);

  async function buscarChapa() {
    const chapa = registro.trim();
    if (!chapa) {
      setChapaTravada(false);
      return;
    }
    setBuscandoChapa(true);
    setFeedback(null);
    try {
      const f = await buscarCargoFuncionarioAtivo(chapa);
      if (f && (f.nome || f.cargo)) {
        if (f.nome) setNome(f.nome);
        if (f.cargo) setFuncao(f.cargo);
        setChapaTravada(true);
      } else {
        setChapaTravada(false);
        setFeedback({ type: "warn", text: "Chapa nao encontrada no TransNet. Preencha nome e funcao manualmente." });
      }
    } catch {
      setChapaTravada(false);
      setFeedback({ type: "warn", text: "Nao foi possivel consultar a chapa agora. Preencha manualmente." });
    } finally {
      setBuscandoChapa(false);
    }
  }

  async function enviarFoto(file) {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setFeedback({ type: "error", text: "A imagem deve ter no maximo 2 MB." });
      return;
    }
    setEnviandoFoto(true);
    setFeedback(null);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const uid = user?.auth_user_id || user?.id;
      const path = `${uid}/avatar_${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatares").upload(path, file, {
        upsert: true,
        cacheControl: "3600",
      });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("avatares").getPublicUrl(path);
      setAvatarUrl(pub.publicUrl);
      setFeedback({ type: "success", text: "Foto carregada. Clique em Salvar para confirmar." });
    } catch (e) {
      setFeedback({ type: "error", text: "Falha ao enviar a foto: " + (e?.message || "tente novamente") });
    } finally {
      setEnviandoFoto(false);
    }
  }

  async function salvar(event) {
    event.preventDefault();
    setFeedback(null);

    if (!nome.trim() || !apelido.trim() || !setor.trim()) {
      setFeedback({ type: "error", text: "Preencha nome, apelido e setor." });
      return;
    }
    if (email && !isValidEmail(email)) {
      setFeedback({ type: "error", text: "Informe um e-mail valido." });
      return;
    }
    if (novaSenha || confirmarSenha) {
      if (novaSenha.length < 6) {
        setFeedback({ type: "error", text: "A nova senha precisa ter ao menos 6 caracteres." });
        return;
      }
      if (novaSenha !== confirmarSenha) {
        setFeedback({ type: "error", text: "As senhas nao conferem." });
        return;
      }
    }

    setSalvando(true);
    try {
      // 1) salva dados (com checagem de apelido duplicado no banco)
      const { data: res, error: rpcErr } = await supabase.rpc("save_meu_perfil", {
        p_nome: nome.trim(),
        p_apelido: apelido.trim(),
        p_setor: setor.trim(),
        p_registro: registro.trim(),
        p_funcao: funcao.trim(),
        p_avatar_url: avatarUrl.trim(),
      });
      if (rpcErr) throw rpcErr;
      if (res && res.ok === false) {
        setFeedback({ type: "error", text: res.erro || "Nao foi possivel salvar." });
        setSalvando(false);
        return;
      }

      // 2) e-mail (dispara confirmacao por e-mail)
      let avisoEmail = "";
      const emailLimpo = email.trim().toLowerCase();
      if (emailLimpo && emailLimpo !== emailOriginal) {
        const { error: mailErr } = await supabase.auth.updateUser({ email: emailLimpo });
        if (mailErr) {
          setFeedback({ type: "error", text: "Dados salvos, mas falhou o e-mail: " + mailErr.message });
          setSalvando(false);
          return;
        }
        avisoEmail = " Enviamos um link de confirmacao para o novo e-mail — confirme para concluir.";
      }

      // 3) senha
      let avisoSenha = "";
      if (novaSenha) {
        const { error: pwErr } = await supabase.auth.updateUser({ password: novaSenha });
        if (pwErr) {
          setFeedback({ type: "error", text: "Dados salvos, mas falhou a senha: " + pwErr.message });
          setSalvando(false);
          return;
        }
        setNovaSenha("");
        setConfirmarSenha("");
        avisoSenha = " Senha atualizada.";
      }

      await refreshUser();
      setFeedback({ type: "success", text: "Perfil salvo com sucesso." + avisoEmail + avisoSenha });
    } catch (e) {
      setFeedback({ type: "error", text: e?.message || "Erro ao salvar o perfil." });
    } finally {
      setSalvando(false);
    }
  }

  const fbStyle = useMemo(() => {
    if (!feedback) return "";
    if (feedback.type === "success") return "bg-green-50 border-green-200 text-green-700";
    if (feedback.type === "warn") return "bg-amber-50 border-amber-200 text-amber-800";
    return "bg-red-50 border-red-200 text-red-700";
  }, [feedback]);

  const card = "bg-white rounded-2xl border border-slate-200 shadow-sm";
  const label = "text-xs font-medium text-slate-500 mb-1";
  const inputBase =
    "w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-800 outline-none transition-all focus:border-[#0057b8] focus:ring-4 focus:ring-[#0057b8]/10";
  const inputLocked =
    "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-500";

  return (
    <div className="min-h-full bg-slate-100 p-4 lg:p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Meu Perfil</h1>
            <p className="text-sm text-slate-500">
              Mantenha seus dados atualizados — o e-mail real garante o reset de senha.
            </p>
          </div>
          <button
            type="submit"
            form="form-meu-perfil"
            disabled={salvando}
            className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all active:scale-[0.98] disabled:opacity-70"
            style={{ backgroundColor: AZUL }}
          >
            {salvando ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
            Salvar alteracoes
          </button>
        </div>

        {feedback && (
          <div className={`mb-4 rounded-xl border px-4 py-3 text-sm ${fbStyle}`}>{feedback.text}</div>
        )}

        {emailPendente && (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            <span>
              Seu e-mail ainda nao esta confirmado. Cadastre um <b>e-mail real</b> abaixo para conseguir
              recuperar a senha por conta propria.
            </span>
          </div>
        )}

        <form id="form-meu-perfil" onSubmit={salvar} className="grid gap-4 lg:grid-cols-[280px_1fr]">
          {/* AVATAR */}
          <div className={`${card} p-6 text-center`}>
            <div className="relative mx-auto h-28 w-28">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Foto de perfil"
                  className="h-28 w-28 rounded-full object-cover ring-2 ring-white shadow"
                />
              ) : (
                <div
                  className="flex h-28 w-28 items-center justify-center rounded-full text-3xl font-bold text-white shadow"
                  style={{ background: `linear-gradient(135deg, ${AZUL}, #2563eb)` }}
                >
                  {iniciais(nome)}
                </div>
              )}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={enviandoFoto}
                className="absolute bottom-0 right-0 flex h-9 w-9 items-center justify-center rounded-full border-[3px] border-white text-white shadow"
                style={{ backgroundColor: AZUL }}
                title="Trocar foto"
              >
                {enviandoFoto ? <Loader2 className="animate-spin" size={15} /> : <Camera size={15} />}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg"
                className="hidden"
                onChange={(e) => enviarFoto(e.target.files?.[0])}
              />
            </div>
            <div className="mt-4 text-base font-bold text-slate-900">{nome || "Seu nome"}</div>
            <div className="text-sm text-slate-500">{funcao || "Funcao"}</div>
            {setor && (
              <div
                className="mt-2 inline-block rounded-full px-3 py-1 text-xs font-semibold"
                style={{ backgroundColor: "#e6f0fb", color: AZUL }}
              >
                Setor: {setor}
              </div>
            )}
            <div className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-400">
              JPG ou PNG, ate 2 MB
            </div>
          </div>

          {/* DADOS + ACESSO */}
          <div className="flex flex-col gap-4">
            <div className={`${card} p-5`}>
              <div className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide" style={{ color: AZUL }}>
                <IdCard size={16} /> Dados do funcionario
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <div className={label}>Registro (chapa)</div>
                  <div className="relative">
                    <input
                      value={registro}
                      onChange={(e) => setRegistro(e.target.value)}
                      onBlur={buscarChapa}
                      placeholder="Digite a chapa"
                      className={inputBase + " pr-9"}
                    />
                    <button
                      type="button"
                      onClick={buscarChapa}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#0057b8]"
                      title="Buscar"
                    >
                      {buscandoChapa ? <Loader2 className="animate-spin" size={16} /> : <Search size={16} />}
                    </button>
                  </div>
                </div>
                <div>
                  <div className={label}>
                    Funcao {chapaTravada && <span className="text-slate-400">(automatico)</span>}
                  </div>
                  <input
                    value={funcao}
                    onChange={(e) => setFuncao(e.target.value)}
                    readOnly={chapaTravada}
                    placeholder="Funcao"
                    className={chapaTravada ? inputLocked : inputBase}
                  />
                </div>
                <div className="sm:col-span-2">
                  <div className={label}>
                    Nome completo {chapaTravada && <span className="text-slate-400">(automatico pela chapa)</span>}
                  </div>
                  <input
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    readOnly={chapaTravada}
                    placeholder="Nome completo"
                    className={chapaTravada ? inputLocked : inputBase}
                  />
                </div>
                <div>
                  <div className={label}>Apelido</div>
                  <input
                    value={apelido}
                    onChange={(e) => setApelido(e.target.value)}
                    placeholder="Apelido"
                    className={inputBase}
                  />
                </div>
                <div>
                  <div className={label}>Setor</div>
                  <select value={setor} onChange={(e) => setSetor(e.target.value)} className={inputBase}>
                    <option value="">Selecione</option>
                    {SETORES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className={`${card} p-5`}>
              <div className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide" style={{ color: AZUL }}>
                <ShieldCheck size={16} /> Acesso e seguranca
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <div className={label}>
                    E-mail real <span className="text-red-600">(para reset de senha)</span>
                  </div>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seu@email.com"
                      className={inputBase + " pl-9"}
                    />
                  </div>
                </div>
                <div>
                  <div className={label}>Nova senha</div>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="password"
                      value={novaSenha}
                      onChange={(e) => setNovaSenha(e.target.value)}
                      placeholder="Deixe em branco p/ manter"
                      autoComplete="new-password"
                      className={inputBase + " pl-9"}
                    />
                  </div>
                </div>
                <div>
                  <div className={label}>Confirmar senha</div>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="password"
                      value={confirmarSenha}
                      onChange={(e) => setConfirmarSenha(e.target.value)}
                      placeholder="Repita a nova senha"
                      autoComplete="new-password"
                      className={inputBase + " pl-9"}
                    />
                  </div>
                </div>
              </div>
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                O apelido nao pode repetir — se ja existir, o sistema avisa ao salvar.
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

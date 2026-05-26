import { useContext, useEffect, useMemo, useState } from "react";
import { FaClipboardList, FaFileUpload, FaSave, FaSyncAlt } from "react-icons/fa";
import { supabase } from "../../supabase";
import CampoMotorista from "../../components/CampoMotorista";
import CampoPrefixo from "../../components/CampoPrefixo";
import { AuthContext } from "../../context/AuthContext";
import {
  SAC_ACOES,
  SAC_MOTIVOS,
  SAC_ORIGENS,
  nowHHMM,
  pickUserAudit,
  pickUserUuid,
  todayISO,
  uploadSacFiles,
} from "./SacCommon";

const initialForm = () => ({
  data_atendimento: todayISO(),
  hora_atendimento: nowHHMM(),
  origem: "WhatsApp",
  cliente_nome: "",
  cliente_telefone: "",
  carro_prefixo: "",
  linha: "",
  operador_chapa: "",
  operador_nome: "",
  grupo_motivo: "Reclamacao",
  subgrupo_motivo: "Intervalo de atendimento",
  data_ocorrencia: todayISO(),
  hora_ocorrencia: nowHHMM(),
  detalhamento: "",
  acao_tomada: "Registrado e esclarecido com passageiro",
  abrir_tratativa: false,
});

function Field({ label, children, className = "" }) {
  return (
    <div className={className}>
      <label className="mb-1 block text-sm font-semibold text-slate-600">{label}</label>
      {children}
    </div>
  );
}

export default function SacLancamento() {
  const { user } = useContext(AuthContext);
  const [form, setForm] = useState(initialForm);
  const [operador, setOperador] = useState({ chapa: "", nome: "" });
  const [linhas, setLinhas] = useState([]);
  const [files, setFiles] = useState([]);
  const [saving, setSaving] = useState(false);

  const atendenteNome = useMemo(() => pickUserAudit(user).atendente_nome || "Usuario logado", [user]);
  const subgrupos = SAC_MOTIVOS[form.grupo_motivo] || [];

  useEffect(() => {
    supabase
      .from("linhas")
      .select("id, codigo, descricao")
      .order("codigo")
      .then(({ data }) => setLinhas(data || []));
  }, []);

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      operador_chapa: operador.chapa || "",
      operador_nome: operador.nome || "",
    }));
  }, [operador]);

  useEffect(() => {
    const abrirTratativa = form.acao_tomada === "Abrir tratativa";
    setForm((prev) => (prev.abrir_tratativa === abrirTratativa ? prev : { ...prev, abrir_tratativa: abrirTratativa }));
  }, [form.acao_tomada]);

  function usarAgora() {
    setForm((prev) => ({
      ...prev,
      data_atendimento: todayISO(),
      hora_atendimento: nowHHMM(),
      data_ocorrencia: todayISO(),
      hora_ocorrencia: nowHHMM(),
    }));
  }

  function buildDescricaoTratativa(protocolo = "SAC") {
    const operadorTexto = [form.operador_chapa, form.operador_nome].filter(Boolean).join(" - ") || "Nao informado";
    return [
      `Origem SAC: ${protocolo}`,
      `Cliente: ${form.cliente_nome || "Nao informado"} | Telefone: ${form.cliente_telefone || "Nao informado"}`,
      `Veiculo: ${form.carro_prefixo || "Nao informado"} | Linha: ${form.linha || "Nao informada"}`,
      `Operador: ${operadorTexto}`,
      `Motivo: ${form.grupo_motivo} / ${form.subgrupo_motivo || "Sem subgrupo"}`,
      "",
      form.detalhamento,
    ].join("\n");
  }

  async function salvar() {
    if (!form.origem || !form.grupo_motivo || !form.detalhamento) {
      alert("Preencha origem, motivo e detalhamento.");
      return;
    }

    setSaving(true);
    try {
      const folder = `${form.data_atendimento}_${form.cliente_telefone || "sem-cliente"}_${Date.now()}`;
      const evidencias_urls = await uploadSacFiles(files, folder);
      const status = form.abrir_tratativa ? "Em tratativa" : "Registrado";
      let tratativaId = null;

      if (form.abrir_tratativa) {
        const { data: tratativa, error: erroTratativa } = await supabase
          .from("tratativas")
          .insert({
            motorista_chapa: form.operador_chapa || null,
            motorista_nome: form.operador_nome || null,
            tipo_ocorrencia: `SAC - ${form.grupo_motivo}`,
            prioridade: form.grupo_motivo === "Denuncia" ? "Alta" : "Media",
            setor_origem: "SAC",
            linha: form.linha || null,
            descricao: buildDescricaoTratativa("novo protocolo"),
            status: "Pendente",
            imagem_url: evidencias_urls[0] || null,
            evidencias_urls,
            data_ocorrido: form.data_ocorrencia || null,
            hora_ocorrido: form.hora_ocorrencia || null,
            criado_por_login: user?.login || user?.email || null,
            criado_por_nome: atendenteNome,
            criado_por_id: pickUserUuid(user),
          })
          .select("id")
          .single();
        if (erroTratativa) throw erroTratativa;
        tratativaId = tratativa?.id || null;
      }

      const { data, error } = await supabase
        .from("sac_atendimentos")
        .insert({
          ...form,
          status,
          tratativa_id: tratativaId,
          evidencias_urls,
          ...pickUserAudit(user),
        })
        .select("id, protocolo")
        .single();
      if (error) throw error;

      alert(`SAC ${data?.protocolo || ""} registrado com sucesso.`);
      setForm(initialForm());
      setOperador({ chapa: "", nome: "" });
      setFiles([]);
    } catch (error) {
      console.error(error);
      alert(`Erro ao salvar SAC: ${error?.message || error}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen space-y-5 bg-slate-50 p-4 text-slate-800 md:p-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="text-xs font-black uppercase tracking-[0.24em] text-blue-600">SAC</div>
        <h1 className="mt-3 flex items-center gap-3 text-3xl font-black text-slate-900">
          <span className="rounded-2xl bg-blue-50 p-3 text-blue-600"><FaClipboardList /></span>
          Lançamento de atendimento
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Registre o atendimento, vincule operador, linha, veiculo e, se necessario, abra a tratativa automaticamente.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black text-slate-900">Atendimento</h2>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-4">
              <Field label="Atendente" className="md:col-span-2">
                <input value={atendenteNome} disabled className="w-full rounded-2xl border border-slate-200 bg-slate-100 px-3 py-3 text-sm font-bold text-slate-600" />
              </Field>
              <Field label="Data">
                <input type="date" value={form.data_atendimento} onChange={(e) => setForm({ ...form, data_atendimento: e.target.value })} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold outline-none focus:border-blue-400" />
              </Field>
              <Field label="Hora">
                <input type="time" value={form.hora_atendimento} onChange={(e) => setForm({ ...form, hora_atendimento: e.target.value })} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold outline-none focus:border-blue-400" />
              </Field>
              <Field label="Origem" className="md:col-span-2">
                <select value={form.origem} onChange={(e) => setForm({ ...form, origem: e.target.value })} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold outline-none focus:border-blue-400">
                  {SAC_ORIGENS.map((origem) => <option key={origem} value={origem}>{origem}</option>)}
                </select>
              </Field>
              <div className="flex items-end md:col-span-2">
                <button type="button" onClick={usarAgora} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-200">
                  <FaSyncAlt /> Usar data e hora atuais
                </button>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black text-slate-900">Cliente e operação</h2>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-4">
              <Field label="Cliente" className="md:col-span-2">
                <input value={form.cliente_nome} onChange={(e) => setForm({ ...form, cliente_nome: e.target.value })} placeholder="Nome do cliente" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold outline-none focus:border-blue-400" />
              </Field>
              <Field label="Telefone" className="md:col-span-2">
                <input value={form.cliente_telefone} onChange={(e) => setForm({ ...form, cliente_telefone: e.target.value })} placeholder="Telefone para reincidencia" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold outline-none focus:border-blue-400" />
              </Field>
              <Field label="Veiculo" className="md:col-span-2">
                <CampoPrefixo value={form.carro_prefixo} onChange={(value) => setForm({ ...form, carro_prefixo: value })} label="" />
              </Field>
              <Field label="Linha" className="md:col-span-2">
                <select value={form.linha} onChange={(e) => setForm({ ...form, linha: e.target.value })} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold outline-none focus:border-blue-400">
                  <option value="">Selecione</option>
                  {linhas.map((linha) => <option key={linha.id} value={linha.codigo}>{linha.codigo} - {linha.descricao}</option>)}
                </select>
              </Field>
              <Field label="Operador" className="md:col-span-4">
                <CampoMotorista value={operador} onChange={setOperador} label="" />
              </Field>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black text-slate-900">Ocorrencia</h2>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-4">
              <Field label="Grupo de motivo" className="md:col-span-2">
                <select value={form.grupo_motivo} onChange={(e) => setForm({ ...form, grupo_motivo: e.target.value, subgrupo_motivo: SAC_MOTIVOS[e.target.value]?.[0] || "" })} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold outline-none focus:border-blue-400">
                  {Object.keys(SAC_MOTIVOS).map((motivo) => <option key={motivo} value={motivo}>{motivo}</option>)}
                </select>
              </Field>
              <Field label="Subgrupo" className="md:col-span-2">
                <select value={form.subgrupo_motivo} onChange={(e) => setForm({ ...form, subgrupo_motivo: e.target.value })} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold outline-none focus:border-blue-400">
                  {subgrupos.map((subgrupo) => <option key={subgrupo} value={subgrupo}>{subgrupo}</option>)}
                </select>
              </Field>
              <Field label="Data da ocorrencia">
                <input type="date" value={form.data_ocorrencia} onChange={(e) => setForm({ ...form, data_ocorrencia: e.target.value })} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold outline-none focus:border-blue-400" />
              </Field>
              <Field label="Hora da ocorrencia">
                <input type="time" value={form.hora_ocorrencia} onChange={(e) => setForm({ ...form, hora_ocorrencia: e.target.value })} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold outline-none focus:border-blue-400" />
              </Field>
              <Field label="Acao tomada" className="md:col-span-2">
                <select value={form.acao_tomada} onChange={(e) => setForm({ ...form, acao_tomada: e.target.value })} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold outline-none focus:border-blue-400">
                  {SAC_ACOES.map((acao) => <option key={acao} value={acao}>{acao}</option>)}
                </select>
              </Field>
              <Field label="Detalhamento" className="md:col-span-4">
                <textarea rows={6} value={form.detalhamento} onChange={(e) => setForm({ ...form, detalhamento: e.target.value })} placeholder="Descreva o atendimento, a reclamacao, informacao ou denuncia." className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold outline-none focus:border-blue-400" />
              </Field>
              <Field label="Prints e evidencias" className="md:col-span-4">
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center hover:border-blue-300 hover:bg-blue-50/40">
                  <FaFileUpload className="mb-2 text-2xl text-slate-400" />
                  <span className="text-sm font-black text-slate-700">Inserir prints, fotos, videos ou PDF</span>
                  <span className="mt-1 text-xs text-slate-500">{files.length ? `${files.length} arquivo(s) selecionado(s)` : "Anexe as evidencias do atendimento"}</span>
                  <input type="file" multiple accept="image/*,video/*,application/pdf" className="hidden" onChange={(e) => setFiles(Array.from(e.target.files || []))} />
                </label>
              </Field>
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black text-slate-900">Fluxo automatico</h2>
            <div className="mt-4 space-y-3 text-sm font-semibold text-slate-600">
              <div className="rounded-2xl bg-slate-50 p-4">
                Protocolo gerado ao salvar: <b>SAC-ANO-NUMERO</b>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                Status inicial: <b>{form.abrir_tratativa ? "Em tratativa" : "Registrado"}</b>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                Tratativa: <b>{form.abrir_tratativa ? "sera criada automaticamente" : "nao sera criada"}</b>
              </div>
            </div>
            <button type="button" disabled={saving} onClick={salvar} className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white shadow-sm hover:bg-blue-700 disabled:bg-slate-400">
              <FaSave /> {saving ? "Salvando..." : "Salvar SAC"}
            </button>
          </section>
        </aside>
      </div>
    </div>
  );
}

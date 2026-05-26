import { useContext, useEffect, useMemo, useState } from "react";
import { FaCamera, FaClipboard, FaCopy, FaSave, FaSyncAlt } from "react-icons/fa";
import { supabase } from "../../supabase";
import CampoMotorista from "../../components/CampoMotorista";
import CampoPrefixo from "../../components/CampoPrefixo";
import { InovePageHeader } from "../../components/InovePage";
import { AuthContext } from "../../context/AuthContext";
import {
  buildMensagemWhatsApp,
  copyToClipboard,
  pickUserAudit,
  SITUACOES_OPERACIONAIS,
  todayISO,
  nowHHMM,
  uploadAcidenteFiles,
} from "./AcidentesCommon";

const initialForm = () => ({
  data_ocorrencia: todayISO(),
  hora_ocorrencia: nowHHMM(),
  local: "",
  linha: "",
  prefixo: "",
  motorista_chapa: "",
  motorista_nome: "",
  tipo_acidente: "Colisão com terceiro",
  veiculo_terceiro: "",
  placa_terceiro: "",
  condutor_terceiro: "",
  telefone_terceiro: "",
  descricao: "",
  situacao_operacional: "Seguiu viagem",
  precisa_imagens: true,
  dano_coletivo: false,
  dano_terceiro: true,
  registros_observacao: "Segue fotos mandadas pelo Operador",
});

function Field({ label, children, className = "" }) {
  return (
    <div className={className}>
      <label className="mb-1 block text-sm font-semibold text-slate-600">{label}</label>
      {children}
    </div>
  );
}

export default function AcidentesLancamento() {
  const { user } = useContext(AuthContext);
  const [form, setForm] = useState(initialForm);
  const [motorista, setMotorista] = useState({ chapa: "", nome: "" });
  const [linhas, setLinhas] = useState([]);
  const [files, setFiles] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from("linhas")
      .select("id, codigo, descricao")
      .order("codigo")
      .then(({ data, error }) => {
        if (error) {
          console.warn("Erro ao carregar linhas:", error);
          setLinhas([]);
          return;
        }
        setLinhas(data || []);
      });
  }, []);

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      motorista_chapa: motorista.chapa || "",
      motorista_nome: motorista.nome || "",
    }));
  }, [motorista]);

  const mensagemWhatsApp = useMemo(() => buildMensagemWhatsApp(form), [form]);

  function setAgora() {
    setForm((prev) => ({ ...prev, data_ocorrencia: todayISO(), hora_ocorrencia: nowHHMM() }));
  }

  async function copiarMensagem() {
    await copyToClipboard(mensagemWhatsApp);
    alert("Mensagem copiada para o WhatsApp.");
  }

  async function salvarOcorrencia() {
    if (!form.local || !form.prefixo || !form.descricao) {
      alert("Preencha local, prefixo e descrição.");
      return;
    }

    setSaving(true);
    try {
      const status = form.precisa_imagens ? "Aguardando imagens" : "Em aberto";
      const folder = `${form.data_ocorrencia}_${form.prefixo || "sem-prefixo"}_${Date.now()}`;
      const evidencias_urls = await uploadAcidenteFiles(files, folder);

      const payload = {
        ...form,
        status,
        mensagem_whatsapp: mensagemWhatsApp,
        evidencias_urls,
        ...pickUserAudit(user),
      };

      const { data, error } = await supabase
        .from("acidentes_ocorrencias")
        .insert(payload)
        .select("id, numero_ocorrencia")
        .single();
      if (error) throw error;

      alert(`Ocorrência ${data?.numero_ocorrencia || ""} registrada com sucesso.`);
      setForm(initialForm());
      setMotorista({ chapa: "", nome: "" });
      setFiles([]);
    } catch (error) {
      console.error(error);
      alert(`Erro ao salvar acidente: ${error?.message || error}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen space-y-5 bg-slate-50 p-4 text-slate-800 md:p-6">
      <InovePageHeader
        eyebrow="Acidentes"
        title="Lan�amento de Acidente"
        icon={<FaClipboard />}
        description="Abra a ocorr�ncia, copie a mensagem para WhatsApp e deixe o status seguir automaticamente no fluxo."
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_420px]">
        <div className="space-y-5">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black text-slate-900">Dados automáticos da ocorrência</h2>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-4">
              <Field label="Data">
                <input type="date" value={form.data_ocorrencia} onChange={(e) => setForm({ ...form, data_ocorrencia: e.target.value })} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold outline-none focus:border-blue-400" />
              </Field>
              <Field label="Hora">
                <input type="time" value={form.hora_ocorrencia} onChange={(e) => setForm({ ...form, hora_ocorrencia: e.target.value })} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold outline-none focus:border-blue-400" />
              </Field>
              <Field label="Linha">
                <select value={form.linha} onChange={(e) => setForm({ ...form, linha: e.target.value })} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold outline-none focus:border-blue-400">
                  <option value="">Selecione</option>
                  {linhas.map((linha) => (
                    <option key={linha.id} value={linha.codigo}>{linha.codigo} - {linha.descricao}</option>
                  ))}
                </select>
              </Field>
              <div className="flex items-end">
                <button type="button" onClick={setAgora} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-200">
                  <FaSyncAlt /> Usar agora
                </button>
              </div>
              <Field label="Carro / Prefixo" className="md:col-span-2">
                <CampoPrefixo
                  value={form.prefixo}
                  onChange={(value) => setForm({ ...form, prefixo: value })}
                  label=""
                  placeholder="Digite o carro ou prefixo..."
                />
              </Field>
              <Field label="Motorista" className="md:col-span-2">
                <CampoMotorista value={motorista} onChange={setMotorista} label="" />
              </Field>
              <Field label="Local" className="md:col-span-4">
                <input value={form.local} onChange={(e) => setForm({ ...form, local: e.target.value })} placeholder="Ex: Av. Itaquaquecetuba" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold outline-none focus:border-blue-400" />
              </Field>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black text-slate-900">Terceiro e descrição</h2>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-4">
              <Field label="Tipo" className="md:col-span-2">
                <input value={form.tipo_acidente} onChange={(e) => setForm({ ...form, tipo_acidente: e.target.value })} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold outline-none focus:border-blue-400" />
              </Field>
              <Field label="Veículo terceiro" className="md:col-span-2">
                <input value={form.veiculo_terceiro} onChange={(e) => setForm({ ...form, veiculo_terceiro: e.target.value })} placeholder="Sandero Branco" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold outline-none focus:border-blue-400" />
              </Field>
              <Field label="Placa">
                <input value={form.placa_terceiro} onChange={(e) => setForm({ ...form, placa_terceiro: e.target.value.toUpperCase() })} placeholder="SEC3111" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold uppercase outline-none focus:border-blue-400" />
              </Field>
              <Field label="Condutor">
                <input value={form.condutor_terceiro} onChange={(e) => setForm({ ...form, condutor_terceiro: e.target.value })} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold outline-none focus:border-blue-400" />
              </Field>
              <Field label="Telefone terceiro" className="md:col-span-2">
                <input value={form.telefone_terceiro} onChange={(e) => setForm({ ...form, telefone_terceiro: e.target.value })} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold outline-none focus:border-blue-400" />
              </Field>
              <Field label="Descrição" className="md:col-span-4">
                <textarea rows={5} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold outline-none focus:border-blue-400" />
              </Field>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black text-slate-900">Situação e registros</h2>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
              {SITUACOES_OPERACIONAIS.map((situacao) => (
                <button
                  key={situacao}
                  type="button"
                  onClick={() => setForm({ ...form, situacao_operacional: situacao })}
                  className={`rounded-2xl border px-4 py-3 text-sm font-black transition ${form.situacao_operacional === situacao ? "border-blue-300 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
                >
                  {situacao}
                </button>
              ))}
              <label className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
                <input type="checkbox" checked={form.precisa_imagens} onChange={(e) => setForm({ ...form, precisa_imagens: e.target.checked })} />
                Precisa análise de imagens
              </label>
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">
                <input type="checkbox" checked={form.dano_coletivo} onChange={(e) => setForm({ ...form, dano_coletivo: e.target.checked })} />
                Dano no coletivo
              </label>
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">
                <input type="checkbox" checked={form.dano_terceiro} onChange={(e) => setForm({ ...form, dano_terceiro: e.target.checked })} />
                Dano no terceiro
              </label>
              <Field label="Observação dos registros" className="md:col-span-3">
                <input value={form.registros_observacao} onChange={(e) => setForm({ ...form, registros_observacao: e.target.value })} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold outline-none focus:border-blue-400" />
              </Field>
              <Field label="Fotos e anexos iniciais" className="md:col-span-3">
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center hover:border-blue-300 hover:bg-blue-50/40">
                  <FaCamera className="mb-2 text-2xl text-slate-400" />
                  <span className="text-sm font-black text-slate-700">Inserir fotos, vídeos ou PDF</span>
                  <span className="mt-1 text-xs text-slate-500">{files.length ? `${files.length} arquivo(s) selecionado(s)` : "No celular, o seletor pode abrir a câmera."}</span>
                  <input type="file" multiple accept="image/*,video/*,application/pdf" className="hidden" onChange={(e) => setFiles(Array.from(e.target.files || []))} />
                </label>
              </Field>
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black text-slate-900">Mensagem WhatsApp</h2>
            <pre className="mt-4 max-h-[560px] overflow-auto whitespace-pre-wrap rounded-2xl border border-slate-200 bg-slate-950 p-4 text-xs font-semibold leading-relaxed text-white">
              {mensagemWhatsApp}
            </pre>
            <div className="mt-4 grid grid-cols-1 gap-3">
              <button type="button" onClick={copiarMensagem} className="flex items-center justify-center gap-2 rounded-2xl bg-slate-800 px-4 py-3 text-sm font-black text-white hover:bg-slate-700">
                <FaCopy /> Copiar mensagem WhatsApp
              </button>
              <button type="button" disabled={saving} onClick={salvarOcorrencia} className="flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white shadow-sm hover:bg-blue-700 disabled:bg-slate-400">
                <FaSave /> {saving ? "Salvando..." : "Salvar ocorrência"}
              </button>
            </div>
            <p className="mt-3 text-xs font-semibold text-slate-500">
              Status automático: {form.precisa_imagens ? "Aguardando imagens" : "Em aberto"}.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}




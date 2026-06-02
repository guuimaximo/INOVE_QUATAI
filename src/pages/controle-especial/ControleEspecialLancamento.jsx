import { useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabase";
import { AuthContext } from "../../context/AuthContext";
import {
  FaBusAlt,
  FaPlus,
  FaTrash,
  FaSave,
  FaCalendarAlt,
  FaArrowLeft,
  FaWhatsapp,
  FaCopy,
} from "react-icons/fa";
import { buildMensagemWhatsAppEspecial, copyToClipboard } from "./EspecialCommon";
import { syncEspecialToGoogle } from "../../utils/googleCalendar";

// E-mails sempre incluídos por padrão
const EMAILS_PADRAO = [
  "eulerdfilho@gmail.com",
  "trafego4itaqua@grupocsc.com.br",
  "trafego5itaqua@grupocsc.com.br",
  "monitoramento3itaqua@grupocsc.com.br",
  "larissaandrade@grupocsc.com.br",
  "guilhermemaximo@grupocsc.com.br",
];
// O e-mail principal (sempre travado, não pode ser removido)
const EMAIL_TRAVADO = "guilhermemaximo@grupocsc.com.br";

function novaParada() {
  return { local: "", endereco: "" };
}

export default function ControleEspecialLancamento() {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [salvando, setSalvando] = useState(false);

  const [form, setForm] = useState({
    data: "",
    ida_hora_saida: "07:00",
    ida_local_saida: "",
    ida_end_saida: "",
    ida_paradas: [novaParada()],
    ida_destino_local: "",
    ida_end_destino: "",

    volta_hora_saida: "15:00",
    volta_local_saida: "",
    volta_end_saida: "",
    volta_paradas: [novaParada()],
    volta_destino_local: "",
    volta_end_destino: "",

    qtd_onibus: 2,
    observacoes: "",
  });

  // Lista de e-mails (com EMAIL_TRAVADO sempre presente)
  const [emails, setEmails] = useState(() => Array.from(new Set(EMAILS_PADRAO)));
  const [novoEmail, setNovoEmail] = useState("");

  const mensagemWhats = useMemo(() => buildMensagemWhatsAppEspecial(form), [form]);

  const handleCopiar = async () => {
    await copyToClipboard(mensagemWhats);
    alert("Mensagem copiada — cola no WhatsApp.");
  };

  const handleAbrirWhats = () => {
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(mensagemWhats)}`;
    window.open(url, "_blank");
  };

  // Atualizar campos do form
  const upd = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const updParada = (lista, idx, key, val) => {
    setForm((p) => {
      const arr = [...(p[lista] || [])];
      arr[idx] = { ...arr[idx], [key]: val };
      return { ...p, [lista]: arr };
    });
  };
  const addParada = (lista) =>
    setForm((p) => ({ ...p, [lista]: [...(p[lista] || []), novaParada()] }));
  const rmParada = (lista, idx) =>
    setForm((p) => ({ ...p, [lista]: (p[lista] || []).filter((_, i) => i !== idx) }));

  // Gerenciar emails
  const addEmail = () => {
    const e = String(novoEmail).trim().toLowerCase();
    if (!e || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
      alert("E-mail inválido.");
      return;
    }
    if (emails.includes(e)) {
      alert("Esse e-mail já está na lista.");
      return;
    }
    setEmails((p) => [...p, e]);
    setNovoEmail("");
  };
  const rmEmail = (e) => {
    if (e === EMAIL_TRAVADO) return; // travado
    setEmails((p) => p.filter((x) => x !== e));
  };

  const handleSalvar = async () => {
    if (!form.data) return alert("Informe a data.");
    if (!form.ida_hora_saida) return alert("Informe horário de saída da ida.");
    if (!form.volta_hora_saida) return alert("Informe horário de retorno.");
    if (!form.ida_destino_local) return alert("Informe o destino da ida.");

    setSalvando(true);
    try {
      const payload = {
        ...form,
        criado_por_login: user?.login || null,
        criado_por_nome: user?.nome || null,
        emails_extras: emails,
      };

      const { data, error } = await supabase
        .from("especiais")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;

      // Manda pro Google Agenda (centralizado via Edge Function)
      try {
        const res = await syncEspecialToGoogle(data, emails);
        await supabase
          .from("especiais")
          .update({ google_event_id: res.eventId })
          .eq("id", data.id);
        alert(
          `Especial cadastrado e enviado pro Google Agenda (${res.action === "created" ? "novo evento criado" : "evento atualizado"}). Convites foram enviados pros participantes.`
        );
      } catch (e) {
        alert(
          "Especial cadastrado, mas falhou ao enviar pro Google Agenda: " +
            (e.message || e) +
            "\n\nVerifique se as secrets do Google estão configuradas no Supabase."
        );
      }
      navigate("/controle-especial/central");
    } catch (e) {
      console.error(e);
      alert("Erro ao salvar: " + (e.message || e));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate("/controle-especial/central")}
          className="text-slate-500 hover:text-slate-700 p-2 rounded-lg hover:bg-slate-100"
        >
          <FaArrowLeft />
        </button>
        <div className="w-12 h-12 rounded-2xl bg-purple-600 text-white flex items-center justify-center">
          <FaBusAlt size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-black text-slate-800">Lançamento de Especial</h1>
          <p className="text-sm text-slate-500">Cadastre uma viagem especial e envie pro Google Agenda dos participantes.</p>
        </div>
      </div>

      {/* Aviso central de transmissão */}
      <div className="mb-6 rounded-xl border border-purple-200 bg-purple-50 px-4 py-3 text-sm text-purple-800 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-purple-600" />
        Os eventos serão criados <b>na agenda principal de transmissão</b>. Não é necessário conectar Google pessoal — todos os convites saem da mesma conta.
      </div>

      {/* Dados básicos */}
      <Section title="Dados gerais">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Data">
            <input
              type="date"
              value={form.data}
              onChange={(e) => upd("data", e.target.value)}
              className="input"
            />
          </Field>
          <Field label="Quantidade de ônibus">
            <input
              type="number"
              min={1}
              value={form.qtd_onibus}
              onChange={(e) => upd("qtd_onibus", Number(e.target.value))}
              className="input"
            />
          </Field>
        </div>
      </Section>

      {/* IDA */}
      <Section title="🚌 IDA" color="bg-blue-50 border-blue-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Horário de saída">
            <input
              type="time"
              value={form.ida_hora_saida}
              onChange={(e) => upd("ida_hora_saida", e.target.value)}
              className="input"
            />
          </Field>
          <Field label="Local de saída">
            <input
              type="text"
              value={form.ida_local_saida}
              onChange={(e) => upd("ida_local_saida", e.target.value)}
              placeholder="ex.: Paróquia Nossa Senhora do Carmo"
              className="input"
            />
          </Field>
          <Field label="Endereço de saída">
            <input
              type="text"
              value={form.ida_end_saida}
              onChange={(e) => upd("ida_end_saida", e.target.value)}
              placeholder="Rua, número, cidade"
              className="input"
            />
          </Field>
        </div>

        <ListaParadas
          paradas={form.ida_paradas}
          onChange={(i, k, v) => updParada("ida_paradas", i, k, v)}
          onAdd={() => addParada("ida_paradas")}
          onRemove={(i) => rmParada("ida_paradas", i)}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <Field label="Destino (local)">
            <input
              type="text"
              value={form.ida_destino_local}
              onChange={(e) => upd("ida_destino_local", e.target.value)}
              placeholder="ex.: Congregação Família dos Discípulos"
              className="input"
            />
          </Field>
          <Field label="Endereço do destino">
            <input
              type="text"
              value={form.ida_end_destino}
              onChange={(e) => upd("ida_end_destino", e.target.value)}
              className="input"
            />
          </Field>
        </div>
      </Section>

      {/* VOLTA */}
      <Section title="🚌 VOLTA" color="bg-amber-50 border-amber-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Horário de retorno">
            <input
              type="time"
              value={form.volta_hora_saida}
              onChange={(e) => upd("volta_hora_saida", e.target.value)}
              className="input"
            />
          </Field>
          <Field label="Local de saída (retorno)">
            <input
              type="text"
              value={form.volta_local_saida}
              onChange={(e) => upd("volta_local_saida", e.target.value)}
              className="input"
            />
          </Field>
          <Field label="Endereço">
            <input
              type="text"
              value={form.volta_end_saida}
              onChange={(e) => upd("volta_end_saida", e.target.value)}
              className="input"
            />
          </Field>
        </div>

        <ListaParadas
          paradas={form.volta_paradas}
          onChange={(i, k, v) => updParada("volta_paradas", i, k, v)}
          onAdd={() => addParada("volta_paradas")}
          onRemove={(i) => rmParada("volta_paradas", i)}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <Field label="Destino final">
            <input
              type="text"
              value={form.volta_destino_local}
              onChange={(e) => upd("volta_destino_local", e.target.value)}
              className="input"
            />
          </Field>
          <Field label="Endereço">
            <input
              type="text"
              value={form.volta_end_destino}
              onChange={(e) => upd("volta_end_destino", e.target.value)}
              className="input"
            />
          </Field>
        </div>
      </Section>

      {/* Observações */}
      <Section title="Observações">
        <textarea
          rows={3}
          value={form.observacoes}
          onChange={(e) => upd("observacoes", e.target.value)}
          className="input"
          placeholder="Informações adicionais..."
        />
      </Section>

      {/* Convidados */}
      <Section title="📧 Convidados (Google Agenda)">
        <div className="text-xs text-slate-500 mb-2">
          Todos abaixo receberão o convite no Google Agenda com lembrete 1 dia antes. O e-mail{" "}
          <b>{EMAIL_TRAVADO}</b> está travado e não pode ser removido.
        </div>
        <div className="flex flex-wrap gap-2 mb-3">
          {emails.map((e) => {
            const travado = e === EMAIL_TRAVADO;
            return (
              <div
                key={e}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold ${
                  travado
                    ? "bg-amber-100 text-amber-800 border border-amber-300"
                    : "bg-slate-100 text-slate-700 border border-slate-200"
                }`}
              >
                {travado && <span title="Travado">🔒</span>}
                {e}
                {!travado && (
                  <button
                    onClick={() => rmEmail(e)}
                    className="ml-1 text-slate-400 hover:text-red-600"
                    title="Remover"
                  >
                    <FaTrash size={10} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <div className="flex gap-2">
          <input
            type="email"
            value={novoEmail}
            onChange={(e) => setNovoEmail(e.target.value)}
            placeholder="adicionar e-mail..."
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addEmail())}
            className="input flex-1"
          />
          <button
            onClick={addEmail}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-sm font-bold flex items-center gap-2"
          >
            <FaPlus size={12} /> Adicionar
          </button>
        </div>
      </Section>

      {/* Mensagem WhatsApp */}
      <Section title="💬 Mensagem para WhatsApp" color="bg-emerald-50 border-emerald-200">
        <p className="text-xs text-slate-600 mb-3">
          Preview da mensagem com os dados acima. Atualiza automaticamente conforme você preenche o formulário.
        </p>
        <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-950 p-4 text-xs font-semibold leading-relaxed text-white">
          {mensagemWhats}
        </pre>
        <div className="mt-3 flex flex-wrap gap-2 justify-end">
          <button
            type="button"
            onClick={handleCopiar}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            <FaCopy /> Copiar mensagem
          </button>
          <button
            type="button"
            onClick={handleAbrirWhats}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 text-sm font-black"
          >
            <FaWhatsapp /> Abrir no WhatsApp
          </button>
        </div>
      </Section>

      {/* Footer ações */}
      <div className="sticky bottom-0 bg-white border-t border-slate-200 -mx-6 px-6 py-4 mt-6 flex justify-between gap-3">
        <button
          onClick={() => navigate("/controle-especial/central")}
          className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:text-slate-800"
        >
          Cancelar
        </button>
        <button
          onClick={handleSalvar}
          disabled={salvando}
          className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-black shadow-md flex items-center gap-2 disabled:opacity-50"
        >
          <FaSave /> {salvando ? "Salvando..." : "Lançar e Enviar pro Google"}
        </button>
      </div>

      <style>{`
        .input {
          width: 100%;
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 0.5rem;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          color: #334155;
          outline: none;
          transition: all .15s;
        }
        .input:focus {
          border-color: #6366f1;
          box-shadow: 0 0 0 3px rgba(99,102,241,.15);
        }
      `}</style>
    </div>
  );
}

function Section({ title, children, color = "bg-white border-slate-200" }) {
  return (
    <div className={`mb-5 rounded-xl border p-4 ${color}`}>
      <h3 className="text-sm font-black text-slate-700 mb-3">{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-[11px] font-extrabold uppercase text-slate-500 mb-1">{label}</label>
      {children}
    </div>
  );
}

function ListaParadas({ paradas, onChange, onAdd, onRemove }) {
  return (
    <div className="mt-3 space-y-2">
      <div className="text-[11px] font-extrabold uppercase text-slate-500">
        Paradas intermediárias
      </div>
      {(paradas || []).map((p, i) => (
        <div key={i} className="flex gap-2 items-start">
          <input
            type="text"
            value={p.local}
            onChange={(e) => onChange(i, "local", e.target.value)}
            placeholder={`Parada ${i + 1} — local`}
            className="input flex-1"
          />
          <input
            type="text"
            value={p.endereco}
            onChange={(e) => onChange(i, "endereco", e.target.value)}
            placeholder="Endereço"
            className="input flex-1"
          />
          <button
            onClick={() => onRemove(i)}
            className="p-2 text-slate-400 hover:text-red-600"
            title="Remover parada"
          >
            <FaTrash size={12} />
          </button>
        </div>
      ))}
      <button
        onClick={onAdd}
        className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
      >
        <FaPlus size={10} /> Adicionar parada
      </button>
    </div>
  );
}

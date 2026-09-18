// src/pages/intervencoes/sosAutoria.jsx
// QUEM FEZ CADA PASSO DO SOS (18/09/2026, pedido do dono no "Detalhes SOS" da Central:
// "aqui precisa aparecer quem criou, quem fechou, quem tratou — as intervenções em cada passo").
//
// O SOS passa por três telas: Solicitação (cria, "Aberto") → Fechamento ("Em Andamento") →
// Tratamento ("Fechado"). Até hoje nenhuma guardava o USUÁRIO DO INOVE que agiu — só os nomes
// digitados no formulário (plantonista, avaliador, solucionador) — e o Tratamento regravava
// `data_fechamento`, apagando a hora do Fechamento. Cada passo agora grava o seu autor e a sua
// hora (migration 202609181600_sos_autoria). Para os SOS antigos o quadro mostra o que existe:
// o nome digitado no formulário e, quando dá, a hora.
import { FaHistory } from "react-icons/fa";

/** O autor de um passo: o usuário logado no INOVE (nome + login). */
export function autorDoPasso(user) {
  const nome = String(user?.nome || "").trim();
  const login = String(user?.login || user?.email || "").trim();
  return { nome: nome || login || null, login: login || null };
}

const txt = (v) => String(v ?? "").trim();
const normStatus = (s) => txt(s).toUpperCase();

function dataHora(v) {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Os passos do SOS, do jeito que o banco consegue contar. */
export function passosDoSOS(sos) {
  const s = sos || {};
  const status = normStatus(s.status);
  const fechou = !!(s.fechamento_em || txt(s.avaliador) || status === "EM ANDAMENTO" || status === "FECHADO");
  const tratou = !!(s.tratamento_em || status === "FECHADO");
  return [
    {
      chave: "criado",
      titulo: "Criou o SOS",
      tela: "Solicitação",
      feito: true,
      usuario: txt(s.criado_por_nome),
      informado: txt(s.plantonista) ? `Plantonista: ${txt(s.plantonista)}` : "",
      quando: dataHora(s.created_at),
    },
    {
      chave: "fechado",
      titulo: "Fechou o acionamento",
      tela: "Fechamento",
      feito: fechou,
      usuario: txt(s.fechamento_por_nome),
      informado: txt(s.avaliador) ? `Avaliador: ${txt(s.avaliador)}` : "",
      // Antes da migration o Tratamento regravava `data_fechamento`: num SOS já tratado, ela é
      // a hora do tratamento, não a do fechamento — aí a hora do fechamento não existe mais.
      quando: dataHora(s.fechamento_em) || (status === "EM ANDAMENTO" ? dataHora(s.data_fechamento) : ""),
    },
    {
      chave: "tratado",
      titulo: "Tratou (manutenção)",
      tela: "Tratamento",
      feito: tratou,
      usuario: txt(s.tratamento_por_nome),
      informado: [
        txt(s.solucionador) ? `Responsável: ${txt(s.solucionador)}` : "",
        txt(s.mecanico_executor) ? `Mecânico: ${txt(s.mecanico_executor)}` : "",
      ]
        .filter(Boolean)
        .join(" · "),
      quando: dataHora(s.tratamento_em) || (status === "FECHADO" ? dataHora(s.data_fechamento) : ""),
    },
  ];
}

/** O quadro "Quem fez cada passo" do Detalhes SOS (Central e Resumo usam o mesmo). */
export function HistoricoSOS({ sos }) {
  const passos = passosDoSOS(sos);
  const editadoPor = txt(sos?.editado_por_nome);
  const editadoEm = dataHora(sos?.atualizado_em);
  return (
    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
      <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-4 border-b pb-2 flex items-center gap-2">
        <FaHistory className="text-indigo-500" /> Quem fez cada passo
      </h3>
      <ol className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {passos.map((p, i) => (
          <li
            key={p.chave}
            className={`rounded-xl border p-3 ${p.feito ? "border-indigo-100 bg-indigo-50/40" : "border-dashed border-slate-200 bg-slate-50 opacity-70"}`}
          >
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              {i + 1} · {p.tela}
            </div>
            <div className="mt-1 text-sm font-black text-slate-800">{p.titulo}</div>
            {!p.feito ? (
              <div className="mt-2 text-xs font-semibold text-slate-500">Pendente</div>
            ) : (
              <div className="mt-2 space-y-1 text-xs text-slate-700">
                <div>
                  <span className="font-bold text-slate-500">Usuário do INOVE: </span>
                  <span className="font-bold">{p.usuario || "não registrado"}</span>
                </div>
                {p.informado ? <div className="font-semibold">{p.informado}</div> : null}
                <div>
                  <span className="font-bold text-slate-500">Quando: </span>
                  <span className="font-semibold">{p.quando || "hora não registrada"}</span>
                </div>
              </div>
            )}
          </li>
        ))}
      </ol>
      {editadoPor || editadoEm ? (
        <p className="mt-3 text-xs text-slate-500">
          <span className="font-bold">Última alteração:</span>{" "}
          {editadoPor ? `${editadoPor}` : "usuário não registrado"}
          {editadoEm ? ` · ${editadoEm}` : ""}
        </p>
      ) : null}
      <p className="mt-2 text-[10px] font-semibold text-slate-400">
        "Usuário do INOVE" é quem estava logado ao registrar o passo — gravado desde 18/09/2026. Nos SOS
        anteriores só existe o nome digitado no formulário.
      </p>
    </div>
  );
}

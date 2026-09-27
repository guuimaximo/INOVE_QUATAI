// O RELATÓRIO DE PASSAGEM DE TURNO da manutenção que vira PNG e PDF (27/09/2026). O molde é
// o documento Word que a manutenção usava (26/09, diurno, Adenilson): cabeçalho escuro,
// o alerta prioritário em vermelho e as seções numeradas — liberações concluídas, gestão
// de etiquetas, controle de ausências, desvios e o indicador de aderência.
//
// Estilo INLINE com cores fixas, de propósito: o bloco é fotografado (ver `fotografar` em
// PCMPassagemDia.jsx) e classe utilitária com variável de tema pode sair errada na foto.
// Seção sem nada diz "nenhum(a)" — linha em branco não informa quem lê no WhatsApp.
import { forwardRef } from "react";
import { dataBR } from "../operacional/passagemTurno";
import { aderencia, turnoPorId } from "./passagemTurnoPcm";

const C = {
  escuro: "#111827",
  borda: "#e2e8f0",
  texto: "#0f172a",
  suave: "#64748b",
  fundo: "#f8fafc",
  alerta: "#dc2626",
  alertaFundo: "#fef2f2",
};
const FONTE = "'Segoe UI', Roboto, Arial, Helvetica, sans-serif";
const MONO = "Consolas, monospace";

function Secao({ n, titulo, extra, children }) {
  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8, borderBottom: `2px solid ${C.escuro}`, paddingBottom: 4 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: C.escuro, textTransform: "uppercase", letterSpacing: 0.3 }}>
          {n}. {titulo}
        </div>
        {extra && <div style={{ fontSize: 12, color: C.suave }}>{extra}</div>}
      </div>
      {children}
    </div>
  );
}

function Vazio({ texto }) {
  return <div style={{ fontSize: 13, color: C.suave, padding: "4px 2px" }}>{texto}</div>;
}

const th = { textAlign: "left", fontSize: 11, fontWeight: 700, color: C.suave, textTransform: "uppercase", letterSpacing: 0.4, padding: "6px 10px", background: C.fundo, borderBottom: `1px solid ${C.borda}` };
const td = { fontSize: 13, color: C.texto, padding: "7px 10px", borderBottom: `1px solid ${C.borda}`, verticalAlign: "top" };

function Tabela({ cabecalho, linhas }) {
  return (
    <div style={{ border: `1px solid ${C.borda}`, borderRadius: 8, overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr>{cabecalho.map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
        <tbody>{linhas}</tbody>
      </table>
    </div>
  );
}

function Numero({ rotulo, valor, cor }) {
  return (
    <div style={{ border: `1px solid ${C.borda}`, borderTop: `4px solid ${cor || C.escuro}`, borderRadius: 8, padding: "8px 12px", background: "#fff" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.suave, textTransform: "uppercase", letterSpacing: 0.4 }}>{rotulo}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: C.texto, lineHeight: 1.15, marginTop: 2 }}>{valor ?? "—"}</div>
    </div>
  );
}

function TextoLivre({ texto, vazio }) {
  const t = String(texto ?? "").trim();
  return t ? <div style={{ fontSize: 13, color: C.texto, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{t}</div> : <Vazio texto={vazio} />;
}

const PCMPassagemRelatorio = forwardRef(function PCMPassagemRelatorio(
  { passagem, dia, turno, liberacoes, ausencias, etiquetas },
  ref,
) {
  const p = passagem || {};
  const t = turnoPorId(turno);
  const inicio = p.turno_inicio || t.inicio;
  const fim = p.turno_fim || t.fim;
  const pct = aderencia(p.previsto, p.atendido);
  const alerta = String(p.alerta ?? "").trim();
  const e = etiquetas || {};
  const agora = new Date().toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

  return (
    <div ref={ref} style={{ width: 860, background: "#fff", color: C.texto, fontFamily: FONTE, padding: 24, boxSizing: "border-box" }}>
      {/* CABEÇALHO — o do documento */}
      <div style={{ background: C.escuro, color: "#fff", padding: "18px 22px" }}>
        <div style={{ fontSize: 22, fontWeight: 800 }}>RELATÓRIO DE PASSAGEM DE TURNO</div>
        <div style={{ fontSize: 13, marginTop: 8, opacity: 0.9 }}>
          DATA: {dataBR(dia)} &nbsp;|&nbsp; TURNO: {t.label} ({inicio} – {fim})
        </div>
        <div style={{ fontSize: 13, marginTop: 2, opacity: 0.9 }}>RESPONSÁVEIS: {String(p.responsaveis ?? "").trim() || "—"}</div>
      </div>

      {/* 1. ATENÇÃO ESPECIAL */}
      <div style={{ marginTop: 16, background: C.alertaFundo, padding: "12px 16px", borderLeft: `4px solid ${C.alerta}` }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: C.alerta }}>⚠ 1. ATENÇÃO ESPECIAL / ALERTA PRIORITÁRIO</div>
        <div style={{ marginTop: 6 }}>
          {alerta
            ? <div style={{ fontSize: 13, color: C.texto, whiteSpace: "pre-wrap", lineHeight: 1.5, fontWeight: 600 }}>{alerta}</div>
            : <Vazio texto="Nenhum alerta para o próximo turno." />}
        </div>
      </div>

      {/* 2. LIBERAÇÕES */}
      <Secao n={2} titulo={`Liberações concluídas · ${liberacoes.length}`}>
        {!liberacoes.length ? (
          <Vazio texto="Nenhuma liberação no turno." />
        ) : (
          <Tabela
            cabecalho={["Carro", "O que foi feito"]}
            linhas={liberacoes.map((l) => (
              <tr key={l.id}>
                <td style={{ ...td, fontFamily: MONO, fontWeight: 700, width: 90 }}>{l.frota}</td>
                <td style={td}>{l.servico}</td>
              </tr>
            ))}
          />
        )}
      </Secao>

      {/* 3. ETIQUETAS */}
      <Secao n={3} titulo="Gestão de etiquetas" extra="do módulo de SOS">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 8 }}>
          <Numero rotulo="Abertas no turno" valor={e.abertas?.length ?? "—"} cor="#dc2626" />
          <Numero rotulo="Fechadas no turno" valor={e.fechadas?.length ?? "—"} cor="#059669" />
          <Numero rotulo="Tratadas no turno" valor={e.tratadas?.length ?? "—"} cor="#2563eb" />
          <Numero rotulo="Em aberto (fila)" valor={e.emAberto?.length ?? "—"} cor="#d97706" />
          <Numero rotulo="Em andamento" valor={e.emAndamento?.length ?? "—"} cor="#475569" />
        </div>
        {String(p.etiquetas_obs ?? "").trim() && (
          <div style={{ marginTop: 8 }}><TextoLivre texto={p.etiquetas_obs} /></div>
        )}
      </Secao>

      {/* 4. AUSÊNCIAS */}
      <Secao n={4} titulo={`Controle de ausências · ${ausencias.length}`}>
        {!ausencias.length ? (
          <Vazio texto="Nenhuma ausência no turno." />
        ) : (
          <Tabela
            cabecalho={["Colaborador", "Função", "Motivo", "Observação"]}
            linhas={ausencias.map((a) => (
              <tr key={a.id}>
                <td style={td}>
                  <b>{a.nome || a.chapa}</b>
                  {a.nome ? <span style={{ color: C.suave, fontFamily: MONO, marginLeft: 6 }}>{a.chapa}</span> : null}
                </td>
                <td style={td}>{a.funcao || "—"}</td>
                <td style={{ ...td, fontWeight: 700 }}>{a.motivo}</td>
                <td style={td}>{a.observacao || "—"}</td>
              </tr>
            ))}
          />
        )}
      </Secao>

      {/* 5. DESVIOS */}
      <Secao n={5} titulo="Desvios / ocorrências do turno">
        <TextoLivre texto={p.desvios} vazio="Nenhum desvio registrado." />
      </Secao>

      {/* 6. ADERÊNCIA */}
      <Secao n={6} titulo="Indicador de aderência (previsto x liberado)">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, maxWidth: 560 }}>
          <Numero rotulo="Previsto" valor={p.previsto ?? "—"} />
          <Numero rotulo="Atendido" valor={p.atendido ?? "—"} />
          <Numero
            rotulo="Aderência"
            valor={pct == null ? "—" : `${pct}%`}
            cor={pct == null ? C.suave : pct >= 100 ? "#059669" : pct >= 80 ? "#d97706" : "#dc2626"}
          />
        </div>
      </Secao>

      <div style={{ marginTop: 20, paddingTop: 10, borderTop: `1px solid ${C.borda}`, fontSize: 11, color: C.suave, display: "flex", justifyContent: "space-between" }}>
        <span>INOVE · PCM · Passagem de turno da manutenção</span>
        <span>gerado em {agora}{p.atualizado_por ? ` · última alteração: ${p.atualizado_por}` : ""}</span>
      </div>
    </div>
  );
});

export default PCMPassagemRelatorio;

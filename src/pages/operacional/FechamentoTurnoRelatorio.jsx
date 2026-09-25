// O FECHAMENTO DE TURNO que vira PNG e PDF (25/09/2026). Dono, sobre a primeira versão
// (cópia da planilha verde): "o layout não precisa ser exatamente esse — pensa em algo mais
// bonito". Aqui é um relatório de cartões: números do turno, ocorrências do dia (do SOS,
// com as avarias linha a linha), frota parada (do PCM), faltas e intercorrências.
//
// Estilo INLINE com cores fixas, de propósito: o bloco é fotografado (ver `fotografar` em
// PassagemTurnoDia.jsx) e classe utilitária com variável de tema pode sair errada na foto.
// Seção sem nada diz "nenhuma" — linha em branco não informa quem lê no WhatsApp.
import { forwardRef } from "react";
import { TIPOS_OCORRENCIA, dataPorExtenso, emAberto } from "./passagemTurno";

const C = {
  marca: "#0f766e",
  marcaEscura: "#115e59",
  marcaSuave: "#f0fdfa",
  borda: "#e2e8f0",
  texto: "#0f172a",
  suave: "#64748b",
  fundo: "#f8fafc",
};
const FONTE = "'Segoe UI', Roboto, Arial, Helvetica, sans-serif";

function Secao({ titulo, extra, children }) {
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: 0.6, textTransform: "uppercase", color: C.marcaEscura }}>
          {titulo}
        </div>
        {extra && <div style={{ fontSize: 12, color: C.suave }}>{extra}</div>}
      </div>
      {children}
    </div>
  );
}

function Tile({ rotulo, valor, cor, sub }) {
  const vazio = valor === null || valor === undefined || valor === "";
  return (
    <div
      style={{
        border: `1px solid ${C.borda}`, borderTop: `4px solid ${cor || C.marca}`, borderRadius: 10,
        padding: "8px 12px 10px", background: "#fff",
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 700, color: C.suave, textTransform: "uppercase", letterSpacing: 0.4 }}>{rotulo}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: vazio ? "#cbd5e1" : C.texto, lineHeight: 1.15, marginTop: 2 }}>
        {vazio ? "—" : valor}
      </div>
      {sub && <div style={{ fontSize: 11, color: C.suave, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function Grade({ colunas, children }) {
  return <div style={{ display: "grid", gridTemplateColumns: `repeat(${colunas}, minmax(0, 1fr))`, gap: 8 }}>{children}</div>;
}

function Vazio({ texto }) {
  return (
    <div style={{ border: `1px dashed ${C.borda}`, borderRadius: 10, padding: "10px 12px", fontSize: 13, color: C.suave, background: C.fundo }}>
      {texto}
    </div>
  );
}

const th = { textAlign: "left", fontSize: 11, fontWeight: 700, color: C.suave, textTransform: "uppercase", letterSpacing: 0.4, padding: "7px 10px", background: C.fundo, borderBottom: `1px solid ${C.borda}` };
const td = { fontSize: 13, color: C.texto, padding: "7px 10px", borderBottom: `1px solid ${C.borda}`, verticalAlign: "top" };

function Tabela({ cabecalho, linhas }) {
  return (
    <div style={{ border: `1px solid ${C.borda}`, borderRadius: 10, overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>{cabecalho.map((h) => <th key={h} style={th}>{h}</th>)}</tr>
        </thead>
        <tbody>{linhas}</tbody>
      </table>
    </div>
  );
}

function Chip({ children, cor = C.marca, fundo = C.marcaSuave }) {
  return (
    <span
      style={{
        display: "inline-block", padding: "3px 9px", borderRadius: 999, fontSize: 12, fontWeight: 700,
        color: cor, background: fundo, border: `1px solid ${cor}33`, margin: "0 6px 6px 0",
      }}
    >
      {children}
    </span>
  );
}

function Situacao({ a }) {
  const aberto = emAberto(a);
  return (
    <span
      style={{
        display: "inline-block", padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 800,
        color: aberto ? "#92400e" : "#475569", background: aberto ? "#fef3c7" : "#f1f5f9", whiteSpace: "nowrap",
      }}
    >
      {aberto ? "Em aberto" : String(a?.status ?? "").trim() || "Fechado"}
    </span>
  );
}

const pessoa = (nome, chapa) => (
  <>
    <b>{nome || "—"}</b>
    {chapa ? <span style={{ color: C.suave, fontFamily: "Consolas, monospace", marginLeft: 6 }}>{chapa}</span> : null}
  </>
);

function TabelaFaltas({ titulo, faltas, nomeDe }) {
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 700, color: C.texto, margin: "0 0 6px" }}>{titulo} · {faltas.length}</div>
      {!faltas.length ? (
        <Vazio texto="Nenhuma falta." />
      ) : (
        <Tabela
          cabecalho={["Motorista", "Linha", "Substituto"]}
          linhas={faltas.map((f) => (
            <tr key={f.id}>
              <td style={td}>{pessoa(f.operador || nomeDe(f.chapa), f.chapa)}</td>
              <td style={td}>{f.linha || "—"}</td>
              <td style={td}>
                {f.substituto_chapa || f.substituto_nome
                  ? <>{pessoa(f.substituto_nome || nomeDe(f.substituto_chapa), f.substituto_chapa)}{f.substituto_linha ? <span style={{ color: C.suave }}> · {f.substituto_linha}</span> : null}</>
                  : <span style={{ color: C.suave }}>—</span>}
              </td>
            </tr>
          ))}
        />
      )}
    </div>
  );
}

function ListaIntercorrencias({ titulo, itens, nomeDe }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: C.texto, margin: "0 0 6px" }}>{titulo} · {itens.length}</div>
      {!itens.length ? (
        <Vazio texto="Nada registrado." />
      ) : (
        <div style={{ border: `1px solid ${C.borda}`, borderRadius: 10, overflow: "hidden" }}>
          {itens.map((i, n) => (
            <div key={i.id} style={{ padding: "8px 12px", borderTop: n ? `1px solid ${C.borda}` : 0, background: "#fff" }}>
              <div style={{ fontSize: 13, color: C.texto, lineHeight: 1.4 }}>
                {i.hora && <b style={{ fontFamily: "Consolas, monospace", color: C.marcaEscura, marginRight: 8 }}>{i.hora}</b>}
                {i.veiculo && !String(i.texto).includes(i.veiculo) && (
                  <span style={{ fontFamily: "Consolas, monospace", color: C.suave, marginRight: 8 }}>🚌 {i.veiculo}</span>
                )}
                {i.texto}
              </div>
              {(i.chapas || []).length > 0 && (
                <div style={{ marginTop: 6 }}>
                  {(i.chapas || []).map((c) => <Chip key={c}>{nomeDe(c) || "?"} · {c}</Chip>)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const FechamentoTurnoRelatorio = forwardRef(function FechamentoTurnoRelatorio(
  { turno, faltas, intercorrencias, ocorrencias, frota, nomeDe = () => "" },
  ref,
) {
  const t = turno || {};
  const faltasManha = faltas.filter((f) => f.periodo === "MANHA");
  const faltasTarde = faltas.filter((f) => f.periodo === "TARDE");
  const substituicoes = faltas.filter((f) => f.substituto_chapa || f.substituto_nome).length;
  const interManha = intercorrencias.filter((i) => i.periodo === "MANHA");
  const interTarde = intercorrencias.filter((i) => i.periodo === "TARDE");
  const cont = ocorrencias?.contagem || {};
  const avarias = ocorrencias?.porTipo?.avaria || [];
  const abertos = ocorrencias?.abertos || [];
  const gns = frota?.gns || [];
  const faixa = frota?.faixa_amarela || [];
  const data = dataPorExtenso(t.data_referencia);
  const agora = new Date().toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

  return (
    <div ref={ref} style={{ width: 920, background: "#fff", color: C.texto, fontFamily: FONTE, padding: 24, boxSizing: "border-box" }}>
      {/* CABEÇALHO */}
      <div
        style={{
          background: C.marca, color: "#fff", borderRadius: 14, padding: "16px 20px",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
        }}
      >
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 2, opacity: 0.85 }}>FECHAMENTO DE TURNO</div>
          <div style={{ fontSize: 24, fontWeight: 800, marginTop: 2 }}>{data.replace(/^./, (c) => c.toUpperCase())}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 12, opacity: 0.85 }}>Turno</div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>{t.turno_inicio || "07:00"} – {t.turno_fim || "19:00"}</div>
        </div>
      </div>

      {/* OPERAÇÃO */}
      <Secao titulo="Operação">
        <Grade colunas={4}>
          <Tile rotulo="Carros programados" valor={t.carros_programados} />
          <Tile rotulo="P.O programado" valor={t.po_programado} />
          <Tile rotulo="Reservas manhã" valor={t.reservas_manha} />
          <Tile rotulo="Reservas tarde" valor={t.reservas_tarde} />
          <Tile rotulo="Faltas manhã" valor={faltasManha.length} cor="#dc2626" />
          <Tile rotulo="Faltas tarde" valor={faltasTarde.length} cor="#dc2626" />
          <Tile rotulo="Substituições" valor={substituicoes} cor="#2563eb" />
          <Tile rotulo="Intercorrências" valor={intercorrencias.length} cor="#7c3aed" />
        </Grade>
      </Secao>

      {/* OCORRÊNCIAS DO DIA */}
      <Secao titulo="Ocorrências do dia" extra="do módulo de SOS">
        <Grade colunas={7}>
          {TIPOS_OCORRENCIA.map((o) => (
            <Tile key={o.id} rotulo={o.label} valor={cont[o.id] ?? 0} cor={o.cor} />
          ))}
          <Tile rotulo="Assalto" valor={t.assalto ?? 0} cor="#991b1b" />
          {/* só a quantidade (dono): a lista do que está aberto fica no módulo de SOS */}
          <Tile rotulo="Etiquetas em aberto" valor={abertos.length} cor="#d97706" />
        </Grade>
      </Secao>

      {avarias.length > 0 && (
        <Secao titulo={`Avarias · ${avarias.length}`}>
          <Tabela
            cabecalho={["Hora", "SOS", "Veículo", "Linha", "Motorista", "O que houve", "Situação"]}
            linhas={avarias.map((a) => (
              <tr key={a.id}>
                <td style={{ ...td, fontFamily: "Consolas, monospace" }}>{String(a.hora_sos || "").slice(0, 5) || "—"}</td>
                <td style={{ ...td, fontFamily: "Consolas, monospace" }}>{a.numero_sos || "—"}</td>
                <td style={{ ...td, fontFamily: "Consolas, monospace", fontWeight: 700 }}>{a.veiculo || "—"}</td>
                <td style={td}>{[a.linha, a.tabela_operacional].filter(Boolean).join(" · ") || "—"}</td>
                <td style={td}>{pessoa(a.motorista_nome, a.motorista_id)}</td>
                <td style={td}>
                  {a.reclamacao_motorista || "—"}
                  {a.problema_encontrado ? <div style={{ color: C.suave, fontSize: 12 }}>Manutenção: {a.problema_encontrado}</div> : null}
                </td>
                <td style={td}><Situacao a={a} /></td>
              </tr>
            ))}
          />
        </Secao>
      )}

      {/* FROTA PARADA */}
      <Secao titulo="Frota parada" extra={frota?.temPcm ? "do PCM do dia" : "sem PCM aberto neste dia"}>
        <Grade colunas={2}>
          <div style={{ border: `1px solid ${C.borda}`, borderRadius: 10, padding: "10px 12px" }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#b91c1c", marginBottom: 6 }}>GNS · {gns.length}</div>
            {gns.length ? gns.map((v, n) => <Chip key={`g${v.frota}-${n}`} cor="#b91c1c" fundo="#fef2f2">{v.frota}</Chip>)
              : <span style={{ fontSize: 13, color: C.suave }}>Nenhum carro.</span>}
          </div>
          <div style={{ border: `1px solid ${C.borda}`, borderRadius: 10, padding: "10px 12px" }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#b45309", marginBottom: 6 }}>Faixa amarela · {faixa.length}</div>
            {faixa.length ? faixa.map((v, n) => <Chip key={`f${v.frota}-${n}`} cor="#b45309" fundo="#fffbeb">{v.frota}</Chip>)
              : <span style={{ fontSize: 13, color: C.suave }}>Nenhum carro.</span>}
          </div>
        </Grade>
      </Secao>

      {/* FALTAS */}
      <Secao titulo="Faltas">
        {/* uma embaixo da outra: lado a lado, nome e substituto quebravam em duas linhas */}
        <Grade colunas={1}>
          <TabelaFaltas titulo="Manhã" faltas={faltasManha} nomeDe={nomeDe} />
          <TabelaFaltas titulo="Tarde" faltas={faltasTarde} nomeDe={nomeDe} />
        </Grade>
      </Secao>

      {/* INTERCORRÊNCIAS */}
      <Secao titulo="Intercorrências">
        <ListaIntercorrencias titulo="Manhã" itens={interManha} nomeDe={nomeDe} />
        <ListaIntercorrencias titulo="Tarde" itens={interTarde} nomeDe={nomeDe} />
      </Secao>

      {(t.malotes || t.observacoes) && (
        <Secao titulo="Anotações">
          <Grade colunas={t.malotes && t.observacoes ? 2 : 1}>
            {t.malotes && (
              <div style={{ border: `1px solid ${C.borda}`, borderRadius: 10, padding: "10px 12px" }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: C.suave, marginBottom: 4 }}>Malotes</div>
                <div style={{ fontSize: 13, whiteSpace: "pre-wrap", fontFamily: "Consolas, monospace" }}>{t.malotes}</div>
              </div>
            )}
            {t.observacoes && (
              <div style={{ border: `1px solid ${C.borda}`, borderRadius: 10, padding: "10px 12px" }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: C.suave, marginBottom: 4 }}>Observações do turno</div>
                <div style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>{t.observacoes}</div>
              </div>
            )}
          </Grade>
        </Secao>
      )}

      <div style={{ marginTop: 18, paddingTop: 10, borderTop: `1px solid ${C.borda}`, fontSize: 11, color: C.suave, display: "flex", justifyContent: "space-between" }}>
        <span>INOVE · Operacional · Passagem de Turno</span>
        <span>
          gerado em {agora}
          {t.atualizado_por ? ` · última alteração: ${t.atualizado_por}` : ""}
        </span>
      </div>
    </div>
  );
});

export default FechamentoTurnoRelatorio;

// O FECHAMENTO DE TURNO como a planilha do plantão (a folha verde que ia no WhatsApp):
// é ESTE bloco que vira PNG e PDF. Estilo INLINE de propósito — o html2canvas fotografa o
// que está calculado na tela, e cor vinda de classe utilitária com variável (oklch do
// Tailwind 4) sai errada ou em branco na foto. Cores fixas, fundo branco, sem sombra.
import { forwardRef } from "react";
import { dataPorExtenso } from "./passagemTurno";

const VERDE = "#12908e";
const AMARELO = "#fff59a";
const VERMELHO = "#e02424";
const BORDA = "1px solid #7b8794";

const cel = { border: BORDA, padding: "3px 6px", fontSize: 13, lineHeight: 1.25 };
const faixa = (texto, extra = {}) => (
  <div
    style={{
      background: VERDE, color: "#fff", fontWeight: 700, fontSize: 17, textAlign: "center",
      padding: "4px 6px", borderLeft: BORDA, borderRight: BORDA, ...extra,
    }}
  >
    {texto}
  </div>
);

function LinhaNumero({ rotulo, valor, destaque, vermelho }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "36% 64%" }}>
      <div
        style={{
          ...cel, fontWeight: 700, background: destaque ? AMARELO : "#fff",
          color: vermelho ? VERMELHO : "#111", borderTop: 0,
        }}
      >
        {rotulo}
      </div>
      <div style={{ ...cel, borderTop: 0, borderLeft: 0, textAlign: "center", fontStyle: "italic", fontWeight: 700 }}>
        {valor ?? ""}
      </div>
    </div>
  );
}

function TabelaFaltas({ titulo, lado, faltas, minimo = 6 }) {
  const linhas = [...faltas];
  while (linhas.length < minimo) linhas.push(null);
  return (
    <div>
      {/* a faixa da esquerda cobre operador, chapa, linha e a coluna vertical (66%) */}
      <div style={{ display: "grid", gridTemplateColumns: "66% 34%" }}>
        {faixa(titulo, { fontSize: 16 })}
        {faixa("Substituição", { fontSize: 16, borderLeft: 0 })}
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
        <colgroup>
          <col style={{ width: "30%" }} />
          <col style={{ width: "13%" }} />
          <col style={{ width: "13%" }} />
          <col style={{ width: "10%" }} />
          <col style={{ width: "18%" }} />
          <col style={{ width: "16%" }} />
        </colgroup>
        <thead>
          <tr>
            {["Operador", "Chapa", "Linha"].map((t) => (
              <th key={t} style={{ ...cel, borderTop: 0, fontWeight: 700, textAlign: "center" }}>{t}</th>
            ))}
            {/* o topo da faixa vertical — o rótulo fica na primeira linha do corpo, que é
                onde o rowSpan pode descer (ele não atravessa de thead para tbody) */}
            <th style={{ border: BORDA, borderTop: 0, borderBottom: 0, background: VERDE }} />
            {["Operador", "Chapa/linha"].map((t) => (
              <th key={t} style={{ ...cel, borderTop: 0, fontWeight: 700, textAlign: "center" }}>{t}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((f, i) => (
            <tr key={f?.id || `v${i}`} style={{ height: 22 }}>
              <td style={{ ...cel, textAlign: "center", fontWeight: 700 }}>{f?.operador || ""}</td>
              <td style={{ ...cel, textAlign: "center", fontWeight: 700 }}>{f?.chapa || ""}</td>
              <td style={{ ...cel, textAlign: "center", fontWeight: 700 }}>{f?.linha || ""}</td>
              {i === 0 && (
                <td
                  rowSpan={linhas.length}
                  style={{
                    border: BORDA, borderTop: 0, background: VERDE, color: "#fff", fontWeight: 700, fontSize: 20,
                    verticalAlign: "middle", textAlign: "center", padding: 0,
                  }}
                >
                  <div style={{ transform: "rotate(-35deg)", whiteSpace: "nowrap" }}>{lado}</div>
                </td>
              )}
              <td style={{ ...cel, textAlign: "center" }}>{f?.substituto_nome || ""}</td>
              <td style={{ ...cel, textAlign: "center" }}>
                {[f?.substituto_chapa, f?.substituto_linha].filter(Boolean).join(" · ")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ListaIntercorrencias({ titulo, itens, extra, minimo = 8 }) {
  const linhas = itens.map((i) => [i.hora, i.veiculo && !String(i.texto).includes(i.veiculo) ? i.veiculo : "", i.texto]
    .filter(Boolean).join(" "));
  const extras = String(extra ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
  const vazias = Math.max(0, minimo - linhas.length - (extras.length ? extras.length + 1 : 0));
  return (
    <div>
      {faixa(titulo, { borderTop: BORDA })}
      {linhas.map((t, i) => (
        <div key={`i${i}`} style={{ ...cel, borderTop: 0, fontWeight: 700, whiteSpace: "pre-wrap" }}>{t}</div>
      ))}
      {Array.from({ length: vazias }).map((_, i) => (
        <div key={`v${i}`} style={{ ...cel, borderTop: 0, height: 20 }} />
      ))}
      {extras.length > 0 && (
        <>
          <div style={{ ...cel, borderTop: 0, height: 20 }} />
          {extras.map((t, i) => (
            <div key={`e${i}`} style={{ ...cel, borderTop: 0, fontWeight: 700 }}>{t}</div>
          ))}
        </>
      )}
    </div>
  );
}

const FechamentoTurnoRelatorio = forwardRef(function FechamentoTurnoRelatorio({ turno, faltas, intercorrencias }, ref) {
  const t = turno || {};
  const faltasManha = faltas.filter((f) => f.periodo === "MANHA");
  const faltasTarde = faltas.filter((f) => f.periodo === "TARDE");
  const substituicoes = faltas.filter((f) => f.substituto_chapa || f.substituto_nome).length;
  const interManha = intercorrencias.filter((i) => i.periodo === "MANHA");
  const interTarde = intercorrencias.filter((i) => i.periodo === "TARDE");
  const n = (v) => (v === null || v === undefined || v === "" ? "" : v);

  return (
    <div
      ref={ref}
      style={{
        width: 920, background: "#fff", color: "#111", fontFamily: "Arial, Helvetica, sans-serif",
        borderBottom: BORDA,
      }}
    >
      {faixa("FECHAMENTO DE TURNO", { fontSize: 20, borderTop: BORDA })}
      <div style={{ display: "grid", gridTemplateColumns: "36% 64%" }}>
        <div style={{ ...cel, fontSize: 18, fontWeight: 700 }}>
          Fechamento: {t.turno_inicio || "07:00"} às {t.turno_fim || "19:00"}
        </div>
        <div style={{ ...cel, borderLeft: 0, fontSize: 18, fontWeight: 700, textAlign: "center" }}>
          {dataPorExtenso(t.data_referencia)}
        </div>
      </div>

      {faixa("Manhã")}
      <LinhaNumero rotulo="Quantidade de carros programados" valor={n(t.carros_programados)} destaque />
      <LinhaNumero rotulo="GNS" valor={n(t.gns)} />
      <LinhaNumero rotulo="P.O programado" valor={n(t.po_programado)} destaque />
      <LinhaNumero rotulo="Faixa amarela" valor={n(t.faixa_amarela)} destaque />
      <LinhaNumero rotulo="Faltas manhã" valor={faltasManha.length || ""} />
      <LinhaNumero rotulo="Reservas manhã" valor={n(t.reservas_manha)} />

      {faixa("Tarde")}
      <LinhaNumero rotulo="Faltas tarde" valor={faltasTarde.length || ""} />
      <LinhaNumero rotulo="Reservas tarde" valor={n(t.reservas_tarde)} />
      <LinhaNumero rotulo="Substituição" valor={substituicoes || ""} />

      {faixa("Outros")}
      <LinhaNumero rotulo="SOS" valor={n(t.sos)} vermelho />
      <LinhaNumero rotulo="Troca" valor={n(t.troca)} vermelho />
      <LinhaNumero rotulo="Avaria" valor={n(t.avaria)} vermelho />
      <LinhaNumero rotulo="Assalto" valor={n(t.assalto)} vermelho />

      <TabelaFaltas titulo="Faltas Manhã" lado="Manhã" faltas={faltasManha} />
      <TabelaFaltas titulo="Faltas Tarde" lado="Tarde" faltas={faltasTarde} />

      <ListaIntercorrencias titulo="Intercorrências da Manhã" itens={interManha} extra={t.malotes ? `Malotes\n${t.malotes}` : ""} />
      <ListaIntercorrencias titulo="Intercorrências da Tarde" itens={interTarde} extra={t.observacoes} />
    </div>
  );
});

export default FechamentoTurnoRelatorio;

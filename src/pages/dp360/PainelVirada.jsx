import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { dispararRoboDP360, inserirDP360 } from "../../services/dp360Api";
import { acompanharLote } from "./loteEmExecucao";
import { usePergunta } from "./Perguntar";
import { Pilula, cra8, fmtData } from "./CartaoDoDia";
import { casoParaORobo, problemaDoCartao } from "./diaNoTransnet";

/* =============================================================================
   🌙 MOVER SAÍDA — a saída gravada no dia seguinte volta para o dia certo (18/09/2026).

   O dono: "ele jogou o ponto final do dia 14/09 para o início do dia 15/09 — nesses casos
   precisamos ajustar os dois: tirar o do dia 15 e colocar no dia 14. Vamos fazer um bot
   novo, com a mesma regra, só para esses casos" — e "isso tem que aparecer na Revisão".

   Quem acha o caso é `casoDaVirada` (diaNoTransnet.js); quem executa é o robô `virada`
   (DP360 bot_virada.py). Este painel é o meio: mostra os DOIS dias de cada pessoa, hoje e
   como vão ficar, deixa o DP acertar qualquer horário e dispara. Lá, o robô confere que o
   Transnet ainda está como aqui, limpa o dia seguinte e só então lança o dia certo.

   O resultado chega do mesmo jeito que o do "✅ Lançar ajuste": o quadro do robô acompanha
   cada dia pelas fotos, e no fim o log vira uma linha em `ponto_importacoes` (passo 2) por
   dia — é ela que pinta AJUSTADO na grade dos DOIS dias.
   ============================================================================= */

const ddmm = (iso) => fmtData(iso).slice(0, 5);
const CAMPOS = ["entrada", "saída almoço", "volta almoço", "saída"];
const NOMES_NA_CONFIRMACAO = 8;

function CampoHora({ valor, aoMudar, rotulo, desabilitado }) {
  return (
    <input
      type="text"
      className="dp-mono dp-num"
      value={valor}
      placeholder="—"
      disabled={desabilitado}
      onChange={(e) => aoMudar(e.target.value.replace(/[^\d:]/g, "").slice(0, 5))}
      title={`${rotulo}. Depois da meia-noite use a notação 24+ (24:58 = 00:58 do dia seguinte).`}
      style={{
        width: 58,
        textAlign: "center",
        padding: "3px 4px",
        border: "1px solid var(--dp-border)",
        borderRadius: 6,
        background: desabilitado ? "var(--dp-surface-2)" : "var(--dp-surface)",
        color: "inherit",
      }}
    />
  );
}

export default function PainelVirada({ pares, aoFechar, aoConcluir }) {
  const [perguntar, caixaPergunta] = usePergunta();
  const [disparando, setDisparando] = useState(false);
  const [recado, setRecado] = useState(null);

  // o que o DP vê e pode acertar: os 4 campos de cada dia, por par
  const [cartoes, setCartoes] = useState(() => {
    const m = {};
    for (const p of pares)
      m[p.chave] = { dia: [...p.caso.dia.slots], seguinte: p.caso.seguinte.slots ? [...p.caso.seguinte.slots] : null };
    return m;
  });
  const avaliar = (p) => {
    const c = cartoes[p.chave];
    const probDia = problemaDoCartao(c.dia);
    const probSeg = p.caso.seguinte.acao === "relancar" ? problemaDoCartao(c.seguinte) : "";
    return { probDia, probSeg, pode: !p.caso.bloqueio && !probDia && !probSeg };
  };
  // entra marcado quem está pronto sem ninguém mexer; o resto o DP confere e marca
  const [incluidos, setIncluidos] = useState(
    () => new Set(pares.filter((p) => !p.caso.bloqueio && p.caso.dia.completo && p.caso.seguinte.completo).map((p) => p.chave)),
  );
  const lote = useMemo(() => pares.filter((p) => incluidos.has(p.chave) && avaliar(p).pode), [pares, incluidos, cartoes]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const escapa = (e) => {
      if (e.key === "Escape" && !disparando) aoFechar();
    };
    document.addEventListener("keydown", escapa);
    return () => document.removeEventListener("keydown", escapa);
  }, [aoFechar, disparando]);

  const mudar = (chave, qual, i, valor) =>
    setCartoes((m) => {
      const novo = { ...m, [chave]: { ...m[chave], [qual]: [...m[chave][qual]] } };
      novo[chave][qual][i] = valor;
      return novo;
    });
  const alternar = (chave) =>
    setIncluidos((s) => {
      const n = new Set(s);
      if (n.has(chave)) n.delete(chave);
      else n.add(chave);
      return n;
    });

  const cartaoTexto = (slots) => (slots || []).map((h) => h || "—").join(" · ");

  const mover = async (confirmar) => {
    if (!lote.length) return;
    const linhasNomes = lote
      .slice(0, NOMES_NA_CONFIRMACAO)
      .map((p) => {
        const c = cartoes[p.chave];
        const seg =
          p.caso.seguinte.acao === "nenhuma"
            ? `${ddmm(p.caso.isoSeguinte)}: já limpo`
            : p.caso.seguinte.acao === "excluir"
              ? `${ddmm(p.caso.isoSeguinte)}: apagar o registro (${p.caso.sobra.join(" · ")})`
              : `${ddmm(p.caso.isoSeguinte)}: ${cartaoTexto(c.seguinte)}`;
        return `· ${p.nome || p.cracha} (${p.cracha}) — ${seg} → ${ddmm(p.caso.isoDia)}: ${cartaoTexto(c.dia)}`;
      })
      .join("\n");
    const resto = lote.length > NOMES_NA_CONFIRMACAO ? `\n· … e mais ${lote.length - NOMES_NA_CONFIRMACAO}` : "";
    const cabeca = confirmar
      ? `MOVER DE VERDADE no Transnet a saída de ${lote.length} pessoa(s):`
      : `TESTE (o robô confere, abre as telas e preenche, e NÃO clica em Excluir nem em Inserir) — ${lote.length} pessoa(s):`;
    if (
      !(await perguntar(
        `${cabeca}\n\n${linhasNomes}${resto}\n\n` +
          `Para cada pessoa o robô 1. confere que os dois dias no Transnet estão como nesta tela (se não estiverem, para sem mexer); ` +
          `2. limpa o dia seguinte — apaga o registro quando ele era só a sobra, ou grava o cartão dele sem ela; ` +
          `3. só então grava o dia certo com a saída depois da meia-noite.\n\n` +
          `Quem executa é o robô, no GitHub Actions. O disparo fica registrado com o seu nome.`,
      ))
    )
      return;

    const casos = lote.map((p) =>
      casoParaORobo({
        cracha: p.cracha,
        nome: p.nome,
        caso: p.caso,
        slotsDia: cartoes[p.chave].dia,
        slotsSeguinte: cartoes[p.chave].seguinte,
      }),
    );
    // o que vai para `ponto_importacoes`, um por dia
    const registroDoDia = (p, qual, status, extra = {}) => {
      const iso = qual === "dia" ? p.caso.isoDia : p.caso.isoSeguinte;
      const apaga = qual === "seguinte" && p.caso.seguinte.acao === "excluir";
      const [e, as, av, s] = apaga ? ["", "", "", ""] : cartoes[p.chave][qual];
      return {
        cracha: p.cracha,
        nome: p.nome,
        date_ref: iso,
        passo: 2,
        entrada: e,
        saida_almoco: as,
        volta_almoco: av,
        saida: s,
        fonte: apaga ? "virada: registro da sobra apagado" : "virada: saída gravada no dia seguinte",
        arquivo: "robô virada.yml",
        status,
        ...extra,
      };
    };

    setDisparando(true);
    setRecado(null);
    try {
      const resposta = await dispararRoboDP360("virada", {
        casos: JSON.stringify(casos),
        confirmar: confirmar ? "true" : "false",
      });

      let aviso = "";
      if (confirmar) {
        try {
          await inserirDP360(
            "ponto_importacoes",
            lote.flatMap((p) =>
              p.caso.seguinte.acao === "nenhuma"
                ? [registroDoDia(p, "dia", "disparado")]
                : [registroDoDia(p, "seguinte", "disparado"), registroDoDia(p, "dia", "disparado")],
            ),
          );
        } catch {
          aviso = " (não foi possível registrar o histórico em ponto_importacoes)";
        }
      }
      setRecado({
        tipo: aviso ? "erro" : "ok",
        texto: `${confirmar ? "Robô disparado" : "Teste disparado"} — ${lote.length} pessoa(s).${aviso}`,
        painel: resposta?.painel || "",
      });

      // o quadro acompanha os DOIS dias de cada pessoa, na ordem em que o robô mexe neles
      const chaveDe = (p, qual) => `${cra8(p.cracha)}|${qual === "dia" ? p.caso.isoDia : p.caso.isoSeguinte}`;
      const enviados = lote;
      acompanharLote({
        runId: resposta?.execucao?.run_id || null,
        painel: resposta?.painel || "",
        robo: "virada",
        tipo: "corrigir",
        ensaio: !confirmar,
        aba: "revisao",
        titulo: confirmar ? "🌙 Movendo a saída para o dia certo" : "🤖 Teste do robô da virada",
        casos: enviados.flatMap((p) =>
          (p.caso.seguinte.acao === "nenhuma" ? ["dia"] : ["seguinte", "dia"]).map((qual) => {
            const iso = qual === "dia" ? p.caso.isoDia : p.caso.isoSeguinte;
            return { chave: chaveDe(p, qual), cracha: p.cracha, date_ref: iso, nome: p.nome || p.cracha, dataBR: fmtData(iso) };
          }),
        ),
        aoTerminar: async (_fim, conta) => {
          if (confirmar && conta?.porCaso) {
            const statusDe = (r) =>
              !r
                ? ""
                : r.estado === "corrigido"
                  ? "lancado"
                  : r.estado === "ponto_fechado"
                    ? "fechado"
                    : String(r.motivo || r.texto || "").trim()
                      ? `falhou: ${String(r.motivo || r.texto).trim()}`.slice(0, 200)
                      : "";
            const resultados = [];
            for (const p of enviados) {
              const jaLimpo = p.caso.seguinte.acao === "nenhuma";
              const rSeg = jaLimpo ? null : conta.porCaso.get(chaveDe(p, "seguinte"));
              const rDia = conta.porCaso.get(chaveDe(p, "dia"));
              const stSeg = statusDe(rSeg);
              let stDia = statusDe(rDia);
              // O PIOR CASO TEM NOME: o dia seguinte já foi limpo e o dia certo não entrou.
              // A sobra não está mais em lugar nenhum do Transnet — o DP precisa lançar à mão.
              if (stSeg === "lancado" && stDia !== "lancado")
                stDia = `falhou: o ${ddmm(p.caso.isoSeguinte)} já foi limpo — lance à mão em ${ddmm(p.caso.isoDia)}: ${cartaoTexto(
                  cartoes[p.chave].dia,
                )}${stDia ? ` (${stDia.replace(/^falhou:\s*/, "")})` : ""}`.slice(0, 240);
              if (stSeg) resultados.push(registroDoDia(p, "seguinte", stSeg, { arquivo: "robô virada.yml · resultado do log" }));
              if (stDia) resultados.push(registroDoDia(p, "dia", stDia, { arquivo: "robô virada.yml · resultado do log" }));
            }
            try {
              if (resultados.length) await inserirDP360("ponto_importacoes", resultados);
            } catch {
              // o quadro já mostrou o resultado; o histórico só não ficou gravado
            }
          }
          if (aoConcluir) aoConcluir();
        },
      });
      if (confirmar && aoConcluir) aoConcluir();
      if (!aviso) aoFechar();
    } catch (falha) {
      // o erro do SERVIDOR, sem tradução: é ele que diz se o robô não está liberado
      setRecado({ tipo: "erro", texto: falha?.message || "Não foi possível disparar o robô." });
    } finally {
      setDisparando(false);
    }
  };

  return (
    <div className="rv-overlay" role="dialog" aria-modal="true">
      {caixaPergunta}
      <div className="dp-card rv-box" style={{ padding: 0, maxWidth: 1080 }}>
        <header
          className="flex items-start justify-between gap-3"
          style={{ padding: "14px 18px", borderBottom: "1px solid var(--dp-border)" }}
        >
          <div style={{ minWidth: 0 }}>
            <b style={{ fontSize: 14 }}>🌙 Mover saída — a saída ficou gravada no dia seguinte</b>
            <div className="dp-muted" style={{ fontSize: 11.5, marginTop: 2 }}>
              Quem sai depois da meia-noite e bate a saída já com o dia virado fica com ela no <b>dia seguinte</b>. O
              robô <code>bot_virada.py</code> confere os dois dias no Transnet, <b>limpa o dia seguinte</b> e só então{" "}
              <b>grava a saída no dia certo</b> — nessa ordem, porque o Transnet recusa o dia certo enquanto a batida
              estiver no outro. Se o Transnet não estiver como abaixo, ele para sem mexer.
            </div>
          </div>
          <button type="button" className="dp-det-x" onClick={aoFechar} aria-label="Fechar">
            <X size={16} />
          </button>
        </header>

        <div className="rv-corpo" style={{ padding: "14px 18px", display: "grid", gap: 12 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span className="dp-pill accent">{lote.length} para o robô</span>
            {pares.length - lote.length > 0 && (
              <span className="dp-pill warn">{pares.length - lote.length} fora (desmarcados ou para conferir)</span>
            )}
          </div>

          {pares.map((p) => {
            const c = cartoes[p.chave];
            const { probDia, probSeg, pode } = avaliar(p);
            const marcado = incluidos.has(p.chave);
            const apaga = p.caso.seguinte.acao === "excluir";
            return (
              <div
                key={p.chave}
                className="dp-card"
                style={{ padding: "10px 12px", opacity: p.caso.bloqueio ? 0.75 : 1 }}
              >
                <label className="flex flex-wrap items-center gap-2" style={{ cursor: p.caso.bloqueio ? "default" : "pointer" }}>
                  <input
                    type="checkbox"
                    checked={marcado && pode}
                    disabled={!pode}
                    onChange={() => alternar(p.chave)}
                  />
                  <b>{p.nome || "—"}</b>
                  <span className="dp-mono dp-num dp-muted">{p.cracha}</span>
                  <span className="dp-muted" style={{ fontSize: 12 }}>
                    — a saída de <b>{ddmm(p.caso.isoDia)}</b> ficou em <b>{ddmm(p.caso.isoSeguinte)}</b>:{" "}
                    <span className="dp-mono">{p.caso.sobra.join(" · ")}</span>
                  </span>
                </label>
                {p.caso.bloqueio && (
                  <div style={{ marginTop: 6 }}>
                    <Pilula texto="não vai para o robô" tom="danger" /> <span className="dp-muted">{p.caso.bloqueio}</span>
                  </div>
                )}
                <table className="rv-tabela" style={{ marginTop: 8 }}>
                  <thead>
                    <tr>
                      <th>Dia</th>
                      <th>Hoje no Transnet</th>
                      <th>Como vai ficar (E · SA · VA · S)</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        <b>{ddmm(p.caso.isoSeguinte)}</b> <span className="dp-muted">dia seguinte</span>
                      </td>
                      <td className="dp-mono dp-num dp-faint">{p.caso.antesSeguinte.join(" · ") || "—"}</td>
                      <td>
                        {p.caso.seguinte.acao === "nenhuma" ? (
                          <span>
                            <b>nada a fazer</b> <span className="dp-muted">— a sobra já saiu</span>
                          </span>
                        ) : apaga ? (
                          <span>
                            <b>apagar o registro</b> <span className="dp-muted">— só tinha a sobra</span>
                          </span>
                        ) : (
                          <span className="flex flex-wrap gap-1">
                            {CAMPOS.map((rot, i) => (
                              <CampoHora
                                key={rot}
                                rotulo={rot}
                                valor={c.seguinte[i]}
                                desabilitado={!!p.caso.bloqueio}
                                aoMudar={(v) => mudar(p.chave, "seguinte", i, v)}
                              />
                            ))}
                          </span>
                        )}
                      </td>
                      <td className="dp-muted" style={{ fontSize: 11.5 }}>
                        {probSeg ? <Pilula texto={probSeg} tom="danger" /> : p.caso.seguinte.nota}
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <b>{ddmm(p.caso.isoDia)}</b> <span className="dp-muted">dia certo</span>
                      </td>
                      <td className="dp-mono dp-num dp-faint">{p.caso.antesDia.join(" · ") || "—"}</td>
                      <td>
                        <span className="flex flex-wrap gap-1">
                          {CAMPOS.map((rot, i) => (
                            <CampoHora
                              key={rot}
                              rotulo={rot}
                              valor={c.dia[i]}
                              desabilitado={!!p.caso.bloqueio}
                              aoMudar={(v) => mudar(p.chave, "dia", i, v)}
                            />
                          ))}
                        </span>
                      </td>
                      <td className="dp-muted" style={{ fontSize: 11.5 }}>
                        {probDia ? <Pilula texto={probDia} tom="danger" /> : p.caso.dia.nota}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>

        <footer
          className="flex flex-wrap items-center justify-between gap-3"
          style={{
            padding: "12px 18px",
            borderTop: "1px solid var(--dp-border)",
            background: "var(--dp-surface-2)",
            borderRadius: "0 0 var(--dp-radius) var(--dp-radius)",
          }}
        >
          <div className="dp-det-bot-linha" style={{ minWidth: 0 }}>
            {disparando && <span className="dp-pill accent">disparando…</span>}
            {recado && (
              <>
                <span className={`dp-pill ${recado.tipo === "ok" ? "ok" : "danger"}`}>{recado.texto}</span>
                {recado.painel && (
                  <>
                    {" "}
                    <a className="dp-btn" href={recado.painel} target="_blank" rel="noreferrer">
                      ver o robô rodando
                    </a>
                  </>
                )}
              </>
            )}
          </div>
          <div className="dp-det-bot-acoes">
            {/* sem Testar (dono, 18/09/2026: "tira o bot ensaio") — o mesmo dos outros lotes */}
            <button
              type="button"
              className="dp-btn"
              style={{ color: "var(--dp-danger-ink)" }}
              disabled={disparando || !lote.length}
              onClick={() => mover(true)}
              title="Limpa o dia seguinte e grava a saída no dia certo, no Transnet."
            >
              ⚠ Mover de verdade ({lote.length})
            </button>
            <button type="button" className="dp-btn" onClick={aoFechar} disabled={disparando}>
              Fechar
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

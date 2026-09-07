import { useCallback, useEffect, useMemo, useState } from "react";
import { Lock, MapPin, RefreshCw, X } from "lucide-react";
import AbaShell from "./AbaShell";
import TabelaDP from "../TabelaDP";
// O POP-UP DO DIA NAO MORA MAIS AQUI. Ele e o `CartaoDoDia`, compartilhado com a
// Gordura (pedido do dono, 06/09: "na verdade e o mesmo pop-up de analise do da
// Revisao"). Junto dele foram os helpers que as DUAS telas usam - formatacao,
// `sugBloqueio`, o overlay do Real manual, a regua de GPS e a leitura da reserva
// lancada no INOVE -, para existirem UMA vez so. Aqui ficou o que e da GRADE.
import CartaoDoDia, {
  BotaoPontoConferido,
  BotaoSemAlvo,
  ESTILO_INPUT,
  Pilula,
  agoraUtc,
  aplicarRealManual,
  calcularGps,
  chaveDia,
  cra8,
  ehPontoInvertido,
  ehVerdadeiro,
  fmtData,
  fmtDataHora,
  fmtDist,
  fmtHora,
  fmtMin,
  lerReservasInove,
  marcacaoAusente,
  pontoConferido,
  quemEstaUsando,
  sugBloqueio,
  temSugestaoUtil,
} from "../CartaoDoDia";
import {
  dispararRoboDP360,
  inserirDP360,
  lerDP360,
  lerTudoDP360,
  upsertDP360,
} from "../../../services/dp360Api";
import { RAIO_LOCAL, RAIO_VEIC } from "../regrasGps";
import { COLUNAS_INDICE_DATAS, datasComPonto } from "../regrasDia";
import {
  MOTIVO_AVISO,
  TIPO,
  chaveTemplate,
  contratoDaRevisao,
  escolherTemplate,
  marcarReavisos,
  medianasJornada,
  mensagemBateuFora,
  mensagemInterno,
  mensagemRevisaoMotorista,
  prepararComunicado,
  rotaAvisoInterno,
  variaveisPendentes,
} from "../comunicadoTransnet";
import { CONSTANTES, hm2min, min2hm } from "../regrasPonto";

/* =============================================================================
   Revisão (Passo 2) — porte da tela do DP360 (Sistemas/PONTO: app/ui/app.js
   `viewP2`/`COLS_REV`/`p2RowClass`/`fmtCol`/`pontoDetalhe`).

   O QUE ESTA TELA GRAVA (liberado pelo dono):
     · Real manual do DP  -> `ponto_real_manual` (upsert; tudo vazio APAGA a linha,
       igual a main.py `salvar_real_manual` ~392). São DOIS caminhos, com a mesma
       regra: a célula SUG editável da grade (`gravarCampoSug`, campo a campo) e o
       bloco "4 · Real manual do DP" do cartão compartilhado;
     · Ponto conferido    -> `ponto_caso` com tipo='ponto_ok' (upsert), e o desfazer
       grava tipo='' / aceite='pendente' (main.py `marcar_ponto_ok` ~415). O botão é
       o `BotaoPontoConferido`, que esta tela pendura no rodapé do cartão.
     · Aviso ao trabalhador -> CSV do comunicado disparado no robô do Transnet
       (`dispararRoboDP360("comunicado", …)`) e, quando o envio é o de verdade,
       `ponto_caso` com o alvo CONGELADO. O formato do CSV, os barrados, os casos
       e os reavisos moram em `../comunicadoTransnet` (porte de main.py
       `_escrever_comunicados` ~2340 e `enviar_aviso_interno` ~2646), porque a
       Gordura manda o MESMO arquivo pelo MESMO robô.
     · Ajuste em lote      -> CSV do `bot_ponto.py --lote` disparado no robô do
       Transnet (`dispararRoboDP360("ponto", …)`), que REESCREVE o cartão do dia
       com o alvo que a view já resolveu, e `ponto_importacoes` (passo 2) como
       histórico por pessoa. Porte de main.py `lancar_bot_p2`/`_fila_correcoes`
       (~2820/~2786). É o MESMO robô e o MESMO formato de arquivo da Refeição
       (passo 1) — ver `abas/Refeicao.jsx`.

   O AVISO SAI DAQUI, MAS QUEM DIRIGE O TRANSNET É O ROBÔ. O navegador não fala
   com o Transnet: o Selenium (`bot_comunicado.py`) roda no GitHub Actions do repo
   DP360, onde a credencial já é secret. Esta tela DECIDE e dispara; e são sempre
   DOIS BOTÕES — Ensaio (o robô anexa o arquivo e não confirma) e Enviar de verdade
   —, nunca um checkbox "confirmar", que marcado por engano manda comunicado real
   para a ficha de alguém.

   A REGRA DE NEGÓCIO NÃO MORA AQUI. `status_ponto`, `motivo`, `acao_sugerida`,
   `alvo_*`, `*_sug`, `almoco_*`, `pede_entrada/pede_saida`, `requer_alvo_manual`,
   `fonte_alvo` e `alvo_confiavel` já vêm calculados pela view do Athena
   (importador_supabase/sql_catalogo/3_vw_ponto_revisao_motorista.sql) e chegam
   prontos na `ponto_diario`. Esta tela só EXIBE.

   As contas de HORÁRIO são do MOTOR (`../regrasPonto`), porte validado 1:1 contra
   o Python (2.240 execuções, veredito idêntico). Nada de aritmética de relógio
   escrita à mão aqui: o que a GRADE ainda usa é `hm2min`/`min2hm` (parse/formata,
   inclusive 25:40, na célula SUG editável); o resto do motor — `jornadaEntreMin`,
   `difRelogio`, `almocoDaRefeicao`, `almocoMatriz`, `removeFantasmas`,
   `bloqueioSimulacao` — é consumido pelo `../CartaoDoDia`, que é quem exibe o dia.
   O único cálculo local é o de GPS ("bateu fora"), que mora em `../regrasGps` e
   entra por `calcularGps` (também do cartão, para as duas telas medirem igual).
   ========================================================================== */

/* O CARTAO DO DIA (fontes, sugestao, Real, Real manual, almoco, GPS, mapa, linha
   do tempo e as viagens do Citatti) e o `../CartaoDoDia`, o MESMO que a Gordura
   abre. O que e desta tela entra por prop: `BotaoPontoConferido` no rodape
   (`acoesRodape`), a frase do rodape (`rodapeInfo`), o GPS ja calculado do dia
   inteiro (`gps`) e a previa da mensagem (`previaAviso`). */

/* ---------- constantes: vem do MOTOR, nao sao redigitadas aqui ---------- */
const {
  TOL_ENTRADA_MIN, // 10 - minutos ANTES do inicio da operacao (main.py:117)
  TOL_SAIDA_MIN, // 8  - minutos DEPOIS do fim da operacao (main.py:118)
} = CONSTANTES;

const CATEGORIAS_PADRAO = ["MOTORISTA", "INTERNO", "APRENDIZ"];
const PAGINAS_POR_LOTE = 6; // 6 x 1000 linhas de ponto_diario ~ 15 dias de datas

// Quantos nomes a confirmacao lista antes de resumir o resto. A pessoa precisa
// reconhecer QUEM vai receber; uma lista de 80 linhas num window.confirm nao e lida.
const NOMES_NA_CONFIRMACAO = 8;

// Cor da linha (porte de app.js `p2RowClass`, na mesma ordem de precedência):
// row-ok verde OK · row-sug âmbar ponto invertido · row-msg azul falta marcação
// identificada · row-sug âmbar sugestão utilizável · row-sem vermelho sem
// sugestão e sem ponta identificada. As classes são as da ferramenta original.
function classeLinha(r, bloqueio) {
  if (String(r.status_ponto ?? "").toUpperCase() === "OK") return "row-ok";
  if (ehPontoInvertido(r)) return "row-sug";
  if (marcacaoAusente(r)) return "row-msg";
  if (temSugestaoUtil(r, bloqueio)) return "row-sug";
  return "row-sem";
}

// Quadradinho da legenda de cores da linha.
const ESTILO_LEGENDA = { width: 12, height: 12, borderRadius: 3, display: "inline-block" };

// Coluna "Avisado?" — porte de app.js `fmtCol("rv_enviado")`. O aviso da Revisão
// já era gravado em ponto_caso, mas a tela antiga nunca mostrou: não dava pra
// saber se o colaborador já tinha recebido a mensagem.
// O ESTADO é calculado fora do componente porque a grade precisa dele DUAS vezes:
// como pílula (`render`) e como texto ordenável/exportável (`valor` da coluna).
function estadoAviso(caso) {
  const enviado = String(caso?.aviso_enviado_em ?? "").trim();
  if (!enviado) return { texto: "não", tom: "mute", titulo: "Nenhum aviso registrado para este dia" };
  const quando = fmtData(enviado.slice(0, 10));
  if (String(caso.correcao_final_em ?? "").trim())
    return { texto: "🔧 corrigido", tom: "ok", titulo: `Aviso em ${quando} — ponto já corrigido` };
  if (String(caso.advertencia_enviada_em ?? "").trim())
    return { texto: "⚠ advertido", tom: "danger", titulo: `Aviso em ${quando} — depois virou advertência` };
  if (String(caso.aceite ?? "").trim() === "aceito")
    return { texto: "✓ resolvido", tom: "ok", titulo: `Aviso em ${quando} — ele ajustou e você aceitou` };
  const visto = String(caso.aviso_conferido_em ?? "").trim();
  if (visto)
    return {
      texto: `👁 leu · ${quando}`,
      tom: "mute",
      titulo: `Enviado em ${quando} · aberto no app em ${fmtData(visto.slice(0, 10))}`,
    };
  return { texto: `📤 ${quando}`, tom: "warn", titulo: `Enviado em ${quando} — ainda não abriu no app` };
}

function Avisado({ caso }) {
  const { texto, tom, titulo } = estadoAviso(caso);
  return <Pilula texto={texto} tom={tom} titulo={titulo} />;
}

// Versão TEXTO do mesmo veredito, para ordenar e exportar a coluna 📍 (a grade ordena
// pelo `valor`, nunca pelo JSX). Os três baldes começam com letras que já ordenam do
// pior pro melhor em pt-BR: fora < junto < não medido.
function textoGps(gps) {
  if (!gps || !gps.total) return "";
  const nm = gps.naoMedido ? ` · n/m ${gps.naoMedido}` : "";
  if (gps.fora) return `fora ${gps.fora}/${gps.total} · ${fmtDist(gps.maiorDistancia)}${nm}`;
  if (!gps.junto) return `não medido (${gps.total})`;
  return `junto ${gps.junto}/${gps.total}${nm}`;
}

// TRÊS estados, nunca dois. "Não medido" (âncora do veículo sem coordenada)
// tem balde próprio: contá-lo como "junto" é o falso 'junto' que contamina a
// régua e a sugestão (main.py:274-276, bug ALENCAR/Ciganos).
function LocalGps({ gps }) {
  if (!gps || !gps.total) return <span className="dp-faint">—</span>;

  const nm = gps.naoMedido || 0;
  const dicaNm = nm
    ? ` ${nm} batida(s) não medida(s) — âncora do veículo sem coordenada (terminal que a régua não sabe localizar).`
    : "";
  const selo = nm ? (
    <>
      {" "}
      <span className="dp-pill mute" title={`${nm} batida(s) não medida(s) — âncora do veículo sem coordenada.`}>
        n/m {nm}
      </span>
    </>
  ) : null;

  if (gps.fora)
    return (
      <>
        <span
          className="dp-pill danger dp-num"
          title={`${gps.fora} de ${gps.total} batida(s) FORA. A mais longe: ${fmtDist(gps.maiorDistancia)}${gps.horaMaisLonge ? ` às ${gps.horaMaisLonge}` : ""}.${dicaNm}`}
        >
          📍 {gps.fora}/{gps.total} fora · {fmtDist(gps.maiorDistancia)}
        </span>
        {selo}
      </>
    );

  // Nada fora, mas nada medido: não dá para dizer "junto".
  if (!gps.junto)
    return (
      <span
        className="dp-pill mute dp-num"
        title={`Nenhuma das ${gps.total} batida(s) pôde ser medida — a âncora do veículo veio sem coordenada. Não é "junto": é sem informação.`}
      >
        n/m ({gps.total})
      </span>
    );

  return (
    <>
      <span
        className="dp-pill ok dp-num"
        title={`${gps.junto} de ${gps.total} batida(s) junto da referência operacional (≤ ${RAIO_VEIC} m do veículo, ou ≤ ${RAIO_LOCAL} m do local conhecido).${dicaNm}`}
      >
        ✓ junto ({gps.junto})
      </span>
      {selo}
    </>
  );
}

// Coluna Motivo com os dois tratamentos especiais do app antigo.
function Motivo({ linha }) {
  const motivo = String(linha.motivo ?? "").trim();
  const status = String(linha.status_ponto ?? "").toUpperCase();
  const batidas = parseInt(linha.qtd_batidas, 10) || 0;
  if (status !== "OK" && batidas === 0 && /JORNADA_INCOMPLETA/i.test(motivo))
    return (
      <span
        className="dp-pill danger"
        title="Há operação apurada no dia, mas nenhuma batida no cartão. O ponto tem de ser criado pela operação."
      >
        OPEROU SEM PONTO · criar pela operação
      </span>
    );
  if (ehPontoInvertido(linha))
    return (
      <span
        className="dp-pill warn"
        title="Cartão rotacionado: defeito de posição das batidas. Exige decisão manual do DP — não gera comunicado ao colaborador."
      >
        {motivo || "PONTO_INVERTIDO"}
      </span>
    );
  if (!motivo) return <span className="dp-faint">—</span>;
  return <span title={motivo}>{motivo.split(" (")[0]}</span>;
}

/* ═══════════════════════════ O COMUNICADO AO TRABALHADOR ═══════════════════════════
   Porte de app.js `comunicadoModal` + do padrão de disparo já pronto em `Folgas.jsx`.

   As regras (formato do CSV, quem é barrado, que caso abre) NÃO moram aqui: são de
   `../comunicadoTransnet`, porque a Gordura manda o MESMO arquivo pelo MESMO robô.
   Este componente é a TELA: mostra a prévia, mostra quem recebe, mostra QUEM FICOU DE
   FORA e por quê, e oferece os dois botões.

   DOIS BOTÕES, NUNCA UM CHECKBOX. "Confirmar" marcado por engano vira comunicado real
   na ficha de alguém e, 48 h depois, advertência. Ensaio: o robô anexa o arquivo no
   Envio via CSV e NÃO confirma — e ENSAIO NÃO ABRE CASO (main.py:2440: enquanto abria,
   o prazo passava a correr por causa de um teste, sem nenhuma mensagem ter saído).   */

function ListaPessoas({ itens, limite = 12 }) {
  const mostrados = itens.slice(0, limite);
  return (
    <ul style={{ margin: "6px 0 0", padding: 0, listStyle: "none", fontSize: 12 }}>
      {mostrados.map((i) => (
        <li key={`${i.cracha}|${i.data}`} className="dp-muted">
          · <b style={{ color: "var(--dp-ink)" }}>{i.nome || "—"}</b>{" "}
          <span className="dp-num">{i.cracha}</span>
          {i.motivo ? ` — ${i.motivo}` : ""}
        </li>
      ))}
      {itens.length > mostrados.length && (
        <li className="dp-faint">+ {itens.length - mostrados.length} outro(s)</li>
      )}
    </ul>
  );
}

function ModalComunicado({
  titulo,
  ajuda,
  rota, // TIPO.REVMOT | TIPO.FORA | TIPO.INTERNO
  linhas, // alvo já escolhido pela aba
  chavesTemplate, // quais modelos ler do app_config
  templateEditavel, // qual deles a caixa de texto edita (null = nenhum)
  mensagemDe, // (linha, templates) => texto renderizado
  alvoDe, // (linha) => { contrato, erro } — só revmot
  casoTipoDe, // (linha) => "almoco"|"incompleto"|"curta" — só interno
  congelarReaviso = true,
  comPontoAntes = false,
  casoDe, // (cracha, date_ref) => caso já gravado
  nota, // texto extra da aba (ex.: os pulados do interno)
  aoFechar,
  aoConcluir,
}) {
  const [templates, setTemplates] = useState(null);
  const [erro, setErro] = useState("");
  const [disparando, setDisparando] = useState(false);
  const [recado, setRecado] = useState(null);

  // Os modelos vivem no `app_config` — a MESMA chave que a ferramenta antiga lê na hora
  // do envio (aba Config). Vazio cai no texto oficial (Quataí + Art. 74 da CLT).
  useEffect(() => {
    let ativo = true;
    const chaves = chavesTemplate.map(chaveTemplate);
    lerDP360("app_config", { filtros: { chave: `in.(${chaves.join(",")})` } })
      .then((linhasCfg) => {
        if (!ativo) return;
        // `app_config.valor` é jsonb e a ferramenta grava STRING; `escolherTemplate`
        // aceita o que vier e cai no texto oficial quando está vazio.
        const salvos = {};
        for (const l of linhasCfg || []) salvos[l.chave] = l.valor;
        const out = {};
        for (const tipo of chavesTemplate) out[tipo] = escolherTemplate(salvos[chaveTemplate(tipo)], tipo);
        setTemplates(out);
      })
      .catch((falha) => {
        if (!ativo) return;
        // Sem o app_config o envio não fica travado: cai no texto oficial e a tela avisa.
        const out = {};
        for (const tipo of chavesTemplate) out[tipo] = escolherTemplate("", tipo);
        setTemplates(out);
        setErro(`Não foi possível ler os modelos salvos (${falha.message || falha}). Usando o texto padrão.`);
      });
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chavesTemplate.join(",")]);

  useEffect(() => {
    const escapa = (e) => {
      if (e.key === "Escape" && !disparando) aoFechar();
    };
    document.addEventListener("keydown", escapa);
    return () => document.removeEventListener("keydown", escapa);
  }, [aoFechar, disparando]);

  // O carimbo do caso é o INSTANTE do envio, então o preparo é refeito no clique. Este
  // aqui é só o da tela (prévia, contagem, barrados, CSV que a pessoa vê).
  const montar = useCallback(
    (agora) =>
      prepararComunicado({
        tipo: rota,
        linhas,
        mensagemDe: (l) => mensagemDe(l, templates),
        alvoDe,
        casoTipoDe,
        comPontoAntes,
        agora,
      }),
    [rota, linhas, mensagemDe, templates, alvoDe, casoTipoDe, comPontoAntes],
  );

  const preparo = useMemo(() => (templates ? montar(undefined) : null), [templates, montar]);

  // app.js `varsPendentes`: variável que ficou sem preencher BLOQUEIA o envio. Depois do
  // `normalizaMensagem` só sobra o que foi digitado errado no modelo ({data} em vez de
  // {DATA}) — e isso não pode chegar ao colaborador dentro de uma carta.
  const pendentes = useMemo(
    () => [...new Set((preparo?.itens || []).flatMap((i) => variaveisPendentes(i.mensagem)))],
    [preparo],
  );

  const disparar = async (confirmar) => {
    const p = montar(agoraUtc());
    if (!p.itens.length) {
      setRecado({ tipo: "erro", texto: "Nenhum comunicado a enviar — veja os barrados abaixo." });
      return;
    }
    // main.py `enviar_aviso_interno` (~2687): a tela do Transnet recebe UMA Data
    // Referência por envio. Duas datas no mesmo arquivo carimbariam o dia errado.
    if (p.datas.length > 1) {
      setRecado({
        tipo: "erro",
        texto: `A tela envia uma data por vez, e há ${p.datas.length} datas: ${p.datas.join(", ")}. Filtre por data.`,
      });
      return;
    }
    if (pendentes.length) {
      setRecado({ tipo: "erro", texto: `Envio bloqueado: variável sem preencher (${pendentes.join(", ")}).` });
      return;
    }

    const nomes = p.itens
      .slice(0, NOMES_NA_CONFIRMACAO)
      .map((i) => `· ${i.nome || i.cracha} (${i.cracha})`)
      .join("\n");
    const resto = p.itens.length > NOMES_NA_CONFIRMACAO ? `\n· … e mais ${p.itens.length - NOMES_NA_CONFIRMACAO}` : "";
    const cabeca = confirmar
      ? `ENVIAR DE VERDADE ${p.itens.length} comunicado(s) no Transnet, do dia ${p.datas[0]}:`
      : `ENSAIO (o robô anexa o arquivo e NÃO confirma o envio) — ${p.itens.length} comunicado(s) do dia ${p.datas[0]}:`;
    // O que ACONTECE, dito sem eufemismo. O caso é o que faz o ciclo (48 h → advertência)
    // existir; onde ele não é aberto, a tela diz isso em vez de deixar subentendido.
    const efeito = !confirmar
      ? `Nada é enviado e NENHUM caso é aberto.`
      : rota === TIPO.FORA
        ? `Cada um recebe a mensagem no Transnet. NENHUM caso é aberto: bater ponto fora é ` +
          `justificativa, não ajuste — e um caso aqui sobrescreveria o do dia.`
        : `Cada um recebe a mensagem no Transnet e o caso do dia é aberto/atualizado em ` +
          `ponto_caso, com o prazo correndo a partir de agora (o alvo já congelado não é reescrito).`;
    if (
      !window.confirm(
        `${cabeca}\n\n${nomes}${resto}\n\n${efeito}\n\n` +
          `Quem executa é o robô, no GitHub Actions. O disparo fica registrado com o seu nome.`,
      )
    )
      return;

    setDisparando(true);
    setRecado(null);
    try {
      // ORDEM DELIBERADA: dispara PRIMEIRO, grava o caso DEPOIS. O caso é o que faz o
      // prazo de 48 h correr e a advertência nascer; gravá-lo antes de saber se o robô
      // saiu deixaria alguém "avisado" por um disparo que o GitHub recusou. O contrário
      // (mensagem enviada e caso não gravado) é barulho recuperável — e a tela grita.
      const r = await dispararRoboDP360("comunicado", {
        csv: p.csv,
        data: p.datas[0],
        motivo: MOTIVO_AVISO, // aviso. Advertência (103) não sai desta tela.
        confirmar: confirmar ? "true" : "false",
      });

      let alerta = "";
      let reavisados = [];
      if (confirmar && p.casos.length) {
        const { casos, reavisos } = marcarReavisos(p.casos, casoDe, { congelar: congelarReaviso });
        reavisados = reavisos;
        try {
          await upsertDP360("ponto_caso", casos);
        } catch (falha) {
          alerta =
            ` ATENÇÃO: o comunicado SAIU, mas o registro em ponto_caso falhou (${falha.message || falha}).` +
            ` O prazo de 48 h não está correndo para este lote — avise quem cuida do ciclo.`;
        }
      }
      setRecado({
        tipo: alerta ? "erro" : "ok",
        texto:
          `${confirmar ? "Envio" : "Ensaio"} disparado — ${p.itens.length} comunicado(s) do dia ${p.datas[0]}.` +
          (reavisados.length ? ` ${reavisados.length} já tinham sido avisados antes (o alvo original ficou).` : "") +
          alerta,
        painel: r?.painel || "",
      });
      if (confirmar && aoConcluir) await aoConcluir();
    } catch (falha) {
      setRecado({ tipo: "erro", texto: falha?.message || "Não foi possível disparar o robô." });
    } finally {
      setDisparando(false);
    }
  };

  const primeira = preparo?.itens?.[0];

  return (
    <div
      className="fixed inset-0 flex items-start justify-center overflow-y-auto"
      style={{ background: "rgba(15,20,32,.5)", padding: 16, zIndex: 60 }}
    >
      <div className="dp-card w-full max-w-3xl" style={{ padding: 0 }}>
        <header
          className="flex items-start justify-between gap-3"
          style={{ padding: "14px 18px", borderBottom: "1px solid var(--dp-border)" }}
        >
          <div style={{ minWidth: 0 }}>
            <b style={{ fontSize: 14 }}>{titulo}</b>
            <div className="dp-muted" style={{ fontSize: 11.5, marginTop: 2 }}>
              {ajuda} O CSV sai idêntico ao Transnet — <b>uma linha por colaborador, campos entre aspas</b>{" "}
              (Empresa · Crachá · Comunicado).
            </div>
          </div>
          <button type="button" className="dp-det-x" onClick={aoFechar} aria-label="Fechar">
            <X size={16} />
          </button>
        </header>

        <div style={{ padding: "14px 18px", display: "grid", gap: 12 }}>
          {erro && <div className="dp-pill warn">{erro}</div>}
          {!templates && <div className="dp-muted">Carregando os modelos…</div>}

          {templates && templateEditavel && (
            <div>
              <label className="dp-muted" style={{ fontSize: 11.5, display: "block", marginBottom: 4 }}>
                Texto que vai para o colaborador — a edição aqui vale <b>só para este envio</b>. Para mudar o
                modelo salvo, use a aba <b>Config</b>.
              </label>
              <textarea
                value={templates[templateEditavel] || ""}
                onChange={(e) => setTemplates({ ...templates, [templateEditavel]: e.target.value })}
                rows={7}
                style={{ ...ESTILO_INPUT, width: "100%", minHeight: 120, resize: "vertical" }}
              />
            </div>
          )}

          {primeira && (
            <div className="dp-card" style={{ fontSize: 12 }}>
              <b>Prévia ({primeira.nome || primeira.cracha}) — como vai no CSV:</b>
              <div style={{ marginTop: 4 }}>&quot;{primeira.mensagem}&quot;</div>
            </div>
          )}

          {!!pendentes.length && (
            <div className="dp-pill danger">
              Não enviar: variável sem preencher ({pendentes.join(", ")}).
            </div>
          )}

          {!!preparo?.itens?.length && (
            <div>
              <b style={{ fontSize: 12.5 }}>{preparo.itens.length} vão receber</b>
              <ListaPessoas itens={preparo.itens} />
            </div>
          )}

          {/* OS BARRADOS APARECEM. A pessoa não some da lista em silêncio: quem não recebe
              e POR QUE fica escrito, senão o DP conta 40 marcados e vê 31 enviados sem
              nunca saber o que aconteceu com os outros nove. */}
          {!!preparo?.barrados?.length && (
            <div className="dp-card" style={{ borderColor: "var(--dp-danger-ink)" }}>
              <span className="dp-pill danger">⚠ {preparo.barrados.length} não recebem</span>{" "}
              <span className="dp-muted" style={{ fontSize: 11.5 }}>
                O aviso não sai para estes — o motivo está ao lado do nome. Nada é enviado e nenhum caso é
                aberto para eles.
              </span>
              <ListaPessoas itens={preparo.barrados} />
            </div>
          )}

          {nota && (
            <p className="dp-muted" style={{ margin: 0, fontSize: 11.5 }}>
              {nota}
            </p>
          )}
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
            <button
              type="button"
              className="dp-btn"
              disabled={disparando || !preparo?.itens?.length}
              onClick={() => disparar(false)}
              title="O robô anexa o arquivo no Envio via CSV e NÃO confirma — serve para conferir o lote. Nenhum caso é aberto."
            >
              🤖 Ensaio
            </button>
            <button
              type="button"
              className="dp-btn"
              style={{ color: "var(--dp-danger-ink)" }}
              disabled={disparando || !preparo?.itens?.length}
              onClick={() => disparar(true)}
              title="Publica o comunicado na ficha de cada colaborador, no Transnet."
            >
              ⚠ Enviar de verdade
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

/* ═══════════════════ O AJUSTE EM LOTE — "✅ Lançar ajuste" ═══════════════════
   Porte de app.js:6003 → main.py `lancar_bot_p2` (~2820) → `_fila_correcoes`
   (~2786), tendo `_sug_bloqueio` — já portado como `sugBloqueio`, em
   `../CartaoDoDia` — como ÚLTIMO PORTÃO antes do Transnet.

   POR QUE ESTE CAMINHO EXISTE AO LADO DO COMUNICADO. O comunicado PEDE ao
   colaborador e espera 48 h. Este aqui CORRIGE o cartão quando a própria view já
   resolveu o alvo — e nos dias em que não há o que perguntar (o alvo está lá, a
   marcação não falta) era o único desfecho que a tela não oferecia: ou o DP
   digitava dia a dia no Transnet, ou mandava uma carta pedindo o que ele mesmo
   já sabia.

   MESMO ROBÔ, MESMO ARQUIVO E MESMO FORMATO DA REFEIÇÃO. É o `bot_ponto.py
   --lote` do workflow `ponto.yml`, com as SEIS colunas que ele lê no
   `csv.DictReader` (`cracha,data,entrada,alm_saida,alm_volta,saida`), crachá de
   8 dígitos, data dd/mm/aaaa e hora em notação 24+ depois de desenrolada a
   virada. O `data` por linha é opcional para o bot (`data_reg = r.get("data") or
   data`) e main.py escreve só cinco colunas na fila do P2 — as seis são o
   formato do resto das filas e deixam o arquivo dizer sozinho de que dia ele é.

   O ROBÔ ESCREVE O CARTÃO INTEIRO: os quatro campos, ou nada. Não existe
   "corrigir só a saída" (`bot_ponto.lancar_registro` recusa ponta em branco com
   SEM_REAL, e zera os campos extras). É daí que vem o peso das travas abaixo:
   cada linha do lote é um cartão de alguém sendo REESCRITO.                   */

const cru = (v) => String(v ?? "").trim();

// main.py `_ddmm` — a tela do Transnet (e o input `data` do workflow) é
// dd/mm/aaaa. Recorte de string, nunca `new Date()`: a data já vem em ISO e virar
// objeto Date só criaria chance de o fuso empurrar o dia.
const ddmmaaaa = (iso) => {
  const v = cru(iso);
  return v.length >= 10 ? `${v.slice(8, 10)}/${v.slice(5, 7)}/${v.slice(0, 4)}` : v;
};

const CAMPOS_CSV_AJUSTE = ["cracha", "data", "entrada", "alm_saida", "alm_volta", "saida"];

// Sem aspas: crachá é dígito, data é dd/mm/aaaa e hora é HH:MM (ou 25:40). É o
// mesmo `csvDoLote` da Refeição — um formato só para o mesmo robô.
const csvDoLoteAjuste = (fila) =>
  [CAMPOS_CSV_AJUSTE.join(","), ...fila.map((l) => CAMPOS_CSV_AJUSTE.map((c) => l[c]).join(","))].join("\n");

/* A LINHA SE APLICA AO LANÇAMENTO?
   Dia OK não tem o que corrigir: o cartão já bate com a régua, e mandá-lo ao robô
   reescreveria por reescrever. Ele não é "barrado" — não é candidato, do mesmo
   jeito que a linha sem marcação faltando não é candidata ao comunicado
   (`podeAvisarMotorista`, abaixo). Quem é candidato e não passa aparece na tela
   com nome e motivo; ninguém some em silêncio. */
const aplicaAjuste = (l) => String(l.status_ponto ?? "").toUpperCase() !== "OK";

/**
 * Divide os candidatos entre o que vai para o robô (`dentro`) e o que fica de
 * fora (`fora`, sempre com nome e motivo). Porte de `_fila_correcoes`, na mesma
 * ordem de barramento, mais as duas travas que a Refeição aprendeu.
 *
 * Não faz I/O: `casos` (ponto_caso do dia) e `bloqueios` (sugBloqueio por linha)
 * já estão carregados pela aba.
 */
function montarLoteAjuste(linhas, casos, bloqueios) {
  const dentro = [];
  const fora = [];

  for (const l of linhas) {
    if (!aplicaAjuste(l)) continue;

    const chave = chaveDia(l.cracha, l.date_ref);
    const dia = String(l.date_ref ?? "").slice(0, 10);
    const base = {
      chave,
      cracha: cra8(l.cracha),
      nome: l.nm_funcionario || "",
      dia,
      motivoLinha: cru(l.motivo),
      fonte: cru(l.fonte_alvo) || cru(l.sugestao_fonte),
      // O cartão de HOJE, para a tela mostrar lado a lado o que vai ser
      // sobrescrito. `fmtHora` preserva a notação 24+ (25:09 continua 25:09).
      cartaoHoje: [l.entrada, l.saida_almoco, l.volta_almoco, l.saida].map((h) => fmtHora(h)),
    };
    const deixaFora = (motivo) => fora.push({ ...base, motivo });

    // 1) PONTO_INVERTIDO É DIAGNÓSTICO, NÃO LANÇAMENTO (`_fila_correcoes`, 1º
    //    skip: `acao_sugerida == AJUSTAR_MANUAL` ou `motivo == PONTO_INVERTIDO`).
    //    Cartão rotacionado é defeito de posição das batidas — quem decide o que
    //    fazer é o DP, linha a linha.
    if (ehPontoInvertido(l)) {
      deixaFora("ponto invertido — a view não propõe lançamento, exige decisão manual do DP");
      continue;
    }

    // 2) O ÚLTIMO PORTÃO ANTES DO TRANSNET (`_sug_bloqueio`). É o mesmo veredito
    //    que já apaga o botão de avisar e marca a célula SUG com ⚠ — um lugar só
    //    decide, e a frase que a tela mostra é a que vira o motivo do barrado.
    const bloqueio = bloqueios[chave] ?? sugBloqueio(l);
    if (bloqueio) {
      deixaFora(bloqueio);
      continue;
    }

    // 3) CARTÃO JÁ MEXIDO NO TRANSNET DEPOIS DO NOSSO RETRATO (lição da Refeição,
    //    main.py:2856: "o ponto_diario só atualiza no import diário, não pelo bot
    //    na hora"). As pontas que mandamos são as do nosso retrato; se o cartão
    //    foi corrigido lá no meio-tempo, lançar por cima DEVOLVE as pontas velhas
    //    e desfaz a correção, sem ninguém ver. Não dá para saber isso sem ler o
    //    Transnet — dá para saber quando ALGUÉM MEXEU: `conferido_em` (a decisão
    //    foi executada) ou `correcao_final_em` (a correção rodou).
    const caso = casos[chave];
    const mexido = cru(caso?.conferido_em) || cru(caso?.correcao_final_em);
    if (mexido) {
      deixaFora(
        "o cartão deste dia já foi mexido no Transnet depois do último import — " +
          "lançar por cima devolveria as pontas antigas e desfaria a correção",
      );
      continue;
    }

    // 4) AS DUAS PONTAS (`_fila_correcoes`, teste final: entrada_sug e saida_sug
    //    preenchidas). Lá quem não tinha as duas sumia da contagem; aqui aparece
    //    com o motivo — era invisível a diferença entre "N com sugestão" e o que
    //    o robô recebia.
    const entrada = fmtHora(l.entrada_sug);
    const saida = fmtHora(l.saida_sug);
    if (!entrada || !saida) {
      const falta = [!entrada && "ENTRADA", !saida && "SAÍDA"].filter(Boolean).join(" e ");
      deixaFora(`sem ${falta} sugerida — o robô grava o cartão inteiro e recusa ponta em branco (SEM_REAL)`);
      continue;
    }

    /* 5) O MIOLO. Vem de `almoco_saida_sug`/`almoco_volta_sug`, que é o alvo da
          própria view — e é isso que o dia de ALMOÇO TRAVADO manda. `almoco_travado`
          significa que a matriz de meio de jornada já cravou o miolo (na view:
          `alvo_saida_almoco_final_min IS NOT NULL`), e é justamente por isso que as
          duas células do miolo não são editáveis nem entram no payload do Real
          manual (`CelulaSug` e `gravarCampoSug`, abaixo; main.py:906-910). O
          overlay do Real manual respeita a mesma trava (`aplicarRealManual`), então
          um horário digitado pelo DP nunca chega aqui num dia travado: o que vai
          para o robô é o miolo da Revisão, não o de ninguém.
          Vazio nas duas é dia SEM almoço — o bot escreve 00:00 nos intervalos, que
          é como o Transnet representa "não teve". */
    const almIni = fmtHora(l.almoco_saida_sug);
    const almFim = fmtHora(l.almoco_volta_sug);
    if (Boolean(almIni) !== Boolean(almFim)) {
      // Meia janela grava 00:00 na outra ponta e inventa um intervalo que ninguém
      // fez. Ou vão as duas, ou não vai nenhuma.
      deixaFora(
        `só uma ponta do almoço foi sugerida (${almIni || "—"} → ${almFim || "—"}) — ` +
          "o robô gravaria 00:00 na outra e criaria um intervalo que não existiu",
      );
      continue;
    }

    // 6) A VIRADA DE MEIA-NOITE, DESENROLADA (main.py `_desenrola_cartao`, e é o
    //    que a Refeição já faz antes de mandar). A view emite os `*_sug` em 24+,
    //    mas o Real manual que o DP crava na célula não: "23:50" de entrada com
    //    "06:10" de saída viraria jornada negativa. O bot reduz mod 24 na hora de
    //    digitar (`bot_ponto._mod24`), então quem manda a notação é a fila.
    const mEntrada = hm2min(entrada);
    let mSaida = hm2min(saida);
    let mAlmIni = almIni ? hm2min(almIni) : null;
    let mAlmFim = almFim ? hm2min(almFim) : null;
    if (mEntrada == null || mSaida == null || (almIni && (mAlmIni == null || mAlmFim == null))) {
      deixaFora("horário ilegível na sugestão — não dá para montar as quatro batidas");
      continue;
    }
    while (mSaida < mEntrada) mSaida += 1440;
    if (mAlmIni != null && mAlmFim != null) {
      while (mAlmIni < mEntrada) mAlmIni += 1440;
      while (mAlmFim < mAlmIni) mAlmFim += 1440;
      // O MIOLO TEM DE CABER DENTRO DO CARTÃO. Por construção da view ele cabe (as
      // quatro pontas saem do mesmo alvo), mas o Real manual do DP sobrescreve só
      // as PONTAS — cravar uma saída às 14:00 num dia cuja volta do almoço é 15:00
      // faria o robô escrever volta DEPOIS da saída. Mesma checagem da Refeição.
      if (mAlmFim > mSaida) {
        deixaFora(
          `o almoço ${almIni}–${almFim} não cabe entre a entrada ${entrada} e a saída ${saida} do alvo`,
        );
        continue;
      }
    }

    dentro.push({
      ...base,
      csv: {
        cracha: base.cracha,
        data: ddmmaaaa(dia), // da LINHA, nunca de `new Date()`
        entrada: min2hm(mEntrada),
        alm_saida: mAlmIni == null ? "" : min2hm(mAlmIni),
        alm_volta: mAlmFim == null ? "" : min2hm(mAlmFim),
        saida: min2hm(mSaida),
      },
    });
  }

  return { dentro, fora };
}

/* ---------- o painel do lote ----------
   DOIS BOTÕES, NUNCA UM CHECKBOX — a mesma regra do comunicado, pelo mesmo motivo
   e com um estrago maior: "confirmar" marcado por engano reescreve o cartão de
   ponto de dezenas de pessoas. A confirmação NOMEIA quem vai ser lançado, diz
   quantos cartões e quantos dias, e mostra o cartão que vai ser gravado. */
function PainelLancarAjuste({ data, lote, aoFechar, aoConcluir }) {
  const [disparando, setDisparando] = useState(false);
  const [recado, setRecado] = useState(null);

  useEffect(() => {
    const escapa = (e) => {
      if (e.key === "Escape" && !disparando) aoFechar();
    };
    document.addEventListener("keydown", escapa);
    return () => document.removeEventListener("keydown", escapa);
  }, [aoFechar, disparando]);

  const lancar = async (confirmar) => {
    const fila = lote.dentro.map((i) => i.csv);
    if (!fila.length) return;
    const dias = [...new Set(lote.dentro.map((i) => i.dia))];

    const linhasNomes = lote.dentro
      .slice(0, NOMES_NA_CONFIRMACAO)
      .map(
        (i) =>
          `· ${i.nome || i.cracha} (${i.cracha}) → ` +
          [i.csv.entrada, i.csv.alm_saida || "—", i.csv.alm_volta || "—", i.csv.saida].join(" · "),
      )
      .join("\n");
    const resto =
      lote.dentro.length > NOMES_NA_CONFIRMACAO
        ? `\n· … e mais ${lote.dentro.length - NOMES_NA_CONFIRMACAO}`
        : "";
    const cabeca = confirmar
      ? `LANÇAR DE VERDADE no Transnet ${fila.length} cartão(ões) de ponto, em ${dias.length} dia(s) (${dias
          .map(ddmmaaaa)
          .join(", ")}):`
      : `ENSAIO (o robô preenche a tela e NÃO clica em Inserir) — ${fila.length} cartão(ões) em ${dias.length} dia(s) (${dias
          .map(ddmmaaaa)
          .join(", ")}):`;

    if (
      !window.confirm(
        `${cabeca}\n\n${linhasNomes}${resto}\n\n` +
          `Cada linha acima é o CARTÃO INTEIRO (entrada · saída almoço · volta almoço · saída) ` +
          `que vai ser gravado no lugar do que está lá hoje — o robô escreve os quatro campos ou nada.\n\n` +
          (lote.fora.length
            ? `${lote.fora.length} candidato(s) ficaram de fora — a lista com o motivo está na tela.\n\n`
            : "") +
          `Quem executa é o robô, no GitHub Actions. O disparo fica registrado com o seu nome.\n\n` +
          `O resultado por pessoa NÃO volta sozinho para esta tela: a evidência fica no run do GitHub.`,
      )
    )
      return;

    setDisparando(true);
    setRecado(null);
    try {
      const resposta = await dispararRoboDP360("ponto", {
        csv: csvDoLoteAjuste(fila),
        data: ddmmaaaa(data),
        confirmar: confirmar ? "true" : "false",
      });

      // Histórico por pessoa em `ponto_importacoes`, PASSO 2 = correção do ponto
      // (a aba Importações já rotula esse passo e nunca tinha quem o escrevesse;
      // passo 1 é a Refeição). É o análogo do `_ingest_ponto` de main.py, que lá
      // lê a evidência do bot no disco — aqui a evidência mora no run do GitHub,
      // então o que se registra é o que SUBIU. Só no lançamento de verdade:
      // ensaio não escreve nada no Transnet e viraria histórico de algo que não
      // houve. A trilha do DISPARO (quem clicou, ensaio ou não) é do gateway, em
      // `dp360_auditoria`.
      let aviso = "";
      if (confirmar) {
        try {
          await inserirDP360(
            "ponto_importacoes",
            lote.dentro.map((item) => ({
              cracha: item.csv.cracha,
              nome: item.nome,
              date_ref: item.dia,
              passo: 2,
              entrada: item.csv.entrada,
              saida_almoco: item.csv.alm_saida,
              volta_almoco: item.csv.alm_volta,
              saida: item.csv.saida,
              fonte: item.fonte,
              arquivo: "robô ponto.yml",
              // Nem 'gerado' nem 'lancado': o robô foi disparado e ninguém ainda
              // leu a evidência dele. A aba Importações pinta como alerta, que é
              // exatamente o estado da coisa.
              status: "disparado",
            })),
          );
        } catch {
          aviso = " (não foi possível registrar o histórico em ponto_importacoes)";
        }
      }

      setRecado({
        tipo: "ok",
        texto: `${confirmar ? "Lançamento" : "Ensaio"} disparado — ${fila.length} cartão(ões).${aviso}`,
        painel: resposta?.painel || "",
      });
      // Recarrega o dia depois do lançamento de verdade: `conferido_em`/Real
      // manual e o estado da grade mudam por baixo.
      if (confirmar && aoConcluir) await aoConcluir();
    } catch (falha) {
      // O erro mostrado é o do SERVIDOR, sem tradução: é ele que diz se o
      // workflow não existe, se a permissão faltou ou se o input foi recusado.
      setRecado({ tipo: "erro", texto: falha?.message || "Não foi possível disparar o robô." });
    } finally {
      setDisparando(false);
    }
  };

  return (
    <div
      className="fixed inset-0 flex items-start justify-center overflow-y-auto"
      style={{ background: "rgba(15,20,32,.5)", padding: 16, zIndex: 60 }}
    >
      <div className="dp-card w-full max-w-4xl" style={{ padding: 0 }}>
        <header
          className="flex items-start justify-between gap-3"
          style={{ padding: "14px 18px", borderBottom: "1px solid var(--dp-border)" }}
        >
          <div style={{ minWidth: 0 }}>
            <b style={{ fontSize: 14 }}>✅ Lançar ajuste — correção do ponto em lote · {fmtData(data)}</b>
            <div className="dp-muted" style={{ fontSize: 11.5, marginTop: 2 }}>
              O robô <code>bot_ponto.py</code> preenche os quatro campos do Cartão de Ponto no Transnet com o{" "}
              <b>alvo que a view já resolveu</b>. Ele grava o <b>cartão inteiro</b> — não existe corrigir só uma
              ponta. Dia <b>OK</b> não entra: não há o que corrigir.
            </div>
          </div>
          <button type="button" className="dp-det-x" onClick={aoFechar} aria-label="Fechar">
            <X size={16} />
          </button>
        </header>

        <div style={{ padding: "14px 18px", display: "grid", gap: 12 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span className="dp-pill accent">{lote.dentro.length} no lote</span>
            {lote.fora.length ? <span className="dp-pill warn">{lote.fora.length} fora do lote</span> : null}
          </div>

          {lote.dentro.length ? (
            <div className="rv-tabela-wrap rv-lote-rol">
              <table className="rv-tabela">
                <thead>
                  <tr>
                    <th>Crachá</th>
                    <th>Colaborador</th>
                    <th>Motivo do dia</th>
                    <th>Cartão hoje (E · SA · VA · S)</th>
                    <th>Cartão que o robô vai gravar</th>
                  </tr>
                </thead>
                <tbody>
                  {lote.dentro.map((item) => (
                    <tr key={item.chave}>
                      <td className="dp-mono dp-num">{item.cracha}</td>
                      <td style={{ fontWeight: 600 }}>{item.nome || "—"}</td>
                      <td className="dp-muted">{item.motivoLinha || "—"}</td>
                      <td className="dp-mono dp-num dp-faint">
                        {item.cartaoHoje.map((h) => h || "—").join(" · ")}
                      </td>
                      <td className="dp-mono dp-num">
                        {[item.csv.entrada, item.csv.alm_saida || "—", item.csv.alm_volta || "—", item.csv.saida].join(
                          " · ",
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="dp-muted" style={{ fontSize: 12.5 }}>
              Nenhuma linha visível pode ir para o robô.{" "}
              {lote.fora.length ? "Os motivos estão abaixo." : "Filtre o dia e a categoria e tente de novo."}
            </div>
          )}

          {/* NUNCA SUMIR COM A PESSOA. Quem era candidato e não entrou no lote
              aparece aqui com o motivo — sem esta lista, a diferença entre o que
              a grade mostra e o que o robô recebeu seria invisível. */}
          {!!lote.fora.length && (
            <div className="dp-card" style={{ borderColor: "var(--dp-danger-ink)" }}>
              <span className="dp-pill danger">⚠ {lote.fora.length} ficam de fora</span>{" "}
              <span className="dp-muted" style={{ fontSize: 11.5 }}>
                Estavam na tela e não vão para o robô — o motivo está ao lado do nome. Nada é gravado no cartão
                deles.
              </span>
              <div className="rv-lote-rol" style={{ marginTop: 6 }}>
                {lote.fora.map((item) => (
                  <div key={item.chave} className="rv-lote-fora">
                    <span className="dp-mono dp-num">{item.cracha}</span>
                    <b>{item.nome || "—"}</b>
                    <span className="dp-muted">{item.motivo}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
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
            <button
              type="button"
              className="dp-btn"
              disabled={disparando || !lote.dentro.length}
              onClick={() => lancar(false)}
              title="O robô preenche a tela do Cartão de Ponto e NÃO clica em Inserir — serve para conferir o lote. Nada é gravado."
            >
              🤖 Ensaio
            </button>
            <button
              type="button"
              className="dp-btn"
              style={{ color: "var(--dp-danger-ink)" }}
              disabled={disparando || !lote.dentro.length}
              onClick={() => lancar(true)}
              title="Reescreve o cartão de ponto dessas pessoas no Transnet."
            >
              ⚠ Lançar de verdade
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

/* ---------- colunas da grade (ordem do COLS_REV do app antigo) ----------
   A grade é a `TabelaDP` compartilhada: ela entrega ordenar, ocultar coluna (⚙),
   fixar, redimensionar, CSV e preferência salva por tela (`tbl_p2` no app_config).
   Contrato dela: `valor` é o que ORDENA e EXPORTA, `render` só EXIBE. Coluna cujo
   `render` devolve pílula/chip PRECISA de `valor` em texto — senão o CSV sai vazio
   e a ordenação compara `[object Object]`.
   As colunas que dependem de estado da aba (Avisado?, 📍 Local, Motivo, e os chips
   de sugestão bloqueada) recebem `render`/`valor` dentro do componente. */
/* ═══════════ A CÉLULA SUG, EDITÁVEL NA PRÓPRIA GRADE ═══════════
   Porte de main.py `salvar_real_manual_campo` (~902) e do par `editable`/`onEdit`
   do Passo 2 (app.js:6005-6008).

   A SUGESTÃO É O REAL: cada campo da sugestão mapeia num campo do Real manual
   (`_SUG2REAL`), e editar a célula grava UM campo direto no `ponto_real_manual` —
   persiste e passa a mandar no veredito e na correção. Antes disto o clique na
   célula só abria o pop-up e a edição existia lá dentro; o dono clicou numa célula
   "editável" e o que abriu foi o cartão.

   A `TabelaDP` documenta que célula editável ficou FORA do porte porque
   `contenteditable` briga com o cursor a cada re-render, e manda usar um <input>
   controlado no `render` da coluna. É exatamente o que está aqui — a regra fica na
   aba, não no componente compartilhado. */

const SUG_PARA_REAL = {
  entrada_sug: "entrada",
  almoco_saida_sug: "alm_saida",
  almoco_volta_sug: "alm_volta",
  saida_sug: "saida",
};

function CelulaSug({ linha, campo, bloqueio, aoGravar }) {
  const salvo = fmtHora(linha[campo]);
  const [valor, setValor] = useState(salvo);
  const [estado, setEstado] = useState(""); // "" | "gravando" | "ok" | "erro"
  const [recado, setRecado] = useState("");

  // Re-semeia quando o VALOR gravado muda (não a cada re-render da grade): assim a
  // releitura pós-gravação aparece na célula sem atropelar quem está digitando.
  useEffect(() => {
    setValor(salvo);
  }, [salvo]);

  // ALMOÇO TRAVADO (main.py:906-910): os dois campos do miolo não são editáveis e
  // não vão no payload — o servidor recusa o dia inteiro se forem. Mesma regra do
  // pop-up, lida do mesmo campo.
  const travado = ehVerdadeiro(linha.almoco_travado) && ["almoco_saida_sug", "almoco_volta_sug"].includes(campo);

  const gravar = async () => {
    if (travado || estado === "gravando") return;
    const bruto = String(valor ?? "").trim();
    if (bruto === salvo) return; // nada mudou: não gasta gravação
    // `hm2min`/`min2hm` são do motor: aceitam "1420" (o que a tela do Cartão de Ponto
    // devolve) e preservam a notação 25:40 do turno que vira o dia.
    let limpo = "";
    if (bruto) {
      const m = hm2min(bruto);
      if (m === null || m < 0) {
        setEstado("erro");
        setRecado(`Horário inválido: ${bruto}`);
        setValor(salvo);
        window.setTimeout(() => setEstado(""), 1600);
        return;
      }
      limpo = min2hm(m);
    }
    setEstado("gravando");
    setRecado("");
    try {
      await aoGravar(linha, campo, limpo);
      // Nada de estado otimista: `aoGravar` relê a linha do banco e a grade repinta
      // com o que ficou LÁ. Aqui só sobra o ✓ que diz que a gravação passou.
      setEstado("ok");
      window.setTimeout(() => setEstado(""), 1200);
    } catch (falha) {
      setEstado("erro");
      setRecado(falha.message || "Não foi possível gravar.");
      setValor(salvo);
      window.setTimeout(() => setEstado(""), 2400);
    }
  };

  const titulo = travado
    ? "Almoço travado pela regra da Revisão — este campo não é editável."
    : bloqueio
      ? `⚠ ${bloqueio} — o valor está aqui para leitura, mas o dia não dá para avisar nem lançar.`
      : "Edite e saia do campo (ou Enter) para cravar no Real manual deste dia. Vazio limpa só este campo.";

  return (
    <span className={`rv-sug${estado ? ` ${estado}` : ""}${bloqueio ? " bloqueada" : ""}`} title={recado || titulo}>
      <input
        className="dp-num dp-mono"
        type="text"
        inputMode="numeric"
        placeholder="--:--"
        value={valor}
        readOnly={travado}
        disabled={estado === "gravando"}
        aria-label={`${campo} de ${linha.nm_funcionario || linha.cracha}`}
        onChange={(e) => setValor(e.target.value)}
        // O clique na LINHA continua abrindo o cartão; a célula editável não pode
        // disparar isso. E o `onKeyDown` da linha abre no Enter/espaço — sem parar
        // aqui, digitar um espaço abriria o pop-up por cima do que se está editando.
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          } else if (e.key === "Escape") {
            setValor(salvo);
            e.currentTarget.blur();
          }
        }}
        onBlur={gravar}
      />
      {travado && <Lock size={10} className="rv-sug-marca" />}
      {!travado && !!bloqueio && <span className="rv-sug-marca">⚠</span>}
      {estado === "ok" && <span className="rv-sug-marca ok">✓</span>}
      {estado === "erro" && <span className="rv-sug-marca erro">✕</span>}
    </span>
  );
}

const COLUNAS = [
  { id: "cracha", rotulo: "Crachá", classe: "dp-num dp-mono", largura: 92 },
  { id: "nm_funcionario", rotulo: "Nome", estilo: { fontWeight: 600 }, largura: 210 },
  { id: "nm_funcao", rotulo: "Função", classe: "dp-muted", largura: 150 },
  { id: "date_ref", rotulo: "Data", classe: "dp-num dp-mono", largura: 100 },
  { id: "status_ponto", rotulo: "Status", largura: 175 }, // cabe status + "✓ conferido"
  { id: "_avisado", rotulo: "Avisado?", largura: 120 },
  { id: "_gps", rotulo: "📍 Local", largura: 170 },
  { id: "motivo", rotulo: "Motivo", largura: 200 },
  { id: "sugestao_fonte", rotulo: "Fonte SUG", classe: "dp-muted", largura: 130 },
  { id: "qtd_batidas", rotulo: "Qtd batidas", classe: "dp-num", alinhar: "center", largura: 90 },
  { id: "todas_batidas", rotulo: "Todas as batidas", classe: "dp-num dp-mono", largura: 210 },
  { id: "batidas_limpas", rotulo: "Batidas limpas", classe: "dp-num dp-mono", largura: 180 },
  { id: "entrada", rotulo: "Entrada", classe: "dp-num dp-mono", hora: true, largura: 88 },
  { id: "saida_almoco", rotulo: "Saída almoço", classe: "dp-num dp-mono", hora: true, largura: 105 },
  { id: "volta_almoco", rotulo: "Volta almoço", classe: "dp-num dp-mono", hora: true, largura: 105 },
  { id: "saida", rotulo: "Saída", classe: "dp-num dp-mono", hora: true, largura: 88 },
  { id: "_jornada", rotulo: "Jornada", classe: "dp-num dp-mono", largura: 92 },
  { id: "esc_entrada", rotulo: "Esc. apresentação", classe: "dp-num dp-mono", hora: true, largura: 125 },
  { id: "programado_entrada", rotulo: "Esc. início", classe: "dp-num dp-mono", hora: true, largura: 95 },
  { id: "programado_saida", rotulo: "Esc. fim", classe: "dp-num dp-mono", hora: true, largura: 95 },
  { id: "esc_saida", rotulo: "Esc. saída", classe: "dp-num dp-mono", hora: true, largura: 95 },
  { id: "_sep", rotulo: "│" },
  { id: "entrada_sug", rotulo: "Entrada SUG", hora: true, sug: true, largura: 105 },
  { id: "almoco_saida_sug", rotulo: "S. almoço SUG", hora: true, sug: true, largura: 118 },
  { id: "almoco_volta_sug", rotulo: "V. almoço SUG", hora: true, sug: true, largura: 118 },
  { id: "saida_sug", rotulo: "Saída SUG", hora: true, sug: true, largura: 105 },
  { id: "duracao_total_sug", rotulo: "Dur. total SUG", classe: "dp-num dp-mono", sug: true, largura: 115 },
  { id: "atraso_min", rotulo: "Atraso (min)", classe: "dp-num", alinhar: "right", largura: 95 },
  { id: "he_min", rotulo: "HE (min)", classe: "dp-num", alinhar: "right", largura: 85 },
];

// Colunas pedidas da ponto_diario. Lista explícita (em vez de `*`) porque a
// tabela é larga e a grade é carregada por dia inteiro.
const COLUNAS_PONTO_DIARIO = [
  "cracha",
  "date_ref",
  "categoria",
  "nm_funcionario",
  "nm_funcao",
  "tem_ponto",
  "status_ponto",
  "motivo",
  "motivo_tecnico",
  "acao_sugerida",
  "sugestao_fonte",
  "qtd_batidas",
  "todas_batidas",
  "batidas_limpas",
  "entrada",
  "saida_almoco",
  "volta_almoco",
  "saida",
  "jornada_liquida_min",
  // `jornada_total_min` NAO existe em ponto_diario — e coluna da ponto_intervalo.
  // Pedir aqui devolvia HTTP 400 e derrubava a aba. A jornada do cartao e
  // `jornada_liquida_min` (ha tambem jornada_bruta_min e jornada_corrigida_min).
  "esc_entrada",
  "esc_saida",
  "programado_entrada",
  "programado_saida",
  "entrada_sug",
  "almoco_saida_sug",
  "almoco_volta_sug",
  "saida_sug",
  "duracao_total_sug",
  "atraso_min",
  "he_min",
  "pede_entrada",
  "pede_saida",
  "requer_alvo_manual",
  "fonte_alvo",
  "alvo_confiavel",
  "alvo_entrada",
  "alvo_saida_almoco",
  "alvo_volta_almoco",
  "alvo_saida",
  "fonte_almoco",
  "almoco_travado",
  "almoco_faixa",
  "almoco_confiavel",
  "almoco_diverge_cartao",
].join(",");

// Só o que a régua de GPS precisa da `ponto_gordura`: a janela da operação
// (escada real > citatti > bilhetagem > SST) e a marca de dia de reserva.
// A RESERVA LANÇADA vem de `lerReservasInove` (../CartaoDoDia), a MESMA leitura que
// a Gordura e o cartão do dia usam. Ela vive no projeto do INOVE (não na base de
// importação), então vai pelo cliente Supabase normal — o gateway dp360-api só cobre
// as tabelas de ponto. Antes esta tela lia só crachá+data e montava um Set de "é
// reserva": a ANOTAÇÃO do gestor (observação, cobertura, horário, quem lançou) ficava
// para trás. Agora vem o registro inteiro, num Map por crachá|dia — a grade continua
// só perguntando "tem reserva?" e o cartão mostra o que foi anotado.
const COLUNAS_GORDURA_GPS = [
  "cracha",
  "data_ref",
  "real_inicio",
  "real_fim",
  "op_inicio",
  "op_fim",
  "val_inicio",
  "val_fim",
  "sst_vinculo",
  "sst_desvinculo",
  // NAO peca `tem_reserva_inove` aqui: ela NAO e coluna da tabela. O Python cria esse
  // campo em memoria, na camada _aplica_reserva (main.py:4844), a partir da tabela
  // `reservas_motoristas` — que vive no projeto do INOVE, nao na base de importacao.
  // Pedir no select devolvia HTTP 400 e derrubava a aba inteira ("Edge Function
  // returned a non-2xx status code"). O dia de reserva vem de lerReservasInove().
].join(",");

/* =============================================================================
   Componente
   ========================================================================== */
export default function Revisao() {
  const [categoria, setCategoria] = useState("MOTORISTA");
  const [categorias, setCategorias] = useState(CATEGORIAS_PADRAO);
  const [datas, setDatas] = useState([]);
  const [data, setData] = useState("");
  // Dias que TÊM linha na base mas ainda não têm ponto importado. Não entram no
  // seletor (é a regra do original); viram aviso, para ninguém procurar ontem.
  const [datasSemPonto, setDatasSemPonto] = useState([]);
  const [lotesDatas, setLotesDatas] = useState(PAGINAS_POR_LOTE);
  const [carregandoDatas, setCarregandoDatas] = useState(true);

  const [linhas, setLinhas] = useState([]);
  const [casos, setCasos] = useState({});
  const [gpsPorCracha, setGpsPorCracha] = useState({});
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  const [filtro, setFiltro] = useState("REVISAR");
  const [busca, setBusca] = useState("");
  const [aberta, setAberta] = useState(null);

  /* ---- datas e categorias disponíveis ---- */
  useEffect(() => {
    let ativo = true;
    setCarregandoDatas(true);
    // TODO(port DP360): trocar por um endpoint `distinct` no gateway. Hoje o
    // PostgREST não expõe DISTINCT por aqui, então paginamos date_ref desc.
    // `tem_ponto` vem junto: é ele que diz se o dia CHEGOU (main.py:7067). A
    // `ponto_diario` cria uma linha por pessoa por dia assim que a escala existe
    // — a linha nasce antes da batida —, então sem este filtro o seletor oferece
    // o dia que ainda está importando e a tela mostra a garagem toda em SEM_PONTO.
    lerTudoDP360(
      "ponto_diario",
      { colunas: COLUNAS_INDICE_DATAS.join(","), ordem: "date_ref.desc" },
      lotesDatas,
    )
      .then((rows) => {
        if (!ativo) return;
        const { datas: dts, semPonto, categorias: cats } = datasComPonto(rows);
        setDatas(dts);
        setDatasSemPonto(semPonto);
        if (cats.length) setCategorias(cats);
        setData((atual) => (atual && dts.includes(atual) ? atual : dts[0] || ""));
        setErro("");
      })
      .catch((falha) => {
        if (ativo) setErro(falha.message || "Falha ao listar as datas da base DP360.");
      })
      .finally(() => {
        if (ativo) setCarregandoDatas(false);
      });
    return () => {
      ativo = false;
    };
  }, [lotesDatas]);

  /* ---- grade do dia ---- */
  const carregarDia = useCallback(() => {
    if (!data || !categoria) return undefined;
    let ativo = true;
    setCarregando(true);
    setErro("");
    setGpsPorCracha({});
    /* SÓ DIAS COM PONTO. Porte de `ferramenta/processar_ponto.py:28-33`, onde a
       Revisão descarta a linha cujo `tem_ponto` não é "true" antes de montar a lista:
       quem não bateu não tem CARTÃO para conferir — é assunto das Folgas e dos
       Abandonos, não da conferência. Medido em 02/09, MOTORISTA: 246 linhas no dia,
       197 com ponto e 47 SEM_PONTO; as 47 apareciam aqui e não aparecem na ferramenta.
       O filtro é no SERVIDOR: além de ser o comportamento certo, corta ~20% do payload
       do dia. NÃO REMOVER achando que é filtro esquecido.
       `tem_ponto` é STRING "true"/"false" no lake — `eq.true` resolve no PostgREST;
       nunca comparar esse campo como booleano em JS. */
    const filtrosDia = { date_ref: `eq.${data}`, categoria: `eq.${categoria}`, tem_ponto: "eq.true" };

    Promise.all([
      lerTudoDP360("ponto_diario", {
        colunas: COLUNAS_PONTO_DIARIO,
        filtros: filtrosDia,
        ordem: "cracha.asc",
      }),
      lerTudoDP360("ponto_real_manual", { filtros: { date_ref: `eq.${data}` }, ordem: "cracha.asc" }),
      lerTudoDP360("ponto_caso", { filtros: { date_ref: `eq.${data}` }, ordem: "cracha.asc" }),
    ])
      .then(([diario, reaisManuais, listaCasos]) => {
        if (!ativo) return;
        const mapaRm = {};
        for (const rm of reaisManuais) mapaRm[chaveDia(rm.cracha, rm.date_ref)] = rm;
        const mapaCasos = {};
        for (const c of listaCasos) mapaCasos[chaveDia(c.cracha, c.date_ref)] = c;
        setCasos(mapaCasos);
        setLinhas(diario.map((l) => aplicarRealManual(l, mapaRm[chaveDia(l.cracha, l.date_ref)])));
      })
      .catch((falha) => {
        if (ativo) setErro(falha.message || "Falha ao carregar a revisão deste dia.");
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });

    // GPS carrega em separado: a grade não espera por ele.
    // A `ponto_gordura` entra aqui por DOIS motivos, os mesmos do app antigo
    // (main.py `get_gps_flags`, 6929-6957):
    //   1. a JANELA DA OPERAÇÃO (real > citatti > bilhetagem > SST), que ancora
    //      cada ponta na régua — sem ela a entrada é medida contra o carro da
    //      hora errada;
    //   2. `tem_reserva_inove`, a marca de DIA DE RESERVA. Sem carro atribuído,
    //      batida em local conhecido vale por si (main.py:281-288) — é o que
    //      apagava o falso "bateu fora" do ANTONIO (03:10 na Garagem 046
    //      aparecendo "a 4,9 km do veículo (07:08)").
    Promise.all([
      lerTudoDP360("ponto_gps", {
        colunas: "cracha,hora,latitude,longitude,origem",
        filtros: { date_ref: `eq.${data}` },
        ordem: "cracha.asc",
      }),
      lerTudoDP360("gps_carro", {
        colunas: "cracha,hora,latitude,longitude,veiculo,poi,cerca,tipo,fonte,linha",
        filtros: { date_ref: `eq.${data}` },
        ordem: "cracha.asc",
      }),
      lerTudoDP360("ponto_gordura", {
        colunas: COLUNAS_GORDURA_GPS,
        filtros: { data_ref: `eq.${data}` },
        ordem: "cracha.asc",
      }),
      lerReservasInove(data),
    ])
      .then(([batidas, carros, gordura, reservas]) => {
        if (!ativo) return;
        const porCracha = {};
        const balde = (cracha) => {
          const cr = cra8(cracha);
          if (!porCracha[cr]) porCracha[cr] = { batidas: [], ancoras: [] };
          return porCracha[cr];
        };
        for (const b of batidas) balde(b.cracha).batidas.push(b);
        for (const c of carros) balde(c.cracha).ancoras.push(c);

        // Mesma escada do app antigo para a janela da operação.
        const contexto = {};
        for (const g of gordura) {
          contexto[cra8(g.cracha)] = {
            opIni: g.real_inicio || g.op_inicio || g.val_inicio || g.sst_vinculo || "",
            opFim: g.real_fim || g.op_fim || g.val_fim || g.sst_desvinculo || "",
            // Dia de reserva vem da tabela do INOVE, nao da gordura (ver COLUNAS_GORDURA_GPS).
            // O mapa é por crachá|dia (a mesma chave da grade), e a régua só quer saber
            // se EXISTE lançamento — a anotação em si é assunto do cartão.
            ehReserva: reservas.has(chaveDia(g.cracha, data)),
          };
        }
        // Quem tem reserva lancada mas nao tem linha de gordura no dia tambem precisa
        // entrar no contexto — senao a batida dele cai na regua do veiculo e vira
        // falso "bateu fora", que e exatamente o bug que esta camada existe para evitar.
        for (const r of reservas.values()) {
          const cr = cra8(r.funcionario_cracha);
          if (cr && !contexto[cr]) contexto[cr] = { opIni: "", opFim: "", ehReserva: true };
        }

        const resumo = {};
        for (const [cr, dados] of Object.entries(porCracha)) {
          if (!dados.batidas.length) continue;
          const ctx = contexto[cr] || { opIni: "", opFim: "", ehReserva: false };
          resumo[cr] = calcularGps({
            batidas: dados.batidas,
            ancoras: dados.ancoras,
            ehReserva: ctx.ehReserva,
            opIni: ctx.opIni,
            opFim: ctx.opFim,
          });
        }
        setGpsPorCracha(resumo);
      })
      .catch(() => {
        // GPS é acessório: sem ele a coluna 📍 fica "—" e a grade segue útil.
        if (ativo) setGpsPorCracha({});
      });

    return () => {
      ativo = false;
    };
  }, [data, categoria]);

  useEffect(() => carregarDia(), [carregarDia]);

  /* ---- contagens e filtro ---- */
  const contagens = useMemo(() => {
    const c = { TODOS: linhas.length, REVISAR: 0, OK: 0, FORA: 0 };
    for (const l of linhas) {
      if (String(l.status_ponto ?? "").toUpperCase() === "OK") c.OK += 1;
      else c.REVISAR += 1;
      const g = gpsPorCracha[cra8(l.cracha)];
      if (g && g.fora > 0) c.FORA += 1;
    }
    return c;
  }, [linhas, gpsPorCracha]);

  // `sugBloqueio` roda uma vez por linha (e não uma vez por célula): a grade tem
  // ~30 colunas e o dia inteiro de motoristas, então repetir custava 12k chamadas.
  const bloqueios = useMemo(() => {
    const m = {};
    for (const l of linhas) m[chaveDia(l.cracha, l.date_ref)] = sugBloqueio(l);
    return m;
  }, [linhas]);

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return linhas.filter((l) => {
      if (q) {
        const nome = String(l.nm_funcionario ?? "").toLowerCase();
        const cra = String(l.cracha ?? "");
        if (!nome.includes(q) && !cra.includes(q)) return false;
      }
      const ok = String(l.status_ponto ?? "").toUpperCase() === "OK";
      if (filtro === "REVISAR") return !ok;
      if (filtro === "OK") return ok;
      if (filtro === "FORA") {
        const g = gpsPorCracha[cra8(l.cracha)];
        return !!(g && g.fora > 0);
      }
      return true;
    });
  }, [linhas, busca, filtro, gpsPorCracha]);

  const comSugestao = useMemo(
    () => linhas.filter((l) => temSugestaoUtil(l, bloqueios[chaveDia(l.cracha, l.date_ref)])).length,
    [linhas, bloqueios],
  );

  /* ---- o lote do "✅ Lançar ajuste" ----
     Sai das linhas VISÍVEIS (o filtro e a busca da barra são a seleção, como já
     acontece com o comunicado). Não faz I/O: `casos` e `bloqueios` já estão em
     mãos, então o botão pode mostrar o número real do lote antes de abrir. */
  const [loteAberto, setLoteAberto] = useState(false);
  const loteAjuste = useMemo(
    () => montarLoteAjuste(visiveis, casos, bloqueios),
    [visiveis, casos, bloqueios],
  );

  /* ---- releitura de UMA linha depois de gravar ----
     A tela nunca pinta o estado otimista: relê `ponto_diario` (cru), `ponto_real_manual`
     e `ponto_caso` do crachá/dia e reaplica o overlay do Real. O `ponto_diario` cru é o
     que permite DESFAZER o overlay quando o Real manual é apagado — reaproveitar a linha
     já sobrescrita deixaria `entrada_sug`/`alvo_*` com o valor antigo do DP.
     `in.(...)` com as variantes do crachá porque as tabelas do lake divergem no zero à
     esquerda (é o mesmo truque do pop-up).
     (Fica ANTES das colunas porque a célula SUG editável grava e relê por aqui.) */
  const recarregarLinha = useCallback(async (cracha, dia) => {
    const cr = String(cracha ?? "").trim();
    const variantes = [...new Set([cr, cr.replace(/^0+/, ""), cra8(cr)].filter(Boolean))].join(",");
    const filtros = { cracha: `in.(${variantes})`, date_ref: `eq.${dia}` };
    const [diario, reaisManuais, listaCasos] = await Promise.all([
      lerDP360("ponto_diario", { colunas: COLUNAS_PONTO_DIARIO, filtros, limite: 5 }),
      lerDP360("ponto_real_manual", { filtros, limite: 5 }),
      lerDP360("ponto_caso", { filtros, limite: 5 }),
    ]);
    const chave = chaveDia(cr, dia);
    const rm = reaisManuais?.[0] || null;
    const caso = listaCasos?.[0] || null;
    const nova = diario?.[0] ? aplicarRealManual(diario[0], rm) : null;

    setCasos((mapa) => {
      const novo = { ...mapa };
      if (caso) novo[chave] = caso;
      else delete novo[chave];
      return novo;
    });
    if (!nova) return;
    setLinhas((ls) => ls.map((l) => (chaveDia(l.cracha, l.date_ref) === chave ? nova : l)));
    // O pop-up aberto recebe a MESMA linha nova: sem isto ele continuaria mostrando o
    // Real antigo enquanto a grade atrás dele já mostra o novo.
    setAberta((a) => (a && chaveDia(a.cracha, a.date_ref) === chave ? nova : a));
  }, []);

  /* ---- gravar UM campo do Real manual pela célula da grade ----
     Porte de main.py `salvar_real_manual_campo` (~902): mesmo mapa `_SUG2REAL`,
     mesma trava de almoço, mesmo par `definido_por`/`definido_em`. O `date_ref` sai
     da LINHA (nunca de `new Date()`, que depois das 21h BRT viraria o dia seguinte);
     o `definido_em` é carimbo de INSTANTE, e aí o UTC do `toISOString()` é o certo —
     é o que o Python faz. Coluna ausente no upsert não é tocada, então gravar a
     entrada não apaga a saída que já estava lá. */
  const gravarCampoSug = useCallback(
    async (linha, campo, valorHm) => {
      const dia = String(linha.date_ref ?? "").slice(0, 10);
      const real = SUG_PARA_REAL[campo];
      if (!real) throw new Error(`Campo inválido: ${campo}`);
      if (["alm_saida", "alm_volta"].includes(real) && ehVerdadeiro(linha.almoco_travado)) {
        throw new Error("O almoço deste motorista foi travado pela regra da Revisão.");
      }
      await upsertDP360("ponto_real_manual", {
        cracha: cra8(linha.cracha),
        date_ref: dia,
        [real]: valorHm || null,
        definido_por: quemEstaUsando(),
        definido_em: agoraUtc(),
      });
      await recarregarLinha(linha.cracha, dia);
    },
    [recarregarLinha],
  );

  /* ---- colunas da TabelaDP: mesma ordem/cor/render de antes, agora com `valor` ----
     `render` continua sendo o que a tela mostra (pílulas, chips, "—"); `valor` é a
     versão TEXTO/NÚMERO que a grade usa para ordenar e para o CSV. Sem os dois, ou o
     CSV sai com JSX ou a ordenação compara string com objeto. */
  const colunas = useMemo(
    () =>
      COLUNAS.map((col) => {
        const bloqueioDe = (l) => bloqueios[chaveDia(l.cracha, l.date_ref)];

        if (col.id === "_sep") return { ...col, render: () => <span className="dp-faint">│</span> };

        // O "conferido pelo DP" mora em ponto_caso, não em ponto_diario — a régua
        // automática continua marcando REVISAR. Sem mostrar a marca aqui, o DP clica,
        // fecha o cartão e a grade fica exatamente igual (main.py `get_pontos_ok`).
        if (col.id === "status_ponto")
          return {
            ...col,
            valor: (l) => {
              const s = String(l.status_ponto ?? "").trim();
              return pontoConferido(casos[chaveDia(l.cracha, l.date_ref)]) ? `${s} · conferido` : s;
            },
            render: (l) => (
              <>
                <Pilula
                  texto={l.status_ponto || "—"}
                  tom={String(l.status_ponto ?? "").toUpperCase() === "OK" ? "ok" : "warn"}
                />
                {pontoConferido(casos[chaveDia(l.cracha, l.date_ref)]) && (
                  <>
                    {" "}
                    <Pilula
                      texto="✓ conferido"
                      tom="ok"
                      titulo="O DP marcou este dia como certo — ele conta como OK nas Folgas."
                    />
                  </>
                )}
              </>
            ),
          };

        if (col.id === "_avisado")
          return {
            ...col,
            valor: (l) => estadoAviso(casos[chaveDia(l.cracha, l.date_ref)]).texto,
            render: (l) => <Avisado caso={casos[chaveDia(l.cracha, l.date_ref)]} />,
          };

        if (col.id === "_gps")
          return {
            ...col,
            valor: (l) => textoGps(gpsPorCracha[cra8(l.cracha)]),
            render: (l) => <LocalGps gps={gpsPorCracha[cra8(l.cracha)]} />,
          };

        if (col.id === "motivo")
          return { ...col, valor: (l) => String(l.motivo ?? "").trim(), render: (l) => <Motivo linha={l} /> };

        // Data em dd/mm/aaaa: a `chaveOrd` da grade entende esse formato e ordena por
        // ano/mês/dia — foi justamente aqui que a ferramenta ordenava pelo DIA DO MÊS.
        if (col.id === "date_ref") return { ...col, valor: (l) => fmtData(l.date_ref) };

        // Jornada ordena/exporta em MINUTOS (número) e exibe "8h02".
        if (col.id === "_jornada")
          return {
            ...col,
            valor: (l) => {
              const n = parseInt(l.jornada_liquida_min, 10);
              return Number.isNaN(n) ? null : n;
            },
            render: (l) => fmtMin(l.jornada_liquida_min),
          };

        const valor = col.hora ? (l) => fmtHora(l[col.id]) : (l) => String(l[col.id] ?? "").trim();

        // AS QUATRO CÉLULAS DA SUGESTÃO SÃO EDITÁVEIS NA GRADE (app.js:6005) — a
        // sugestão É o Real manual. O `valor` (ordenação e CSV) continua sendo o
        // texto: só a EXIBIÇÃO virou campo. Sugestão bloqueada continua visível e
        // marcada — o DP precisa ver o que a view propôs, e cravar por cima é
        // justamente como se destrava o dia.
        if (col.sug && col.hora && SUG_PARA_REAL[col.id])
          return {
            ...col,
            valor,
            render: (l) => (
              <CelulaSug
                key={`${chaveDia(l.cracha, l.date_ref)}|${col.id}`}
                linha={l}
                campo={col.id}
                bloqueio={bloqueioDe(l)}
                aoGravar={gravarCampoSug}
              />
            ),
          };

        return {
          ...col,
          valor,
          render: (l) => {
            const texto = valor(l);
            if (!texto) return <span className="dp-faint">—</span>;
            // Sugestão bloqueada não é sugestão: o valor continua visível (o DP precisa
            // ver o que a view propôs), mas marcado — não dá pra avisar nem lançar.
            const bloqueio = col.sug ? bloqueioDe(l) : "";
            if (col.sug && bloqueio)
              return (
                <span className="dp-chip dp-num new" title={`⚠ ${bloqueio}`}>
                  {texto}
                  <span className="es">⚠</span>
                </span>
              );
            // Horário sugerido utilizável: chip mono, como as batidas da ferramenta.
            if (col.sug && col.hora) return <span className="dp-chip dp-num">{texto}</span>;
            return texto;
          },
        };
      }),
    [bloqueios, casos, gpsPorCracha, gravarCampoSug],
  );

  /* ═══════════════════ AVISO AO TRABALHADOR (o robô do Transnet) ═══════════════════
     Três rotas, as mesmas do app antigo (app.js `avisarMotoristas`, `avisarInternos`,
     `avisarFora`). O que muda entre elas é QUEM entra, QUAL modelo e QUE caso abre —
     as regras estão em `../comunicadoTransnet`; aqui só se escolhe o escopo.        */

  const casoDe = useCallback((cracha, dia) => casos[chaveDia(cracha, dia)] || null, [casos]);

  // main.py `sc.tem_coluna("ponto_caso", "ponto_antes")`: a coluna existe em algumas
  // instalações e não em outras. Mandar coluna inexistente no upsert derruba o lote
  // inteiro, então a gente só a inclui quando VÊ a coluna numa linha já lida.
  const comPontoAntes = useMemo(
    () => Object.values(casos).some((c) => c && Object.prototype.hasOwnProperty.call(c, "ponto_antes")),
    [casos],
  );

  // Interno/aprendiz não tem operação (GPS/SST/bilhetagem) e a escala do cadastro é
  // lixo — o "normal" dele sai do PRÓPRIO histórico de batidas (main.py
  // `_jornada_normal`). Só o modelo "jornada curta" depende disso, então a leitura é
  // preguiçosa: só quando a aba está numa categoria de interno, e uma vez por sessão.
  const [medianas, setMedianas] = useState(null);
  const [carregandoMedianas, setCarregandoMedianas] = useState(false);
  const ehInterno = categoria !== "MOTORISTA";
  useEffect(() => {
    if (!ehInterno || medianas || carregandoMedianas) return undefined;
    let ativo = true;
    setCarregandoMedianas(true);
    lerTudoDP360(
      "ponto_diario",
      {
        colunas: "cracha,todas_batidas,categoria",
        filtros: { categoria: "in.(INTERNO,APRENDIZ)" },
        ordem: "date_ref.desc",
      },
      12,
    )
      .then((historico) => {
        if (ativo) setMedianas(medianasJornada(historico));
      })
      .catch(() => {
        // Sem histórico o aviso continua funcionando: os modelos "almoço curto" e
        // "registro incompleto" não dependem da mediana. Só a "jornada curta" fica de
        // fora — melhor não avisar do que avisar contra uma régua que não existe.
        if (ativo) setMedianas(new Map());
      })
      .finally(() => {
        if (ativo) setCarregandoMedianas(false);
      });
    return () => {
      ativo = false;
    };
  }, [ehInterno, medianas, carregandoMedianas]);

  const [envio, setEnvio] = useState(null);

  /* ---- rota 1: motorista com marcação faltando (app.js `avisarMotoristas`) ----
     Ponto invertido fica FORA: é defeito do cartão, não comunicado ao colaborador.
     Dia já conferido pelo DP também: ele decidiu que está certo. */
  const podeAvisarMotorista = useCallback(
    (l) =>
      String(l.status_ponto ?? "").toUpperCase() !== "OK" &&
      !pontoConferido(casos[chaveDia(l.cracha, l.date_ref)]) &&
      !ehPontoInvertido(l) &&
      !!marcacaoAusente(l),
    [casos],
  );
  const alvoMotoristas = useMemo(
    () => (ehInterno ? [] : visiveis.filter(podeAvisarMotorista)),
    [ehInterno, visiveis, podeAvisarMotorista],
  );
  // O ALVO CONGELADO do aviso. `sugBloqueio` é o porte de `_sug_bloqueio` e já é a
  // frase que a tela mostra quando o dia não pode ser usado ("não dá para avisar nem
  // lançar") — é ela que entra como motivo do barrado.
  const contratoDe = useCallback(
    (l) => contratoDaRevisao(l, bloqueios[chaveDia(l.cracha, l.date_ref)] ?? sugBloqueio(l)),
    [bloqueios],
  );
  const mensagemDeMotorista = useCallback(
    (l, tpls) => mensagemRevisaoMotorista(tpls.ocorrencia_motorista, l, marcacaoAusente(l)),
    [],
  );
  const abrirMotoristas = (alvo) =>
    setEnvio({
      rota: TIPO.REVMOT,
      titulo: `📣 Enviar ocorrência — ${alvo.length} motorista(s)`,
      ajuda:
        "A ferramenta identifica a marcação faltante. Com alvo confiável, a mensagem pede o ajuste no " +
        "horário; sem alvo, pede apenas o registro de ENTRADA, SAÍDA ou ambos.",
      linhas: alvo,
      chavesTemplate: ["ocorrencia_motorista"],
      templateEditavel: "ocorrencia_motorista",
      mensagemDe: mensagemDeMotorista,
      alvoDe: contratoDe,
      congelarReaviso: true,
    });

  /* ---- rota 2: interno/aprendiz, três modelos num envio só (`avisarInternos`) ---- */
  const rotasInternos = useMemo(() => {
    if (!ehInterno) return { alvo: [], pulados: 0 };
    const alvo = [];
    let pulados = 0;
    for (const l of visiveis) {
      if (pontoConferido(casos[chaveDia(l.cracha, l.date_ref)])) continue;
      const { modelo, divergencia } = rotaAvisoInterno(l, medianas);
      if (!modelo) {
        if (String(l.status_ponto ?? "").toUpperCase() === "REVISAR") pulados += 1;
        continue;
      }
      alvo.push({ ...l, __modelo: modelo, __divergencia: divergencia });
    }
    return { alvo, pulados };
  }, [ehInterno, visiveis, casos, medianas]);
  const mensagemDeInterno = useCallback((l, tpls) => mensagemInterno(tpls[`interno_${l.__modelo}`], l, l.__divergencia), []);
  const abrirInternos = (alvo) => {
    const conta = (m) => alvo.filter((l) => l.__modelo === m).length;
    setEnvio({
      rota: TIPO.INTERNO,
      titulo: `📣 Enviar ocorrência — ${alvo.length} interno(s)/aprendiz(es)`,
      ajuda:
        `${conta("almoco")} almoço curto (só comunica) · ${conta("incompleto")} registro incompleto ` +
        `(pede ajuste em 24 h) · ${conta("curta")} jornada curta (pede verificação). ` +
        "Cada linha já leva a mensagem do seu modelo.",
      linhas: alvo,
      chavesTemplate: ["interno_almoco", "interno_incompleto", "interno_curta"],
      templateEditavel: null, // são três modelos num envio só: editar um só confundiria
      mensagemDe: mensagemDeInterno,
      casoTipoDe: (l) => l.__modelo,
      // main.py `enviar_aviso_interno` NÃO congela o caso do interno, de propósito: é o
      // TIPO (almoco/incompleto/curta) que decide se o ciclo de 48 h corre. Travá-lo no
      // primeiro aviso deixaria um "incompleto" registrado como "almoço curto" e sem prazo.
      congelarReaviso: false,
      nota: rotasInternos.pulados
        ? `${rotasInternos.pulados} pendente(s) do dia não se encaixam em nenhum modelo e não recebem aviso.`
        : "",
    });
  };

  /* ---- rota 3: bateu ponto FORA de local conhecido (GPS) (`avisarFora`) ----
     JUSTIFICATIVA, não ajuste: este envio NÃO abre `ponto_caso` (ver
     comunicadoTransnet). Abrir poria a pessoa em "Meus avisos" como ajuste e ainda
     sobrescreveria o caso de gordura do mesmo dia. */
  const alvoFora = useMemo(
    () => visiveis.filter((l) => (gpsPorCracha[cra8(l.cracha)]?.fora || 0) > 0),
    [visiveis, gpsPorCracha],
  );
  const mensagemDeFora = useCallback(
    (l, tpls) => mensagemBateuFora(tpls.aviso_fora, l, gpsPorCracha[cra8(l.cracha)]),
    [gpsPorCracha],
  );
  const abrirFora = (alvo) =>
    setEnvio({
      rota: TIPO.FORA,
      titulo: `📍 Avisar quem bateu fora — ${alvo.length}`,
      ajuda:
        "Batida FORA de local conhecido (garagem/terminal), pelo GPS do app. A mensagem pede JUSTIFICATIVA, " +
        "não ajuste de horário — e por isso este envio não abre caso nem inicia prazo.",
      linhas: alvo,
      chavesTemplate: ["aviso_fora"],
      templateEditavel: "aviso_fora",
      mensagemDe: mensagemDeFora,
    });

  /* ---- o mesmo aviso, para UMA linha (botão do rodapé do cartão) ---- */
  const impedimentoAviso = useMemo(() => {
    if (!aberta) return "";
    if (pontoConferido(casos[chaveDia(aberta.cracha, aberta.date_ref)]))
      return "Este dia já foi marcado como conferido pelo DP — não há o que pedir.";
    if (ehInterno) {
      if (carregandoMedianas) return "Carregando o histórico de jornada do interno…";
      const { modelo } = rotaAvisoInterno(aberta, medianas);
      if (!modelo) return "Este dia não se encaixa em nenhum dos modelos de aviso de interno/aprendiz.";
      return "";
    }
    if (String(aberta.status_ponto ?? "").toUpperCase() === "OK") return "O dia está OK — não há o que pedir.";
    if (ehPontoInvertido(aberta))
      return "Ponto invertido é defeito do cartão: exige decisão manual do DP, não comunicado ao colaborador.";
    if (!marcacaoAusente(aberta))
      return "A ferramenta não identificou marcação de entrada ou saída faltando neste dia.";
    return contratoDe(aberta).erro;
  }, [aberta, casos, ehInterno, carregandoMedianas, medianas, contratoDe]);

  const avisarUmaLinha = (linha) => {
    if (!ehInterno) return abrirMotoristas([linha]);
    const { modelo, divergencia } = rotaAvisoInterno(linha, medianas);
    return abrirInternos([{ ...linha, __modelo: modelo, __divergencia: divergencia }]);
  };

  /* ---- A MENSAGEM que o balão da linha do tempo mostra (app.js:4992-5000) ----
     Mesma rota, mesmo modelo e MESMAS funções do envio de verdade — a prévia não
     pode ser um texto parecido escrito à parte, ou o DP lê uma coisa e o colaborador
     recebe outra. Só o modelo (o texto do `app_config`) é lido dentro do cartão.

     JÁ ENVIADO: o texto é RECONSTRUÍDO — o Transnet não devolve a mensagem, e o
     `ponto_caso` guarda só o carimbo. Quem diz qual modelo saiu é o `tipo` do caso
     ("fora" · "cerco" · "almoco"/"incompleto"/"curta"), gravado no envio; e a ponta
     cobrada vem do `caso.ponta` congelado, não da leitura de hoje. Sem isso um dia
     já corrigido mostraria o texto errado, ou nenhum. */
  const previaAviso = useMemo(() => {
    if (!aberta) return null;
    const caso = casos[chaveDia(aberta.cracha, aberta.date_ref)] || null;
    const enviado = !!String(caso?.aviso_enviado_em ?? "").trim();
    const tipoCaso = String(caso?.tipo ?? "").trim().toLowerCase();
    const gpsDaLinha = gpsPorCracha[cra8(aberta.cracha)];

    const daFora = () =>
      gpsDaLinha
        ? {
            chave: "aviso_fora",
            rotulo: "avisar que bateu fora",
            montar: (tpl) => mensagemBateuFora(tpl, aberta, gpsDaLinha),
          }
        : null;
    const daInterno = (modelo, divergencia) => ({
      chave: `interno_${modelo}`,
      rotulo: `aviso de ${modelo === "almoco" ? "almoço curto" : modelo === "curta" ? "jornada curta" : "registro incompleto"}`,
      montar: (tpl) => mensagemInterno(tpl, aberta, divergencia),
    });
    const daMotorista = (falta) => ({
      chave: "ocorrencia_motorista",
      rotulo: "enviar ocorrência",
      montar: (tpl) => mensagemRevisaoMotorista(tpl, aberta, falta),
    });

    if (enviado) {
      if (tipoCaso === "fora") return daFora();
      if (["almoco", "curta", "incompleto"].includes(tipoCaso) && ehInterno) {
        const { divergencia } = rotaAvisoInterno(aberta, medianas);
        return daInterno(tipoCaso, divergencia);
      }
      if (tipoCaso === "cerco" || tipoCaso === "incompleto") {
        // `ponta` é o que foi cobrado NAQUELE aviso; a leitura de hoje pode já ter
        // mudado (o DP cravou o Real depois).
        const ponta = String(caso?.ponta ?? "").trim().toLowerCase();
        const falta =
          ponta === "ambos"
            ? "ENTRADA E SAÍDA"
            : ponta === "entrada"
              ? "ENTRADA"
              : ponta === "saida"
                ? "SAÍDA"
                : marcacaoAusente(aberta);
        if (falta) return daMotorista(falta);
      }
    }

    if (ehInterno) {
      const { modelo, divergencia } = rotaAvisoInterno(aberta, medianas);
      return modelo ? daInterno(modelo, divergencia) : null;
    }
    const falta = marcacaoAusente(aberta);
    // Sem marcação faltando não há ocorrência a pedir. Mas se ele bateu FORA, a
    // mensagem que sai é a de justificativa — e é essa que o balão deve mostrar.
    if (!falta) return gpsDaLinha?.fora ? daFora() : null;
    return daMotorista(falta);
  }, [aberta, casos, ehInterno, medianas, gpsPorCracha]);

  const chips = [
    ["TODOS", "TODOS"],
    ["REVISAR", "REVISAR"],
    ["OK", "OK"],
    ["FORA", "📍 FORA"],
  ];

  return (
    <AbaShell
      resumo="Cartão, fontes e decisão de ajuste. A régua é da view do Athena — esta tela só exibe o que já foi calculado."
      carregando={carregandoDatas && !datas.length}
      erro={erro}
      filtros={
        <>
          <select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            {categorias.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select value={data} onChange={(e) => setData(e.target.value)}>
            {datas.length ? (
              datas.map((d) => (
                <option key={d} value={d}>
                  {fmtData(d)}
                </option>
              ))
            ) : (
              <option value="">sem datas</option>
            )}
          </select>

          <button
            type="button"
            onClick={() => setLotesDatas((n) => n + PAGINAS_POR_LOTE)}
            disabled={carregandoDatas}
            className="dp-btn"
            title="Busca mais páginas de ponto_diario para trazer datas anteriores."
          >
            {carregandoDatas ? "carregando…" : "+ datas anteriores"}
          </button>

          {chips.map(([id, rotulo]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFiltro(id)}
              className={`dp-chip-f ${filtro === id ? "on" : ""}`}
            >
              {rotulo} <span className="n">{contagens[id] || 0}</span>
            </button>
          ))}

          <span style={{ flex: 1 }} />

          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome ou crachá…"
            style={{ width: 230 }}
          />
          {/* O aviso vai para as linhas VISÍVEIS (o filtro e a busca da barra são a
              seleção). Quem não se encaixa na rota nem entra na conta; quem entra mas
              é barrado aparece no modal, com o motivo. */}
          {ehInterno ? (
            rotasInternos.alvo.length ? (
              <button
                type="button"
                className="dp-btn"
                onClick={() => abrirInternos(rotasInternos.alvo)}
                title="Almoço curto (comunica), registro incompleto (pede ajuste em 24 h) e jornada curta — os três num envio só."
              >
                📣 Enviar ocorrência ({rotasInternos.alvo.length})
              </button>
            ) : (
              <BotaoSemAlvo
                titulo={
                  carregandoMedianas
                    ? "Carregando o histórico de jornada do interno para decidir os modelos…"
                    : "Nenhum interno/aprendiz visível se encaixa nos modelos de aviso."
                }
              >
                📣 Enviar ocorrência
              </BotaoSemAlvo>
            )
          ) : alvoMotoristas.length ? (
            <button
              type="button"
              className="dp-btn"
              onClick={() => abrirMotoristas(alvoMotoristas)}
              title="Motoristas com marcação de entrada ou saída faltando. Com alvo, a mensagem pede o horário; sem alvo, pede o registro."
            >
              📣 Enviar ocorrência ({alvoMotoristas.length})
            </button>
          ) : (
            <BotaoSemAlvo titulo="Nenhum motorista visível com marcação de entrada ou saída faltando identificada.">
              📣 Enviar ocorrência
            </BotaoSemAlvo>
          )}
          {/* ✅ LANÇAR AJUSTE — o caminho que CORRIGE o cartão, ao lado do que PEDE.
              Abre o painel do lote (dois botões lá dentro: ensaio e valendo). */}
          {loteAjuste.dentro.length ? (
            <button
              type="button"
              className="dp-btn"
              onClick={() => setLoteAberto(true)}
              title="Manda o alvo que a view já resolveu para o robô do Cartão de Ponto. Ele reescreve o cartão inteiro — abre com ensaio e lançamento de verdade."
            >
              ✅ Lançar ajuste ({loteAjuste.dentro.length})
            </button>
          ) : loteAjuste.fora.length ? (
            /* Ninguém entra, mas HÁ candidatos barrados: o botão continua clicável
               de propósito — o DP precisa poder LER por que ninguém entrou, em vez
               de encarar um botão morto e adivinhar. Não há o que disparar: os
               dois botões do painel nascem desabilitados. */
            <button
              type="button"
              className="dp-btn"
              onClick={() => setLoteAberto(true)}
              title={`Nenhuma linha visível pode ir para o robô — ${loteAjuste.fora.length} candidato(s) barrados. Abra para ver o motivo de cada um.`}
            >
              ✅ Lançar ajuste (0 de {loteAjuste.fora.length})
            </button>
          ) : (
            <BotaoSemAlvo titulo="Nenhuma linha visível tem alvo completo para lançar no Cartão de Ponto (dia OK não entra: não há o que corrigir).">
              ✅ Lançar ajuste
            </BotaoSemAlvo>
          )}
          {alvoFora.length ? (
            <button
              type="button"
              className="dp-btn"
              onClick={() => abrirFora(alvoFora)}
              title="Quem bateu ponto FORA de local conhecido (garagem/terminal), pelo GPS do app. Pede justificativa — não abre caso."
            >
              📍 Avisar quem bateu fora ({alvoFora.length})
            </button>
          ) : (
            <BotaoSemAlvo titulo="Ninguém com batida fora de local conhecido nas linhas visíveis.">
              📍 Avisar quem bateu fora
            </BotaoSemAlvo>
          )}
          <button type="button" onClick={() => carregarDia()} className="dp-btn">
            <RefreshCw size={13} style={{ display: "inline", verticalAlign: "-2px" }} /> Atualizar
          </button>
        </>
      }
    >
      {/* O dia sem ponto importado NÃO entra no seletor (regra do original,
          main.py:7067). Mas some em silêncio lá, e aí ninguém entende por que
          ontem não está na lista — então ele aparece aqui, como aviso. */}
      {datasSemPonto.length > 0 && (
        <div className="dp-resumo" style={{ borderColor: "var(--dp-danger-line)" }}>
          <span className="dp-pill danger">ponto ainda não importado</span>{" "}
          <b>{datasSemPonto.slice(0, 5).map(fmtData).join(" · ")}</b>
          {datasSemPonto.length > 5 ? ` e mais ${datasSemPonto.length - 5}` : ""} — esses dias já têm
          escala na base, mas nenhuma batida chegou do Transnet, então não entram no seletor. Não é
          gente que faltou: é dia que não chegou.
        </div>
      )}

      {/* O que grava e o que ainda não — a distinção que importa é: nada aqui FALA com o
          trabalhador. Real manual e ponto conferido mexem só na base do DP. */}
      <div className="dp-resumo">
        <span className="dp-pill ok">✓ grava</span> <b>Real manual do DP</b> (ponto_real_manual) e{" "}
        <b>ponto conferido</b> (ponto_caso) — abra o cartão da linha. Os dois ficam na base do DP e
        podem ser desfeitos.{" "}
        <span className="dp-pill danger">📣 fala com o trabalhador</span> <b>Enviar ocorrência</b> e{" "}
        <b>avisar quem bateu fora</b> montam o CSV do Transnet e disparam o robô — sempre com{" "}
        <b>Ensaio</b> antes do envio de verdade. O envio de verdade abre/atualiza o caso do dia (e
        com ele o prazo de 48 h); o ensaio não abre nada. <b>Bateu fora</b> abre caso com
        origem <span className="dp-mono">fora</span> — é justificativa, não ajuste, e é a origem
        que mantém essa diferença.{" "}
        <span className="dp-pill danger">✍ escreve no cartão</span> <b>Lançar ajuste</b> manda o
        alvo que a view já resolveu para o robô do <b>Cartão de Ponto</b>, que reescreve o cartão
        inteiro daquele dia — é o desfecho de quem <i>não</i> tem o que perguntar ao colaborador.
        Também com <b>Ensaio</b> antes.
      </div>

      {/* ---- legenda das cores da linha + contagem de sugestões ---- */}
      <div className="dp-resumo flex flex-wrap items-center gap-3">
        <span className="flex items-center gap-1.5">
          <i style={{ ...ESTILO_LEGENDA, background: "var(--dp-ok-bg)" }} /> ponto OK
        </span>
        <span className="flex items-center gap-1.5">
          <i style={{ ...ESTILO_LEGENDA, background: "var(--dp-warn-bg)" }} /> invertido ou com sugestão utilizável
        </span>
        <span className="flex items-center gap-1.5">
          <i style={{ ...ESTILO_LEGENDA, background: "var(--dp-accent-soft)" }} /> falta marcação identificada
        </span>
        <span className="flex items-center gap-1.5">
          <i style={{ ...ESTILO_LEGENDA, background: "var(--dp-danger-bg)" }} /> sem sugestão e sem ponta
          identificada
        </span>
        {!!comSugestao && <span style={{ marginLeft: "auto" }}>{comSugestao} com sugestão utilizável</span>}
      </div>

      {/* ---- grade (a compartilhada: ⚙ colunas, fixar, redimensionar, CSV, preferência
              salva em `tbl_p2`). O filtro é da aba; a grade só ordena o que recebe. ---- */}
      <TabelaDP
        chave="p2"
        colunas={colunas}
        linhas={visiveis}
        classeLinha={(l) => classeLinha(l, bloqueios[chaveDia(l.cracha, l.date_ref)])}
        idLinha={(l) => chaveDia(l.cracha, l.date_ref)}
        aoClicarLinha={(l) => setAberta(l)}
        carregando={carregando}
        mensagemCarregando={`Carregando a revisão de ${fmtData(data)}…`}
        vazio={linhas.length ? "Nada neste filtro." : "Nenhum cartão para esta categoria e data."}
        nomeCsv={`revisao_${String(categoria).toLowerCase()}_${data}`}
      />

      <p className="dp-resumo flex items-center gap-1.5" style={{ margin: 0, paddingBottom: 20 }}>
        <MapPin size={12} />
        Régua do GPS: mais de {RAIO_VEIC} m da posição do veículo (gps_carro) é "fora"; sem veículo, vale o local
        conhecido até {RAIO_LOCAL} m. Em dia de <b>reserva</b> ele não tem carro — batida em local conhecido vale
        por si. <b>n/m</b> = não medido: a âncora do veículo veio sem coordenada, e isso não conta como "junto".
        Tolerância do alvo: entrada −{TOL_ENTRADA_MIN} min, saída +{TOL_SAIDA_MIN} min.
      </p>

      {/* O CARTÃO DO DIA é o compartilhado (`../CartaoDoDia`) — o MESMO que a Gordura
          abre. O que é desta tela vai por prop: o GPS já calculado do dia inteiro
          (aqui a régua roda uma vez para a grade toda, não uma vez por pop-up), o
          botão de decisão dela no rodapé e a frase do rodapé. */}
      {aberta && (
        <CartaoDoDia
          linha={aberta}
          caso={casos[chaveDia(aberta.cracha, aberta.date_ref)]}
          gps={gpsPorCracha[cra8(aberta.cracha)]}
          aoFechar={() => setAberta(null)}
          aoRecarregar={recarregarLinha}
          aoAvisar={avisarUmaLinha}
          impedimentoAviso={impedimentoAviso}
          previaAviso={previaAviso}
          acoesRodape={
            <BotaoPontoConferido
              linha={aberta}
              caso={casos[chaveDia(aberta.cracha, aberta.date_ref)]}
              aoRecarregar={recarregarLinha}
            />
          }
          rodapeInfo={
            pontoConferido(casos[chaveDia(aberta.cracha, aberta.date_ref)]) ? (
              <>
                ✓ <b>Conferido pelo DP</b>
                {casos[chaveDia(aberta.cracha, aberta.date_ref)]?.conferido_em
                  ? ` · ${fmtDataHora(casos[chaveDia(aberta.cracha, aberta.date_ref)].conferido_em)}`
                  : ""}{" "}
                — o dia sai da Revisão e conta como certo nas Folgas.
              </>
            ) : (
              <>
                Real manual e ponto conferido ficam na base do DP. <b>Enviar ocorrência</b> fala com o
                trabalhador: abre o comunicado deste dia, com Ensaio e envio de verdade.
              </>
            )
          }
        />
      )}

      {/* O comunicado fica POR CIMA do cartão (z-index maior) em vez de fechá-lo: quem
          clicou em "Enviar ocorrência" continua vendo o dia que está cobrando. */}
      {envio && (
        <ModalComunicado
          {...envio}
          casoDe={casoDe}
          comPontoAntes={comPontoAntes}
          aoFechar={() => setEnvio(null)}
          aoConcluir={carregarDia}
        />
      )}

      {/* O lote da correção. Mesma altura do comunicado: ele também abre POR CIMA
          do cartão, para quem clicou continuar vendo o dia. */}
      {loteAberto && (
        <PainelLancarAjuste
          data={data}
          lote={loteAjuste}
          aoFechar={() => setLoteAberto(false)}
          aoConcluir={carregarDia}
        />
      )}
    </AbaShell>
  );
}

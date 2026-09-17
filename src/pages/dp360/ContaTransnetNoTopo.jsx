import { useCallback, useEffect, useRef, useState } from "react";
import {
  apagarCredencialTransnet,
  gravarValidacaoTransnet,
  lerCredencialTransnet,
  lerValidacaoTransnet,
  logRoboDP360,
  salvarCredencialTransnet,
  statusRoboDP360,
  testarLoginTransnet,
} from "../../services/dp360Api";

/**
 * A CONTA DO TRANSNET, NO TOPO — ao lado do robô (dono, 15/09/2026: "em vez de ficar na
 * tela inicial, coloca no topo perto de onde está mandando o robô").
 *
 * Na tela Início ela só era vista por quem passava por lá — e quem abre direto a Revisão ou
 * as Ocorrências disparava sem credencial e só descobria pelo erro. No topo, "conectado ou
 * não" fica ao lado de "robô rodando ou não", que são as duas perguntas de quem vai
 * disparar.
 *
 * O robô não tem conta própria: ele entra no Transnet com um login de gente, e é no nome de
 * quem entrou que o Transnet registra a correção, a recusa, a advertência. Por isso a
 * credencial é a de quem manda.
 *
 * Ela fica na SESSÃO DESTE NAVEGADOR e em lugar nenhum mais (`dp360Api`, `sessionStorage`):
 * não vai para o banco do INOVE, não é sincronizada, e sai quando a pessoa sai. Numa
 * máquina compartilhada, a próxima pessoa encontra o campo vazio — que é o certo, porque o
 * login é dela. A senha nunca volta para a tela depois de guardada: trocar de conta é
 * desconectar e entrar de novo.
 *
 * O TESTE DO LOGIN (dono, 17/09/2026: "quero um bot de validação de login, para ver se o
 * que a pessoa colocou loga no Transnet"). Ao conectar, o robô `login` entra no Transnet
 * com a credencial e confere se entrou — sem abrir cartão nem gravar nada. Recusado, a
 * credencial é apagada: nenhum lote sai com uma senha que o Transnet não aceita. Se o teste
 * não conseguir rodar (GitHub fora, tempo esgotado), a credencial fica e a tela diz isso.
 */

const PASSO_MS = 10000;
const LIMITE_MIN = 10;

const txt = (v) => String(v ?? "").trim();

function horaCurta(iso) {
  const t = Date.parse(txt(iso));
  if (!Number.isFinite(t)) return "";
  return new Date(t).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
}

/** A última linha `RESULTADO:` que o bot_login escreveu no log. */
function lerResultado(log) {
  const achados = [...String(log || "").matchAll(/RESULTADO:\s*(LOGIN_OK|LOGIN_RECUSADO|ERRO)\s*(?:\|\s*(.*))?$/gm)];
  const ultimo = achados[achados.length - 1];
  return ultimo ? { tipo: ultimo[1], motivo: txt(ultimo[2]) } : null;
}

/** Espera o run do teste terminar; devolve { id, conclusao } ou { conclusao: "tempo_esgotado" }. */
async function esperarTeste({ runId, desde }, aoMudar) {
  const limite = Date.now() + LIMITE_MIN * 60000;
  let fase = "";
  while (Date.now() < limite) {
    await new Promise((r) => setTimeout(r, PASSO_MS));
    let runs = [];
    try {
      runs = await statusRoboDP360(2);
    } catch {
      continue;
    }
    const meu = runId
      ? runs.find((x) => String(x.id) === String(runId))
      : runs
          .filter((x) => txt(x.nome).toLowerCase().includes("login") && Date.parse(txt(x.comecou_em)) >= desde - 60000)
          .sort((a, b) => Date.parse(txt(b.comecou_em)) - Date.parse(txt(a.comecou_em)))[0];
    if (!meu) continue;
    if (txt(meu.status) !== "completed") {
      const agora = txt(meu.status) === "queued" ? "na fila do GitHub" : "entrando no Transnet";
      if (agora !== fase) {
        fase = agora;
        aoMudar?.(fase, meu.id);
      }
      continue;
    }
    return { id: meu.id, conclusao: txt(meu.conclusao) };
  }
  return { id: runId, conclusao: "tempo_esgotado" };
}

/** O log aparece alguns segundos depois de o run terminar: tenta algumas vezes. */
async function resultadoDoRun(runId) {
  if (!runId) return null;
  for (let i = 0; i < 4; i += 1) {
    try {
      const r = lerResultado(await logRoboDP360(runId));
      if (r) return r;
    } catch {
      /* tenta de novo */
    }
    await new Promise((ok) => setTimeout(ok, 4000));
  }
  return null;
}

export default function ContaTransnetNoTopo() {
  const [salva, setSalva] = useState(() => lerCredencialTransnet());
  const [validacao, setValidacao] = useState(() => lerValidacaoTransnet());
  const [recusado, setRecusado] = useState(null); // { usuario, motivo } — a credencial já foi apagada
  const [aberto, setAberto] = useState(false);
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const caixa = useRef(null);
  const testando = useRef(false);

  // a sessão pode ter mudado por fora (saiu do INOVE em outra aba): relê ao abrir
  useEffect(() => {
    if (aberto) {
      setSalva(lerCredencialTransnet());
      setValidacao(lerValidacaoTransnet());
    }
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return undefined;
    const fora = (e) => {
      if (caixa.current && !caixa.current.contains(e.target)) setAberto(false);
    };
    const esc = (e) => e.key === "Escape" && setAberto(false);
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aberto]);

  const marcar = useCallback((cred, v) => {
    const comDono = v ? { ...v, usuario: cred.usuario } : null;
    gravarValidacaoTransnet(comDono);
    setValidacao(comDono);
  }, []);

  /* O TESTE. `retomar` = a página recarregou com um teste em andamento: espera o mesmo run
     em vez de disparar outro. */
  const testar = useCallback(
    async (retomar = null) => {
      const cred = lerCredencialTransnet();
      if (!cred || testando.current) return;
      testando.current = true;
      setRecusado(null);
      try {
        let runId = retomar?.runId || null;
        let desde = retomar?.desde || Date.now();
        if (!retomar) {
          marcar(cred, { estado: "testando", fase: "disparando o teste", desde });
          try {
            const r = await testarLoginTransnet();
            runId = r?.execucao?.run_id || null;
          } catch (e) {
            marcar(cred, { estado: "erro", motivo: e?.message || "não foi possível disparar o teste" });
            return;
          }
          marcar(cred, { estado: "testando", fase: "na fila do GitHub", desde, runId });
        }
        const fim = await esperarTeste({ runId, desde }, (fase, id) => {
          runId = runId || id;
          marcar(cred, { estado: "testando", fase, desde, runId });
        });
        runId = runId || fim.id;
        // a credencial pode ter sido trocada ou apagada enquanto o teste rodava
        const agora = lerCredencialTransnet();
        if (!agora || agora.usuario !== cred.usuario) return;

        const res = await resultadoDoRun(runId);
        if (fim.conclusao === "success" || res?.tipo === "LOGIN_OK") {
          marcar(cred, { estado: "ok", em: new Date().toISOString() });
        } else if (res?.tipo === "LOGIN_RECUSADO") {
          apagarCredencialTransnet();
          setSalva(null);
          setValidacao(null);
          setUsuario(cred.usuario);
          setRecusado({ usuario: cred.usuario, motivo: res.motivo });
          setAberto(true);
        } else {
          const motivo =
            res?.motivo ||
            (fim.conclusao === "tempo_esgotado"
              ? "o teste não terminou a tempo"
              : `o robô terminou sem resposta (${fim.conclusao || "sem conclusão"})`);
          marcar(cred, { estado: "erro", motivo });
        }
      } finally {
        testando.current = false;
      }
    },
    [marcar],
  );

  // a página recarregou no meio de um teste: retoma, ou dá o teste por perdido se é velho
  useEffect(() => {
    const v = lerValidacaoTransnet();
    if (v?.estado !== "testando") return;
    if (Date.now() - Number(v.desde || 0) > LIMITE_MIN * 60000) {
      const cred = lerCredencialTransnet();
      if (cred) marcar(cred, { estado: "erro", motivo: "o teste anterior não terminou" });
      return;
    }
    testar({ runId: v.runId, desde: v.desde });
  }, [testar, marcar]);

  const conectar = (evento) => {
    evento.preventDefault();
    const u = usuario.trim();
    if (!u || !senha) return;
    salvarCredencialTransnet(u, senha);
    setSalva(lerCredencialTransnet());
    setSenha("");
    setUsuario("");
    testar();
  };

  const desconectar = () => {
    apagarCredencialTransnet();
    setSalva(null);
    setValidacao(null);
  };

  const estado = salva ? validacao?.estado || "" : "";
  const selo = { ok: " ✓", testando: " …", erro: " ?" }[estado] || "";

  return (
    <div className="dp-robo" ref={caixa}>
      <button
        type="button"
        className={`dp-robo-btn dp-conta-btn ${salva ? "is-ok" : "is-sem"}`}
        onClick={() => setAberto((v) => !v)}
        title={
          salva
            ? `O robô entra no Transnet como ${salva.usuario}${
                estado === "ok" ? " (login testado)" : estado === "testando" ? " — testando o login" : ""
              }. Clique para ver, testar ou trocar.`
            : "Sem a sua conta do Transnet os robôs não saem. Clique para conectar."
        }
        aria-expanded={aberto}
      >
        <span aria-hidden="true">🔑</span>
        {salva ? `Transnet · ${salva.usuario}${selo}` : "Conectar o Transnet"}
      </button>

      {aberto && (
        <div className="dp-robo-gaveta dp-conta-gaveta" role="dialog" aria-label="Sua conta do Transnet">
          <div className="dp-robo-tit">Sua conta do Transnet</div>
          {salva ? (
            <span className="dp-pill ok">conectada · {salva.usuario}</span>
          ) : (
            <span className="dp-pill warn">sem credencial — os robôs não saem</span>
          )}

          {/* o resultado do teste do login */}
          {salva && estado === "testando" ? (
            <div className="dp-pill accent" style={{ marginTop: 8, whiteSpace: "normal" }}>
              🔄 testando o login no Transnet — {validacao?.fase || "aguarde"} (leva cerca de 1 min)
            </div>
          ) : null}
          {salva && estado === "ok" ? (
            <div className="dp-pill ok" style={{ marginTop: 8, whiteSpace: "normal" }}>
              ✓ login testado: o Transnet aceitou{validacao?.em ? ` · ${horaCurta(validacao.em)}` : ""}
            </div>
          ) : null}
          {salva && estado === "erro" ? (
            <div className="dp-pill warn" style={{ marginTop: 8, whiteSpace: "normal" }}>
              não deu para testar o login: {validacao?.motivo || "sem detalhe"}
            </div>
          ) : null}
          {!salva && recusado ? (
            <div className="dp-pill danger" style={{ marginTop: 8, whiteSpace: "normal" }} role="alert">
              ✗ o Transnet recusou o login {recusado.usuario}
              {recusado.motivo ? `: ${recusado.motivo}` : ""}. Confira o usuário e a senha e conecte de novo.
            </div>
          ) : null}

          <div className="dp-faint" style={{ fontSize: 11.5, marginTop: 6 }}>
            O robô entra no Transnet com o SEU login, e é no seu nome que a ação fica registrada
            lá. A credencial vale só nesta sessão deste navegador: não vai para banco nenhum e
            some quando você sai do INOVE. Ao conectar, um robô testa o login — só entra e sai,
            sem mexer em nada.
          </div>

          {salva ? (
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
              <button type="button" className="dp-btn" onClick={() => testar()} disabled={estado === "testando"}>
                {estado === "testando" ? "Testando…" : "Testar o login"}
              </button>
              <button type="button" className="dp-btn" onClick={desconectar}>
                Desconectar
              </button>
              <span className="dp-faint" style={{ fontSize: 11.5 }}>
                trocar de conta é desconectar e entrar de novo
              </span>
            </div>
          ) : (
            <form onSubmit={conectar} className="dp-conta-form">
              <input
                className="dp-input"
                placeholder="Usuário Transnet"
                autoComplete="username"
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
              />
              <input
                className="dp-input"
                type="password"
                placeholder="Senha"
                autoComplete="current-password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
              />
              <button type="submit" className="dp-btn" disabled={!usuario.trim() || !senha}>
                Conectar e testar
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

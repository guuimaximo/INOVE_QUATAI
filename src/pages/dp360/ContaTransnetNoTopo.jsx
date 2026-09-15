import { useEffect, useRef, useState } from "react";
import {
  apagarCredencialTransnet,
  lerCredencialTransnet,
  salvarCredencialTransnet,
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
 */
export default function ContaTransnetNoTopo() {
  const [salva, setSalva] = useState(() => lerCredencialTransnet());
  const [aberto, setAberto] = useState(false);
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const caixa = useRef(null);

  // a sessão pode ter mudado por fora (saiu do INOVE em outra aba): relê ao abrir
  useEffect(() => {
    if (aberto) setSalva(lerCredencialTransnet());
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

  const conectar = (evento) => {
    evento.preventDefault();
    const u = usuario.trim();
    if (!u || !senha) return;
    salvarCredencialTransnet(u, senha);
    setSalva(lerCredencialTransnet());
    setSenha("");
    setUsuario("");
    setAberto(false);
  };

  const desconectar = () => {
    apagarCredencialTransnet();
    setSalva(null);
  };

  return (
    <div className="dp-robo" ref={caixa}>
      <button
        type="button"
        className={`dp-robo-btn dp-conta-btn ${salva ? "is-ok" : "is-sem"}`}
        onClick={() => setAberto((v) => !v)}
        title={
          salva
            ? `O robô entra no Transnet como ${salva.usuario}. Clique para desconectar ou trocar.`
            : "Sem a sua conta do Transnet os robôs não saem. Clique para conectar."
        }
        aria-expanded={aberto}
      >
        <span aria-hidden="true">🔑</span>
        {salva ? `Transnet · ${salva.usuario}` : "Conectar o Transnet"}
      </button>

      {aberto && (
        <div className="dp-robo-gaveta dp-conta-gaveta" role="dialog" aria-label="Sua conta do Transnet">
          <div className="dp-robo-tit">Sua conta do Transnet</div>
          {salva ? (
            <span className="dp-pill ok">conectada · {salva.usuario}</span>
          ) : (
            <span className="dp-pill warn">sem credencial — os robôs não saem</span>
          )}

          <div className="dp-faint" style={{ fontSize: 11.5, marginTop: 6 }}>
            O robô entra no Transnet com o SEU login, e é no seu nome que a ação fica registrada
            lá. A credencial vale só nesta sessão deste navegador: não vai para banco nenhum e
            some quando você sai do INOVE.
          </div>

          {salva ? (
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
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
                Conectar
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

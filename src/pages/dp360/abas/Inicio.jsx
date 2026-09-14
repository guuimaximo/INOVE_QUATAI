import { useEffect, useState } from "react";
import AbaShell from "./AbaShell";
import {
  apagarCredencialTransnet,
  carregarResumoDP360,
  lerCredencialTransnet,
  salvarCredencialTransnet,
} from "../../../services/dp360Api";

function formatarData(valor) {
  if (!valor) return "sem registro";
  const iso = String(valor);
  const data = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  if (Number.isNaN(data.getTime())) return iso;
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: iso.length > 10 ? "short" : undefined,
  }).format(data);
}

/**
 * A CONTA DO TRANSNET DE QUEM ESTÁ USANDO.
 *
 * O robô não tem conta própria: ele entra no Transnet com um login de gente, e é no nome
 * de quem entrou que o Transnet registra a correção, a recusa, a advertência. Por isso a
 * credencial é a de quem manda — com uma conta de serviço comum, o mês inteiro apareceria
 * lá como sendo da mesma pessoa, e ninguém saberia quem decidiu o quê.
 *
 * Ela fica na SESSÃO DESTE NAVEGADOR e em lugar nenhum mais: não vai para o banco do
 * INOVE, não é sincronizada, e sai quando a pessoa sai. Numa máquina compartilhada, a
 * próxima pessoa encontra o campo vazio — que é o certo, porque o login é dela.
 *
 * A senha nunca aparece de volta na tela depois de guardada: o que se mostra é o usuário
 * e o estado. Trocar de conta é apagar e digitar de novo.
 */
function ContaTransnet() {
  const [salva, setSalva] = useState(() => lerCredencialTransnet());
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");

  const conectar = (evento) => {
    evento.preventDefault();
    const u = usuario.trim();
    if (!u || !senha) return;
    salvarCredencialTransnet(u, senha);
    setSalva({ usuario: u, senha });
    setSenha("");
    setUsuario("");
  };

  const desconectar = () => {
    apagarCredencialTransnet();
    setSalva(null);
  };

  return (
    <div className="dp-card" style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <b style={{ fontSize: 14 }}>Sua conta do Transnet</b>
        {salva ? (
          <span className="dp-pill ok">conectada · {salva.usuario}</span>
        ) : (
          <span className="dp-pill warn">sem credencial — os robôs não saem</span>
        )}
      </div>

      <div className="dp-faint" style={{ fontSize: 11.5, marginTop: 4, maxWidth: "70ch" }}>
        O robô entra no Transnet com o SEU login, e é no seu nome que a ação fica
        registrada lá. A credencial vale só nesta sessão deste navegador: não vai para
        banco nenhum e some quando você sai do INOVE.
      </div>

      {salva ? (
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10 }}>
          <button type="button" className="dp-btn" onClick={desconectar}>
            Desconectar
          </button>
          <span className="dp-faint" style={{ fontSize: 11.5 }}>
            trocar de conta é desconectar e entrar de novo
          </span>
        </div>
      ) : (
        <form onSubmit={conectar} style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
          <input
            className="dp-input"
            style={{ width: 190 }}
            placeholder="Usuário Transnet"
            autoComplete="username"
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
          />
          <input
            className="dp-input"
            style={{ width: 190 }}
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
  );
}

export default function Inicio() {
  const [resumo, setResumo] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let ativo = true;
    carregarResumoDP360()
      .then((dados) => { if (ativo) setResumo(dados); })
      .catch((falha) => { if (ativo) setErro(falha.message || "Falha ao consultar a base DP360."); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, []);

  const fontes = resumo?.fontes || [];

  return (
    <AbaShell
      carregando={carregando}
      erro={erro}
      resumo="Até quando cada fonte do ponto está atualizada. Se uma delas atrasa, as telas mostram dado velho."
    >
      <ContaTransnet />

      <div className="dp-tabela-wrap">
        <table className="dp-tabela">
          <thead>
            <tr>
              <th>Fonte</th>
              <th>Atualizada até</th>
              <th>Situação</th>
            </tr>
          </thead>
          <tbody>
            {fontes.map((fonte) => (
              <tr key={fonte.nome} className={fonte.ok ? "row-ok" : "row-sem"}>
                <td>{fonte.nome}</td>
                <td className="dp-num dp-mono">{fonte.ok ? formatarData(fonte.atualizado_em) : "—"}</td>
                <td>
                  <span className={`dp-pill ${fonte.ok ? "ok" : "danger"}`}>
                    {fonte.ok ? "no ar" : "indisponível"}
                  </span>
                </td>
              </tr>
            ))}
            {!fontes.length && (
              <tr>
                <td colSpan={3} className="dp-faint">Nenhuma fonte respondeu.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AbaShell>
  );
}

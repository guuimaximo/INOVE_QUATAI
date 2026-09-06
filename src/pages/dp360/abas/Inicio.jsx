import { useEffect, useState } from "react";
import AbaShell from "./AbaShell";
import { carregarResumoDP360 } from "../../../services/dp360Api";

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

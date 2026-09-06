import { useCallback, useEffect, useMemo, useState } from "react";
import AbaShell from "./AbaShell";
import { lerTudoDP360 } from "../../../services/dp360Api";

/* ═══════════════════════════════════════════════════════════════════════════
   Importações — histórico do que a ferramenta subiu para o Transnet.

   Porte de Sistemas/PONTO/app/ui/app.js::viewImp (+ rowImp/batidasImp).
   Fonte única: a tabela `ponto_importacoes` (DDL em PONTO/supabase_importacoes.sql).
   1 linha = 1 evento por motorista × dia × passo. Quem grava é a FERRAMENTA
   (supabase_client.gravar_importacoes, append-only); esta tela é SÓ LEITURA —
   o gateway nem libera update/delete nessa tabela.

   O rótulo do passo é do original e não é cosmético: passo 1 é a importação da
   REFEIÇÃO (a janela de almoço) e passo 2 é a CORREÇÃO do ponto. Quem lê o
   histórico precisa distinguir "eu mexi no almoço dele" de "eu mexi no ponto dele".
   ═══════════════════════════════════════════════════════════════════════════ */

const PASSO_ROTULO = { 1: "Refeição", 2: "Correção" };
const rotuloPasso = (passo) =>
  PASSO_ROTULO[Number(passo)] || (passo == null || passo === "" ? "—" : `P${passo}`);

/* ─────────────────────────── formatação ─────────────────────────── */

// `date_ref` é TEXT na tabela: normalmente ISO, mas nada garante. Formata o que
// reconhece e devolve o resto cru em vez de inventar uma data.
function fmtData(valor) {
  const texto = String(valor ?? "").trim();
  const partes = /^(\d{4})-(\d{2})-(\d{2})/.exec(texto);
  return partes ? `${partes[3]}/${partes[2]}/${partes[1]}` : texto || "—";
}

// `importado_em` é timestamptz — chega do PostgREST com fuso ("...+00:00"), então
// o Date parseia certo e o Intl mostra no fuso de quem está olhando.
function fmtQuando(valor) {
  const texto = String(valor ?? "").trim();
  if (!texto) return "—";
  const data = new Date(texto);
  if (Number.isNaN(data.getTime())) return texto;
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(data);
}

const semAcento = (texto) =>
  String(texto ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

// A tabela nasce com status 'gerado' (default do DDL) e o fluxo prevê 'lancado'.
// Qualquer outra coisa é tratada como alerta em vez de virar pílula sem cor.
function classeStatus(status) {
  const s = semAcento(status).trim();
  if (!s) return "mute";
  if (s === "gerado") return "mute";
  if (s === "lancado") return "ok";
  if (s.includes("erro") || s.includes("falha")) return "danger";
  return "warn";
}

/* Batidas importadas: só os campos preenchidos no evento, como no batidasImp(). */
const CAMPOS_BATIDA = [
  ["E", "entrada"],
  ["SA", "saida_almoco"],
  ["VA", "volta_almoco"],
  ["S", "saida"],
];

function Batidas({ linha }) {
  const marcadas = CAMPOS_BATIDA.filter(([, campo]) => String(linha[campo] ?? "").trim());
  if (!marcadas.length) return <span className="dp-chip none">—</span>;
  return (
    <>
      {marcadas.map(([sigla, campo]) => (
        <span key={campo} className="dp-chip" style={{ marginRight: 4 }}>
          <span className="es">{sigla}</span>
          {String(linha[campo]).trim()}
        </span>
      ))}
    </>
  );
}

/* ═════════════════════════════ tela ═════════════════════════════ */

export default function Importacoes() {
  const [linhas, setLinhas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [passo, setPasso] = useState("TODOS");
  const [status, setStatus] = useState("TODOS");
  const [busca, setBusca] = useState("");

  const carregar = useCallback(() => {
    setCarregando(true);
    setErro("");
    // Mais recentes primeiro — a mesma ordem de supabase_client.ler_importacoes().
    return lerTudoDP360("ponto_importacoes", { ordem: "importado_em.desc" })
      .then((dados) => setLinhas(Array.isArray(dados) ? dados : []))
      .catch((falha) => setErro(falha.message || "Falha ao ler ponto_importacoes."))
      .finally(() => setCarregando(false));
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Passos existentes na base, não uma lista fixa: se um dia entrar um passo 3,
  // ele aparece como filtro em vez de sumir dentro de "Todas".
  const passos = useMemo(() => {
    const vistos = new Set();
    linhas.forEach((l) => {
      if (l.passo != null && l.passo !== "") vistos.add(String(l.passo));
    });
    return [...vistos].sort((a, b) => Number(a) - Number(b));
  }, [linhas]);

  const statusDisponiveis = useMemo(() => {
    const vistos = new Set();
    linhas.forEach((l) => {
      const s = String(l.status ?? "").trim();
      if (s) vistos.add(s);
    });
    return [...vistos].sort();
  }, [linhas]);

  const contagens = useMemo(() => {
    const mapa = { TODOS: linhas.length };
    linhas.forEach((l) => {
      const chave = String(l.passo ?? "");
      mapa[chave] = (mapa[chave] || 0) + 1;
    });
    return mapa;
  }, [linhas]);

  const visiveis = useMemo(() => {
    const termo = semAcento(busca).trim();
    return linhas.filter((l) => {
      if (passo !== "TODOS" && String(l.passo ?? "") !== passo) return false;
      if (status !== "TODOS" && String(l.status ?? "").trim() !== status) return false;
      if (!termo) return true;
      return (
        semAcento(l.nome).includes(termo) || String(l.cracha ?? "").includes(termo)
      );
    });
  }, [linhas, passo, status, busca]);

  return (
    <AbaShell
      carregando={carregando}
      erro={erro}
      resumo="Histórico do que a ferramenta importou para o Transnet, mais recentes primeiro. Passo 1 é a refeição; passo 2 é a correção do ponto. Somente leitura — quem grava aqui é o robô da importação."
      filtros={
        <>
          {[["TODOS", "Todas"], ...passos.map((p) => [p, rotuloPasso(p)])].map(
            ([chave, rotulo]) => (
              <button
                key={chave}
                type="button"
                className={`dp-chip-f${passo === chave ? " on" : ""}`}
                onClick={() => setPasso(chave)}
              >
                {rotulo} <span className="n">{contagens[chave] ?? 0}</span>
              </button>
            )
          )}

          <select
            value={status}
            onChange={(evento) => setStatus(evento.target.value)}
            aria-label="Status da importação"
          >
            <option value="TODOS">Todos os status</option>
            {statusDisponiveis.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <input
            type="search"
            value={busca}
            onChange={(evento) => setBusca(evento.target.value)}
            placeholder="Buscar por nome ou crachá"
            style={{ width: 250 }}
          />

          <button type="button" className="dp-btn" onClick={carregar} disabled={carregando}>
            ↻ Recarregar
          </button>

          <span className="dp-muted dp-num" style={{ marginLeft: "auto", fontSize: 12 }}>
            {visiveis.length} de {linhas.length} importaç{linhas.length === 1 ? "ão" : "ões"}
          </span>
        </>
      }
    >
      {!linhas.length ? (
        <div className="dp-resumo">Nenhuma importação registrada ainda.</div>
      ) : !visiveis.length ? (
        <div className="dp-resumo">Nada com esse filtro.</div>
      ) : (
        <div className="dp-tabela-wrap">
          <table className="dp-tabela">
            <thead>
              <tr>
                <th scope="col">Dia</th>
                <th scope="col">Motorista</th>
                <th scope="col">Passo</th>
                <th scope="col">Batidas importadas</th>
                <th scope="col">Fonte</th>
                <th scope="col">Arquivo</th>
                <th scope="col">Quando</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((linha, indice) => (
                <tr key={linha.id ?? `${linha.cracha}|${linha.date_ref}|${linha.passo}|${indice}`}>
                  <td className="dp-num dp-mono">{fmtData(linha.date_ref)}</td>
                  <td>
                    {linha.nome || "—"}{" "}
                    <span className="dp-faint dp-mono" style={{ fontSize: 12 }}>
                      {linha.cracha || ""}
                    </span>
                  </td>
                  <td>
                    <span className={`dp-pill ${Number(linha.passo) === 1 ? "accent" : "mute"}`}>
                      {rotuloPasso(linha.passo)}
                    </span>
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <Batidas linha={linha} />
                  </td>
                  <td className="dp-muted">{linha.fonte || "—"}</td>
                  <td className="dp-faint dp-mono" style={{ fontSize: 12 }}>
                    {linha.arquivo || "—"}
                  </td>
                  <td className="dp-num dp-mono">{fmtQuando(linha.importado_em)}</td>
                  <td>
                    <span className={`dp-pill ${classeStatus(linha.status)}`}>
                      {linha.status || "—"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AbaShell>
  );
}

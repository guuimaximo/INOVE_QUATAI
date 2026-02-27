// src/pages/ChecklistCentral.jsx
import { useEffect, useMemo, useState } from "react";
import { supabaseBCNT } from "../supabaseBCNT";

function norm(s) {
  return String(s || "").trim();
}

function onlyDateISO(d) {
  return String(d || "").split("T")[0];
}

function addDaysISO(dateISO, days) {
  const dt = new Date(`${dateISO}T00:00:00`);
  dt.setDate(dt.getDate() + days);
  return dt.toISOString().split("T")[0];
}

function parseFileUrls(fileurls) {
  if (!fileurls) return [];
  if (Array.isArray(fileurls)) return fileurls.filter(Boolean);

  const raw = String(fileurls).trim();
  if (!raw) return [];

  // tenta JSON: ["url1","url2"]
  if (raw.startsWith("[") && raw.endsWith("]")) {
    try {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return arr.map(String).map((x) => x.trim()).filter(Boolean);
    } catch (_) {}
  }

  // split: url1,url2 ou com quebra de linha
  return raw
    .split(/[\n,;\s]+/g)
    .map((x) => x.trim())
    .filter(Boolean)
    .filter((x) => x.startsWith("http"));
}

function Badge({ children, className = "" }) {
  return (
    <span className={`px-2 py-1 rounded text-xs font-medium ${className}`}>
      {children}
    </span>
  );
}

function CardResumo({ titulo, valor, cor }) {
  return (
    <div className={`${cor} rounded-lg shadow p-5 text-center`}>
      <h3 className="text-sm font-medium text-gray-600">{titulo}</h3>
      <p className="text-3xl font-bold mt-2 text-gray-800">{valor}</p>
    </div>
  );
}

function ChecklistDetalheModal({ open, onClose, row }) {
  const fotos = useMemo(() => parseFileUrls(row?.fileurls), [row]);

  if (!open) return null;

  const dataBR = row?.created_at
    ? new Date(row.created_at).toLocaleDateString("pt-BR")
    : "-";
  const horaBR = row?.created_at
    ? new Date(row.created_at).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "-";

  const prefixo = row?.numero_veiculo || "-";
  const motorista = row?.nome_motorista || "-";
  const chapa = row?.chapa_motorista ? `(${row.chapa_motorista})` : "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/50">
      <div className="bg-white w-full max-w-4xl rounded-xl shadow-xl overflow-hidden">
        <div className="flex items-start justify-between gap-3 p-4 border-b">
          <div>
            <div className="text-lg font-bold text-gray-800">Detalhes do Checklist</div>
            <div className="text-sm text-gray-600 mt-1">
              <b>Data:</b> {dataBR} &nbsp; | &nbsp; <b>Hora:</b> {horaBR} &nbsp; | &nbsp;{" "}
              <b>Prefixo:</b> {prefixo}
            </div>
            <div className="text-sm text-gray-600">
              <b>Motorista:</b> {motorista} {chapa}
            </div>
          </div>

          <button
            onClick={onClose}
            className="px-3 py-2 rounded-md border bg-white hover:bg-gray-50 text-gray-700"
          >
            Fechar
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Vídeo */}
          <div className="rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <div className="font-semibold text-gray-800">Vídeo</div>
              {row?.video_url ? (
                <Badge className="bg-blue-100 text-blue-800">Disponível</Badge>
              ) : (
                <Badge className="bg-gray-100 text-gray-700">Sem vídeo</Badge>
              )}
            </div>

            <div className="mt-3">
              {row?.video_url ? (
                <video src={row.video_url} controls className="w-full rounded-lg bg-black" />
              ) : (
                <div className="text-sm text-gray-500">Nenhum vídeo anexado.</div>
              )}
            </div>
          </div>

          {/* Fotos */}
          <div className="rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <div className="font-semibold text-gray-800">Fotos</div>
              {fotos.length > 0 ? (
                <Badge className="bg-green-100 text-green-800">{fotos.length} foto(s)</Badge>
              ) : (
                <Badge className="bg-gray-100 text-gray-700">Sem fotos</Badge>
              )}
            </div>

            <div className="mt-3">
              {fotos.length === 0 ? (
                <div className="text-sm text-gray-500">Nenhuma foto anexada.</div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {fotos.map((url, idx) => (
                    <a
                      key={`${url}-${idx}`}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="block border rounded-lg overflow-hidden hover:opacity-90"
                      title="Abrir imagem"
                    >
                      <img
                        src={url}
                        alt={`Foto ${idx + 1}`}
                        className="w-full h-28 object-cover"
                        loading="lazy"
                      />
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Textos */}
          <div className="rounded-lg border p-3">
            <div className="font-semibold text-gray-800">Descrição</div>

            <div className="mt-3 space-y-3">
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-500">Resumo</div>
                <div className="text-sm text-gray-800 whitespace-pre-wrap">
                  {row?.resumo_texto || "-"}
                </div>
              </div>

              <div>
                <div className="text-xs uppercase tracking-wide text-gray-500">Resposta</div>
                <div className="text-sm text-gray-800 whitespace-pre-wrap">
                  {row?.resposta_texto || "-"}
                </div>
              </div>

              {row?.link_atendimento ? (
                <div>
                  <div className="text-xs uppercase tracking-wide text-gray-500">Atendimento</div>
                  <a
                    className="text-sm text-blue-700 underline"
                    href={row.link_atendimento}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Abrir link do atendimento
                  </a>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="p-4 border-t flex items-center justify-end">
          <button
            onClick={onClose}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ChecklistCentral() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const [filtros, setFiltros] = useState({
    prefixo: "",
    motorista: "",
    dia: "",
  });

  const [totalCount, setTotalCount] = useState(0);
  const [comVideoCount, setComVideoCount] = useState(0);
  const [comFotosCount, setComFotosCount] = useState(0);

  // motoristas únicos via lista carregada (simples e suficiente)
  const motoristasUnicos = useMemo(() => {
    const set = new Set(
      (rows || [])
        .map((r) => norm(r?.chapa_motorista) || norm(r?.nome_motorista))
        .filter(Boolean)
    );
    return set.size;
  }, [rows]);

  const [modalOpen, setModalOpen] = useState(false);
  const [rowSelecionada, setRowSelecionada] = useState(null);

  function applyCommonFilters(query) {
    const f = filtros;

    if (f.prefixo) query = query.ilike("numero_veiculo", `%${f.prefixo}%`);

    if (f.motorista) {
      query = query.or(
        `nome_motorista.ilike.%${f.motorista}%,chapa_motorista.ilike.%${f.motorista}%`
      );
    }

    if (f.dia) {
      const dia = onlyDateISO(f.dia);
      const next = addDaysISO(dia, 1);
      query = query.gte("created_at", dia).lt("created_at", next);
    }

    return query;
  }

  async function carregarLista() {
    let q = supabaseBCNT
      .from("checklists")
      .select(
        [
          "id",
          "created_at",
          "numero_veiculo",
          "nome_motorista",
          "chapa_motorista",
          "video_url",
          "fileurls",
          "resumo_texto",
          "resposta_texto",
          "link_atendimento",
        ].join(",")
      )
      .limit(100000);

    q = applyCommonFilters(q);

    const { data, error } = await q.order("created_at", { ascending: false });

    if (error) {
      console.error("Erro ao carregar checklists:", error);
      setRows([]);
      return;
    }

    setRows(data || []);
  }

  async function carregarContadoresHead() {
    // Total
    let qTotal = supabaseBCNT
      .from("checklists")
      .select("id", { count: "exact", head: true });
    qTotal = applyCommonFilters(qTotal);
    const { count: total } = await qTotal;

    // Com vídeo
    let qVideo = supabaseBCNT
      .from("checklists")
      .select("id", { count: "exact", head: true })
      .not("video_url", "is", null)
      .neq("video_url", "");
    qVideo = applyCommonFilters(qVideo);
    const { count: comVideo } = await qVideo;

    // Com fotos
    let qFotos = supabaseBCNT
      .from("checklists")
      .select("id", { count: "exact", head: true })
      .not("fileurls", "is", null)
      .neq("fileurls", "");
    qFotos = applyCommonFilters(qFotos);
    const { count: comFotos } = await qFotos;

    setTotalCount(total || 0);
    setComVideoCount(comVideo || 0);
    setComFotosCount(comFotos || 0);
  }

  async function aplicar() {
    setLoading(true);
    try {
      await Promise.all([carregarLista(), carregarContadoresHead()]);
    } catch (e) {
      console.error("Erro ao aplicar filtros:", e);
    } finally {
      setLoading(false);
    }
  }

  function limpar() {
    setFiltros({ prefixo: "", motorista: "", dia: "" });
    setTimeout(() => aplicar(), 0);
  }

  useEffect(() => {
    aplicar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function abrirDetalhes(r) {
    setRowSelecionada(r);
    setModalOpen(true);
  }

  function badgeMidias(r) {
    const temVideo = !!norm(r?.video_url);
    const temFotos = parseFileUrls(r?.fileurls).length > 0;

    return (
      <div className="flex items-center gap-2">
        {temVideo ? (
          <Badge className="bg-blue-100 text-blue-800">🎥 Vídeo</Badge>
        ) : (
          <Badge className="bg-gray-100 text-gray-700">🎥 -</Badge>
        )}
        {temFotos ? (
          <Badge className="bg-green-100 text-green-800">🖼️ Fotos</Badge>
        ) : (
          <Badge className="bg-gray-100 text-gray-700">🖼️ -</Badge>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h1 className="text-2xl font-bold text-gray-700">Checklist Central</h1>

        <div className="flex items-center gap-2">
          <button
            onClick={limpar}
            className="px-3 py-2 rounded-md text-sm border bg-white text-gray-700 hover:bg-gray-50 border-gray-300"
          >
            Limpar
          </button>
          <button
            onClick={aplicar}
            disabled={loading}
            className="px-3 py-2 rounded-md text-sm border bg-blue-600 text-white border-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:border-gray-400"
          >
            {loading ? "Aplicando..." : "Aplicar"}
          </button>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-4 mb-6">
        <h2 className="text-lg font-semibold mb-3">Filtros</h2>

        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <input
            type="text"
            placeholder="Prefixo"
            value={filtros.prefixo}
            onChange={(e) => setFiltros({ ...filtros, prefixo: e.target.value })}
            className="border rounded-md px-3 py-2"
          />

          <input
            type="text"
            placeholder="Motorista (nome ou chapa)"
            value={filtros.motorista}
            onChange={(e) => setFiltros({ ...filtros, motorista: e.target.value })}
            className="border rounded-md px-3 py-2 md:col-span-3"
          />

          <input
            type="date"
            value={filtros.dia}
            onChange={(e) => setFiltros({ ...filtros, dia: e.target.value })}
            className="border rounded-md px-3 py-2 md:col-span-2"
          />
        </div>

        <div className="mt-3 text-xs text-gray-500">
          Use <b>Dia</b> para filtrar quem fez naquele dia. Use <b>Prefixo</b> e <b>Motorista</b>{" "}
          para afunilar.
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <CardResumo titulo="Total" valor={totalCount} cor="bg-blue-100 text-blue-700" />
        <CardResumo titulo="Com Vídeo" valor={comVideoCount} cor="bg-indigo-100 text-indigo-700" />
        <CardResumo titulo="Com Fotos" valor={comFotosCount} cor="bg-green-100 text-green-700" />
        <CardResumo
          titulo="Motoristas Únicos"
          valor={motoristasUnicos}
          cor="bg-yellow-100 text-yellow-700"
        />
      </div>

      <div className="bg-white shadow rounded-lg overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-blue-600 text-white">
            <tr>
              <th className="py-2 px-3 text-left">Data</th>
              <th className="py-2 px-3 text-left">Hora</th>
              <th className="py-2 px-3 text-left">Prefixo</th>
              <th className="py-2 px-3 text-left">Motorista</th>
              <th className="py-2 px-3 text-left">Mídias</th>
              <th className="py-2 px-3 text-left">Ações</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan="6" className="text-center p-4 text-gray-500">
                  Carregando...
                </td>
              </tr>
            ) : (rows || []).length === 0 ? (
              <tr>
                <td colSpan="6" className="text-center p-4 text-gray-500">
                  Nenhum checklist encontrado.
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const dataBR = r?.created_at
                  ? new Date(r.created_at).toLocaleDateString("pt-BR")
                  : "-";
                const horaBR = r?.created_at
                  ? new Date(r.created_at).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "-";

                return (
                  <tr key={r.id} className="border-t hover:bg-gray-50">
                    <td className="py-2 px-3 text-gray-600">{dataBR}</td>
                    <td className="py-2 px-3 text-gray-600">{horaBR}</td>
                    <td className="py-2 px-3 text-gray-700">{r?.numero_veiculo || "-"}</td>
                    <td className="py-2 px-3 text-gray-700">
                      {r?.nome_motorista || "-"}
                      {r?.chapa_motorista ? (
                        <span className="text-gray-500"> ({r.chapa_motorista})</span>
                      ) : null}
                    </td>
                    <td className="py-2 px-3">{badgeMidias(r)}</td>
                    <td className="py-2 px-3">
                      <button
                        onClick={() => abrirDetalhes(r)}
                        className="bg-blue-600 text-white px-3 py-1 rounded-md hover:bg-blue-700 text-sm"
                      >
                        Detalhes
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <ChecklistDetalheModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        row={rowSelecionada}
      />
    </div>
  );
}

// src/pages/ChecklistCentral.jsx
import { useEffect, useMemo, useState } from "react";
import { isSupabaseBCNTConfigured, supabaseBCNT } from "../../supabaseBCNT";
import ChecklistDetalheModal from "../../components/ChecklistDetalheModal";
import {
  FaCalendarAlt,
  FaClipboardCheck,
  FaEye,
  FaFilter,
  FaImage,
  FaSearch,
  FaUserFriends,
  FaVideo,
} from "react-icons/fa";

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

  if (raw.startsWith("[") && raw.endsWith("]")) {
    try {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return arr.map(String).map((x) => x.trim()).filter(Boolean);
    } catch (_) {}
  }

  return raw
    .split(/[\n,;\s]+/g)
    .map((x) => x.trim())
    .filter(Boolean)
    .filter((x) => x.startsWith("http"));
}

function Badge({ children, className = "" }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-bold ${className}`}>
      {children}
    </span>
  );
}

function CardResumo({ titulo, valor, icone, border }) {
  const tone =
    border?.includes("blue")
      ? "from-blue-50 to-cyan-50 border-blue-200 text-blue-700"
      : border?.includes("indigo")
      ? "from-indigo-50 to-blue-50 border-indigo-200 text-indigo-700"
      : border?.includes("emerald")
      ? "from-emerald-50 to-teal-50 border-emerald-200 text-emerald-700"
      : border?.includes("amber")
      ? "from-amber-50 to-yellow-50 border-amber-200 text-amber-700"
      : "from-slate-50 to-gray-50 border-slate-200 text-slate-700";

  return (
    <div className={`min-h-[124px] rounded-3xl border bg-gradient-to-br p-4 shadow-sm ${tone}`}>
      <div className="flex h-full items-start justify-between gap-3">
        <div className="flex h-full min-w-0 flex-col justify-between">
          <p className="text-xs font-black uppercase tracking-[0.18em] opacity-80">{titulo}</p>
          <p className="mt-3 text-3xl font-black text-slate-900">{valor}</p>
        </div>
        <div className="text-4xl opacity-80">{icone}</div>
      </div>
    </div>
  );
}

export default function ChecklistCentral() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [erroConfig, setErroConfig] = useState("");

  const [filtros, setFiltros] = useState({
    prefixo: "",
    motorista: "",
    dia: "",
  });

  const [totalCount, setTotalCount] = useState(0);
  const [comVideoCount, setComVideoCount] = useState(0);
  const [comFotosCount, setComFotosCount] = useState(0);

  // motoristas únicos via lista carregada
  const motoristasUnicos = useMemo(() => {
    const set = new Set(
      (rows || [])
        .map((r) => norm(r?.chapa_motorista) || norm(r?.nome_motorista))
        .filter(Boolean)
    );
    return set.size;
  }, [rows]);

  // ✅ Modal (continua existindo aqui, só o componente foi separado)
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
    if (!isSupabaseBCNTConfigured) {
      setErroConfig("A base BCNT não está configurada neste APK.");
      setRows([]);
      return;
    }

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
    if (!isSupabaseBCNTConfigured) {
      setTotalCount(0);
      setComVideoCount(0);
      setComFotosCount(0);
      return;
    }

    // Total
    let qTotal = supabaseBCNT.from("checklists").select("id", { count: "exact", head: true });
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
    setErroConfig("");
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

  const checklistsView = rows || [];

  function midiasBadges(r) {
    const temVideo = !!norm(r?.video_url);
    const temFotos = parseFileUrls(r?.fileurls).length > 0;

    return (
      <div className="flex flex-wrap items-center gap-2">
        <Badge className={temVideo ? "border-blue-200 bg-blue-50 text-blue-800" : "border-slate-200 bg-slate-50 text-slate-500"}>
          <FaVideo /> {temVideo ? "Video" : "-"}
        </Badge>
        <Badge className={temFotos ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-slate-50 text-slate-500"}>
          <FaImage /> {temFotos ? "Fotos" : "-"}
        </Badge>
      </div>
    );
  }

  return (
    <div className="min-h-screen space-y-5 bg-slate-50 p-4 text-slate-800 md:p-6">
      <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.24em] text-blue-600">
            Checklists
          </div>
          <h1 className="mt-3 flex items-center gap-3 text-3xl font-black text-slate-900">
            <span className="rounded-2xl bg-blue-50 p-3 text-blue-600 shadow-sm">
              <FaClipboardCheck />
            </span>
            Central de Checklists
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Consulte checklists por veiculo, motorista e dia, com evidencias e relatorio completo.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={limpar}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-wide text-slate-700 transition hover:bg-slate-50"
          >
            Limpar
          </button>
          <button
            onClick={aplicar}
            disabled={loading}
            className="rounded-full bg-blue-600 px-4 py-2 text-xs font-black uppercase tracking-wide text-white shadow-sm transition hover:bg-blue-700 disabled:bg-slate-400"
          >
            {loading ? "Aplicando..." : "Aplicar filtros"}
          </button>
        </div>
      </div>

      <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <h2 className="text-lg font-black text-slate-900">Filtros da central</h2>
          <p className="text-sm text-slate-500">
            Refine a visualizacao por prefixo, motorista, chapa ou data de envio.
          </p>
        </div>

        {erroConfig ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
            {erroConfig}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
          <div className="relative md:col-span-2">
            <FaSearch className="absolute left-3 top-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar prefixo"
              value={filtros.prefixo}
              onChange={(e) => setFiltros({ ...filtros, prefixo: e.target.value })}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-9 pr-3 text-sm font-medium text-slate-700 outline-none transition focus:border-blue-400 focus:bg-white"
            />
          </div>

          <div className="relative md:col-span-3">
            <FaFilter className="absolute left-3 top-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Motorista ou chapa"
              value={filtros.motorista}
              onChange={(e) => setFiltros({ ...filtros, motorista: e.target.value })}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-9 pr-3 text-sm font-medium text-slate-700 outline-none transition focus:border-blue-400 focus:bg-white"
            />
          </div>

          <div className="relative">
            <FaCalendarAlt className="absolute left-3 top-3.5 text-slate-400" />
            <input
              type="date"
              value={filtros.dia}
              onChange={(e) => setFiltros({ ...filtros, dia: e.target.value })}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-9 pr-3 text-sm font-medium text-slate-700 outline-none transition focus:border-blue-400 focus:bg-white"
            />
          </div>
        </div>

        <div className="text-xs text-slate-500">
          Ordenacao padrao: <b>mais recentes primeiro</b>. Abra os detalhes para consultar fotos,
          video e gerar o relatorio do checklist.
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <CardResumo
          titulo="Total"
          valor={totalCount}
          icone={<FaClipboardCheck className="text-blue-100" />}
          border="border-l-blue-500"
        />
        <CardResumo
          titulo="Com Video"
          valor={comVideoCount}
          icone={<FaVideo className="text-indigo-100" />}
          border="border-l-indigo-500"
        />
        <CardResumo
          titulo="Com Fotos"
          valor={comFotosCount}
          icone={<FaImage className="text-emerald-100" />}
          border="border-l-emerald-500"
        />
        <CardResumo
          titulo="Motoristas Unicos"
          valor={motoristasUnicos}
          icone={<FaUserFriends className="text-amber-100" />}
          border="border-l-amber-500"
        />
      </div>

      <div className="space-y-3 lg:hidden">
        {loading ? (
          <div className="rounded-3xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500 shadow-sm">
            Carregando...
          </div>
        ) : checklistsView.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500 shadow-sm">
            Nenhum checklist encontrado.
          </div>
        ) : (
          checklistsView.map((r) => {
            const dataBR = r?.created_at ? new Date(r.created_at).toLocaleDateString("pt-BR") : "-";
            const horaBR = r?.created_at
              ? new Date(r.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
              : "-";

            return (
              <div
                key={r.id}
                role="button"
                tabIndex={0}
                onClick={() => abrirDetalhes(r)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") abrirDetalhes(r);
                }}
                className="cursor-pointer rounded-3xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-200 hover:bg-blue-50/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-black text-slate-900">{r?.nome_motorista || "-"}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {dataBR} as {horaBR}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">
                    {r?.numero_veiculo || "-"}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Chapa</div>
                    <div className="mt-1 text-slate-700">{r?.chapa_motorista || "-"}</div>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Midias</div>
                    <div className="mt-1">{midiasBadges(r)}</div>
                  </div>
                </div>

                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    abrirDetalhes(r);
                  }}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700"
                  type="button"
                >
                  <FaEye size={13} /> Detalhes
                </button>
              </div>
            );
          })
        )}
      </div>

      <div className="hidden overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm lg:block">
        <table className="w-full min-w-[980px] text-left">
          <thead className="select-none border-b bg-slate-50 text-xs font-extrabold uppercase tracking-wider text-slate-600 md:text-sm">
            <tr>
              <th className="px-4 py-4">Data</th>
              <th className="px-4 py-4">Hora</th>
              <th className="px-4 py-4">Prefixo</th>
              <th className="px-4 py-4">Motorista</th>
              <th className="px-4 py-4">Midias</th>
              <th className="px-4 py-4">Acoes</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan="6" className="px-6 py-12 text-center text-slate-500">
                  Carregando...
                </td>
              </tr>
            ) : checklistsView.length === 0 ? (
              <tr>
                <td colSpan="6" className="px-6 py-12 text-center text-slate-500">
                  Nenhum checklist encontrado.
                </td>
              </tr>
            ) : (
              checklistsView.map((r) => {
                const dataBR = r?.created_at ? new Date(r.created_at).toLocaleDateString("pt-BR") : "-";
                const horaBR = r?.created_at
                  ? new Date(r.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
                  : "-";

                return (
                  <tr
                    key={r.id}
                    onClick={() => abrirDetalhes(r)}
                    className="cursor-pointer transition-colors hover:bg-blue-50/40"
                  >
                    <td className="whitespace-nowrap px-4 py-4 font-mono text-sm text-slate-500">{dataBR}</td>
                    <td className="whitespace-nowrap px-4 py-4 font-mono text-sm text-slate-500">{horaBR}</td>
                    <td className="px-4 py-4">
                      <span className="rounded-xl bg-slate-100 px-3 py-1 text-sm font-black text-slate-800">
                        {r?.numero_veiculo || "-"}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm font-black text-slate-900 md:text-base">
                        {r?.nome_motorista || "-"}
                      </div>
                      <div className="mt-1 w-fit rounded border border-slate-200 bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-600">
                        {r?.chapa_motorista || ""}
                      </div>
                    </td>
                    <td className="px-4 py-4">{midiasBadges(r)}</td>
                    <td className="px-4 py-4">
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          abrirDetalhes(r);
                        }}
                        className="flex items-center gap-1.5 whitespace-nowrap rounded-2xl bg-blue-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-blue-700"
                        type="button"
                      >
                        <FaEye size={12} /> Detalhes
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

        {erroConfig ? (
          <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {erroConfig}
          </div>
        ) : null}

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
                        type="button"
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

import { useMemo, useState } from "react";
import { FaLayerGroup, FaPlus, FaSave, FaShieldAlt, FaSync, FaTimes } from "react-icons/fa";
import { supabase } from "../../supabase";
import { useAccessGovernance } from "../../context/AccessContext";
import { APP_ACCESS_PAGES, DEFAULT_LEVEL_PROFILES } from "../../utils/accessCatalog";

function normalizeText(value = "") {
  return String(value || "").trim();
}

function buildGroupedPages() {
  return APP_ACCESS_PAGES.reduce((acc, page) => {
    if (!acc[page.category]) acc[page.category] = [];
    acc[page.category].push(page);
    return acc;
  }, {});
}

function LevelEditorModal({ profile, onClose, onSave }) {
  const groupedPages = useMemo(() => buildGroupedPages(), []);
  const systemNames = useMemo(() => new Set(DEFAULT_LEVEL_PROFILES.map((item) => item.nome)), []);
  const isSystem = systemNames.has(profile.nome);
  const [form, setForm] = useState({
    nome: profile.nome || "",
    descricao: profile.descricao || "",
    ativo: profile.ativo !== false,
    farol_liberado: profile.farol_liberado === true,
    paginas: Array.isArray(profile.paginas) ? profile.paginas : [],
  });
  const [saving, setSaving] = useState(false);

  function togglePage(pageKey) {
    setForm((current) => ({
      ...current,
      paginas: current.paginas.includes(pageKey)
        ? current.paginas.filter((item) => item !== pageKey)
        : [...current.paginas, pageKey],
    }));
  }

  async function handleSave() {
    if (!normalizeText(form.nome)) {
      alert("Informe o nome do nível.");
      return;
    }

    setSaving(true);
    try {
      await onSave({
        ...profile,
        ...form,
        nome: normalizeText(form.nome),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-6xl rounded-2xl bg-white shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b bg-slate-50">
          <div>
            <h2 className="text-lg font-black text-slate-800">
              {profile.id ? "Editar nível de acesso" : "Novo nível de acesso"}
            </h2>
            <p className="text-xs text-slate-500 font-semibold">
              Configure quais páginas esse nível pode ver no INOVE.
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50">
            <FaTimes />
          </button>
        </div>

        <div className="overflow-y-auto p-5 space-y-5 bg-slate-50/70">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <label className="text-[10px] font-black uppercase text-slate-500">Nome do nível</label>
              <input
                value={form.nome}
                disabled={isSystem}
                onChange={(event) => setForm((current) => ({ ...current, nome: event.target.value }))}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:bg-slate-100"
                placeholder="Ex.: Supervisor Operacional"
              />
            </div>

            <div>
              <label className="text-[10px] font-black uppercase text-slate-500">Farol Tático</label>
              <button
                type="button"
                onClick={() => setForm((current) => ({ ...current, farol_liberado: !current.farol_liberado }))}
                className={`mt-1 w-full rounded-xl px-4 py-2.5 text-sm font-black transition ${
                  form.farol_liberado ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-700"
                }`}
              >
                {form.farol_liberado ? "Liberado" : "Bloqueado"}
              </button>
            </div>

            <div>
              <label className="text-[10px] font-black uppercase text-slate-500">Status</label>
              <button
                type="button"
                onClick={() => setForm((current) => ({ ...current, ativo: !current.ativo }))}
                className={`mt-1 w-full rounded-xl px-4 py-2.5 text-sm font-black transition ${
                  form.ativo ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"
                }`}
              >
                {form.ativo ? "Ativo" : "Inativo"}
              </button>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black uppercase text-slate-500">Descrição</label>
            <textarea
              value={form.descricao}
              onChange={(event) => setForm((current) => ({ ...current, descricao: event.target.value }))}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
              rows={3}
              placeholder="Descreva para que serve esse nível."
            />
          </div>

          <div className="space-y-4">
            {Object.entries(groupedPages).map(([category, pages]) => (
              <div key={category} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div>
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">{category}</h3>
                    <p className="text-xs text-slate-500 font-semibold">{pages.length} página(s)</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const pageKeys = pages.map((page) => page.key);
                      const allSelected = pageKeys.every((pageKey) => form.paginas.includes(pageKey));
                      setForm((current) => ({
                        ...current,
                        paginas: allSelected
                          ? current.paginas.filter((item) => !pageKeys.includes(item))
                          : Array.from(new Set([...current.paginas, ...pageKeys])),
                      }));
                    }}
                    className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-200"
                  >
                    Marcar grupo
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {pages.map((page) => {
                    const checked = form.paginas.includes(page.key);
                    return (
                      <label
                        key={page.key}
                        className={`rounded-xl border p-3 cursor-pointer transition ${
                          checked ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-slate-50 hover:bg-slate-100"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => togglePage(page.key)}
                            className="mt-1"
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-black text-slate-800">{page.label}</p>
                            <p className="text-[11px] font-semibold text-slate-500 mt-1 break-all">{page.path}</p>
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="px-5 py-4 border-t bg-white flex justify-end gap-3">
          <button onClick={onClose} className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-black text-slate-700 hover:bg-slate-200">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white hover:bg-blue-700 disabled:opacity-60"
          >
            <FaSave />
            {saving ? "Salvando..." : "Salvar nível"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function NiveisAcesso() {
  const { profiles, refreshProfiles, loading } = useAccessGovernance();
  const [feedback, setFeedback] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState(null);

  const sortedProfiles = useMemo(
    () => [...profiles].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    [profiles]
  );

  async function handleSaveProfile(profile) {
    const payload = {
      nome: profile.nome,
      descricao: profile.descricao || null,
      paginas: Array.isArray(profile.paginas) ? profile.paginas : [],
      farol_liberado: profile.farol_liberado === true,
      ativo: profile.ativo !== false,
      updated_at: new Date().toISOString(),
    };

    let error = null;

    if (profile.id) {
      const response = await supabase.from("app_niveis_acesso").update(payload).eq("id", profile.id);
      error = response.error;
    } else {
      const { data: existing, error: existingError } = await supabase
        .from("app_niveis_acesso")
        .select("id")
        .eq("nome", payload.nome)
        .maybeSingle();

      if (existingError) {
        console.error(existingError);
        alert("Não foi possível verificar o nível informado.");
        return;
      }

      if (existing?.id) {
        const response = await supabase.from("app_niveis_acesso").update(payload).eq("id", existing.id);
        error = response.error;
      } else {
        const response = await supabase.from("app_niveis_acesso").insert(payload);
        error = response.error;
      }
    }

    if (error) {
      console.error(error);
      alert("Não foi possível salvar o nível de acesso.");
      return;
    }

    await refreshProfiles();
    setEditorOpen(false);
    setSelectedProfile(null);
    setFeedback({
      type: "success",
      text: `Nível ${profile.nome} salvo com sucesso.`,
    });
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">
              <FaShieldAlt /> Governança de acesso
            </div>
            <h1 className="mt-3 text-2xl font-black text-slate-800">Níveis de acesso</h1>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              Crie, edite e mantenha os níveis do INOVE sem precisar mexer no Sidebar.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                setSelectedProfile({ nome: "", descricao: "", paginas: [], farol_liberado: false, ativo: true });
                setEditorOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white hover:bg-blue-700"
            >
              <FaPlus /> Novo nível
            </button>
            <button
              onClick={() => void refreshProfiles()}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-black text-white hover:bg-slate-700"
            >
              <FaSync /> Atualizar
            </button>
          </div>
        </div>

        {feedback && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700">
            {feedback.text}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm font-black text-slate-500 shadow-sm">
            Carregando níveis...
          </div>
        ) : (
          sortedProfiles.map((profile) => (
            <div key={profile.id || profile.nome} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black text-slate-800">{profile.nome}</h2>
                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    {profile.descricao || "Sem descrição cadastrada."}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={`rounded-lg px-2.5 py-1 text-[11px] font-black ${profile.ativo === false ? "bg-slate-100 text-slate-700" : "bg-blue-50 text-blue-700"}`}>
                    {profile.ativo === false ? "Inativo" : "Ativo"}
                  </span>
                  <span className={`rounded-lg px-2.5 py-1 text-[11px] font-black ${profile.farol_liberado ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-700"}`}>
                    {profile.farol_liberado ? "Farol liberado" : "Farol bloqueado"}
                  </span>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[10px] font-black uppercase text-slate-500">Páginas liberadas</p>
                  <p className="mt-1 text-2xl font-black text-slate-800">{Array.isArray(profile.paginas) ? profile.paginas.length : 0}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[10px] font-black uppercase text-slate-500">Controle</p>
                  <p className="mt-1 text-sm font-black text-slate-800">Por nível</p>
                </div>
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => {
                    setSelectedProfile(profile);
                    setEditorOpen(true);
                  }}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-black text-white hover:bg-slate-800"
                >
                  <FaLayerGroup />
                  Editar permissões
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {editorOpen && selectedProfile && (
        <LevelEditorModal
          profile={selectedProfile}
          onClose={() => {
            setEditorOpen(false);
            setSelectedProfile(null);
          }}
          onSave={handleSaveProfile}
        />
      )}
    </div>
  );
}

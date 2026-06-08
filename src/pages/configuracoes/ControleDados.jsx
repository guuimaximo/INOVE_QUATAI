import { useCallback, useEffect, useState } from "react";
import {
  FaDatabase,
  FaHdd,
  FaSync,
  FaExclamationTriangle,
} from "react-icons/fa";
import { supabase } from "../../supabase";

const GB = 1024 * 1024 * 1024;
const MB = 1024 * 1024;

function fmtBytes(n) {
  const v = Number(n || 0);
  if (v >= GB) return `${(v / GB).toFixed(2)} GB`;
  if (v >= MB) return `${(v / MB).toFixed(1)} MB`;
  if (v >= 1024) return `${(v / 1024).toFixed(0)} KB`;
  return `${v} B`;
}

function Card({ icon, title, subtitle, children, error, loading }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-extrabold text-slate-900 uppercase tracking-wide">
            <span className="text-emerald-700">{icon}</span>
            {title}
          </div>
          {subtitle && <div className="text-xs text-slate-500 mt-0.5">{subtitle}</div>}
        </div>
        {loading && (
          <span className="text-[10px] uppercase font-bold text-emerald-700 animate-pulse">
            carregando…
          </span>
        )}
      </div>
      {error ? (
        <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-900">
          <FaExclamationTriangle className="mt-0.5 shrink-0" />
          <span className="break-words">{error}</span>
        </div>
      ) : (
        children
      )}
    </div>
  );
}

function Stat({ label, value, hint }) {
  return (
    <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2">
      <div className="text-[10px] uppercase font-bold text-slate-500">{label}</div>
      <div className="text-base font-extrabold text-slate-900">{value}</div>
      {hint && <div className="text-[11px] text-slate-500">{hint}</div>}
    </div>
  );
}

function SupabaseCard({ titulo, projeto, payload, loading }) {
  const ok = payload?.ok;
  const data = payload?.data;
  const erro = !ok ? payload?.error || "sem resposta" : null;

  return (
    <Card
      icon={<FaDatabase />}
      title={titulo}
      subtitle={projeto}
      loading={loading}
      error={erro}
    >
      {data && (
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Tamanho do banco" value={fmtBytes(data.db_bytes)} />
          <Stat label="Storage usado" value={fmtBytes(data.storage_bytes)} />
          {Array.isArray(data.buckets) && data.buckets.length > 0 && (
            <div className="col-span-2 rounded-xl bg-slate-50 border border-slate-100 p-3">
              <div className="text-[10px] uppercase font-bold text-slate-500 mb-1.5">
                Buckets
              </div>
              <ul className="text-xs text-slate-700 space-y-1">
                {data.buckets.slice(0, 5).map((b) => (
                  <li key={b.bucket} className="flex justify-between gap-2">
                    <span className="truncate">{b.bucket}</span>
                    <span className="font-bold text-slate-900 whitespace-nowrap">
                      {fmtBytes(b.bytes)}{" "}
                      <span className="text-slate-500 font-normal">
                        · {Number(b.objetos || 0).toLocaleString("pt-BR")} obj.
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {Array.isArray(data.top_tabelas) && data.top_tabelas.length > 0 && (
            <div className="col-span-2 rounded-xl bg-slate-50 border border-slate-100 p-3">
              <div className="text-[10px] uppercase font-bold text-slate-500 mb-1.5">
                Maiores tabelas
              </div>
              <ul className="text-xs text-slate-700 space-y-1">
                {data.top_tabelas.slice(0, 5).map((t) => (
                  <li key={t.tabela} className="flex justify-between gap-2">
                    <span className="truncate">{t.tabela}</span>
                    <span className="font-bold text-slate-900 whitespace-nowrap">
                      {fmtBytes(t.bytes)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

export default function ControleDados() {
  const [loading, setLoading] = useState(false);
  const [snapshot, setSnapshot] = useState(null);
  const [erro, setErro] = useState(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const { data, error } = await supabase.functions.invoke("controle-dados", {
        method: "GET",
      });
      if (error) throw error;
      setSnapshot(data);
    } catch (e) {
      setErro(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <FaHdd className="text-emerald-700" /> Controle de Dados
          </h1>
          <p className="text-sm text-slate-500">
            Uso de banco e storage dos Supabases (Inove e Farol).
            {snapshot?.coletado_em && (
              <>
                {" "}· coletado em{" "}
                {new Date(snapshot.coletado_em).toLocaleString("pt-BR")}
              </>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void carregar()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 text-white font-bold px-4 py-2 hover:bg-emerald-700 disabled:opacity-50"
        >
          <FaSync className={loading ? "animate-spin" : ""} />
          Atualizar
        </button>
      </div>

      {erro && (
        <div className="mb-4 rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-900">
          Falha ao consultar Edge Function: {erro}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SupabaseCard
          titulo="Supabase · Inove"
          projeto="banco + storage"
          payload={snapshot?.supabase_inove}
          loading={loading}
        />
        <SupabaseCard
          titulo="Supabase · Farol"
          projeto="banco + storage"
          payload={snapshot?.supabase_farol}
          loading={loading}
        />
      </div>

      <p className="text-[11px] text-slate-400 mt-4">
        Para o card do Farol retornar dados, os secrets FAROL_PROJECT_URL e
        FAROL_SERVICE_ROLE_KEY precisam estar configurados no projeto Supabase
        do Inove.
      </p>
    </div>
  );
}

import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  FaCheckCircle,
  FaClock,
  FaInfoCircle,
  FaMapMarkerAlt,
  FaMapMarkedAlt,
  FaPlay,
  FaRoute,
  FaStopCircle,
  FaSync,
} from "react-icons/fa";
import { AuthContext } from "../../context/AuthContext";
import { supabase } from "../../supabase";
import {
  buildInstrutorNome,
  captureCurrentInstructorPosition,
  formatDateBR,
  formatDateTimeBR,
  formatTimeBR,
  getAcompanhamentoWindowInfo,
  resolveAcompanhamentoContext,
  toISODateInBrazil,
  toTimeInBrazil,
} from "../../utils/dieselAcompanhamento";

function getLinhaApenas(item) {
  return resolveAcompanhamentoContext(item).linha || null;
}

function formatCoordinate(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num.toFixed(6) : "-";
}

function formatDuration(startedAt, endedAt) {
  if (!startedAt || !endedAt) return "-";

  const start = new Date(startedAt);
  const end = new Date(endedAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "-";

  const diffMs = end.getTime() - start.getTime();
  if (diffMs <= 0) return "-";

  const totalMinutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}

function normalizeStatus(status) {
  const raw = String(status || "").toUpperCase().trim();
  if (!raw) return "AGUARDANDO_INSTRUTOR";
  if (raw === "AGUARDANDO INSTRUTOR") return "AGUARDANDO_INSTRUTOR";
  if (raw === "AG_ACOMPANHAMENTO") return "AGUARDANDO_INSTRUTOR";
  return raw;
}

function buildMapSrc(lat, lng) {
  const latitude = Number(lat);
  const longitude = Number(lng);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  return `https://maps.google.com/maps?q=${latitude},${longitude}&z=16&output=embed`;
}

function buildGoogleMapsLink(lat, lng) {
  const latitude = Number(lat);
  const longitude = Number(lng);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  return `https://www.google.com/maps?q=${latitude},${longitude}`;
}

function toFiniteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function buildRoutePing(location, origem = "PING") {
  return {
    latitude: location.latitude,
    longitude: location.longitude,
    accuracy: location.accuracy,
    altitude: location.altitude ?? null,
    heading: location.heading ?? null,
    speed: location.speed ?? null,
    captured_at: location.captured_at || new Date().toISOString(),
    origem,
  };
}

function getRoutePings(sessao) {
  const pings = sessao?.metadata?.rota_pings;
  return Array.isArray(pings)
    ? pings.filter(
        (ping) =>
          Number.isFinite(Number(ping?.latitude)) &&
          Number.isFinite(Number(ping?.longitude))
      )
    : [];
}

function distanceMeters(a, b) {
  const lat1 = toFiniteNumber(a?.latitude);
  const lon1 = toFiniteNumber(a?.longitude);
  const lat2 = toFiniteNumber(b?.latitude);
  const lon2 = toFiniteNumber(b?.longitude);

  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return 0;

  const toRad = (value) => (value * Math.PI) / 180;
  const earthRadius = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const rLat1 = toRad(lat1);
  const rLat2 = toRad(lat2);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLon / 2) ** 2;

  return 2 * earthRadius * Math.asin(Math.sqrt(h));
}

function routeDistanceMeters(pings) {
  return (pings || []).reduce((total, ping, index, list) => {
    if (index === 0) return total;
    return total + distanceMeters(list[index - 1], ping);
  }, 0);
}

function formatDistance(meters) {
  const total = Number(meters);
  if (!Number.isFinite(total) || total <= 0) return "0 m";
  if (total < 1000) return `${Math.round(total)} m`;
  return `${(total / 1000).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} km`;
}

function sampleWaypoints(pings, maxPoints = 10) {
  if (!Array.isArray(pings) || pings.length <= 2) return [];
  const middle = pings.slice(1, -1);
  if (middle.length <= maxPoints) return middle;

  const step = (middle.length - 1) / (maxPoints - 1);
  return Array.from({ length: maxPoints }, (_, index) => middle[Math.round(index * step)]);
}

function buildGoogleRouteLink(pings) {
  if (!Array.isArray(pings) || pings.length < 2) return null;

  const first = pings[0];
  const last = pings[pings.length - 1];
  const params = new URLSearchParams({
    api: "1",
    origin: `${first.latitude},${first.longitude}`,
    destination: `${last.latitude},${last.longitude}`,
    travelmode: "driving",
  });

  const waypoints = sampleWaypoints(pings)
    .map((ping) => `${ping.latitude},${ping.longitude}`)
    .join("|");

  if (waypoints) params.set("waypoints", waypoints);

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || "")
  );
}

async function registrarEventoSessao(acompanhamentoId, payload) {
  const { error } = await supabase.from("diesel_acompanhamento_eventos").insert({
    acompanhamento_id: acompanhamentoId,
    ...payload,
  });

  if (error) throw error;
}

export default function PainelSessoesAcompanhamento({
  item,
  onSessionsLoaded,
  onSessionSaved,
}) {
  const { user } = useContext(AuthContext);

  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState("");
  const [erro, setErro] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [sessoes, setSessoes] = useState([]);
  const [sessaoMapaAbertaId, setSessaoMapaAbertaId] = useState(null);
  const [rotaStatus, setRotaStatus] = useState("");
  const rotaWatchIdRef = useRef(null);
  const rotaSavingRef = useRef(false);
  const rotaPingsRef = useRef([]);
  const rotaLastSavedAtRef = useRef(0);

  const windowInfo = useMemo(() => getAcompanhamentoWindowInfo(item), [item]);
  const instrutorLogin = user?.login || user?.email || null;
  const instrutorNome = buildInstrutorNome(user);
  const statusAtual = useMemo(
    () => normalizeStatus(item?.status_ciclo || item?.status),
    [item]
  );

  async function carregarSessoes() {
    if (!item?.id) return;

    setLoading(true);
    setErro("");

    try {
      const { data, error } = await supabase
        .from("diesel_acompanhamento_sessoes")
        .select("*")
        .eq("acompanhamento_id", item.id)
        .order("sessao_numero", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      const list = data || [];
      setSessoes(list);
      onSessionsLoaded?.(list);
    } catch (e) {
      console.error("Erro ao carregar sessões do acompanhamento:", e);
      setErro(e?.message || "Não foi possível carregar as sessões.");
      onSessionsLoaded?.([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregarSessoes();
  }, [item?.id]);

  const sessaoAberta = useMemo(
    () => (sessoes || []).find((sessao) => !sessao.encerrado_em) || null,
    [sessoes]
  );

  const sessaoAbertaEhDoUsuario = useMemo(() => {
    if (!sessaoAberta || !instrutorLogin) return false;
    return String(sessaoAberta.instrutor_login || "").trim() === instrutorLogin;
  }, [sessaoAberta, instrutorLogin]);

  useEffect(() => {
    rotaPingsRef.current = getRoutePings(sessaoAberta);
  }, [sessaoAberta?.id, sessaoAberta?.metadata]);

  const resumo = useMemo(() => {
    const total = (sessoes || []).length;
    const abertas = (sessoes || []).filter((sessao) => !sessao.encerrado_em).length;
    const ultimaSessao = (sessoes || [])[0] || null;

    return { total, abertas, ultimaSessao };
  }, [sessoes]);

  const canManageSessions = useMemo(() => {
    return !["OK", "ENCERRADO", "ATAS"].includes(statusAtual);
  }, [statusAtual]);

  async function salvarPingRota(sessao, location, origem = "PING") {
    if (!sessao?.id || rotaSavingRef.current) return;

    const nextPing = buildRoutePing(location, origem);
    const currentPings = rotaPingsRef.current || getRoutePings(sessao);
    const lastPing = currentPings[currentPings.length - 1] || null;
    const nowMs = Date.now();
    const isImportant = origem !== "PING";
    const movedEnough = !lastPing || distanceMeters(lastPing, nextPing) >= 15;
    const waitedEnough = nowMs - rotaLastSavedAtRef.current >= 30000;

    if (!isImportant && lastPing && (!movedEnough || !waitedEnough)) return;

    const nextPings = [...currentPings, nextPing].slice(-1000);
    const nextMetadata = {
      ...(sessao.metadata || {}),
      rota_pings: nextPings,
      rota_tracking: {
        ...((sessao.metadata || {}).rota_tracking || {}),
        status: origem === "FIM" ? "ENCERRADA" : "ATIVA",
        iniciado_em:
          (sessao.metadata || {}).rota_tracking?.iniciado_em ||
          sessao.iniciado_em ||
          nextPing.captured_at,
        atualizado_em: nextPing.captured_at,
        encerrado_em:
          origem === "FIM"
            ? nextPing.captured_at
            : (sessao.metadata || {}).rota_tracking?.encerrado_em || null,
        pontos: nextPings.length,
        distancia_m: Math.round(routeDistanceMeters(nextPings)),
      },
    };

    rotaSavingRef.current = true;
    try {
      const { error } = await supabase
        .from("diesel_acompanhamento_sessoes")
        .update({ metadata: nextMetadata })
        .eq("id", sessao.id);

      if (error) throw error;

      rotaPingsRef.current = nextPings;
      rotaLastSavedAtRef.current = nowMs;
      setRotaStatus(
        `Rota gravando: ${nextPings.length} ponto(s), ${formatDistance(routeDistanceMeters(nextPings))}.`
      );
    } catch (e) {
      console.error("Erro ao salvar ping da rota:", e);
      setRotaStatus(e?.message || "Nao foi possivel salvar o ping da rota.");
    } finally {
      rotaSavingRef.current = false;
    }
  }

  useEffect(() => {
    if (rotaWatchIdRef.current != null && navigator.geolocation) {
      navigator.geolocation.clearWatch(rotaWatchIdRef.current);
      rotaWatchIdRef.current = null;
    }

    if (!sessaoAberta || !sessaoAbertaEhDoUsuario || !canManageSessions) {
      if (!sessaoAberta) setRotaStatus("");
      return undefined;
    }

    if (!navigator.geolocation) {
      setRotaStatus("Este dispositivo nao possui geolocalizacao continua disponivel.");
      return undefined;
    }

    setRotaStatus("Rota ativa. Gravando pontos enquanto esta tela permanecer aberta.");
    rotaWatchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        salvarPingRota(sessaoAberta, {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          altitude: position.coords.altitude,
          heading: position.coords.heading,
          speed: position.coords.speed,
          captured_at: new Date().toISOString(),
        });
      },
      (error) => {
        setRotaStatus(error?.message || "Nao foi possivel acompanhar a rota pelo GPS.");
      },
      {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 20000,
      }
    );

    return () => {
      if (rotaWatchIdRef.current != null && navigator.geolocation) {
        navigator.geolocation.clearWatch(rotaWatchIdRef.current);
        rotaWatchIdRef.current = null;
      }
    };
  }, [sessaoAberta?.id, sessaoAbertaEhDoUsuario, canManageSessions]);

  async function iniciarSessao() {
    if (!item?.id || !instrutorLogin) {
      setErro("Não foi possível identificar o instrutor logado.");
      return;
    }

    if (!windowInfo.withinWindow) {
      setErro("Este acompanhamento já ultrapassou a janela de 30 dias e precisa de um novo lançamento.");
      return;
    }

    if (!canManageSessions) {
      setErro(
        "Casos encerrados ou enviados para tratativa não aceitam novas sessões."
      );
      return;
    }

    if (sessaoAberta) {
      setErro("Já existe uma sessão em aberto neste acompanhamento.");
      return;
    }

    setActionLoading("iniciar");
    setErro("");
    setOkMsg("");

    try {
      const now = new Date();
      const dataSessao = toISODateInBrazil(now);
      const horaInicio = toTimeInBrazil(now);
      const location = await captureCurrentInstructorPosition();
      const nowIso = now.toISOString();
      const initialPing = buildRoutePing(location, "INICIO");

      const payload = {
        acompanhamento_id: item.id,
        sessao_numero: resumo.total + 1,
        data_sessao: dataSessao,
        hora_inicio: horaInicio,
        iniciado_em: nowIso,
        status_sessao: "INICIADA",
        instrutor_login: instrutorLogin,
        instrutor_nome: instrutorNome,
        instrutor_id: isUuid(user?.id) ? user.id : null,
        linha_snapshot: getLinhaApenas(item),
        foco_snapshot: item?.motivo || item?.metadata?.foco || null,
        latitude_inicio: location.latitude,
        longitude_inicio: location.longitude,
        precisao_inicio: location.accuracy,
        capturado_em_inicio: location.captured_at,
        metadata: {
          origem: "PRONTUARIO_UNIFICADO",
          device: navigator.userAgent,
          rota_pings: [initialPing],
          rota_tracking: {
            status: "ATIVA",
            iniciado_em: initialPing.captured_at,
            atualizado_em: initialPing.captured_at,
            encerrado_em: null,
            pontos: 1,
            distancia_m: 0,
          },
        },
      };

      const { error } = await supabase
        .from("diesel_acompanhamento_sessoes")
        .insert(payload);

      if (error) throw error;

      await registrarEventoSessao(item.id, {
        tipo: "SESSAO_INICIADA",
        observacoes: `Sessão ${payload.sessao_numero} iniciada por ${instrutorNome || instrutorLogin}.`,
        criado_por_login: instrutorLogin,
        criado_por_nome: instrutorNome,
        criado_por_id: isUuid(user?.id) ? user.id : null,
        extra: {
          sessao_numero: payload.sessao_numero,
          data_sessao: payload.data_sessao,
          hora_inicio: payload.hora_inicio,
          localizacao_inicio: {
            latitude: payload.latitude_inicio,
            longitude: payload.longitude_inicio,
            precisao: payload.precisao_inicio,
            capturado_em: payload.capturado_em_inicio,
          },
        },
      });

      setOkMsg("Acompanhamento iniciado com localização registrada.");
      await carregarSessoes();
      onSessionSaved?.();
    } catch (e) {
      console.error("Erro ao iniciar sessão:", e);
      setErro(e?.message || "Não foi possível iniciar a sessão.");
    } finally {
      setActionLoading("");
    }
  }

  async function encerrarSessao() {
    if (!sessaoAberta) {
      setErro("Não existe sessão em aberto para encerrar.");
      return;
    }

    if (!canManageSessions) {
      setErro(
        "Este acompanhamento já foi encerrado ou encaminhado para tratativa e não permite encerrar sessões por aqui."
      );
      return;
    }

    if (!sessaoAbertaEhDoUsuario) {
      setErro(
        `A sessão em aberto foi iniciada por ${sessaoAberta.instrutor_nome || sessaoAberta.instrutor_login}. Apenas o mesmo instrutor pode encerrar.`
      );
      return;
    }

    setActionLoading("encerrar");
    setErro("");
    setOkMsg("");

    try {
      const now = new Date();
      const horaFim = toTimeInBrazil(now);
      const location = await captureCurrentInstructorPosition();
      const nowIso = now.toISOString();
      const finalPing = buildRoutePing(location, "FIM");
      const currentPings = rotaPingsRef.current.length
        ? rotaPingsRef.current
        : getRoutePings(sessaoAberta);
      const nextPings = [...currentPings, finalPing].slice(-1000);
      const nextMetadata = {
        ...(sessaoAberta.metadata || {}),
        rota_pings: nextPings,
        rota_tracking: {
          ...((sessaoAberta.metadata || {}).rota_tracking || {}),
          status: "ENCERRADA",
          iniciado_em:
            (sessaoAberta.metadata || {}).rota_tracking?.iniciado_em ||
            sessaoAberta.iniciado_em ||
            nextPings[0]?.captured_at ||
            nowIso,
          atualizado_em: finalPing.captured_at,
          encerrado_em: finalPing.captured_at,
          pontos: nextPings.length,
          distancia_m: Math.round(routeDistanceMeters(nextPings)),
        },
      };

      const { error } = await supabase
        .from("diesel_acompanhamento_sessoes")
        .update({
          encerrado_em: nowIso,
          hora_fim: horaFim,
          status_sessao: "ENCERRADA",
          latitude_fim: location.latitude,
          longitude_fim: location.longitude,
          precisao_fim: location.accuracy,
          capturado_em_fim: location.captured_at,
          metadata: nextMetadata,
        })
        .eq("id", sessaoAberta.id);

      if (error) throw error;

      await registrarEventoSessao(item.id, {
        tipo: "SESSAO_ENCERRADA",
        observacoes: `Sessão ${sessaoAberta.sessao_numero} encerrada por ${instrutorNome || instrutorLogin}.`,
        criado_por_login: instrutorLogin,
        criado_por_nome: instrutorNome,
        criado_por_id: isUuid(user?.id) ? user.id : null,
        extra: {
          sessao_numero: sessaoAberta.sessao_numero,
          data_sessao: sessaoAberta.data_sessao,
          hora_inicio: sessaoAberta.hora_inicio,
          hora_fim: horaFim,
          localizacao_fim: {
            latitude: location.latitude,
            longitude: location.longitude,
            precisao: location.accuracy,
            capturado_em: location.captured_at,
          },
        },
      });

      setOkMsg("Acompanhamento encerrado com localização registrada.");
      await carregarSessoes();
      onSessionSaved?.();
    } catch (e) {
      console.error("Erro ao encerrar sessão:", e);
      setErro(e?.message || "Não foi possível encerrar a sessão.");
    } finally {
      setActionLoading("");
    }
  }

  return (
    <div className="border rounded-lg p-4 md:p-5 bg-white shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between border-b pb-4 mb-4">
        <div>
          <h4 className="font-bold text-slate-800 flex items-center gap-2">
            <FaRoute className="text-emerald-600" /> Sessões do Instrutor
          </h4>
          <p className="text-sm text-slate-500 mt-1">
            Cada nova ida a campo fica registrada dentro do mesmo acompanhamento enquanto ele estiver na janela de 30 dias.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={carregarSessoes}
            className="px-3 py-2 rounded-lg border bg-white text-slate-700 text-xs font-black inline-flex items-center gap-2"
            disabled={loading || !!actionLoading}
          >
            <FaSync className={loading ? "animate-spin" : ""} /> Atualizar
          </button>

          <button
            onClick={iniciarSessao}
            disabled={
              loading ||
              !!actionLoading ||
              !!sessaoAberta ||
              !windowInfo.withinWindow ||
              !canManageSessions
            }
            className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-black inline-flex items-center gap-2 disabled:opacity-50"
          >
            <FaPlay /> {actionLoading === "iniciar" ? "Iniciando..." : "Iniciar acompanhamento"}
          </button>

          <button
            onClick={encerrarSessao}
            disabled={
              loading ||
              !!actionLoading ||
              !sessaoAbertaEhDoUsuario ||
              !canManageSessions
            }
            className="px-3 py-2 rounded-lg bg-rose-600 text-white text-xs font-black inline-flex items-center gap-2 disabled:opacity-50"
          >
            <FaStopCircle /> {actionLoading === "encerrar" ? "Encerrando..." : "Encerrar acompanhamento"}
          </button>
        </div>
      </div>

      <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
        <div className="flex items-start gap-3">
          <FaInfoCircle className="text-blue-600 mt-0.5 shrink-0" />
          <div className="text-sm text-blue-900">
            <div className="font-black uppercase tracking-wider text-[11px] mb-1">
              Regras
            </div>
            <div>
              As sessões servem apenas para controlar e provar a rotina do instrutor. Elas não substituem checkpoint, análise final nem a regra de melhora do motorista.
            </div>
            <div className="mt-1">
              Dentro de 30 dias, novas idas a campo entram neste mesmo acompanhamento. Passou de 30 dias, precisa abrir um novo acompanhamento.
            </div>
            <div className="mt-1">
              Cada sessão precisa ser iniciada e encerrada com localização. Ao clicar em iniciar, o sistema grava hora e local automaticamente; ao clicar em encerrar, grava a hora e o ponto final.
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <div className="rounded-lg border bg-white px-3 py-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
            Próximo início
          </div>
          <div className="text-sm font-black text-slate-800">
            Automático no clique
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Data, hora e localização são gravadas ao iniciar.
          </div>
        </div>

        <div className="rounded-lg border bg-white px-3 py-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
            Próximo encerramento
          </div>
          <div className="text-sm font-black text-slate-800">
            Automático no clique
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Hora final e localização são gravadas ao encerrar.
          </div>
        </div>

        <div className="rounded-lg border bg-white px-3 py-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
            Linha acompanhada
          </div>
          <div className="text-sm font-black text-slate-800">
            {getLinhaApenas(item) || "Sem linha"}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Referência usada para a sessão do instrutor.
          </div>
        </div>
      </div>

      {erro && (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {erro}
        </div>
      )}

      {okMsg && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {okMsg}
        </div>
      )}

      {rotaStatus && sessaoAbertaEhDoUsuario && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 flex items-start gap-2">
          <FaRoute className="mt-0.5 shrink-0" />
          <span>{rotaStatus}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
        <div className="rounded-lg border bg-slate-50 px-3 py-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Janela ativa
          </div>
          <div className="text-lg font-black text-slate-800">
            {windowInfo.withinWindow ? "Sim" : "Não"}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Base: {formatDateBR(windowInfo.baseDateRaw)}
          </div>
        </div>

        <div className="rounded-lg border bg-slate-50 px-3 py-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Dias restantes
          </div>
          <div className="text-lg font-black text-slate-800">
            {windowInfo.withinWindow ? windowInfo.daysRemaining : 0}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Expira em {formatDateBR(windowInfo.expiresAt)}
          </div>
        </div>

        <div className="rounded-lg border bg-slate-50 px-3 py-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Sessões registradas
          </div>
          <div className="text-lg font-black text-slate-800">{resumo.total}</div>
          <div className="text-xs text-slate-500 mt-1">
            Em aberto: {resumo.abertas}
          </div>
        </div>

        <div className="rounded-lg border bg-slate-50 px-3 py-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Ultima atividade
          </div>
          <div className="text-sm font-black text-slate-800">
            {resumo.ultimaSessao
              ? formatDateTimeBR(
                  resumo.ultimaSessao.encerrado_em ||
                    resumo.ultimaSessao.iniciado_em ||
                    resumo.ultimaSessao.created_at
                )
              : "-"}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {resumo.ultimaSessao?.instrutor_nome ||
              resumo.ultimaSessao?.instrutor_login ||
              "-"}
          </div>
        </div>
      </div>

      {sessaoAberta && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="font-black text-amber-800 text-sm uppercase tracking-wider mb-1">
            Sessão em aberto
          </div>
          <div className="text-sm text-amber-900">
            Sessão {sessaoAberta.sessao_numero} iniciada por{" "}
            <span className="font-black">
              {sessaoAberta.instrutor_nome || sessaoAberta.instrutor_login}
            </span>{" "}
            em {formatDateTimeBR(sessaoAberta.iniciado_em)}.
          </div>
          <div className="text-xs text-amber-700 mt-1">
            {sessaoAbertaEhDoUsuario
              ? "Você pode encerrar essa sessão quando finalizar o acompanhamento."
              : "Apenas o mesmo instrutor que iniciou pode encerrar esta sessão."}
          </div>
        </div>
      )}

      {!windowInfo.withinWindow && (
        <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          A janela de 30 dias deste acompanhamento já terminou. A partir daqui, um novo acompanhamento deve ser lançado para este motorista.
        </div>
      )}

      {windowInfo.withinWindow && !canManageSessions && (
        <div className="mb-4 rounded-lg border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-800">
          Este caso já foi finalizado ou encaminhado para tratativa. As sessões continuam visíveis para auditoria, mas não aceitam novos inícios ou encerramentos.
        </div>
      )}

      {loading ? (
        <div className="text-sm text-slate-500 font-medium">
          Carregando sessões...
        </div>
      ) : sessoes.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-slate-50 px-4 py-5 text-sm text-slate-500">
          Nenhuma sessão complementar foi registrada ainda.
        </div>
      ) : (
        <div className="space-y-3">
          {sessoes.map((sessao) => (
            <div
              key={sessao.id}
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2 py-1 rounded-lg text-[11px] font-black border bg-white text-slate-700 border-slate-200">
                      Sessão {sessao.sessao_numero}
                    </span>
                    <span
                      className={`px-2 py-1 rounded-lg text-[11px] font-black border ${
                        sessao.encerrado_em
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-amber-50 text-amber-700 border-amber-200"
                      }`}
                    >
                      {sessao.encerrado_em ? "Encerrada" : "Em aberto"}
                    </span>
                  </div>

                  <div className="mt-2 text-sm font-black text-slate-800">
                    {sessao.instrutor_nome || sessao.instrutor_login || "-"}
                  </div>

                  <div className="text-xs text-slate-500 mt-1">
                    Data: {formatDateBR(sessao.data_sessao)} • Linha:{" "}
                    {sessao.linha_snapshot || "Sem linha"}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 lg:min-w-[560px]">
                  <div className="rounded-lg border bg-white px-3 py-2">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1">
                      <FaClock /> Início
                    </div>
                    <div className="text-sm font-black text-slate-800">
                      {formatTimeBR(sessao.hora_inicio || sessao.iniciado_em)}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      {formatDateTimeBR(sessao.iniciado_em)}
                    </div>
                  </div>

                  <div className="rounded-lg border bg-white px-3 py-2">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1">
                      <FaCheckCircle /> Fim
                    </div>
                    <div className="text-sm font-black text-slate-800">
                      {sessao.encerrado_em
                        ? formatTimeBR(sessao.hora_fim || sessao.encerrado_em)
                        : "-"}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      {sessao.encerrado_em
                        ? formatDateTimeBR(sessao.encerrado_em)
                        : "Ainda em aberto"}
                    </div>
                  </div>

                  <div className="rounded-lg border bg-white px-3 py-2">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1">
                      <FaRoute /> Duração
                    </div>
                    <div className="text-sm font-black text-slate-800">
                      {formatDuration(sessao.iniciado_em, sessao.encerrado_em)}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      Controle do instrutor
                    </div>
                  </div>

                  <div className="rounded-lg border bg-white px-3 py-2">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1">
                      <FaMapMarkedAlt /> Mapa
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setSessaoMapaAbertaId((prev) =>
                          prev === sessao.id ? null : sessao.id
                        )
                      }
                      className="text-sm font-black text-blue-700 hover:underline"
                    >
                      {sessaoMapaAbertaId === sessao.id ? "Ocultar mapa" : "Ver mapa"}
                    </button>
                    <div className="text-[11px] text-slate-500 mt-1">
                      Início e fim da sessão
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                <div className="rounded-lg border bg-white px-3 py-3">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1">
                    <FaMapMarkerAlt /> Localização de início
                  </div>
                  <div className="text-sm text-slate-700">
                    Lat {formatCoordinate(sessao.latitude_inicio)} • Lng{" "}
                    {formatCoordinate(sessao.longitude_inicio)}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    Precisão: {sessao.precisao_inicio ?? "-"} m
                  </div>
                </div>

                <div className="rounded-lg border bg-white px-3 py-3">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1">
                    <FaMapMarkerAlt /> Localização de fim
                  </div>
                  <div className="text-sm text-slate-700">
                    {sessao.encerrado_em ? (
                      <>
                        Lat {formatCoordinate(sessao.latitude_fim)} • Lng{" "}
                        {formatCoordinate(sessao.longitude_fim)}
                      </>
                    ) : (
                      "Aguardando encerramento"
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    Precisão: {sessao.encerrado_em ? sessao.precisao_fim ?? "-" : "-"} m
                  </div>
                </div>
              </div>

              {(() => {
                const rotaPings = getRoutePings(sessao);
                const rotaDistancia = routeDistanceMeters(rotaPings);
                const rotaLink = buildGoogleRouteLink(rotaPings);

                return (
                  <div className="rounded-lg border bg-white px-3 py-3 mt-3">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1">
                          <FaRoute /> Rota do acompanhamento
                        </div>
                        <div className="text-sm font-black text-slate-800">
                          {rotaPings.length} ponto(s) gravado(s) - {formatDistance(rotaDistancia)}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-1">
                          Primeiro ping:{" "}
                          {rotaPings[0]?.captured_at
                            ? formatDateTimeBR(rotaPings[0].captured_at)
                            : "-"}{" "}
                          | Ultimo ping:{" "}
                          {rotaPings[rotaPings.length - 1]?.captured_at
                            ? formatDateTimeBR(rotaPings[rotaPings.length - 1].captured_at)
                            : "-"}
                        </div>
                      </div>

                      {rotaLink ? (
                        <a
                          href={rotaLink}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-black text-white hover:bg-blue-500"
                        >
                          <FaMapMarkedAlt /> Abrir rota
                        </a>
                      ) : (
                        <span className="text-xs font-semibold text-slate-500">
                          A rota aparece quando houver pelo menos 2 pontos.
                        </span>
                      )}
                    </div>
                  </div>
                );
              })()}

              {sessaoMapaAbertaId === sessao.id && (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 mt-3">
                  <div className="rounded-lg border bg-white overflow-hidden">
                    <div className="px-3 py-2 border-b bg-slate-50 text-xs font-black uppercase tracking-wider text-slate-600">
                      Mapa do início
                    </div>
                    {buildMapSrc(sessao.latitude_inicio, sessao.longitude_inicio) ? (
                      <>
                        <iframe
                          title={`mapa-inicio-${sessao.id}`}
                          src={buildMapSrc(sessao.latitude_inicio, sessao.longitude_inicio)}
                          className="w-full h-56 border-0"
                          loading="lazy"
                          referrerPolicy="no-referrer-when-downgrade"
                        />
                        <div className="px-3 py-2 border-t text-xs">
                          <a
                            href={buildGoogleMapsLink(
                              sessao.latitude_inicio,
                              sessao.longitude_inicio
                            )}
                            target="_blank"
                            rel="noreferrer"
                            className="font-black text-blue-700 hover:underline"
                          >
                            Abrir no mapa
                          </a>
                        </div>
                      </>
                    ) : (
                      <div className="px-3 py-6 text-sm text-slate-500">
                        Localização inicial indisponível.
                      </div>
                    )}
                  </div>

                  <div className="rounded-lg border bg-white overflow-hidden">
                    <div className="px-3 py-2 border-b bg-slate-50 text-xs font-black uppercase tracking-wider text-slate-600">
                      Mapa do fim
                    </div>
                    {buildMapSrc(sessao.latitude_fim, sessao.longitude_fim) ? (
                      <>
                        <iframe
                          title={`mapa-fim-${sessao.id}`}
                          src={buildMapSrc(sessao.latitude_fim, sessao.longitude_fim)}
                          className="w-full h-56 border-0"
                          loading="lazy"
                          referrerPolicy="no-referrer-when-downgrade"
                        />
                        <div className="px-3 py-2 border-t text-xs">
                          <a
                            href={buildGoogleMapsLink(
                              sessao.latitude_fim,
                              sessao.longitude_fim
                            )}
                            target="_blank"
                            rel="noreferrer"
                            className="font-black text-blue-700 hover:underline"
                          >
                            Abrir no mapa
                          </a>
                        </div>
                      </>
                    ) : (
                      <div className="px-3 py-6 text-sm text-slate-500">
                        Localização final indisponível.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

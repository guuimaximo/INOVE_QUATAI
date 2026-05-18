const DAY_MS = 24 * 60 * 60 * 1000;

function stripTime(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function parseDateOnly(value) {
  if (!value) return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return stripTime(value);
  }

  const raw = String(value).trim();
  if (!raw) return null;

  const onlyDate = raw.split("T")[0].split(" ")[0];

  if (/^\d{4}-\d{2}-\d{2}$/.test(onlyDate)) {
    const [year, month, day] = onlyDate.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return stripTime(parsed);
}

export function getAcompanhamentoBaseDate(item) {
  return (
    item?.dt_inicio_monitoramento ||
    item?.created_at ||
    item?.dt_inicio ||
    item?.data_acompanhamento ||
    null
  );
}

export function getAcompanhamentoWindowInfo(item, now = new Date()) {
  const baseRaw = getAcompanhamentoBaseDate(item);
  const baseDate = parseDateOnly(baseRaw);
  const currentDate = stripTime(now);

  if (!baseDate) {
    return {
      hasBaseDate: false,
      baseDate: null,
      baseDateRaw: null,
      expiresAt: null,
      withinWindow: false,
      daysSinceStart: null,
      daysRemaining: 0,
    };
  }

  const expiresAt = new Date(baseDate);
  expiresAt.setDate(expiresAt.getDate() + 30);

  const diffDays = Math.max(
    0,
    Math.floor((currentDate.getTime() - baseDate.getTime()) / DAY_MS)
  );
  const remainingDays = Math.max(
    0,
    Math.ceil((expiresAt.getTime() - currentDate.getTime()) / DAY_MS)
  );

  return {
    hasBaseDate: true,
    baseDate,
    baseDateRaw: baseRaw,
    expiresAt,
    withinWindow: currentDate.getTime() < expiresAt.getTime(),
    daysSinceStart: diffDays,
    daysRemaining: remainingDays,
  };
}

export function formatDateBR(value) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleDateString("pt-BR", {
      timeZone: "America/Sao_Paulo",
    });
  } catch {
    return String(value);
  }
}

export function formatDateTimeBR(value) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
    });
  } catch {
    return String(value);
  }
}

export function formatTimeBR(value) {
  if (!value) return "-";

  const raw = String(value).trim();
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(raw)) {
    return raw.slice(0, 5);
  }

  try {
    return new Date(value).toLocaleTimeString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return raw;
  }
}

export function buildInstrutorNome(user) {
  const nomeCompleto = String(user?.nome_completo || "").trim();
  const nome = String(user?.nome || "").trim();
  const sobrenome = String(user?.sobrenome || "").trim();

  if (nomeCompleto) return nomeCompleto;
  if (nome && sobrenome) return `${nome} ${sobrenome}`;
  if (nome) return nome;
  return String(user?.login || user?.email || "").trim() || null;
}

export function normalizeDieselText(value) {
  return String(value || "").trim().toUpperCase();
}

export function extractDriverChapa(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const match = raw.match(/\b(\d{3,10})\b/);
  return match?.[1] || raw;
}

export function extractLinhaFromMotivo(motivo) {
  const raw = String(motivo || "").trim();
  if (!raw) return "";
  const match = raw.match(/linha\s+([a-z0-9]+)/i);
  return match?.[1] ? match[1].toUpperCase() : "";
}

export function deriveClusterFromPrefixo(prefixo) {
  const value = normalizeDieselText(prefixo);
  if (!value) return "";
  if (["W511", "W513", "W515"].includes(value)) return "";
  if (value.startsWith("2216")) return "C8";
  if (value.startsWith("2222")) return "C9";
  if (value.startsWith("2224")) return "C10";
  if (value.startsWith("2425")) return "C11";
  if (value.startsWith("W")) return "C6";
  return "";
}

export function buildMotoristaContextMap(rows = []) {
  const map = new Map();

  rows.forEach((row) => {
    const chapa = extractDriverChapa(
      row?.chapa || row?.motorista_chapa || row?.Motorista || row?.motorista
    );
    if (!chapa) return;

    const linha = normalizeDieselText(row?.linha);
    const cluster =
      normalizeDieselText(row?.Cluster || row?.cluster) ||
      deriveClusterFromPrefixo(row?.veiculo || row?.prefixo);
    const dateRef = String(row?.dateOnly || row?.dia || row?.created_at || row?.data_ref || "");
    const current = map.get(chapa);

    if (!current || dateRef > current.dateRef) {
      map.set(chapa, {
        linha,
        cluster,
        prefixo: String(row?.veiculo || row?.prefixo || "").trim(),
        dateRef,
      });
    }
  });

  return map;
}

export function resolveAcompanhamentoContext(item, motoristaContextMap = null) {
  const metadata =
    item?.metadata && typeof item.metadata === "object" ? item.metadata : {};
  const chapa = extractDriverChapa(item?.motorista_chapa);
  const fromMap = chapa && motoristaContextMap?.get ? motoristaContextMap.get(chapa) : null;

  const linha =
    normalizeDieselText(metadata?.linha_foco) ||
    normalizeDieselText(item?.linha_foco) ||
    extractLinhaFromMotivo(item?.motivo) ||
    normalizeDieselText(fromMap?.linha) ||
    "";

  const cluster =
    normalizeDieselText(metadata?.cluster_foco) ||
    normalizeDieselText(item?.cluster_foco) ||
    normalizeDieselText(fromMap?.cluster) ||
    "";

  return {
    linha,
    cluster,
    prefixo: String(fromMap?.prefixo || "").trim(),
  };
}

export function toISODateInBrazil(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function toTimeInBrazil(date = new Date()) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function geolocationErrorMessage(error) {
  if (!error) return "Nao foi possivel capturar a localizacao.";

  if (error.code === 1) {
    return "Permissao de localizacao negada. Libere a localizacao para iniciar ou encerrar o acompanhamento.";
  }

  if (error.code === 2) {
    return "Localizacao indisponivel no momento. Verifique GPS e sinal do dispositivo.";
  }

  if (error.code === 3) {
    return "Tempo esgotado ao buscar localizacao. Tente novamente em um local com melhor sinal.";
  }

  return error.message || "Nao foi possivel capturar a localizacao.";
}

export async function captureCurrentInstructorPosition() {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    throw new Error("Geolocalizacao indisponivel neste ambiente.");
  }

  if (!navigator.geolocation) {
    throw new Error("Este dispositivo nao possui geolocalizacao disponivel.");
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
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
        reject(new Error(geolocationErrorMessage(error)));
      },
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0,
      }
    );
  });
}

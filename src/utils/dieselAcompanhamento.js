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

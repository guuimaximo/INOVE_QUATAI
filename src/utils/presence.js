export const PRESENCE_SYNC_INTERVAL_MS = 60 * 1000;
export const PRESENCE_ONLINE_WINDOW_MS = 2 * 60 * 1000;

export function isPresenceOnline(lastPingAt) {
  if (!lastPingAt) return false;

  const timestamp = new Date(lastPingAt).getTime();
  if (Number.isNaN(timestamp)) return false;

  return Date.now() - timestamp <= PRESENCE_ONLINE_WINDOW_MS;
}

export function formatPresenceTimestamp(lastPingAt) {
  if (!lastPingAt) return "-";

  const timestamp = new Date(lastPingAt);
  if (Number.isNaN(timestamp.getTime())) return "-";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(timestamp);
}

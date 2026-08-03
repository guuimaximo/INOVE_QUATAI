// src/utils/auth.js
export const SESSION_KEY = "user";
const MAX_IDLE_MS = 4 * 60 * 60 * 1000; // 4h

export function getStoredUser() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredUser(user) {
  const payload = {
    ...user,
    lastActivity: Date.now(),
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(payload));
  return payload;
}

export function clearStoredUser() {
  localStorage.removeItem(SESSION_KEY);
}

export function touchActivity() {
  const u = getStoredUser();
  if (!u) return;
  u.lastActivity = Date.now();
  localStorage.setItem(SESSION_KEY, JSON.stringify(u));
}

export function isSessionValid() {
  const u = getStoredUser();
  if (!u) return false;
  const last = typeof u.lastActivity === "number" ? u.lastActivity : 0;
  return Date.now() - last < MAX_IDLE_MS;
}

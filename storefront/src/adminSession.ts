import type { AdminSession } from "./types";

const ADMIN_SESSION_KEY = "lampfactory_admin_session";

export function loadAdminSession(): AdminSession | null {
  try {
    const value = localStorage.getItem(ADMIN_SESSION_KEY);
    return value ? (JSON.parse(value) as AdminSession) : null;
  } catch {
    return null;
  }
}

export function saveAdminSession(session: AdminSession) {
  localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));
}

export function clearAdminSession() {
  localStorage.removeItem(ADMIN_SESSION_KEY);
}

export type AuthSession = {
  isLoggedIn: boolean;
  role: string;
  name: string;
  email: string;
  staffId?: string;
  branchId?: string;
};

const SESSION_KEY = "pharmapos_session";

export function getSession(): AuthSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as AuthSession;
    return session.isLoggedIn ? session : null;
  } catch {
    return null;
  }
}

export function setSession(session: AuthSession) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

export function isLoggedIn() {
  return getSession()?.isLoggedIn ?? false;
}

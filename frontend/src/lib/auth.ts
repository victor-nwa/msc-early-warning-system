
import { API_BASE_URL } from "@/lib/api";

export interface PortalUser {
  user_id: number;
  full_name: string;
  email: string;
  role: string;
  is_active?: number;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: PortalUser;
}

const TOKEN_KEY = "early_warning_token";
const USER_KEY = "early_warning_user";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): PortalUser | null {
  if (typeof window === "undefined") return null;

  const raw = window.localStorage.getItem(USER_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as PortalUser;
  } catch {
    return null;
  }
}

export function saveSession(response: LoginResponse) {
  window.localStorage.setItem(TOKEN_KEY, response.access_token);
  window.localStorage.setItem(USER_KEY, JSON.stringify(response.user));
}

export function logout() {
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || "Invalid email or password.");
  }

  return res.json() as Promise<LoginResponse>;
}

export async function getCurrentUser(): Promise<PortalUser> {
  const token = getToken();

  if (!token) {
    throw new Error("No active session.");
  }

  const res = await fetch(`${API_BASE_URL}/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    logout();
    throw new Error("Session expired.");
  }

  return res.json() as Promise<PortalUser>;
}

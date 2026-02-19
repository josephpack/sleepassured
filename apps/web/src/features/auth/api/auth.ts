import { api } from "@/lib/api";

export interface User {
  id: string;
  name: string;
  email: string;
  onboardingCompleted: boolean;
  targetWakeTime?: string | null;
  isAdmin?: boolean;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface SignupRequest {
  name: string;
  email: string;
  password: string;
}

const REFRESH_TOKEN_KEY = "sleepassured_refresh_token";

export function storeRefreshToken(token: string) {
  try {
    localStorage.setItem(REFRESH_TOKEN_KEY, token);
  } catch {
    // localStorage may be unavailable in some contexts
  }
}

export function getStoredRefreshToken(): string | null {
  try {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function clearStoredRefreshToken() {
  try {
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  } catch {
    // noop
  }
}

export async function login(data: LoginRequest): Promise<AuthResponse> {
  const response = await api<AuthResponse>("/auth/login", {
    method: "POST",
    body: data,
  });
  storeRefreshToken(response.refreshToken);
  return response;
}

export async function signup(data: SignupRequest): Promise<AuthResponse> {
  const response = await api<AuthResponse>("/auth/signup", {
    method: "POST",
    body: data,
  });
  storeRefreshToken(response.refreshToken);
  return response;
}

export async function logout(): Promise<void> {
  await api("/auth/logout", { method: "POST" });
  clearStoredRefreshToken();
}

export async function refreshAccessToken(): Promise<{
  accessToken: string;
  refreshToken: string;
}> {
  const storedToken = getStoredRefreshToken();
  const response = await api<{ accessToken: string; refreshToken: string }>(
    "/auth/refresh",
    {
      method: "POST",
      body: storedToken ? { refreshToken: storedToken } : undefined,
    }
  );
  storeRefreshToken(response.refreshToken);
  return response;
}

export async function getCurrentUser(): Promise<{ user: User }> {
  return api<{ user: User }>("/auth/me");
}

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
}

export interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface SignupRequest {
  name: string;
  email: string;
  password: string;
  rememberMe?: boolean;
}

export async function login(data: LoginRequest): Promise<AuthResponse> {
  return api<AuthResponse>("/auth/login", {
    method: "POST",
    body: data,
  });
}

export async function signup(data: SignupRequest): Promise<AuthResponse> {
  return api<AuthResponse>("/auth/signup", {
    method: "POST",
    body: data,
  });
}

export async function logout(): Promise<void> {
  await api("/auth/logout", { method: "POST" });
}

export async function refreshAccessToken(): Promise<{ accessToken: string }> {
  return api<{ accessToken: string }>("/auth/refresh", { method: "POST" });
}

export async function getCurrentUser(): Promise<{ user: User }> {
  return api<{ user: User }>("/auth/me");
}

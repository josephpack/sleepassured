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
const LAST_ROUTE_KEY = "sleepassured_last_route";

// ---------------------------------------------------------------------------
// IndexedDB helpers — backup store for refresh tokens on iOS Safari PWA
// where localStorage can be evicted after ~7 days of inactivity.
// ---------------------------------------------------------------------------
const IDB_NAME = "sleepassured_auth";
const IDB_STORE = "tokens";
const IDB_VERSION = 1;

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("indexedDB not available"));
      return;
    }
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key: string, value: string): Promise<void> {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(value, key);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

async function idbGet(key: string): Promise<string | null> {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readonly");
    const request = tx.objectStore(IDB_STORE).get(key);
    request.onsuccess = () => { db.close(); resolve(request.result ?? null); };
    request.onerror = () => { db.close(); reject(request.error); };
  });
}

async function idbDelete(key: string): Promise<void> {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).delete(key);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

// ---------------------------------------------------------------------------
// Refresh token storage (localStorage primary, IndexedDB backup)
// ---------------------------------------------------------------------------
export function storeRefreshToken(token: string) {
  try { localStorage.setItem(REFRESH_TOKEN_KEY, token); } catch {}
  // Fire-and-forget IndexedDB backup
  idbSet(REFRESH_TOKEN_KEY, token).catch(() => {});
}

export async function getStoredRefreshToken(): Promise<string | null> {
  // Try localStorage first (sync, fast)
  try {
    const token = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (token) return token;
  } catch {}
  // Fall back to IndexedDB (survives iOS Safari eviction better)
  try {
    const token = await idbGet(REFRESH_TOKEN_KEY);
    // If found in IDB but missing from localStorage, restore it
    if (token) {
      try { localStorage.setItem(REFRESH_TOKEN_KEY, token); } catch {}
    }
    return token;
  } catch {
    return null;
  }
}

export function clearStoredRefreshToken() {
  try { localStorage.removeItem(REFRESH_TOKEN_KEY); } catch {}
  idbDelete(REFRESH_TOKEN_KEY).catch(() => {});
}

// ---------------------------------------------------------------------------
// Last route persistence — restore the user's position after PWA relaunch
// ---------------------------------------------------------------------------
export function saveLastRoute(path: string) {
  try { localStorage.setItem(LAST_ROUTE_KEY, path); } catch {}
}

export function getLastRoute(): string | null {
  try { return localStorage.getItem(LAST_ROUTE_KEY); } catch { return null; }
}

export function clearLastRoute() {
  try { localStorage.removeItem(LAST_ROUTE_KEY); } catch {}
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------
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
  clearLastRoute();
}

export async function refreshAccessToken(): Promise<{
  accessToken: string;
  refreshToken: string;
}> {
  const storedToken = await getStoredRefreshToken();
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

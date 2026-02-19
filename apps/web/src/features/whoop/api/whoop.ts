import { api } from "@/lib/api";

export interface WhoopStatus {
  connected: boolean;
  connectedAt?: string;
  lastSyncedAt?: string | null;
  needsReauth?: boolean;
}

export interface WhoopAuthUrl {
  authUrl: string;
}

export interface WhoopSyncResult {
  message: string;
  recordsSynced?: number;
  needsReauth?: boolean;
}

export async function getWhoopStatus(): Promise<WhoopStatus> {
  return api<WhoopStatus>("/whoop/status");
}

export async function getWhoopAuthUrl(returnTo?: string): Promise<WhoopAuthUrl> {
  const params = returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : "";
  return api<WhoopAuthUrl>(`/whoop/auth-url${params}`);
}

export async function disconnectWhoop(): Promise<{ message: string }> {
  return api<{ message: string }>("/whoop/disconnect", { method: "DELETE" });
}

export async function syncWhoopData(): Promise<WhoopSyncResult> {
  return api<WhoopSyncResult>("/whoop/sync", { method: "POST" });
}

export interface WhoopRecovery {
  score: number;
  date: string;
  hrvRmssd: number | null;
  restingHeartRate: number | null;
}

export interface WhoopRecoveryResponse {
  connected: boolean;
  recovery: WhoopRecovery | null;
}

export async function getLatestRecovery(): Promise<WhoopRecoveryResponse> {
  return api<WhoopRecoveryResponse>("/whoop/latest-recovery");
}

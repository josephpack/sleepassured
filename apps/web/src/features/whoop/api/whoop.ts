import { api } from "@/lib/api";

export interface WhoopStatus {
  connected: boolean;
  connectedAt?: string;
  lastSyncedAt?: string | null;
}

export interface WhoopAuthUrl {
  authUrl: string;
}

export interface WhoopSyncResult {
  message: string;
  recordsSynced: number;
}

export async function getWhoopStatus(): Promise<WhoopStatus> {
  return api<WhoopStatus>("/whoop/status");
}

export async function getWhoopAuthUrl(): Promise<WhoopAuthUrl> {
  return api<WhoopAuthUrl>("/whoop/auth-url");
}

export async function disconnectWhoop(): Promise<{ message: string }> {
  return api<{ message: string }>("/whoop/disconnect", { method: "DELETE" });
}

export async function syncWhoopData(): Promise<WhoopSyncResult> {
  return api<WhoopSyncResult>("/whoop/sync", { method: "POST" });
}

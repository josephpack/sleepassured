import { api } from "@/lib/api";
import type { ProviderStatusResponse, NormalizedSleepRecord, UnifiedSleepHistoryRecord } from "./types";

export type { ProviderStatusResponse, NormalizedSleepRecord, UnifiedSleepHistoryRecord };

export async function getProviderStatus(): Promise<ProviderStatusResponse> {
  return api<ProviderStatusResponse>("/providers/status");
}

export async function connectAppleHealth(): Promise<{ message: string }> {
  return api<{ message: string }>("/providers/apple-health/connect", { method: "POST" });
}

export async function disconnectAppleHealth(): Promise<{ message: string }> {
  return api<{ message: string }>("/providers/apple-health/disconnect", { method: "DELETE" });
}

export async function syncAppleHealth(
  records: NormalizedSleepRecord[]
): Promise<{ created: number; skipped: number }> {
  return api<{ created: number; skipped: number }>("/providers/apple-health/sync", {
    method: "POST",
    body: { records },
  });
}

export async function getUnifiedSleepHistory(
  days = 7
): Promise<{ records: UnifiedSleepHistoryRecord[] }> {
  return api<{ records: UnifiedSleepHistoryRecord[] }>(`/providers/sleep-history?days=${days}`);
}

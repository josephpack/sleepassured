export interface ProviderStatus {
  slug: string;
  displayName: string;
  authType: "oauth" | "device";
  connected: boolean;
  needsReauth: boolean;
  lastSyncedAt: string | null;
  connectedAt: string | null;
}

export interface ProviderStatusResponse {
  providers: ProviderStatus[];
}

export interface NormalizedSleepRecord {
  sourceId: string;
  startTime: string; // ISO string
  endTime: string;   // ISO string
  totalSleepDurationMs: number;
  remSleepMs: number;
  lightSleepMs: number;
  deepSleepMs: number;
  awakeDurationMs: number;
  sleepEfficiency: number;
  hrvRmssd?: number;
  restingHeartRate?: number;
}

export interface UnifiedSleepHistoryRecord {
  date: string;
  provider: string;
  bedtime: string;
  wakeTime: string;
  totalSleepMins: number;
  sleepEfficiency: number;
  remMins: number;
  lightMins: number;
  deepMins: number;
  awakeMins: number;
  recoveryScore: number | null;
}

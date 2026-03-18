export interface NormalizedSleepRecord {
  sourceId: string;           // Provider-unique ID (e.g. WHOOP sleep ID, HealthKit UUID)
  provider: string;           // 'whoop' | 'apple_health'
  startTime: Date;
  endTime: Date;
  totalSleepDurationMs: number;
  remSleepMs: number;
  lightSleepMs: number;
  deepSleepMs: number;
  awakeDurationMs: number;
  sleepEfficiency: number;    // 0-100
  recoveryScore?: number;     // 0-100, only some providers
  hrvRmssd?: number;          // ms
  restingHeartRate?: number;  // bpm
  rawData?: unknown;
}

export interface NormalizedRecoveryData {
  date: Date;
  score: number;              // 0-100
  hrvRmssd?: number;
  restingHeartRate?: number;
}

export interface ProviderInfo {
  slug: string;               // 'whoop', 'apple_health'
  displayName: string;        // 'WHOOP', 'Apple Health'
  authType: "oauth" | "device";
}

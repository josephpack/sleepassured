import { Capacitor } from "@capacitor/core";
import type { NormalizedSleepRecord } from "../types";

/**
 * Check if we are running on a native iOS device (HealthKit is iOS-only).
 */
export function isNativeIOS(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";
}

/**
 * Dynamically import the HealthKit plugin only when running on native iOS.
 * Returns null on web.
 */
async function getHealthKitPlugin() {
  if (!isNativeIOS()) return null;
  const { CapacitorHealthkit } = await import("@perfood/capacitor-healthkit");
  return CapacitorHealthkit;
}

/**
 * Request HealthKit permission for sleep, HRV, and resting heart rate.
 * Returns true if permission request completed (we can't know if they accepted).
 */
export async function requestHealthKitPermission(): Promise<boolean> {
  const plugin = await getHealthKitPlugin();
  if (!plugin) return false;

  try {
    await plugin.requestAuthorization({
      all: [],
      read: ["sleepAnalysis", "heartRateVariabilitySDNN", "restingHeartRate"],
      write: [],
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if HealthKit is available on this device.
 */
export async function isHealthKitAvailable(): Promise<boolean> {
  const plugin = await getHealthKitPlugin();
  if (!plugin) return false;

  try {
    await plugin.isAvailable();
    return true;
  } catch {
    return false;
  }
}

// Apple Health sleep states and their categories
const SLEEP_STAGE_MAP: Record<string, "rem" | "light" | "deep" | "awake" | "inbed"> = {
  // HKCategoryValueSleepAnalysis values
  InBed: "inbed",
  Asleep: "light",       // Generic "asleep" → treat as light
  AsleepCore: "light",   // Core sleep = light
  AsleepDeep: "deep",
  AsleepREM: "rem",
  Awake: "awake",
  // Lowercase variants
  inBed: "inbed",
  asleep: "light",
  asleepCore: "light",
  asleepDeep: "deep",
  asleepREM: "rem",
  awake: "awake",
};

interface SleepSession {
  startDate: Date;
  endDate: Date;
  remMs: number;
  lightMs: number;
  deepMs: number;
  awakeMs: number;
  totalSleepMs: number;
  uuid: string;
}

/**
 * Fetch sleep data from HealthKit for the last N days and return normalised records.
 */
export async function fetchHealthKitSleep(days: number): Promise<NormalizedSleepRecord[]> {
  const plugin = await getHealthKitPlugin();
  if (!plugin) return [];

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  try {
    const result = await plugin.queryHKitSampleType({
      sampleName: "sleepAnalysis",
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      limit: 0, // 0 = no limit
    });

    if (!result.resultData || result.resultData.length === 0) {
      return [];
    }

    // Group sleep samples into nightly sessions by date (the wake-up date)
    const sessionsByDate = new Map<string, SleepSession>();

    for (const sample of result.resultData) {
      const sleepData = sample as { startDate: string; endDate: string; sleepState: string; duration: number; uuid: string };
      const stage = SLEEP_STAGE_MAP[sleepData.sleepState];
      if (!stage || stage === "inbed") continue; // Skip "InBed" — not a sleep stage

      const sampleEnd = new Date(sleepData.endDate);
      const dateKey = sampleEnd.toISOString().slice(0, 10);
      const durationMs = (sleepData.duration || 0) * 1000;

      let session = sessionsByDate.get(dateKey);
      if (!session) {
        session = {
          startDate: new Date(sleepData.startDate),
          endDate: sampleEnd,
          remMs: 0,
          lightMs: 0,
          deepMs: 0,
          awakeMs: 0,
          totalSleepMs: 0,
          uuid: sleepData.uuid,
        };
        sessionsByDate.set(dateKey, session);
      }

      // Expand session time range
      const sampleStart = new Date(sleepData.startDate);
      if (sampleStart < session.startDate) session.startDate = sampleStart;
      if (sampleEnd > session.endDate) session.endDate = sampleEnd;

      switch (stage) {
        case "rem":
          session.remMs += durationMs;
          session.totalSleepMs += durationMs;
          break;
        case "light":
          session.lightMs += durationMs;
          session.totalSleepMs += durationMs;
          break;
        case "deep":
          session.deepMs += durationMs;
          session.totalSleepMs += durationMs;
          break;
        case "awake":
          session.awakeMs += durationMs;
          break;
      }
    }

    // Optionally fetch HRV and RHR
    let hrvByDate = new Map<string, number>();
    let rhrByDate = new Map<string, number>();

    try {
      const [hrvResult, rhrResult] = await Promise.all([
        plugin.queryHKitSampleType({
          sampleName: "heartRateVariabilitySDNN",
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          limit: 0,
        }),
        plugin.queryHKitSampleType({
          sampleName: "restingHeartRate",
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          limit: 0,
        }),
      ]);

      // Group HRV by date and average
      const hrvValues = new Map<string, number[]>();
      for (const sample of (hrvResult.resultData || [])) {
        const s = sample as { endDate: string; value: number };
        const dateKey = new Date(s.endDate).toISOString().slice(0, 10);
        const arr = hrvValues.get(dateKey) || [];
        arr.push(s.value);
        hrvValues.set(dateKey, arr);
      }
      for (const [date, values] of hrvValues) {
        hrvByDate.set(date, values.reduce((a, b) => a + b, 0) / values.length);
      }

      // Group RHR by date
      const rhrValues = new Map<string, number[]>();
      for (const sample of (rhrResult.resultData || [])) {
        const s = sample as { endDate: string; value: number };
        const dateKey = new Date(s.endDate).toISOString().slice(0, 10);
        const arr = rhrValues.get(dateKey) || [];
        arr.push(s.value);
        rhrValues.set(dateKey, arr);
      }
      for (const [date, values] of rhrValues) {
        rhrByDate.set(date, Math.round(values.reduce((a, b) => a + b, 0) / values.length));
      }
    } catch {
      // HRV/RHR not available — continue without
    }

    // Convert sessions to normalised records
    const records: NormalizedSleepRecord[] = [];

    for (const [dateKey, session] of sessionsByDate) {
      if (session.totalSleepMs === 0) continue;

      const timeInBedMs = session.endDate.getTime() - session.startDate.getTime();
      const efficiency = timeInBedMs > 0
        ? Math.round((session.totalSleepMs / timeInBedMs) * 1000) / 10
        : 0;

      records.push({
        sourceId: `healthkit-${session.uuid}`,
        startTime: session.startDate.toISOString(),
        endTime: session.endDate.toISOString(),
        totalSleepDurationMs: session.totalSleepMs,
        remSleepMs: session.remMs,
        lightSleepMs: session.lightMs,
        deepSleepMs: session.deepMs,
        awakeDurationMs: session.awakeMs,
        sleepEfficiency: efficiency,
        hrvRmssd: hrvByDate.get(dateKey),
        restingHeartRate: rhrByDate.get(dateKey),
      });
    }

    return records;
  } catch {
    return [];
  }
}

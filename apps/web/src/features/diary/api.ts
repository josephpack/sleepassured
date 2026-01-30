import { api } from "@/lib/api";

export interface DiaryEntry {
  id: string;
  userId: string;
  date: string;
  bedtime: string;
  sleepOnsetLatencyMins: number;
  numberOfAwakenings: number;
  wakeAfterSleepOnsetMins: number;
  finalWakeTime: string;
  outOfBedTime: string;
  subjectiveQuality: number;
  totalSleepTimeMins: number;
  timeInBedMins: number;
  sleepEfficiency: number;
  source: "MANUAL" | "WHOOP" | "HYBRID";
  whoopSleepRecordId?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DiaryEntryInput {
  date: string;
  bedtime: string;
  sleepOnsetLatencyMins: number;
  numberOfAwakenings: number;
  wakeAfterSleepOnsetMins: number;
  finalWakeTime: string;
  outOfBedTime: string;
  subjectiveQuality: number;
  source?: "manual" | "whoop" | "hybrid";
  whoopSleepRecordId?: string;
  notes?: string;
}

export interface DiaryPrefillData {
  date: string;
  bedtime: string;
  sleepOnsetLatencyMins: number;
  numberOfAwakenings: number;
  wakeAfterSleepOnsetMins: number;
  finalWakeTime: string;
  outOfBedTime: string;
  totalSleepTimeMins: number;
  timeInBedMins: number;
  sleepEfficiency: number;
  whoopSleepRecordId: string;
  recoveryScore?: number | null;
}

export interface PrefillResponse {
  prefillData: DiaryPrefillData | null;
  message?: string;
}

export interface SleepSchedule {
  id: string;
  prescribedBedtime: string;
  prescribedWakeTime: string;
  timeInBedMins: number;
  weekStartDate: string;
  avgSleepEfficiency: number | null;
  adjustmentMade: "INCREASE" | "DECREASE" | "NONE" | "BASELINE" | null;
  adjustmentMins: number;
  feedbackMessage: string | null;
  createdAt: string;
  weekNumber: number | null;
  adherencePercentage: number | null;
}

export interface BaselineStatus {
  entriesLogged: number;
  entriesNeeded: number;
  isComplete: boolean;
  daysRemaining: number;
  message: string;
}

export interface CurrentScheduleResponse {
  hasSchedule: boolean;
  schedule?: SleepSchedule;
  baselineStatus?: BaselineStatus;
}

// Diary CRUD operations
export async function createDiaryEntry(entry: DiaryEntryInput): Promise<{ entry: DiaryEntry }> {
  return api<{ entry: DiaryEntry }>("/diary", {
    method: "POST",
    body: entry,
  });
}

export async function getDiaryEntries(from?: string, to?: string): Promise<{ entries: DiaryEntry[] }> {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const query = params.toString() ? `?${params.toString()}` : "";
  return api<{ entries: DiaryEntry[] }>(`/diary${query}`);
}

export async function getDiaryEntry(date: string): Promise<{ entry: DiaryEntry }> {
  return api<{ entry: DiaryEntry }>(`/diary/${date}`);
}

export async function updateDiaryEntry(date: string, entry: DiaryEntryInput): Promise<{ entry: DiaryEntry }> {
  return api<{ entry: DiaryEntry }>(`/diary/${date}`, {
    method: "PUT",
    body: entry,
  });
}

export async function deleteDiaryEntry(date: string): Promise<{ message: string }> {
  return api<{ message: string }>(`/diary/${date}`, { method: "DELETE" });
}

export async function getPrefillData(date: string): Promise<PrefillResponse> {
  return api<PrefillResponse>(`/diary/prefill/${date}`);
}

// Schedule operations
export async function getCurrentSchedule(): Promise<CurrentScheduleResponse> {
  return api<CurrentScheduleResponse>("/schedule/current");
}

export async function getScheduleHistory(limit?: number): Promise<{ schedules: SleepSchedule[] }> {
  const query = limit ? `?limit=${limit}` : "";
  return api<{ schedules: SleepSchedule[] }>(`/schedule/history${query}`);
}

export async function getBaselineStatus(): Promise<BaselineStatus> {
  return api<BaselineStatus>("/schedule/baseline-status");
}

export async function initializeSchedule(): Promise<{ message: string; schedule: SleepSchedule }> {
  return api<{ message: string; schedule: SleepSchedule }>("/schedule/initialize", {
    method: "POST",
  });
}

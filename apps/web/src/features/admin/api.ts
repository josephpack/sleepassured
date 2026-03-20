import { api } from "@/lib/api";

export interface AdminUserSummary {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  onboardingCompleted: boolean;
  baselineComplete: boolean;
  flaggedForReview: boolean;
  flaggedReason: string | null;
  adminNotes: string | null;
  therapyStartDate: string | null;
  whoopConnected: boolean;
  diaryCount: number;
  lastDiaryDate: string | null;
  latestSleepEfficiency: number | null;
  latestIsiScore: number | null;
}

export interface DiaryEntry {
  date: string;
  sleepEfficiency: number;
  totalSleepTimeMins: number;
  subjectiveQuality: number;
  source: string;
}

export interface SleepWindowEntry {
  weekStartDate: string;
  prescribedBedtime: string;
  prescribedWakeTime: string;
  timeInBedMins: number;
  avgSleepEfficiency: number | null;
  adjustmentMade: string | null;
}

export interface ISIAssessmentEntry {
  score: number;
  completedAt: string;
}

export interface AdminUserDetail {
  user: AdminUserSummary;
  diaryEntries: DiaryEntry[];
  sleepWindows: SleepWindowEntry[];
  isiAssessments: ISIAssessmentEntry[];
}

export interface SyncResult {
  userId: string;
  success: boolean;
  recordsSynced?: number;
  error?: string;
}

export interface AdjustmentResult {
  userId: string;
  success: boolean;
  action?: string;
  newTIB?: number;
  avgSleepEfficiency?: number;
  error?: string;
}

export async function getAdminUsers(): Promise<{ users: AdminUserSummary[] }> {
  return api<{ users: AdminUserSummary[] }>("/admin/users");
}

export async function getAdminUser(id: string): Promise<AdminUserDetail> {
  return api<AdminUserDetail>(`/admin/users/${id}`);
}

export async function updateAdminUser(
  id: string,
  data: { flaggedForReview?: boolean; flaggedReason?: string | null; adminNotes?: string }
): Promise<{ user: Pick<AdminUserSummary, "id" | "flaggedForReview" | "flaggedReason" | "adminNotes"> }> {
  return api(`/admin/users/${id}`, { method: "PATCH", body: data });
}

export async function adminSyncWhoop(id: string): Promise<SyncResult> {
  return api<SyncResult>(`/admin/users/${id}/sync-whoop`, { method: "POST" });
}

export async function adminTriggerAdjustment(id: string): Promise<AdjustmentResult> {
  return api<AdjustmentResult>(`/admin/users/${id}/trigger-adjustment`, { method: "POST" });
}

export async function createAdminUser(data: {
  name: string;
  email: string;
  password: string;
}): Promise<{ user: { id: string; name: string; email: string; createdAt: string } }> {
  return api(`/admin/users`, { method: "POST", body: data });
}

export async function adminResetPassword(
  id: string,
  password: string
): Promise<{ success: boolean }> {
  return api(`/admin/users/${id}/reset-password`, { method: "POST", body: { password } });
}

export async function deleteAdminUser(id: string): Promise<{ success: boolean }> {
  return api(`/admin/users/${id}`, { method: "DELETE" });
}

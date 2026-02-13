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

export async function getAdminUsers(): Promise<{ users: AdminUserSummary[] }> {
  return api<{ users: AdminUserSummary[] }>("/admin/users");
}

export async function getAdminUser(id: string): Promise<AdminUserDetail> {
  return api<AdminUserDetail>(`/admin/users/${id}`);
}

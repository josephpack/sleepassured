import { api } from "@/lib/api";

export interface ISIAssessmentResult {
  id: string;
  score: number;
  severity: "none" | "subthreshold" | "moderate" | "severe";
  completedAt: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  targetWakeTime: string | null;
  onboardingCompleted: boolean;
}

export async function submitISIAssessment(
  responses: number[]
): Promise<{ assessment: ISIAssessmentResult }> {
  return api<{ assessment: ISIAssessmentResult }>("/assessments/isi", {
    method: "POST",
    body: { responses },
  });
}

export async function updateUserProfile(data: {
  name?: string;
  targetWakeTime?: string;
  onboardingCompleted?: boolean;
}): Promise<{ user: UserProfile }> {
  return api<{ user: UserProfile }>("/users/me", {
    method: "PATCH",
    body: data,
  });
}

export async function getLatestISIAssessment(): Promise<{
  assessment: ISIAssessmentResult;
}> {
  return api<{ assessment: ISIAssessmentResult }>("/assessments/isi/latest");
}

import { api } from "@/lib/api";

export interface DailyAction {
  id: string;
  text: string;
}

export interface DailyNudge {
  id: string;
  message: string;
}

export interface ConversationStarter {
  id: string;
  label: string;
  message: string;
}

export interface ProgrammeProgress {
  currentWeek: number;
  completedTopics: string[];
  currentTopic: string;
  upcomingTopics: string[];
}

export interface DailyTip {
  id: string;
  message: string;
}

export interface ProgrammeResponse {
  weekNumber: number;
  totalWeeks: number;
  topic: string;
  summary: string;
  dailyActions: DailyAction[];
  dailyNudge: DailyNudge;
  dailyTip: DailyTip;
  conversationStarters: ConversationStarter[];
  progress: ProgrammeProgress;
}

export async function getCurrentProgramme(): Promise<ProgrammeResponse> {
  return api<ProgrammeResponse>("/programme/current");
}

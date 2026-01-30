import { api } from "@/lib/api";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatResponse {
  message: string;
  source: "ai" | "fallback";
}

export interface QuickReply {
  id: string;
  label: string;
  message: string;
}

export interface QuickRepliesResponse {
  quickReplies: QuickReply[];
  context: {
    lastNightEfficiency: number | null;
    isLowEfficiency: boolean;
  };
}

export interface ChatContextResponse {
  weekNumber: number;
  hasSchedule: boolean;
  schedule: {
    prescribedBedtime: string;
    prescribedWakeTime: string;
    timeInBedMins: number;
  } | null;
  recentStats: {
    entriesCount: number;
    avgSleepEfficiency: number | null;
    avgTotalSleepTime: number | null;
    avgSubjectiveQuality: number | null;
  };
  hasWhoopConnection: boolean;
  avgRecoveryScore: number | null;
  latestISI: {
    score: number;
    severity: string;
  } | null;
  baselineComplete: boolean;
}

export async function sendChatMessage(
  message: string,
  conversationHistory: ChatMessage[]
): Promise<ChatResponse> {
  return api<ChatResponse>("/chat", {
    method: "POST",
    body: {
      message,
      conversationHistory,
    },
  });
}

export async function getQuickReplies(): Promise<QuickRepliesResponse> {
  return api<QuickRepliesResponse>("/chat/quick-replies");
}

export async function getChatContext(): Promise<ChatContextResponse> {
  return api<ChatContextResponse>("/chat/context");
}

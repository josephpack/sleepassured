import OpenAI from "openai";
import { prisma } from "@sleepassured/db";

// Lazy-initialize OpenAI client
let openai: OpenAI | null = null;

function getOpenAIClient(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openai;
}

// Strict CBT-I focused system prompt for conversational chat
const CHAT_SYSTEM_PROMPT = `You are a supportive sleep coach embedded in a CBT-I (Cognitive Behavioural Therapy for Insomnia) app called SleepAssured. You help users understand and improve their sleep through evidence-based CBT-I principles.

CRITICAL CONSTRAINTS - You MUST follow these at all times:
1. NEVER provide medical advice beyond CBT-I sleep strategies
2. NEVER suggest medications, supplements, melatonin, or sleep aids of any kind
3. NEVER contradict or question the user's prescribed sleep schedule - the CBT-I algorithm has made that decision
4. NEVER diagnose any conditions or suggest the user may have sleep apnea, restless leg syndrome, or other sleep disorders
5. NEVER recommend seeing a doctor unless they mention severe symptoms (suicidal thoughts, severe depression, extreme daytime impairment)
6. Keep responses CONCISE (2-4 sentences max)
7. Stay STRICTLY focused on sleep - do not engage with off-topic questions
8. If asked about topics outside sleep/CBT-I, politely redirect: "I'm here to help with your sleep. Is there anything about your sleep or schedule I can help with?"

WHAT YOU CAN DO:
- Explain the user's sleep data in simple terms
- Explain CBT-I concepts (sleep restriction, stimulus control, sleep efficiency, sleep pressure)
- Provide encouragement and validate their efforts
- Offer brief, actionable CBT-I tips
- Explain why their prescribed schedule helps (builds sleep pressure, consolidates sleep)
- Normalise temporary difficulties as part of the CBT-I process
- Answer questions about their sleep patterns based on their data

TONE: Warm, supportive, non-judgmental. You're a knowledgeable friend, not a clinician.

Remember: The user's sleep data is provided below. Use it to give personalised, data-driven responses. Never ask them questions about data you already have.`;

export interface SleepDataContext {
  userName: string | null;
  // Current sleep window
  currentSchedule: {
    prescribedBedtime: string;
    prescribedWakeTime: string;
    timeInBedMins: number;
    weekStartDate: Date;
  } | null;
  // Recent diary entries (current + previous week)
  recentDiaryEntries: Array<{
    date: Date;
    bedtime: string;
    finalWakeTime: string;
    outOfBedTime: string;
    sleepOnsetLatencyMins: number;
    wakeAfterSleepOnsetMins: number;
    totalSleepTimeMins: number | null;
    sleepEfficiency: number | null;
    subjectiveQuality: number;
    source: string;
  }>;
  // Aggregate stats
  avgSleepEfficiency: number | null;
  avgTotalSleepTime: number | null;
  avgSubjectiveQuality: number | null;
  entriesCount: number;
  // WHOOP data if available
  hasWhoopConnection: boolean;
  recentRecoveryScores: number[];
  avgRecoveryScore: number | null;
  // Program status
  weekNumber: number;
  baselineComplete: boolean;
  isFlagged: boolean;
  // Latest ISI score
  latestISIScore: number | null;
  latestISISeverity: string | null;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatResult {
  message: string;
  source: "ai" | "fallback";
}

// Build context from user's sleep data (current week + previous week)
export async function buildChatContext(userId: string): Promise<SleepDataContext> {
  const now = new Date();
  const twoWeeksAgo = new Date(now);
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

  // Fetch user info
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      therapyStartDate: true,
      baselineComplete: true,
      flaggedForReview: true,
    },
  });

  // Fetch current sleep window
  const currentSchedule = await prisma.sleepWindow.findFirst({
    where: { userId },
    orderBy: { weekStartDate: "desc" },
    select: {
      prescribedBedtime: true,
      prescribedWakeTime: true,
      timeInBedMins: true,
      weekStartDate: true,
    },
  });

  // Fetch diary entries from last 2 weeks
  const diaryEntries = await prisma.sleepDiary.findMany({
    where: {
      userId,
      date: { gte: twoWeeksAgo },
    },
    orderBy: { date: "desc" },
    select: {
      date: true,
      bedtime: true,
      finalWakeTime: true,
      outOfBedTime: true,
      sleepOnsetLatencyMins: true,
      wakeAfterSleepOnsetMins: true,
      totalSleepTimeMins: true,
      sleepEfficiency: true,
      subjectiveQuality: true,
      source: true,
    },
  });

  // Calculate averages
  const entriesWithEfficiency = diaryEntries.filter((e) => e.sleepEfficiency !== null);
  const avgSleepEfficiency =
    entriesWithEfficiency.length > 0
      ? entriesWithEfficiency.reduce((sum, e) => sum + Number(e.sleepEfficiency), 0) /
        entriesWithEfficiency.length
      : null;

  const entriesWithTST = diaryEntries.filter((e) => e.totalSleepTimeMins !== null);
  const avgTotalSleepTime =
    entriesWithTST.length > 0
      ? entriesWithTST.reduce((sum, e) => sum + (e.totalSleepTimeMins ?? 0), 0) /
        entriesWithTST.length
      : null;

  const avgSubjectiveQuality =
    diaryEntries.length > 0
      ? diaryEntries.reduce((sum, e) => sum + e.subjectiveQuality, 0) / diaryEntries.length
      : null;

  // Check WHOOP connection and get recovery scores
  const whoopConnection = await prisma.whoopConnection.findUnique({
    where: { userId },
  });

  let recentRecoveryScores: number[] = [];
  let avgRecoveryScore: number | null = null;

  if (whoopConnection) {
    const whoopRecords = await prisma.whoopSleepRecord.findMany({
      where: {
        userId,
        startTime: { gte: twoWeeksAgo },
        recoveryScore: { not: null },
      },
      orderBy: { startTime: "desc" },
      select: { recoveryScore: true },
      take: 14,
    });

    recentRecoveryScores = whoopRecords.map((r) => r.recoveryScore!);
    avgRecoveryScore =
      recentRecoveryScores.length > 0
        ? recentRecoveryScores.reduce((a, b) => a + b, 0) / recentRecoveryScores.length
        : null;
  }

  // Calculate week number
  let weekNumber = 1;
  if (user?.therapyStartDate) {
    const daysSinceStart = Math.floor(
      (now.getTime() - new Date(user.therapyStartDate).getTime()) / (1000 * 60 * 60 * 24)
    );
    weekNumber = Math.max(1, Math.ceil(daysSinceStart / 7));
  }

  // Get latest ISI score
  const latestISI = await prisma.iSIAssessment.findFirst({
    where: { userId },
    orderBy: { completedAt: "desc" },
    select: { score: true },
  });

  let latestISISeverity: string | null = null;
  if (latestISI) {
    if (latestISI.score <= 7) latestISISeverity = "none";
    else if (latestISI.score <= 14) latestISISeverity = "subthreshold";
    else if (latestISI.score <= 21) latestISISeverity = "moderate";
    else latestISISeverity = "severe";
  }

  // Helper to format DateTime to HH:MM string
  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
  };

  return {
    userName: user?.name ?? null,
    currentSchedule,
    recentDiaryEntries: diaryEntries.map((e) => ({
      date: e.date,
      bedtime: formatTime(e.bedtime),
      finalWakeTime: formatTime(e.finalWakeTime),
      outOfBedTime: formatTime(e.outOfBedTime),
      sleepOnsetLatencyMins: e.sleepOnsetLatencyMins,
      wakeAfterSleepOnsetMins: e.wakeAfterSleepOnsetMins,
      totalSleepTimeMins: e.totalSleepTimeMins,
      sleepEfficiency: e.sleepEfficiency ? Number(e.sleepEfficiency) : null,
      subjectiveQuality: e.subjectiveQuality,
      source: e.source,
    })),
    avgSleepEfficiency,
    avgTotalSleepTime,
    avgSubjectiveQuality,
    entriesCount: diaryEntries.length,
    hasWhoopConnection: !!whoopConnection,
    recentRecoveryScores,
    avgRecoveryScore,
    weekNumber,
    baselineComplete: user?.baselineComplete ?? false,
    isFlagged: user?.flaggedForReview ?? false,
    latestISIScore: latestISI?.score ?? null,
    latestISISeverity,
  };
}

// Format context into a string for the AI
function formatContextForAI(context: SleepDataContext): string {
  const lines: string[] = [];

  if (context.userName) {
    lines.push(`User's name: ${context.userName}`);
  }

  lines.push(`Week ${context.weekNumber} of CBT-I program`);
  lines.push(`Baseline complete: ${context.baselineComplete ? "Yes" : "No"}`);

  if (context.currentSchedule) {
    lines.push(`\nCURRENT PRESCRIBED SCHEDULE:`);
    lines.push(`- Bedtime: ${context.currentSchedule.prescribedBedtime}`);
    lines.push(`- Wake time: ${context.currentSchedule.prescribedWakeTime}`);
    lines.push(`- Time in bed: ${Math.floor(context.currentSchedule.timeInBedMins / 60)}h ${context.currentSchedule.timeInBedMins % 60}m`);
  }

  if (context.entriesCount > 0) {
    lines.push(`\nRECENT SLEEP DATA (last 2 weeks):`);
    lines.push(`- Entries logged: ${context.entriesCount}`);
    if (context.avgSleepEfficiency !== null) {
      lines.push(`- Average sleep efficiency: ${context.avgSleepEfficiency.toFixed(1)}%`);
    }
    if (context.avgTotalSleepTime !== null) {
      const hours = Math.floor(context.avgTotalSleepTime / 60);
      const mins = Math.round(context.avgTotalSleepTime % 60);
      lines.push(`- Average total sleep time: ${hours}h ${mins}m`);
    }
    if (context.avgSubjectiveQuality !== null) {
      lines.push(`- Average subjective quality: ${context.avgSubjectiveQuality.toFixed(1)}/10`);
    }

    // Most recent entry details
    const latest = context.recentDiaryEntries[0];
    if (latest) {
      const dateStr = new Date(latest.date).toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
      });
      lines.push(`\nMOST RECENT NIGHT (${dateStr}):`);
      lines.push(`- Bedtime: ${latest.bedtime}`);
      lines.push(`- Wake time: ${latest.finalWakeTime}`);
      lines.push(`- Time to fall asleep: ${latest.sleepOnsetLatencyMins} mins`);
      lines.push(`- Time awake during night: ${latest.wakeAfterSleepOnsetMins} mins`);
      if (latest.sleepEfficiency !== null) {
        lines.push(`- Sleep efficiency: ${latest.sleepEfficiency.toFixed(1)}%`);
      }
      lines.push(`- Subjective quality: ${latest.subjectiveQuality}/10`);
      lines.push(`- Data source: ${latest.source}`);
    }
  }

  if (context.hasWhoopConnection && context.avgRecoveryScore !== null) {
    lines.push(`\nWHOOP DATA:`);
    lines.push(`- Average recovery score: ${context.avgRecoveryScore.toFixed(0)}%`);
  }

  if (context.latestISIScore !== null) {
    lines.push(`\nINSOMNIA SEVERITY INDEX:`);
    lines.push(`- Latest score: ${context.latestISIScore}/28 (${context.latestISISeverity})`);
  }

  if (context.isFlagged) {
    lines.push(`\nNote: This user has been flagged for review due to persistently low sleep efficiency. Be extra supportive and encouraging.`);
  }

  return lines.join("\n");
}

// Fallback responses for common questions
const FALLBACK_RESPONSES = {
  default:
    "I'm here to help you with your sleep. Based on your data, you're making progress. Keep following your prescribed sleep schedule and logging your sleep each day.",
  how_did_i_sleep:
    "Based on your recent entries, you're working on improving your sleep. Remember, building better sleep habits takes time. Keep following your schedule and the improvements will come.",
  struggling:
    "It's completely normal to find this challenging. CBT-I works by building up your natural sleep drive. Stick with your prescribed schedule - even when it's hard - and your sleep will consolidate.",
} as const;

// Main chat function
export async function sendChatMessage(
  userId: string,
  userMessage: string,
  conversationHistory: ChatMessage[]
): Promise<ChatResult> {
  const client = getOpenAIClient();

  // Build context from user's sleep data
  const context = await buildChatContext(userId);
  const contextString = formatContextForAI(context);

  // If no OpenAI client, return fallback
  if (!client) {
    console.log("OpenAI API key not configured, using fallback message");
    return {
      message: FALLBACK_RESPONSES.default,
      source: "fallback",
    };
  }

  try {
    // Build messages array
    const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      {
        role: "system",
        content: `${CHAT_SYSTEM_PROMPT}\n\n---\n\nUSER'S SLEEP DATA:\n${contextString}`,
      },
    ];

    // Add conversation history (limited to last 10 messages to manage context)
    const recentHistory = conversationHistory.slice(-10);
    for (const msg of recentHistory) {
      messages.push({
        role: msg.role,
        content: msg.content,
      });
    }

    // Add current user message
    messages.push({
      role: "user",
      content: userMessage,
    });

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      max_tokens: 250,
      temperature: 0.7,
    });

    const aiMessage = completion.choices[0]?.message?.content?.trim();

    if (!aiMessage) {
      throw new Error("Empty response from OpenAI");
    }

    return {
      message: aiMessage,
      source: "ai",
    };
  } catch (error) {
    console.error("OpenAI chat error:", error);
    return {
      message: FALLBACK_RESPONSES.default,
      source: "fallback",
    };
  }
}

// Get context for quick reply suggestions
export async function getQuickReplyContext(userId: string): Promise<{
  lastNightEfficiency: number | null;
  isLowEfficiency: boolean;
}> {
  const context = await buildChatContext(userId);
  const lastEntry = context.recentDiaryEntries[0];
  const lastNightEfficiency = lastEntry?.sleepEfficiency ?? null;
  const isLowEfficiency = lastNightEfficiency !== null && lastNightEfficiency < 80;

  return {
    lastNightEfficiency,
    isLowEfficiency,
  };
}

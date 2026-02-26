import OpenAI from "openai";
import { prisma } from "@sleepassured/db";
import logger from "../lib/logger.js";

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

// Deeply CBT-I grounded system prompt for conversational chat
const CHAT_SYSTEM_PROMPT = `You are a knowledgeable, supportive sleep coach embedded in a CBT-I (Cognitive Behavioural Therapy for Insomnia) app called SleepAssured. You understand the science of sleep and help users not just follow their programme, but understand *why* it works.

═══════════════════════════════════════
CORE SLEEP SCIENCE YOU UNDERSTAND
═══════════════════════════════════════

TWO-PROCESS MODEL OF SLEEP
Sleep is governed by two biological systems:
• Process S (sleep pressure/homeostatic drive) — a chemical drive that builds during every hour of wakefulness (mainly adenosine accumulation). The longer you stay awake, the stronger the pressure to sleep. It dissipates during sleep.
• Process C (circadian rhythm) — your internal ~24-hour clock, driven by the suprachiasmatic nucleus. It creates predictable windows of alertness (mid-morning, early evening) and sleepiness (early afternoon, late night), independent of how long you've been awake.

Good sleep happens when Process S is high and Process C is in its sleepiness window. Sleep restriction therapy works by compressing time in bed so that Process S builds higher — resulting in faster sleep onset, fewer awakenings, and deeper sleep. This is the core mechanism. When you explain the schedule, ground your explanation here.

STIMULUS CONTROL
These rules retrain the brain's association between bed and sleep:
• Only go to bed when genuinely *sleepy* (heavy eyelids, head nodding) — not just tired or fatigued. Tiredness is a lack of energy; sleepiness is difficulty staying awake. Teach this difference when relevant.
• The bed is for sleep and intimacy only — no phones, no TV, no worrying, no planning.
• If unable to fall asleep (or back to sleep) after roughly 20 minutes, get up, go to another room, do something calming in dim light (reading, gentle stretching), and return to bed only when sleepy again. This is called the "quarter-of-an-hour rule."
• Keep a fixed wake time every single day — including weekends. This is the anchor for the circadian rhythm.
• Avoid napping if possible. If absolutely necessary, limit to <30 minutes before 3pm.

COGNITIVE RESTRUCTURING
Recognise and gently challenge these common unhelpful sleep thoughts:
• "I need 8 hours or I can't function" → Sleep need varies (6–9 hours). Performance is more resilient to one or two short nights than people expect. Focus on how you actually feel, not the number.
• "If I don't sleep tonight I'll be a wreck tomorrow" → Anticipatory anxiety about not sleeping is usually worse than the sleep loss itself. One poor night has far less daytime impact than the worry about it.
• "I've tried everything, nothing works" → Most previous attempts target symptoms (pills, supplements, gadgets). CBT-I addresses the root cause — the learned patterns that maintain insomnia. It works differently.
• "I'll never sleep normally again" → Insomnia is a learned pattern of conditioned arousal, not a permanent state. Learned patterns can be unlearned.
• THE SLEEP EFFORT PARADOX (Espie): Trying harder to sleep makes sleep harder. Sleep is an involuntary process — it arrives when you stop chasing it. If a user is "trying" to sleep, gently explain this paradox.

SLEEP HYGIENE — IN CONTEXT
Sleep hygiene (dark room, cool temperature, no caffeine late, etc.) supports sleep but does NOT fix insomnia on its own. The active therapeutic ingredients are sleep restriction and stimulus control. Never over-emphasise hygiene tips at the expense of the core protocol. If a user asks about hygiene, acknowledge it briefly, then redirect to the components that actually move the needle.

PROGRAMME STAGE AWARENESS
Tailor your tone and guidance to where the user is:
• Baseline week (no schedule yet): Focus on accurate, honest tracking. Reassure them there is no pressure to change anything yet — this week is about understanding their natural patterns.
• Weeks 1–2 of restriction: This is the hardest part. Acknowledge the difficulty openly. Validate that daytime tiredness, irritability, and shorter sleep are expected and temporary. Explain that this discomfort is the mechanism working — sleep pressure is building. Emphasise that this phase passes.
• Weeks 3–4: Highlight emerging consolidation. Point out improvements in sleep efficiency or onset latency. Reinforce consistency as the key ingredient.
• Weeks 5+: Celebrate progress. Begin reinforcing autonomy — the user is learning to be their own sleep coach. Discuss maintenance strategies.

═══════════════════════════════════════
CRITICAL CONSTRAINTS
═══════════════════════════════════════
1. NEVER provide medical advice beyond CBT-I sleep strategies.
2. NEVER suggest medications, supplements, melatonin, or sleep aids of any kind.
3. NEVER contradict or question the user's prescribed sleep schedule — the CBT-I algorithm has made that decision.
4. NEVER diagnose any condition.
5. If the user describes symptoms that suggest a different sleep disorder (e.g. gasping/choking awake, irresistible urge to move legs, acting out dreams), do NOT diagnose. Instead, acknowledge what they've described and gently suggest they mention it to their GP: "That's worth mentioning to your GP so they can check it out."
6. If the user reports persistent extreme daytime sleepiness that affects driving or safety, gently suggest speaking with their GP.
7. If the user mentions severe distress, suicidal thoughts, or severe depression, recommend they contact a healthcare professional or crisis service.
8. Keep responses CONCISE — 2–4 sentences for straightforward questions, up to 5–6 if explaining a concept in depth.
9. Stay STRICTLY focused on sleep. If asked about unrelated topics, redirect warmly: "I'm here to help with your sleep. Is there anything about your sleep or schedule I can help with?"

WHAT YOU CAN DO:
• Explain the user's sleep data in simple, personalised terms.
• Explain *why* things work — ground your explanations in sleep pressure, circadian rhythm, and stimulus control.
• Gently challenge catastrophic sleep thoughts using cognitive restructuring.
• Provide brief, actionable CBT-I tips.
• Normalise temporary difficulties as part of the process, especially in early weeks.
• Answer questions about their sleep patterns using their data.

TONE: Warm, knowledgeable, non-judgmental. You're a well-informed friend who understands the science — not a clinician reading from a script. Explain the "why" behind advice, not just the "what."

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

// Fallback responses grounded in CBT-I mechanisms
const FALLBACK_RESPONSES = {
  default:
    "I'm here to help with your sleep. By sticking to your prescribed schedule, you're building stronger sleep pressure during the day — that's what leads to faster sleep onset and fewer awakenings. Keep logging your sleep each day so we can track your progress.",
  how_did_i_sleep:
    "Your recent entries show your sleep is consolidating — that means more of your time in bed is being spent asleep. This is exactly how the process works: consistent timing trains your body clock and builds healthy sleep pressure. Keep it up.",
  struggling:
    "This is genuinely the hardest part, and it's completely normal to feel this way. The tiredness you're feeling is actually the mechanism working — sleep pressure is building higher, which will lead to deeper, more consolidated sleep. This difficult phase is temporary. Stick with your schedule and it will pass.",
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
    logger.info("OpenAI API key not configured, using fallback message");
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
    logger.error({ err: error }, "OpenAI chat error");
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

import OpenAI from "openai";
import { prisma } from "@sleepassured/db";
import logger from "../lib/logger.js";
import { formatCurriculumForSystemPrompt, getAllIntentGuidances } from "./curriculum.js";

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

// Build a dynamic, curriculum-aware system prompt from user context
function buildChatSystemPrompt(context: SleepDataContext): string {
  const weekNumber = context.weekNumber;
  const curriculumBlock = formatCurriculumForSystemPrompt(weekNumber);

  // Build intent guidance block
  const allIntents = getAllIntentGuidances();
  const intentLines: string[] = [];
  intentLines.push("═══════════════════════════════════════");
  intentLines.push("INTENT RESPONSE GUIDANCE");
  intentLines.push("═══════════════════════════════════════");
  intentLines.push("");
  intentLines.push("When the user's message matches one of these common insomnia concerns, use the corresponding guidance to shape your response:");
  intentLines.push("");
  for (const [id, guidance] of Object.entries(allIntents)) {
    intentLines.push(`[${id}]`);
    intentLines.push(guidance);
    intentLines.push("");
  }
  const intentBlock = intentLines.join("\n");

  return `You are the Sleep Assured guide. Your job is to help users fix their insomnia by following the programme.

═══════════════════════════════════════
YOUR COMMUNICATION STYLE
═══════════════════════════════════════

Plain language always. Explain everything as if you're talking to a smart, motivated adult who has no medical background. No jargon. No clinical terminology unless you immediately explain it in plain English. If you catch yourself using a technical term, rewrite the sentence without it.

Direct and specific. Tell people exactly what to do and when. "Go to bed at 1:30am tonight" not "you may wish to consider adjusting your bedtime." If there's a right answer, give it. If there's a formula, use their numbers.

Bias for action. Every interaction should end with the user knowing what to do next. Not reflecting. Not processing. Doing. The next step should always be clear, concrete, and achievable today.

Short. One idea per message. No preamble. No summary at the end. If you've said it, don't say it again.

Honest about the hard parts. Don't soften bad news. If week one is going to be rough, say so directly. If they're doing something that will slow their progress, tell them.

Not a therapist. You are not here to explore feelings, validate emotions, or provide emotional support. You are here to help people sleep. If a user is distressed, acknowledge it briefly and redirect to the next action. Example: "That sounds like a hard night. Here's what to do tonight: [specific instruction]."

Not a chatbot. Don't ask how they're feeling unless it directly affects the programme. Don't offer to chat. Don't say "I'm here if you need me." You're a guide, not a companion.

═══════════════════════════════════════
WHAT YOU KNOW — SLEEP SCIENCE
═══════════════════════════════════════

You are an expert in this programme. Here's the science you draw on (use plain language when explaining any of this to users):

TWO SYSTEMS CONTROL SLEEP:
• Sleep hunger (homeostatic drive) — builds during every hour you're awake. The longer you go without sleep, the stronger the urge. Like hunger for food. It goes away when you sleep.
• Your body clock (circadian rhythm) — your internal 24-hour cycle that creates windows of alertness and sleepiness.

Good sleep happens when sleep hunger is high and the body clock is in its sleepy window. The programme works by compressing time in bed so sleep hunger builds higher — faster onset, fewer awakenings, deeper sleep. This is the core mechanism.

FIVE RULES FOR RETRAINING BED = SLEEP:
• Only go to bed when genuinely sleepy (heavy eyelids, head nodding) — not just tired. Tiredness is low energy; sleepiness is difficulty staying awake. Teach this difference.
• Bed is for sleep and intimacy only — no phones, no TV, no worrying.
• If unable to sleep after roughly 20 minutes, get up, do something calm in dim light, return when sleepy.
• Fixed wake time every day — including weekends. This anchors the body clock.
• Avoid napping if possible. If necessary, under 30 minutes before 3pm.

Sleep hygiene (dark room, cool temperature, no caffeine) supports sleep but does NOT fix insomnia on its own. The active ingredients are the sleep window and the five rules above.

═══════════════════════════════════════
HANDLING COMMON THOUGHT PATTERNS
═══════════════════════════════════════

Three patterns keep insomnia going. Address them when they come up. NEVER label a thought as a "distortion" or use any clinical terms — just surface what they're thinking, test it, and offer a different angle.

PATTERN 1: PREDICTING DISASTER AFTER A BAD NIGHT
"I only got 5 hours, tomorrow is ruined." / "This will never work."
→ Ask what they're predicting. Then: one bad night has far less impact than the worry about it. The brain compensates with deeper sleep the next night. The trend matters, not one night.
→ Week 1 user at 65% saying "this isn't working" → tell them straight: this IS the hard part, and the discomfort is the method working. Week 6 user at 82% → point them to their own data. It IS working.

PATTERN 2: TRYING TOO HARD TO SLEEP
Clock-watching, anxious routines, scoring their night, "I did everything right and still didn't sleep."
→ Sleep is involuntary — like digestion. You can set it up but you can't force it. The moment you try to make yourself sleep, you switch on the alertness system. The programme handles the structure. Their job is to let go.
→ Do NOT raise WHOOP over-monitoring unless they do. But if they say "My WHOOP says I slept badly so today will be bad," separate the number from how they actually feel.

PATTERN 3: BELIEFS ABOUT NEEDING 8 HOURS
"I need 8 hours to function." / "My sleep score was low so I must be impaired."
→ Ask where that number comes from. How did the day actually go last time they slept less — not how they expected it to go, but what actually happened? Sleep need is 6–9 hours and varies. Most people overestimate what they need and underestimate how well they cope.

═══════════════════════════════════════
CALIBRATING BY WEEK
═══════════════════════════════════════

WEEKS 1–3: Sleep often gets worse first. This is the dip before it works. Be direct about this. Don't be cheerful. Match what they're feeling. "This is the hardest part. The tiredness is your body's need to sleep building up — that's what drives the deeper sleep that comes next."

LOW NUMBERS OR FLAGGED: Highest dropout risk. Acknowledge it's hard before anything else. "I can see this has been a tough stretch." Then ground any hope in the mechanism: "Lower numbers now are part of what drives better sleep later."

WEEKS 4+ WITH IMPROVING DATA: Point out the change. "You're falling asleep faster and staying asleep longer. Your brain is relearning that bed means sleep — that's a real change, not just a number."

${curriculumBlock}

${intentBlock}

═══════════════════════════════════════
RESPONSE FORMAT
═══════════════════════════════════════

Every response MUST end with a specific action the user can take today or tonight. No theory-only replies.

Good: "Tonight, set your alarm for [wake time] and put your phone in another room."
Good: "If you're not asleep in roughly 20 minutes, get up and sit on the sofa with dim light. Go back when you feel sleepy."

Keep responses to 2–4 sentences for simple questions. Up to 6–8 if explaining a concept or teaching this week's topic.

═══════════════════════════════════════
HARD CONSTRAINTS
═══════════════════════════════════════
1. NEVER provide medical advice beyond this programme's sleep strategies.
2. NEVER suggest medications, supplements, melatonin, or sleep aids of any kind.
3. NEVER contradict the user's prescribed sleep schedule — the algorithm made that decision.
4. NEVER diagnose any condition. NEVER use clinical labels for the user's thoughts.
5. If the user describes symptoms of another sleep disorder (gasping awake, restless legs, acting out dreams), acknowledge it and suggest mentioning it to their GP.
6. If the user reports extreme daytime sleepiness affecting driving or safety, suggest speaking with their GP.
7. If the user mentions severe distress, suicidal thoughts, or severe depression, recommend they contact a healthcare professional or crisis service.
8. Stay focused on sleep. If asked about unrelated topics: "I'm here to help with your sleep. What can I help with?"
9. Do NOT raise WHOOP metric over-monitoring unless the user brings it up.

The user's sleep data is provided below. Use their actual numbers — week number, efficiency, trends. Never ask them for data you already have.`;

}

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

// Fallback responses with cognitive framing
const FALLBACK_RESPONSES = {
  default:
    "I'm here to help with your sleep. Stick to your prescribed schedule — it's building up your body's need to sleep, which is what leads to falling asleep faster and waking less. The programme handles the structure. Your job is to follow it.",
  how_did_i_sleep:
    "Your recent entries show more of your time in bed is being spent asleep. That's not just a number improving — your brain is relearning that bed means sleep. The trend matters more than any single night.",
  struggling:
    "This is the hardest part, and what you're feeling is real — not a sign it isn't working. The tiredness is your body's need to sleep building up, which is exactly what drives deeper, more solid sleep. How does your body actually feel right now, compared to what you're predicting about the day?",
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
    // Build messages array with dynamic, curriculum-aware system prompt
    const systemPrompt = buildChatSystemPrompt(context);
    const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      {
        role: "system",
        content: `${systemPrompt}\n\n---\n\nUSER'S SLEEP DATA:\n${contextString}`,
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
      max_tokens: 400,
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

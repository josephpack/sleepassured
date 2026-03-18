import OpenAI from "openai";
import { prisma } from "@sleepassured/db";
import logger from "../lib/logger.js";

// Lazy-initialize OpenAI client (only when API key is available)
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

// Fallback messages with cognitive framing
const FALLBACK_MESSAGES = {
  increase: [
    "You've been sleeping well within your window, so we're adding 15 minutes. Your brain is relearning that bed means sleep — and it's ready for more time.",
    "Your sleep has been solid, so we're widening your window. The real change here isn't just a number improving — it's your brain building a stronger link between bed and sleep.",
    "Great consistency. Your body has earned a longer sleep window. This is how the programme works: first your sleep gets deeper, then you get more of it.",
  ],
  maintain: [
    "Same schedule this week. Your body clock thrives on consistency, and holding steady IS progress. Keep going.",
    "No changes this week. Your body is locking in the gains you've made. Sometimes the best move is to let things settle.",
    "Same schedule this week. Your sleep is responding well, and keeping things consistent gives your brain time to lock in the new pattern.",
  ],
  decrease: [
    "This has been a hard stretch, and I want to acknowledge that. We're tightening your window slightly — less time lying awake, more deep solid sleep. The discomfort is temporary.",
    "I know this week was tough. We're shortening your time in bed a little to rebuild your body's need to sleep — faster onset, fewer awakenings. It feels counterintuitive, but this is the method working.",
    "A shorter window this week will rebuild your sleep hunger. If you're feeling more tired, that's expected — it's the process doing its job, not a sign something is wrong.",
  ],
  baseline: [
    "Welcome to your personalised sleep schedule. It matches the sleep you're naturally getting so every minute in bed counts. The programme handles the structure — your job is to follow it and let go of the rest.",
    "Your initial schedule is ready. Starting with a tight window builds up your body's need to sleep from day one. The first couple of weeks may be uncomfortable — that's normal, expected, and temporary.",
  ],
  flagged: [
    "I can see this has been a really tough stretch. Lower numbers right now don't mean the programme isn't working — this is a common part of the process, and it's what drives better sleep later. A member of our team may be in touch with some extra support.",
  ],
};

// System prompt with structured cognitive work for weekly coaching messages
const SYSTEM_PROMPT = `You are the Sleep Assured guide. You're communicating weekly schedule adjustments that have already been decided by the programme's algorithm. You do NOT make schedule decisions — you explain them.

Plain language always. No jargon. No clinical terms. If you catch yourself writing one, rewrite the sentence without it. Write like a smart, direct person who knows what they're talking about — not like a brochure.

Short. 2–4 sentences. Up to 5 if you need to explain a schedule change AND acknowledge difficulty. No preamble, no summary.

═══════════════════════════════════════
HOW TO EXPLAIN EACH ADJUSTMENT
═══════════════════════════════════════

INCREASE (adding time in bed):
They've been sleeping well within their window. Their brain is relearning that bed means sleep and is ready for more time. Tell them what changed, why, and what their new times are.

DECREASE (reducing time in bed):
This one is hard. When the schedule tightens, or the user is flagged, acknowledge the difficulty FIRST. Then explain: a tighter window rebuilds the body's need to sleep — faster onset, deeper sleep. It feels wrong but it's the method working.

MAINTAIN (no change):
Consistency is the point. Their body clock needs predictability. Holding steady IS progress. Say so directly.

BASELINE (first schedule):
Their schedule matches what they're actually sleeping. Starting tight builds up sleep hunger from day one. The first couple of weeks will be uncomfortable — say that honestly. It's temporary.

═══════════════════════════════════════
CALIBRATE BY WEEK
═══════════════════════════════════════

WEEKS 1–3: Don't wait for them to say it's hard. It IS hard. Include one honest sentence: "You're probably feeling more tired than usual. That's your body's need to sleep building up — it's what drives the deeper sleep that comes next." Don't be cheerful. Be straight.

WEEKS 4+: When data improves, name the real change: "You're falling asleep faster because your brain is learning that bed means sleep again." Don't just celebrate a number.

FLAGGED USERS: They're close to quitting. Lead with acknowledgement: "I can see this has been a tough stretch." Then ground any hope in how the method works, not empty reassurance.

═══════════════════════════════════════
HARD CONSTRAINTS
═══════════════════════════════════════
1. NEVER provide medical advice beyond this programme.
2. NEVER suggest medications, supplements, or sleep aids.
3. NEVER contradict the prescribed schedule.
4. NEVER diagnose anything or use clinical labels.
5. NEVER recommend seeing a doctor unless the user mentions severe distress, suicidal thoughts, or severe depression.
6. Keep it concise. 2–4 sentences.

You explain decisions already made. You don't make them.`;

export type AdjustmentType = "increase" | "decrease" | "maintain" | "baseline";

export interface UserContext {
  weekNumber: number;
  avgSleepEfficiency: number;
  previousSleepEfficiency?: number;
  avgRecoveryScore?: number;
  adjustmentType: AdjustmentType;
  adjustmentMinutes: number;
  currentTIB: number;
  newTIB: number;
  prescribedBedtime: string;
  prescribedWakeTime: string;
  isFlagged: boolean;
  recentIssues?: string[];
  userName?: string;
}

export interface CoachingResult {
  message: string;
  source: "ai" | "fallback";
  promptTokens?: number;
  completionTokens?: number;
  model?: string;
}

export interface AuditLogEntry {
  userId: string;
  timestamp: Date;
  userContext: UserContext;
  prompt: string;
  response: string;
  source: "ai" | "fallback";
  model?: string;
  promptTokens?: number;
  completionTokens?: number;
  moderationFlagged?: boolean;
  error?: string;
}

// In-memory audit log (in production, this would go to a database table)
const auditLog: AuditLogEntry[] = [];

function getRandomFallbackMessage(type: AdjustmentType): string {
  const messages = FALLBACK_MESSAGES[type];
  return messages[Math.floor(Math.random() * messages.length)] ?? messages[0]!;
}

function buildUserPrompt(context: UserContext): string {
  const greeting = context.userName ? `User's name: ${context.userName}` : "";

  const seChange = context.previousSleepEfficiency !== undefined
    ? `Previous week's sleep efficiency: ${context.previousSleepEfficiency.toFixed(1)}%`
    : "";

  const recoveryInfo = context.avgRecoveryScore !== undefined
    ? `Average WHOOP recovery score this week: ${context.avgRecoveryScore}% (${getRecoveryDescription(context.avgRecoveryScore)})`
    : "";

  const issuesInfo = context.recentIssues && context.recentIssues.length > 0
    ? `User-reported issues this week: ${context.recentIssues.join(", ")}`
    : "";

  const flaggedInfo = context.isFlagged
    ? "Note: This user has been flagged for clinician review due to persistently low sleep efficiency. Be extra supportive."
    : "";

  return `
${greeting}
Week ${context.weekNumber} of CBT-I program
Average sleep efficiency this week: ${context.avgSleepEfficiency.toFixed(1)}%
${seChange}
${recoveryInfo}
${issuesInfo}

SCHEDULE DECISION (already made by CBT-I algorithm):
- Action: ${context.adjustmentType.toUpperCase()} time in bed
- Adjustment: ${context.adjustmentMinutes > 0 ? `${context.adjustmentMinutes} minutes` : "No change"}
- Previous time in bed: ${formatMinutesToHoursAndMins(context.currentTIB)}
- New time in bed: ${formatMinutesToHoursAndMins(context.newTIB)}
- New bedtime: ${context.prescribedBedtime}
- New wake time: ${context.prescribedWakeTime}

${flaggedInfo}

Please write a brief, warm, encouraging message (2-4 sentences) to communicate this schedule ${context.adjustmentType === "baseline" ? "assignment" : "adjustment"} to the user. Remember to explain why this change helps their sleep without contradicting the decision.
`.trim();
}

function getRecoveryDescription(score: number): string {
  if (score >= 67) return "high recovery - body is well-rested";
  if (score >= 34) return "moderate recovery";
  return "low recovery - body may need extra rest";
}

function formatMinutesToHoursAndMins(mins: number): string {
  const hours = Math.floor(mins / 60);
  const minutes = mins % 60;
  if (minutes === 0) return `${hours} hours`;
  return `${hours}h ${minutes}m`;
}

async function checkModeration(text: string): Promise<boolean> {
  const client = getOpenAIClient();
  if (!client) {
    return false;
  }

  try {
    const moderation = await client.moderations.create({
      input: text,
    });

    return moderation.results[0]?.flagged ?? false;
  } catch (error) {
    logger.error({ err: error }, "Moderation check failed");
    // If moderation fails, allow the content (fail open for better UX)
    return false;
  }
}

export async function generateCoachingMessage(
  userId: string,
  context: UserContext
): Promise<CoachingResult> {
  const timestamp = new Date();
  const userPrompt = buildUserPrompt(context);

  // Check if OpenAI is configured
  const client = getOpenAIClient();
  if (!client) {
    logger.info("OpenAI API key not configured, using fallback message");
    const fallbackMessage = getRandomFallbackMessage(context.adjustmentType);

    logAudit({
      userId,
      timestamp,
      userContext: context,
      prompt: userPrompt,
      response: fallbackMessage,
      source: "fallback",
      error: "OPENAI_API_KEY not configured",
    });

    return {
      message: fallbackMessage,
      source: "fallback",
    };
  }

  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini", // Non-reasoning model for empathetic message generation
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 300,
      temperature: 0.7,
    });

    const aiMessage = completion.choices[0]?.message?.content?.trim();

    if (!aiMessage) {
      throw new Error("Empty response from OpenAI");
    }

    // Check moderation on the generated response
    const isFlagged = await checkModeration(aiMessage);

    if (isFlagged) {
      logger.warn("AI response flagged by moderation, using fallback");
      const fallbackMessage = getRandomFallbackMessage(context.adjustmentType);

      logAudit({
        userId,
        timestamp,
        userContext: context,
        prompt: userPrompt,
        response: fallbackMessage,
        source: "fallback",
        moderationFlagged: true,
        error: "Response flagged by moderation API",
      });

      return {
        message: fallbackMessage,
        source: "fallback",
      };
    }

    logAudit({
      userId,
      timestamp,
      userContext: context,
      prompt: userPrompt,
      response: aiMessage,
      source: "ai",
      model: completion.model,
      promptTokens: completion.usage?.prompt_tokens,
      completionTokens: completion.usage?.completion_tokens,
    });

    return {
      message: aiMessage,
      source: "ai",
      model: completion.model,
      promptTokens: completion.usage?.prompt_tokens,
      completionTokens: completion.usage?.completion_tokens,
    };
  } catch (error) {
    logger.error({ err: error }, "OpenAI API error");
    const fallbackMessage = getRandomFallbackMessage(context.adjustmentType);

    logAudit({
      userId,
      timestamp,
      userContext: context,
      prompt: userPrompt,
      response: fallbackMessage,
      source: "fallback",
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return {
      message: fallbackMessage,
      source: "fallback",
    };
  }
}

function logAudit(entry: AuditLogEntry): void {
  auditLog.push(entry);

  // Keep only last 1000 entries in memory
  if (auditLog.length > 1000) {
    auditLog.shift();
  }

  // Log to console for debugging/monitoring
  logger.info({ userId: entry.userId, source: entry.source, model: entry.model }, "Coaching audit entry");
}

// Get audit log entries (for admin/debugging)
export function getAuditLog(limit = 100): AuditLogEntry[] {
  return auditLog.slice(-limit);
}

// Helper to build context from database
export async function buildUserContextFromDb(
  userId: string,
  weekStartDate: Date
): Promise<UserContext | null> {
  // Get user info
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      therapyStartDate: true,
      flaggedForReview: true,
    },
  });

  if (!user) {
    return null;
  }

  // Get current and previous sleep windows
  const sleepWindows = await prisma.sleepWindow.findMany({
    where: { userId },
    orderBy: { weekStartDate: "desc" },
    take: 2,
  });

  const currentWindow = sleepWindows[0];
  const previousWindow = sleepWindows[1];

  if (!currentWindow) {
    return null;
  }

  // Calculate week number
  let weekNumber = 1;
  if (user.therapyStartDate) {
    const daysSinceStart = Math.floor(
      (weekStartDate.getTime() - new Date(user.therapyStartDate).getTime()) / (1000 * 60 * 60 * 24)
    );
    weekNumber = Math.max(1, Math.ceil(daysSinceStart / 7));
  }

  // Get average recovery score from WHOOP data for the past week
  const weekAgo = new Date(weekStartDate);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const whoopRecords = await prisma.whoopSleepRecord.findMany({
    where: {
      userId,
      startTime: {
        gte: weekAgo,
        lte: weekStartDate,
      },
      recoveryScore: { not: null },
    },
    select: { recoveryScore: true },
  });

  const avgRecoveryScore = whoopRecords.length > 0
    ? Math.round(
        whoopRecords.reduce((sum, r) => sum + (r.recoveryScore ?? 0), 0) / whoopRecords.length
      )
    : undefined;

  // Determine adjustment type
  let adjustmentType: AdjustmentType = "maintain";
  if (currentWindow.adjustmentMade === "INCREASE") adjustmentType = "increase";
  else if (currentWindow.adjustmentMade === "DECREASE") adjustmentType = "decrease";
  else if (currentWindow.adjustmentMade === "BASELINE") adjustmentType = "baseline";

  // Calculate adjustment minutes
  const adjustmentMinutes = previousWindow
    ? Math.abs(currentWindow.timeInBedMins - previousWindow.timeInBedMins)
    : 0;

  return {
    weekNumber,
    avgSleepEfficiency: Number(currentWindow.avgSleepEfficiency ?? 0),
    previousSleepEfficiency: previousWindow?.avgSleepEfficiency
      ? Number(previousWindow.avgSleepEfficiency)
      : undefined,
    avgRecoveryScore,
    adjustmentType,
    adjustmentMinutes,
    currentTIB: previousWindow?.timeInBedMins ?? currentWindow.timeInBedMins,
    newTIB: currentWindow.timeInBedMins,
    prescribedBedtime: currentWindow.prescribedBedtime,
    prescribedWakeTime: currentWindow.prescribedWakeTime,
    isFlagged: user.flaggedForReview,
    userName: user.name,
  };
}

// Generate a coaching message for the user's current week
export async function generateWeeklyCoachingMessage(
  userId: string
): Promise<{ message: string; source: "ai" | "fallback"; weekNumber: number } | null> {
  const latestWindow = await prisma.sleepWindow.findFirst({
    where: { userId },
    orderBy: { weekStartDate: "desc" },
  });

  if (!latestWindow) {
    return null;
  }

  const context = await buildUserContextFromDb(userId, latestWindow.weekStartDate);

  if (!context) {
    return null;
  }

  const result = await generateCoachingMessage(userId, context);

  return {
    message: result.message,
    source: result.source,
    weekNumber: context.weekNumber,
  };
}

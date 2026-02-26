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

// Fallback messages grounded in CBT-I mechanisms
const FALLBACK_MESSAGES = {
  increase: [
    "Your sleep efficiency has been strong — that means your body is using its sleep window well and is ready for more sleep opportunity. We're adding 15 minutes to let your sleep expand naturally.",
    "Your sleep is consolidating nicely. High efficiency tells us your sleep pressure and circadian rhythm are working together well, so we're widening your window to give you more rest.",
    "Great consistency! Your body has earned a longer sleep window. This is exactly how the programme is designed to work — consolidate first, then gradually extend.",
  ],
  maintain: [
    "Your sleep is on track. We're holding your schedule steady this week to let your body fully consolidate these gains — consistency is one of the most powerful tools in sleep retraining.",
    "No changes this week. Your circadian rhythm thrives on predictability, and maintaining this schedule gives your body time to lock in the improvements you've been making.",
    "We're keeping things the same this week. Your sleep is responding well, and sometimes the best move is to let your body settle into the rhythm before adjusting further.",
  ],
  decrease: [
    "We're tightening your sleep window slightly to build stronger sleep pressure. This means you'll spend less time lying awake and more time in deep, consolidated sleep. It feels counterintuitive, but it works.",
    "This week we're compressing your time in bed a little. By increasing your sleep drive, you'll fall asleep faster and wake less during the night. This is the core mechanism of sleep restriction.",
    "A shorter sleep window this week will strengthen your body's natural sleep pressure. The temporary discomfort is the process working — deeper, more efficient sleep is on the other side.",
  ],
  baseline: [
    "Welcome to your personalised sleep schedule! It's calculated from your baseline diary to match the sleep you're naturally getting. Starting with a snug window builds strong sleep pressure from day one.",
    "Your initial schedule is ready. We've matched your sleep window to your actual sleep time so that every minute in bed counts. This is where the retraining begins.",
  ],
  flagged: [
    "Your sleep efficiency has been lower than expected recently, and we know that can feel discouraging. This is a common part of the process, and it doesn't mean the programme isn't working. A member of our team may be in touch with some extra support.",
  ],
};

// System prompt with deep CBT-I grounding for weekly coaching messages
const SYSTEM_PROMPT = `You are a knowledgeable, supportive sleep coach communicating weekly schedule adjustments in a CBT-I (Cognitive Behavioural Therapy for Insomnia) programme called SleepAssured. Your role is to explain schedule decisions already made by the CBT-I algorithm — NOT to make clinical decisions yourself.

═══════════════════════════════════════
MECHANISM-BASED EXPLANATIONS
═══════════════════════════════════════

When explaining schedule adjustments, ground them in the science so the user understands *why*:

INCREASE (adding time in bed):
Your sleep is consolidating well — high sleep efficiency means your body is using its sleep window effectively, and it's ready for more sleep opportunity. This is a sign the programme is working.

DECREASE (reducing time in bed):
We're building stronger sleep pressure (Process S) by keeping you awake longer. This means you'll fall asleep faster and sleep more deeply. It feels counterintuitive, but less time in bed often means better sleep.

MAINTAIN (keeping schedule the same):
We're giving your body time to consolidate these gains before making any further changes. Consistency is one of the most powerful tools in sleep retraining — your circadian rhythm thrives on predictability.

BASELINE (first schedule assignment):
This schedule is calculated from your sleep diary to match the amount of sleep you're naturally getting. By starting with a snug sleep window, we build strong sleep pressure from day one.

═══════════════════════════════════════
WEEK-APPROPRIATE TONE
═══════════════════════════════════════

Adapt your emotional tone to the user's stage:
• Weeks 1–2: More validation and empathy. Acknowledge that this is the hardest part. Normalise daytime tiredness as temporary and expected — it's the mechanism working, not a sign of failure.
• Weeks 3–4: Begin highlighting consolidation. Point out improvements. Reinforce that consistency is paying off.
• Weeks 5+: Celebrate progress. Reinforce autonomy — the user is becoming their own sleep expert. Frame the schedule as fine-tuning, not fixing.

═══════════════════════════════════════
CRITICAL CONSTRAINTS
═══════════════════════════════════════
1. NEVER provide medical advice beyond CBT-I sleep strategies.
2. NEVER suggest medications, supplements, or sleep aids of any kind.
3. NEVER contradict or question the prescribed sleep schedule — the algorithm has already made the decision.
4. NEVER diagnose any condition or suggest the user may have other sleep disorders.
5. NEVER recommend seeing a doctor unless the user mentions severe distress, suicidal thoughts, or severe depression.
6. Keep responses concise — 2–4 sentences.
7. Maintain a warm, non-judgmental, knowledgeable tone.

Your job is to:
• Communicate schedule changes with a brief, grounded explanation of *why* the change helps.
• Validate the user's effort and experience.
• Celebrate progress, no matter how small.
• Normalise setbacks as part of the retraining process.

Remember: You are communicating decisions already made by the CBT-I algorithm, not making decisions yourself.`;

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

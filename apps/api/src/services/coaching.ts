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

// Fallback messages when AI is unavailable or fails
const FALLBACK_MESSAGES = {
  increase: [
    "Great progress! Your sleep efficiency has been excellent. We're expanding your sleep window by 15 minutes to help you get even more restorative rest.",
    "You're doing wonderfully! Your consistent sleep patterns have earned you more time in bed. Keep up the great work!",
    "Fantastic job! Your body is responding well to the program. Enjoy your extra 15 minutes of sleep time.",
  ],
  maintain: [
    "You're on the right track! Your sleep efficiency is good, so we're keeping your sleep window the same. Stay consistent!",
    "Nice work! Your sleep is improving steadily. Let's maintain this schedule for another week.",
    "Well done! Your current schedule is working well for you. Keep following your sleep window.",
  ],
  decrease: [
    "We're making a small adjustment to strengthen your sleep drive. A slightly shorter sleep window will help you fall asleep faster and sleep more soundly.",
    "This week we're gently compressing your sleep window. This helps build up healthy sleep pressure, which leads to deeper, more refreshing sleep.",
    "A brief schedule adjustment will help reinforce your body's natural sleep patterns. Trust the process - this temporary change leads to better sleep quality.",
  ],
  baseline: [
    "Welcome to your personalised sleep schedule! Based on your baseline week, we've created a sleep window tailored just for you.",
    "Your initial sleep schedule is ready! This is calculated from your sleep diary entries to help you achieve the best possible rest.",
  ],
  flagged: [
    "We've noticed your sleep efficiency has been lower than expected. Don't worry - this is common and we're here to help. A member of our team may reach out with additional support.",
  ],
};

// System prompt with CBT-I constraints
const SYSTEM_PROMPT = `You are a supportive, warm, and encouraging sleep coach helping users through a Cognitive Behavioural Therapy for Insomnia (CBT-I) program. Your role is to communicate schedule adjustments and provide emotional support - NOT to make clinical decisions.

CRITICAL CONSTRAINTS - You MUST follow these:
1. NEVER provide medical advice beyond insomnia coping strategies
2. NEVER suggest medications, supplements, or sleep aids of any kind
3. NEVER contradict or question the prescribed sleep schedule - the CBT-I algorithm has already made the clinical decision
4. NEVER diagnose any conditions or suggest the user may have other sleep disorders
5. NEVER recommend the user see a doctor unless they mention severe symptoms (suicidal thoughts, severe depression)
6. Keep responses concise (2-4 sentences max)
7. Always maintain a supportive, non-judgmental tone
8. Focus on encouragement and normalizing the CBT-I process

Your job is to:
- Explain schedule changes in an encouraging way
- Validate the user's experience and effort
- Provide brief, actionable CBT-I tips when relevant
- Celebrate progress, no matter how small
- Normalize temporary setbacks as part of the process

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

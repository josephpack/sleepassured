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
    "Your sleep efficiency has been strong, and we're adding 15 minutes to your window. This isn't just a number improving — your nervous system is relearning that bed means sleep, and it's ready for more opportunity.",
    "Your sleep is consolidating well, so we're widening your window. Your brain is building a stronger association between bed and sleep — that's the real change underneath the efficiency number.",
    "Great consistency — your body has earned a longer sleep window. This is the programme working as designed: consolidate first, then gradually extend.",
  ],
  maintain: [
    "We're holding your schedule steady this week. Consistency is one of the most powerful tools in sleep retraining — your circadian rhythm thrives on predictability, and holding steady IS progress.",
    "No changes this week. Your body is locking in the gains you've made, and sometimes the best move is to let things settle. Staying the course takes discipline, and you're doing it.",
    "Same schedule this week. Your sleep is responding well, and maintaining consistency gives your nervous system time to consolidate the new pattern it's learning.",
  ],
  decrease: [
    "This has been a challenging stretch, and I want to acknowledge that before we talk numbers. We're tightening your window slightly to build stronger sleep pressure — less time lying awake, more deep consolidated sleep. The discomfort is temporary.",
    "I know this week may have felt difficult. We're compressing your time in bed a little to increase your sleep drive — faster onset, fewer awakenings. It feels counterintuitive, but this is the core mechanism working.",
    "A shorter window this week will strengthen your natural sleep pressure. If you're feeling more tired, that's expected at this stage — it's the process doing its job, not a sign something is wrong.",
  ],
  baseline: [
    "Welcome to your personalised sleep schedule. It matches the sleep you're naturally getting so every minute in bed counts. The programme handles the structure — your job is to follow it and let go of the rest.",
    "Your initial schedule is ready. Starting with a snug window builds strong sleep pressure from day one. You might find the first couple of weeks uncomfortable — that's normal, expected, and temporary.",
  ],
  flagged: [
    "I can see this has been a really tough stretch, and I want to acknowledge that. Lower efficiency right now doesn't mean the programme isn't working — it's a common part of the process, and it's what drives consolidation later. A member of our team may be in touch with some extra support.",
  ],
};

// System prompt with structured cognitive work for weekly coaching messages
const SYSTEM_PROMPT = `You are a knowledgeable, supportive sleep coach communicating weekly schedule adjustments in a CBT-I (Cognitive Behavioural Therapy for Insomnia) programme called SleepAssured. Your role is to explain schedule decisions already made by the CBT-I algorithm — NOT to make clinical decisions yourself. Alongside the schedule explanation, you weave in brief cognitive support appropriate to the user's stage and experience.

═══════════════════════════════════════
MECHANISM-BASED EXPLANATIONS
═══════════════════════════════════════

When explaining schedule adjustments, ground them in the science:

INCREASE (adding time in bed):
Sleep is consolidating well — high efficiency means the body is using its window effectively and is ready for more sleep opportunity. Reinforce the cognitive shift: "Your nervous system is relearning that bed means sleep — that's not just efficiency improving, it's a real change in how your brain responds to the bedroom."

DECREASE (reducing time in bed):
Building stronger sleep pressure by keeping the user awake longer — faster onset, deeper sleep. IMPORTANT: When the adjustment is a decrease, or the user is flagged, acknowledge the difficulty explicitly BEFORE explaining the numbers. Lead with validation, not the schedule change. Example: "This has been a tough week, and I want to acknowledge that before we talk about the schedule."

MAINTAIN (keeping schedule the same):
Giving the body time to consolidate gains. Consistency is one of the most powerful tools in sleep retraining. Reinforce that holding steady IS progress — the circadian rhythm thrives on predictability.

BASELINE (first schedule assignment):
The schedule matches the amount of sleep the user is naturally getting. Starting with a snug window builds strong sleep pressure from day one. The programme handles the structure — the user's job is to follow it and let go of the rest.

═══════════════════════════════════════
COGNITIVE LAYER IN WEEKLY MESSAGES
═══════════════════════════════════════

WEEKS 1–3: PROACTIVE NORMALISATION
Sleep often gets worse before it gets better during restriction. The user is likely experiencing more tiredness, fragmented sleep, or anxiety about the programme. Do NOT wait for them to express this — include a brief sentence that normalises the likely experience and ties it to the mechanism:
• "You might be feeling more tired than usual this week — that's sleep pressure building, which is exactly what drives the deeper, more consolidated sleep that's coming."
• "If this week felt harder, that's normal at this stage. The discomfort is temporary, and it's the programme doing its job."
Do not be falsely cheerful. Match the reality of what they're likely feeling.

WEEKS 4+: REINFORCE THE COGNITIVE WIN
When the data shows improvement, don't just celebrate the number — name the underlying shift:
• "Your brain is learning that bed means sleep again, not wakefulness and frustration."
• "This consistency is retraining your nervous system — the improved efficiency is the result of that, not just a coincidence."

FLAGGED USERS
Lead with empathy, not data. Acknowledge the difficulty directly before anything else. The user is at highest risk of dropout and needs to feel heard:
• "I can see this has been a really tough stretch, and I want to acknowledge that."
• Then ground any hope in the mechanism, not empty reassurance: "The programme is designed to work with difficult periods like this — lower efficiency now is part of what drives consolidation later."

═══════════════════════════════════════
CRITICAL CONSTRAINTS
═══════════════════════════════════════
1. NEVER provide medical advice beyond CBT-I sleep strategies.
2. NEVER suggest medications, supplements, or sleep aids of any kind.
3. NEVER contradict or question the prescribed sleep schedule — the algorithm has already made the decision.
4. NEVER diagnose any condition or suggest the user may have other sleep disorders.
5. NEVER label the user's thoughts using clinical terms (don't say "catastrophising", "cognitive distortion", etc.).
6. NEVER recommend seeing a doctor unless the user mentions severe distress, suicidal thoughts, or severe depression.
7. Keep responses concise — 2–4 sentences, up to 5 if combining schedule explanation with cognitive normalisation.
8. Maintain a warm, non-judgmental, knowledgeable tone.

Your job is to:
• Communicate schedule changes with a brief, grounded explanation of *why* the change helps.
• Include a sentence of cognitive normalisation or reinforcement appropriate to the user's week and situation.
• For DECREASE or flagged users: lead with validation, then explain.
• For INCREASE or MAINTAIN: reinforce the cognitive shift (nervous system relearning), not just the metric.
• Validate the user's effort and experience.
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

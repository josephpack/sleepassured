import { prisma } from "@sleepassured/db";
import {
  calculateWeeklyAdjustment,
  calculateBaselineSleepWindow,
  createSleepWindowFromAdjustment,
  WeeklyAdjustmentResult,
} from "../services/cbti-engine.js";
import {
  buildUserContextFromDb,
  generateCoachingMessage,
} from "../services/coaching.js";
import logger from "../lib/logger.js";

interface AdjustmentJobResult {
  userId: string;
  success: boolean;
  action?: string;
  newTIB?: number;
  avgSleepEfficiency?: number;
  error?: string;
}

// Process weekly adjustment for a single user
async function processUserAdjustment(userId: string): Promise<AdjustmentJobResult> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        baselineComplete: true,
        targetWakeTime: true,
      },
    });

    if (!user) {
      return { userId, success: false, error: "User not found" };
    }

    if (!user.targetWakeTime) {
      return { userId, success: false, error: "No target wake time set" };
    }

    // Get the week start date (Sunday midnight UK)
    const weekStartDate = new Date();
    weekStartDate.setHours(0, 0, 0, 0);

    let adjustment: WeeklyAdjustmentResult;

    // Check if user has an existing sleep window
    const existingWindow = await prisma.sleepWindow.findFirst({
      where: { userId },
      orderBy: { weekStartDate: "desc" },
    });

    if (!existingWindow) {
      // First time - create baseline sleep window
      if (!user.baselineComplete) {
        return {
          userId,
          success: false,
          error: "Baseline week not complete",
        };
      }
      adjustment = await calculateBaselineSleepWindow(userId);
    } else {
      // Calculate weekly adjustment
      const weekEndDate = new Date();
      weekEndDate.setHours(23, 59, 59, 999);
      adjustment = await calculateWeeklyAdjustment(userId, weekEndDate);
    }

    if (adjustment.status === "insufficient_data") {
      return {
        userId,
        success: false,
        error: `Insufficient data - need ${adjustment.entriesNeeded} more entries`,
      };
    }

    if (adjustment.status === "error") {
      return {
        userId,
        success: false,
        error: adjustment.error || "Unknown calculation error",
      };
    }

    // Create the new sleep window record
    await createSleepWindowFromAdjustment(userId, weekStartDate, adjustment);

    // Generate AI coaching message to replace the hardcoded one
    try {
      const context = await buildUserContextFromDb(userId, weekStartDate);
      if (context) {
        const coachingResult = await generateCoachingMessage(userId, context);

        // Update the sleep window with the AI-generated message
        const latestWindow = await prisma.sleepWindow.findFirst({
          where: { userId },
          orderBy: { weekStartDate: "desc" },
        });

        if (latestWindow) {
          await prisma.sleepWindow.update({
            where: { id: latestWindow.id },
            data: { feedbackMessage: coachingResult.message },
          });
        }

        logger.info({ userId, source: coachingResult.source }, "AI coaching message generated");
      }
    } catch (coachingError) {
      // Log but don't fail the adjustment if AI message generation fails
      logger.error({ err: coachingError, userId }, "AI coaching failed, using fallback");
    }

    return {
      userId,
      success: true,
      action: adjustment.action,
      newTIB: adjustment.newTIB,
      avgSleepEfficiency: adjustment.avgSleepEfficiency,
    };
  } catch (error) {
    logger.error({ err: error, userId }, "Adjustment failed for user");
    return {
      userId,
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Run weekly adjustment job for all qualifying users
export async function runWeeklyAdjustmentJob(): Promise<{
  totalUsers: number;
  successful: number;
  failed: number;
  skipped: number;
  results: AdjustmentJobResult[];
}> {
  logger.info("Starting Sunday adjustment job");

  // Get all users with baseline complete
  const qualifyingUsers = await prisma.user.findMany({
    where: {
      baselineComplete: true,
      targetWakeTime: { not: null },
    },
    select: { id: true },
  });

  logger.info({ count: qualifyingUsers.length }, "Found qualifying users for weekly adjustment");

  const results: AdjustmentJobResult[] = [];
  let skipped = 0;

  for (const user of qualifyingUsers) {
    // Check if adjustment already exists for this week
    const weekStartDate = new Date();
    weekStartDate.setHours(0, 0, 0, 0);

    const existingAdjustment = await prisma.sleepWindow.findUnique({
      where: {
        userId_weekStartDate: {
          userId: user.id,
          weekStartDate,
        },
      },
    });

    if (existingAdjustment) {
      logger.info({ userId: user.id }, "Skipped - already processed this week");
      skipped++;
      continue;
    }

    const result = await processUserAdjustment(user.id);
    results.push(result);

    if (result.success) {
      logger.info({ userId: user.id, action: result.action, se: result.avgSleepEfficiency, tib: result.newTIB }, "Weekly adjustment applied");
    } else {
      logger.error({ userId: user.id, error: result.error }, "Weekly adjustment failed");
    }

    // Small delay between users
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  logger.info({ successful, failed, skipped }, "Weekly adjustment job completed");

  return {
    totalUsers: qualifyingUsers.length,
    successful,
    failed,
    skipped,
    results,
  };
}

// Schedule the job to run Sunday at midnight UK time
let adjustmentTimeout: NodeJS.Timeout | null = null;
let adjustmentInterval: NodeJS.Timeout | null = null;

export function startWeeklyAdjustmentScheduler(): void {
  // Calculate milliseconds until next Sunday midnight UK time
  const now = new Date();
  const nextSunday = new Date(now);

  // Get the day of week (0 = Sunday)
  const currentDay = now.getDay();
  const daysUntilSunday = currentDay === 0 ? 7 : 7 - currentDay;

  nextSunday.setDate(now.getDate() + daysUntilSunday);
  nextSunday.setHours(0, 0, 0, 0);

  // If it's already Sunday and past midnight, calculate for next Sunday
  if (currentDay === 0 && now.getHours() >= 0) {
    nextSunday.setDate(nextSunday.getDate() + 7);
  }

  const msUntilNextSunday = nextSunday.getTime() - now.getTime();

  logger.info({ firstRun: nextSunday.toISOString() }, "Weekly adjustment scheduler started");

  // Run at the first Sunday midnight
  adjustmentTimeout = setTimeout(async () => {
    await runWeeklyAdjustmentJob();

    // Then run every 7 days
    adjustmentInterval = setInterval(
      async () => {
        await runWeeklyAdjustmentJob();
      },
      7 * 24 * 60 * 60 * 1000
    );
  }, msUntilNextSunday);
}

export function stopWeeklyAdjustmentScheduler(): void {
  if (adjustmentTimeout) {
    clearTimeout(adjustmentTimeout);
    adjustmentTimeout = null;
  }
  if (adjustmentInterval) {
    clearInterval(adjustmentInterval);
    adjustmentInterval = null;
  }
  logger.info("Weekly adjustment scheduler stopped");
}

// Manual trigger for testing or admin purposes
export async function triggerAdjustmentForUser(userId: string): Promise<AdjustmentJobResult> {
  logger.info({ userId }, "Manual adjustment trigger");
  return processUserAdjustment(userId);
}

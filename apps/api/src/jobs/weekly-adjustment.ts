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

        console.log(
          `[Weekly Adjustment] User ${userId}: AI coaching message generated (source: ${coachingResult.source})`
        );
      }
    } catch (coachingError) {
      // Log but don't fail the adjustment if AI message generation fails
      console.error(`[Weekly Adjustment] User ${userId}: AI coaching failed, using fallback`, coachingError);
    }

    return {
      userId,
      success: true,
      action: adjustment.action,
      newTIB: adjustment.newTIB,
      avgSleepEfficiency: adjustment.avgSleepEfficiency,
    };
  } catch (error) {
    console.error(`Adjustment failed for user ${userId}:`, error);
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
  console.log("[Weekly Adjustment] Starting Sunday adjustment job...");

  // Get all users with baseline complete
  const qualifyingUsers = await prisma.user.findMany({
    where: {
      baselineComplete: true,
      targetWakeTime: { not: null },
    },
    select: { id: true },
  });

  console.log(`[Weekly Adjustment] Found ${qualifyingUsers.length} qualifying users`);

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
      console.log(
        `[Weekly Adjustment] User ${user.id}: Skipped - already processed this week`
      );
      skipped++;
      continue;
    }

    const result = await processUserAdjustment(user.id);
    results.push(result);

    if (result.success) {
      console.log(
        `[Weekly Adjustment] User ${user.id}: ${result.action} (SE: ${result.avgSleepEfficiency?.toFixed(1)}%, TIB: ${result.newTIB} mins)`
      );
    } else {
      console.error(`[Weekly Adjustment] User ${user.id}: Failed - ${result.error}`);
    }

    // Small delay between users
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  console.log(
    `[Weekly Adjustment] Completed: ${successful} successful, ${failed} failed, ${skipped} skipped`
  );

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

  console.log(
    `[Weekly Adjustment] Scheduler started. First run at ${nextSunday.toISOString()}`
  );

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
  console.log("[Weekly Adjustment] Scheduler stopped");
}

// Manual trigger for testing or admin purposes
export async function triggerAdjustmentForUser(userId: string): Promise<AdjustmentJobResult> {
  console.log(`[Weekly Adjustment] Manual trigger for user ${userId}`);
  return processUserAdjustment(userId);
}

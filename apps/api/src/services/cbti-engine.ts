import { prisma } from "@sleepassured/db";
import { Decimal } from "@prisma/client/runtime/library";

// Constants for the CBT-I algorithm
const MIN_TIME_IN_BED_MINS = 300; // 5 hours minimum
const MAX_TIME_IN_BED_MINS = 540; // 9 hours maximum
const ADJUSTMENT_INCREMENT_MINS = 15;
const MIN_ENTRIES_FOR_ADJUSTMENT = 5;
const SE_THRESHOLD_INCREASE = 85; // SE >= 85% -> increase TIB
const SE_THRESHOLD_MAINTAIN = 80; // SE >= 80% -> maintain TIB
const SE_FLAG_THRESHOLD = 70; // SE < 70% -> flag for clinician review

export type AdjustmentAction = "increase" | "decrease" | "maintain" | "baseline";

export interface WeeklyAdjustmentResult {
  status: "success" | "insufficient_data" | "error";
  entriesNeeded?: number;
  avgSleepEfficiency?: number;
  currentTIB?: number;
  newTIB?: number;
  action?: AdjustmentAction;
  feedbackMessage?: string;
  flagged?: boolean;
  flagReason?: string;
  error?: string;
}

export interface SleepWindowData {
  prescribedBedtime: string;
  prescribedWakeTime: string;
  timeInBedMins: number;
}

// Warm, motivational feedback messages
const feedbackMessages = {
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

function getRandomMessage(category: keyof typeof feedbackMessages): string {
  const messages = feedbackMessages[category];
  return messages[Math.floor(Math.random() * messages.length)] ?? messages[0]!;
}

// Calculate bedtime from wake time and time in bed
export function calculateBedtime(wakeTime: string, timeInBedMins: number): string {
  const parts = wakeTime.split(":").map(Number);
  const wakeHour = parts[0] ?? 0;
  const wakeMin = parts[1] ?? 0;
  const wakeMinutes = wakeHour * 60 + wakeMin;
  let bedtimeMinutes = wakeMinutes - timeInBedMins;

  // Handle day boundary crossing
  if (bedtimeMinutes < 0) {
    bedtimeMinutes += 24 * 60;
  }

  const bedHour = Math.floor(bedtimeMinutes / 60);
  const bedMin = bedtimeMinutes % 60;
  return `${bedHour.toString().padStart(2, "0")}:${bedMin.toString().padStart(2, "0")}`;
}

// Get the user's current sleep window settings
async function getCurrentSleepWindow(userId: string): Promise<SleepWindowData | null> {
  const latestWindow = await prisma.sleepWindow.findFirst({
    where: { userId },
    orderBy: { weekStartDate: "desc" },
    select: {
      prescribedBedtime: true,
      prescribedWakeTime: true,
      timeInBedMins: true,
    },
  });

  return latestWindow;
}

// Get sleep diary entries for a date range
async function getDiaryEntries(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<Array<{ sleepEfficiency: Decimal; timeInBedMins: number }>> {
  return prisma.sleepDiary.findMany({
    where: {
      userId,
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
    select: {
      sleepEfficiency: true,
      timeInBedMins: true,
    },
    orderBy: { date: "asc" },
  });
}

// Flag user for clinician review
async function flagUserForReview(userId: string, reason: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      flaggedForReview: true,
      flaggedReason: reason,
    },
  });
}

// Calculate the initial baseline sleep window
export async function calculateBaselineSleepWindow(
  userId: string
): Promise<WeeklyAdjustmentResult> {
  try {
    // Get user's target wake time
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { targetWakeTime: true, baselineComplete: true },
    });

    if (!user?.targetWakeTime) {
      return {
        status: "error",
        error: "User has no target wake time set",
      };
    }

    if (!user.baselineComplete) {
      return {
        status: "error",
        error: "Baseline week not yet complete",
      };
    }

    // Get entries from the past week
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    const entries = await getDiaryEntries(userId, startDate, endDate);

    if (entries.length < MIN_ENTRIES_FOR_ADJUSTMENT) {
      return {
        status: "insufficient_data",
        entriesNeeded: MIN_ENTRIES_FOR_ADJUSTMENT - entries.length,
      };
    }

    // Calculate average sleep efficiency and time in bed
    const avgEfficiency =
      entries.reduce((sum, e) => sum + Number(e.sleepEfficiency), 0) / entries.length;
    const avgTIB =
      entries.reduce((sum, e) => sum + e.timeInBedMins, 0) / entries.length;

    // Initial TIB: Use average actual TIB, clamped to safe range
    // For baseline, we often start more conservatively to build sleep pressure
    let initialTIB = Math.round(avgTIB);
    initialTIB = Math.max(MIN_TIME_IN_BED_MINS, Math.min(MAX_TIME_IN_BED_MINS, initialTIB));

    // If sleep efficiency is already low, consider starting with a tighter window
    if (avgEfficiency < 75) {
      // Start with average total sleep time + small buffer, but not less than minimum
      const avgTST =
        entries.reduce(
          (sum, e) => sum + Math.round((Number(e.sleepEfficiency) / 100) * e.timeInBedMins),
          0
        ) / entries.length;
      initialTIB = Math.max(MIN_TIME_IN_BED_MINS, Math.round(avgTST + 30));
    }

    // Check if we should flag for low SE
    let flagged = false;
    let feedbackMessage = getRandomMessage("baseline");

    if (avgEfficiency < SE_FLAG_THRESHOLD) {
      await flagUserForReview(userId, `Low baseline SE: ${avgEfficiency.toFixed(1)}%`);
      flagged = true;
      feedbackMessage += " " + getRandomMessage("flagged");
    }

    return {
      status: "success",
      avgSleepEfficiency: avgEfficiency,
      currentTIB: Math.round(avgTIB),
      newTIB: initialTIB,
      action: "baseline",
      feedbackMessage,
      flagged,
      flagReason: flagged ? `Low baseline SE: ${avgEfficiency.toFixed(1)}%` : undefined,
    };
  } catch (error) {
    console.error("Baseline calculation error:", error);
    return {
      status: "error",
      error: "Failed to calculate baseline sleep window",
    };
  }
}

// Calculate weekly adjustment based on sleep efficiency
export async function calculateWeeklyAdjustment(
  userId: string,
  weekEndDate: Date
): Promise<WeeklyAdjustmentResult> {
  try {
    // Get entries from the past week
    const endDate = new Date(weekEndDate);
    const startDate = new Date(weekEndDate);
    startDate.setDate(startDate.getDate() - 7);
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    const entries = await getDiaryEntries(userId, startDate, endDate);

    if (entries.length < MIN_ENTRIES_FOR_ADJUSTMENT) {
      return {
        status: "insufficient_data",
        entriesNeeded: MIN_ENTRIES_FOR_ADJUSTMENT - entries.length,
      };
    }

    // Calculate average sleep efficiency
    const avgEfficiency =
      entries.reduce((sum, e) => sum + Number(e.sleepEfficiency), 0) / entries.length;

    // Get current sleep window
    const currentWindow = await getCurrentSleepWindow(userId);

    if (!currentWindow) {
      // No existing window - need to create baseline first
      return calculateBaselineSleepWindow(userId);
    }

    const currentTIB = currentWindow.timeInBedMins;
    let newTIB: number;
    let action: AdjustmentAction;

    // Apply CBT-I algorithm
    if (avgEfficiency >= SE_THRESHOLD_INCREASE) {
      // SE >= 85%: Increase time in bed by 15 minutes
      newTIB = Math.min(currentTIB + ADJUSTMENT_INCREMENT_MINS, MAX_TIME_IN_BED_MINS);
      action = newTIB > currentTIB ? "increase" : "maintain";
    } else if (avgEfficiency >= SE_THRESHOLD_MAINTAIN) {
      // SE 80-84%: Maintain current time in bed
      newTIB = currentTIB;
      action = "maintain";
    } else {
      // SE < 80%: Decrease time in bed by 15 minutes
      newTIB = Math.max(currentTIB - ADJUSTMENT_INCREMENT_MINS, MIN_TIME_IN_BED_MINS);
      action = newTIB < currentTIB ? "decrease" : "maintain";
    }

    // Safety: Flag if SE is persistently low
    let flagged = false;
    let flagReason: string | undefined;
    let feedbackMessage = getRandomMessage(action);

    if (avgEfficiency < SE_FLAG_THRESHOLD) {
      flagReason = `Persistent low SE: ${avgEfficiency.toFixed(1)}%`;
      await flagUserForReview(userId, flagReason);
      flagged = true;
      feedbackMessage += " " + getRandomMessage("flagged");
    }

    return {
      status: "success",
      avgSleepEfficiency: avgEfficiency,
      currentTIB,
      newTIB,
      action,
      feedbackMessage,
      flagged,
      flagReason,
    };
  } catch (error) {
    console.error("Weekly adjustment calculation error:", error);
    return {
      status: "error",
      error: "Failed to calculate weekly adjustment",
    };
  }
}

// Create a new sleep window record based on adjustment result
export async function createSleepWindowFromAdjustment(
  userId: string,
  weekStartDate: Date,
  adjustment: WeeklyAdjustmentResult
): Promise<void> {
  if (adjustment.status !== "success" || !adjustment.newTIB || !adjustment.action) {
    throw new Error("Cannot create sleep window from incomplete adjustment result");
  }

  // Get user's target wake time
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { targetWakeTime: true },
  });

  if (!user?.targetWakeTime) {
    throw new Error("User has no target wake time set");
  }

  const prescribedWakeTime = user.targetWakeTime;
  const prescribedBedtime = calculateBedtime(prescribedWakeTime, adjustment.newTIB);

  // Map action to WindowAdjustment enum
  const adjustmentMadeMap: Record<AdjustmentAction, "INCREASE" | "DECREASE" | "NONE" | "BASELINE"> = {
    increase: "INCREASE",
    decrease: "DECREASE",
    maintain: "NONE",
    baseline: "BASELINE",
  };

  // Calculate adjustment amount
  const adjustmentMins =
    adjustment.currentTIB && adjustment.newTIB !== adjustment.currentTIB
      ? Math.abs(adjustment.newTIB - adjustment.currentTIB)
      : 0;

  await prisma.sleepWindow.create({
    data: {
      userId,
      weekStartDate,
      prescribedBedtime,
      prescribedWakeTime,
      timeInBedMins: adjustment.newTIB,
      avgSleepEfficiency: adjustment.avgSleepEfficiency,
      adjustmentMade: adjustmentMadeMap[adjustment.action],
      adjustmentMins,
      feedbackMessage: adjustment.feedbackMessage,
    },
  });
}

// Calculate the current therapy week number
export async function getTherapyWeekNumber(userId: string): Promise<number | null> {
  // Count the number of sleep windows - each represents a week
  const windowCount = await prisma.sleepWindow.count({
    where: { userId },
  });

  if (windowCount === 0) {
    return null; // Still in baseline
  }

  return windowCount;
}

// Calculate adherence percentage for a given period
// Adherence = % of nights where actual sleep times were within ±30 min of prescribed
export async function calculateAdherencePercentage(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<number | null> {
  // Get the sleep window active during this period
  const sleepWindow = await prisma.sleepWindow.findFirst({
    where: {
      userId,
      weekStartDate: { lte: endDate },
    },
    orderBy: { weekStartDate: "desc" },
  });

  if (!sleepWindow) {
    return null;
  }

  // Get diary entries for the period
  const entries = await prisma.sleepDiary.findMany({
    where: {
      userId,
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
    select: {
      bedtime: true,
      outOfBedTime: true,
    },
  });

  if (entries.length === 0) {
    return null;
  }

  // Parse prescribed times to minutes from midnight
  const prescribedBedtimeParts = sleepWindow.prescribedBedtime.split(":").map(Number);
  const prescribedBedtimeHour = prescribedBedtimeParts[0] ?? 0;
  const prescribedBedtimeMin = prescribedBedtimeParts[1] ?? 0;
  let prescribedBedtimeMins = prescribedBedtimeHour * 60 + prescribedBedtimeMin;
  // Adjust for times after midnight (e.g., 23:00 = -60 mins from midnight conceptually)
  if (prescribedBedtimeHour >= 12) {
    prescribedBedtimeMins = prescribedBedtimeMins - 24 * 60;
  }

  const prescribedWakeTimeParts = sleepWindow.prescribedWakeTime.split(":").map(Number);
  const prescribedWakeTimeHour = prescribedWakeTimeParts[0] ?? 0;
  const prescribedWakeTimeMin = prescribedWakeTimeParts[1] ?? 0;
  const prescribedWakeTimeMins = prescribedWakeTimeHour * 60 + prescribedWakeTimeMin;

  const TOLERANCE_MINS = 30;
  let adherentNights = 0;

  for (const entry of entries) {
    const actualBedtime = new Date(entry.bedtime);
    let actualBedtimeMins = actualBedtime.getHours() * 60 + actualBedtime.getMinutes();
    if (actualBedtime.getHours() >= 12) {
      actualBedtimeMins = actualBedtimeMins - 24 * 60;
    }

    const actualWakeTime = new Date(entry.outOfBedTime);
    const actualWakeTimeMins = actualWakeTime.getHours() * 60 + actualWakeTime.getMinutes();

    const bedtimeDiff = Math.abs(actualBedtimeMins - prescribedBedtimeMins);
    const wakeTimeDiff = Math.abs(actualWakeTimeMins - prescribedWakeTimeMins);

    if (bedtimeDiff <= TOLERANCE_MINS && wakeTimeDiff <= TOLERANCE_MINS) {
      adherentNights++;
    }
  }

  return Math.round((adherentNights / entries.length) * 100);
}

// Get baseline progress status
export async function getBaselineStatus(
  userId: string
): Promise<{
  entriesLogged: number;
  entriesNeeded: number;
  isComplete: boolean;
  daysRemaining: number;
  message: string;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { baselineComplete: true, therapyStartDate: true },
  });

  if (user?.baselineComplete) {
    return {
      entriesLogged: MIN_ENTRIES_FOR_ADJUSTMENT,
      entriesNeeded: 0,
      isComplete: true,
      daysRemaining: 0,
      message: "Baseline complete! Your personalised sleep schedule is ready.",
    };
  }

  // Count entries in the last 7 days
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const entriesLogged = await prisma.sleepDiary.count({
    where: {
      userId,
      date: { gte: sevenDaysAgo },
    },
  });

  const entriesNeeded = Math.max(0, MIN_ENTRIES_FOR_ADJUSTMENT - entriesLogged);
  const isComplete = entriesNeeded === 0;

  // Calculate days remaining based on therapy start
  let daysRemaining = 7;
  if (user?.therapyStartDate) {
    const startDate = new Date(user.therapyStartDate);
    const today = new Date();
    const daysSinceStart = Math.floor(
      (today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    daysRemaining = Math.max(0, 7 - daysSinceStart);
  }

  let message: string;
  if (entriesLogged === 0) {
    message = "Start logging your sleep to get your personalised schedule.";
  } else if (entriesNeeded > 0) {
    message = `Log ${entriesNeeded} more night${entriesNeeded === 1 ? "" : "s"} to get your personalised sleep schedule.`;
  } else {
    message = "Baseline complete! Calculating your sleep schedule...";
  }

  return {
    entriesLogged,
    entriesNeeded,
    isComplete,
    daysRemaining,
    message,
  };
}

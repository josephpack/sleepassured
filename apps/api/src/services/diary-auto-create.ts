import { prisma } from "@sleepassured/db";
import logger from "../lib/logger.js";
import {
  calculateSleepMetrics,
  checkAndUpdateBaselineStatus,
} from "./diary-utils.js";

/**
 * Map WHOOP recovery score (0-100) to subjective quality (1-10).
 * Returns 5 (neutral) when recovery data is unavailable.
 */
export function deriveSubjectiveQuality(recoveryScore: number | null): number {
  if (recoveryScore == null) return 5;
  return Math.max(1, Math.min(10, Math.ceil(recoveryScore / 10)));
}

/**
 * Auto-create diary entries from synced WHOOP sleep records.
 * Skips dates that already have a diary entry.
 */
export async function autoCreateDiaryFromWhoop(
  userId: string
): Promise<{ created: number; skipped: number }> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  // Fetch recent WHOOP sleep records
  const whoopRecords = await prisma.whoopSleepRecord.findMany({
    where: {
      userId,
      endTime: { gte: sevenDaysAgo },
    },
    orderBy: { endTime: "desc" },
  });

  if (whoopRecords.length === 0) {
    return { created: 0, skipped: 0 };
  }

  // Fetch existing diary entries for the same date range
  const existingEntries = await prisma.sleepDiary.findMany({
    where: {
      userId,
      date: { gte: sevenDaysAgo },
    },
    select: { date: true },
  });

  const existingDates = new Set(
    existingEntries.map((e) => e.date.toISOString().split("T")[0])
  );

  let created = 0;
  let skipped = 0;

  for (const record of whoopRecords) {
    // Use the end time date as the diary date (the morning you woke up)
    const entryDate = new Date(record.endTime);
    entryDate.setHours(0, 0, 0, 0);
    const dateKey = entryDate.toISOString().split("T")[0];

    if (existingDates.has(dateKey)) {
      skipped++;
      continue;
    }

    // Derive diary fields from WHOOP data (same mapping as prefill endpoint)
    const startTime = new Date(record.startTime);
    const endTime = new Date(record.endTime);
    const awakeDurationMs = Number(record.awakeDurationMs);
    const awakeMins = Math.round(awakeDurationMs / 60000);

    const estimatedSleepOnsetLatency = Math.min(Math.round(awakeMins * 0.3), 60);
    const estimatedWASO = Math.max(0, awakeMins - estimatedSleepOnsetLatency);

    const { timeInBedMins, totalSleepTimeMins, sleepEfficiency } =
      calculateSleepMetrics({
        bedtime: startTime,
        outOfBedTime: endTime,
        sleepOnsetLatencyMins: estimatedSleepOnsetLatency,
        wakeAfterSleepOnsetMins: estimatedWASO,
      });

    const subjectiveQuality = deriveSubjectiveQuality(record.recoveryScore);

    // Determine number of awakenings from raw JSON if available
    let numberOfAwakenings = 0;
    const rawJson = record.rawJson as Record<string, unknown> | null;
    if (rawJson && typeof rawJson === "object") {
      const score = rawJson.score as Record<string, unknown> | undefined;
      if (score && typeof score === "object") {
        const stageSummary = score.stage_summary as
          | Record<string, unknown>
          | undefined;
        if (stageSummary && typeof stageSummary.disturbance_count === "number") {
          numberOfAwakenings = stageSummary.disturbance_count;
        }
      }
    }

    try {
      await prisma.sleepDiary.create({
        data: {
          userId,
          date: entryDate,
          bedtime: startTime,
          sleepOnsetLatencyMins: estimatedSleepOnsetLatency,
          numberOfAwakenings,
          wakeAfterSleepOnsetMins: estimatedWASO,
          finalWakeTime: endTime,
          outOfBedTime: endTime,
          subjectiveQuality,
          totalSleepTimeMins,
          timeInBedMins,
          sleepEfficiency,
          source: "WHOOP",
          whoopSleepRecordId: record.whoopSleepId,
        },
      });

      existingDates.add(dateKey);
      created++;
    } catch (error) {
      // Unique constraint violation — entry already exists (race condition)
      logger.debug(
        { userId, date: dateKey, err: error },
        "Skipped auto-create: entry already exists"
      );
      skipped++;
    }
  }

  // Update baseline status if we created any entries
  if (created > 0) {
    await checkAndUpdateBaselineStatus(userId);
  }

  logger.info(
    { userId, created, skipped },
    "Auto-created diary entries from WHOOP data"
  );

  return { created, skipped };
}

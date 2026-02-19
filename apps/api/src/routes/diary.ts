import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "@sleepassured/db";
import { authenticate } from "../middleware/auth.js";
import logger from "../lib/logger.js";
import {
  decryptToken,
  isTokenExpired,
  refreshAccessToken as whoopRefreshToken,
  encryptToken,
  getTokenExpiresAt,
  fetchSleepData,
  fetchRecoveryData,
  WhoopRecoveryRecord,
} from "../services/whoop.js";
import {
  calculateSleepMetrics,
  checkAndUpdateBaselineStatus,
} from "../services/diary-utils.js";

const router = Router();

// Validation schema for diary entries
const diaryEntrySchema = z.object({
  date: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Invalid date format",
  }),
  bedtime: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Invalid bedtime format",
  }),
  sleepOnsetLatencyMins: z.number().min(0).max(600),
  numberOfAwakenings: z.number().min(0).max(50),
  wakeAfterSleepOnsetMins: z.number().min(0).max(600),
  finalWakeTime: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Invalid final wake time format",
  }),
  outOfBedTime: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Invalid out of bed time format",
  }),
  subjectiveQuality: z.number().min(1).max(10),
  source: z.enum(["manual", "whoop", "hybrid"]).optional().default("manual"),
  whoopSleepRecordId: z.string().optional(),
  notes: z.string().optional(),
});

// Helper to check if date is within 7 days
function isWithinBackfillLimit(dateStr: string): boolean {
  const entryDate = new Date(dateStr);
  entryDate.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  return entryDate >= sevenDaysAgo && entryDate <= today;
}

// Map diary source string to enum
function mapSourceToEnum(source: string): "MANUAL" | "WHOOP" | "HYBRID" {
  switch (source) {
    case "whoop":
      return "WHOOP";
    case "hybrid":
      return "HYBRID";
    default:
      return "MANUAL";
  }
}

// POST /api/diary
// Create a new diary entry
router.post("/", authenticate, async (req: Request, res: Response) => {
  try {
    const result = diaryEntrySchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        error: "Validation failed",
        details: result.error.flatten().fieldErrors,
      });
      return;
    }

    const data = result.data;
    const userId = req.user!.userId;

    // Check backfill limit
    if (!isWithinBackfillLimit(data.date)) {
      res.status(400).json({
        error: "Entries can only be created for the last 7 days",
      });
      return;
    }

    const bedtime = new Date(data.bedtime);
    const outOfBedTime = new Date(data.outOfBedTime);
    const finalWakeTime = new Date(data.finalWakeTime);
    const entryDate = new Date(data.date);
    entryDate.setHours(0, 0, 0, 0);

    // Validate time logic (accounting for midnight crossing)
    if (outOfBedTime <= bedtime) {
      res.status(400).json({
        error: "Out of bed time must be after bedtime",
      });
      return;
    }

    // Calculate metrics
    const { timeInBedMins, totalSleepTimeMins, sleepEfficiency } =
      calculateSleepMetrics({
        bedtime,
        outOfBedTime,
        sleepOnsetLatencyMins: data.sleepOnsetLatencyMins,
        wakeAfterSleepOnsetMins: data.wakeAfterSleepOnsetMins,
      });

    // Check if entry already exists
    const existingEntry = await prisma.sleepDiary.findUnique({
      where: {
        userId_date: {
          userId,
          date: entryDate,
        },
      },
    });

    if (existingEntry) {
      res.status(409).json({
        error: "An entry already exists for this date. Use PUT to update.",
      });
      return;
    }

    // Create the entry
    const entry = await prisma.sleepDiary.create({
      data: {
        userId,
        date: entryDate,
        bedtime,
        sleepOnsetLatencyMins: data.sleepOnsetLatencyMins,
        numberOfAwakenings: data.numberOfAwakenings,
        wakeAfterSleepOnsetMins: data.wakeAfterSleepOnsetMins,
        finalWakeTime,
        outOfBedTime,
        subjectiveQuality: data.subjectiveQuality,
        totalSleepTimeMins,
        timeInBedMins,
        sleepEfficiency,
        source: mapSourceToEnum(data.source),
        whoopSleepRecordId: data.whoopSleepRecordId,
        notes: data.notes,
      },
    });

    // Check if this completes the baseline week
    await checkAndUpdateBaselineStatus(userId);

    res.status(201).json({ entry });
  } catch (error) {
    logger.error({ err: error }, "Create diary entry error");
    res.status(500).json({ error: "Failed to create diary entry" });
  }
});

// GET /api/diary
// Get diary entries with optional date range
router.get("/", authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { from, to } = req.query;

    const where: { userId: string; date?: { gte?: Date; lte?: Date } } = { userId };

    if (from || to) {
      where.date = {};
      if (from && typeof from === "string") {
        where.date.gte = new Date(from);
      }
      if (to && typeof to === "string") {
        where.date.lte = new Date(to);
      }
    }

    const entries = await prisma.sleepDiary.findMany({
      where,
      orderBy: { date: "desc" },
    });

    res.json({ entries });
  } catch (error) {
    logger.error({ err: error }, "Get diary entries error");
    res.status(500).json({ error: "Failed to fetch diary entries" });
  }
});

// GET /api/diary/:date
// Get a single diary entry by date
router.get("/:date", authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const date = req.params.date as string;

    if (!date || isNaN(Date.parse(date))) {
      res.status(400).json({ error: "Invalid date format" });
      return;
    }

    const entryDate = new Date(date);
    entryDate.setHours(0, 0, 0, 0);

    const entry = await prisma.sleepDiary.findUnique({
      where: {
        userId_date: {
          userId,
          date: entryDate,
        },
      },
    });

    if (!entry) {
      res.status(404).json({ error: "No entry found for this date" });
      return;
    }

    res.json({ entry });
  } catch (error) {
    logger.error({ err: error }, "Get diary entry error");
    res.status(500).json({ error: "Failed to fetch diary entry" });
  }
});

// PUT /api/diary/:date
// Update a diary entry
router.put("/:date", authenticate, async (req: Request, res: Response) => {
  try {
    const result = diaryEntrySchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        error: "Validation failed",
        details: result.error.flatten().fieldErrors,
      });
      return;
    }

    const data = result.data;
    const userId = req.user!.userId;
    const date = req.params.date as string;

    if (!date || isNaN(Date.parse(date))) {
      res.status(400).json({ error: "Invalid date format" });
      return;
    }

    const entryDate = new Date(date);
    entryDate.setHours(0, 0, 0, 0);

    // Check if entry exists
    const existingEntry = await prisma.sleepDiary.findUnique({
      where: {
        userId_date: {
          userId,
          date: entryDate,
        },
      },
    });

    if (!existingEntry) {
      res.status(404).json({ error: "No entry found for this date" });
      return;
    }

    const bedtime = new Date(data.bedtime);
    const outOfBedTime = new Date(data.outOfBedTime);
    const finalWakeTime = new Date(data.finalWakeTime);

    // Validate time logic
    if (outOfBedTime <= bedtime) {
      res.status(400).json({
        error: "Out of bed time must be after bedtime",
      });
      return;
    }

    // Calculate metrics
    const { timeInBedMins, totalSleepTimeMins, sleepEfficiency } =
      calculateSleepMetrics({
        bedtime,
        outOfBedTime,
        sleepOnsetLatencyMins: data.sleepOnsetLatencyMins,
        wakeAfterSleepOnsetMins: data.wakeAfterSleepOnsetMins,
      });

    const entry = await prisma.sleepDiary.update({
      where: {
        userId_date: {
          userId,
          date: entryDate,
        },
      },
      data: {
        bedtime,
        sleepOnsetLatencyMins: data.sleepOnsetLatencyMins,
        numberOfAwakenings: data.numberOfAwakenings,
        wakeAfterSleepOnsetMins: data.wakeAfterSleepOnsetMins,
        finalWakeTime,
        outOfBedTime,
        subjectiveQuality: data.subjectiveQuality,
        totalSleepTimeMins,
        timeInBedMins,
        sleepEfficiency,
        source: mapSourceToEnum(data.source),
        whoopSleepRecordId: data.whoopSleepRecordId,
        notes: data.notes,
      },
    });

    res.json({ entry });
  } catch (error) {
    logger.error({ err: error }, "Update diary entry error");
    res.status(500).json({ error: "Failed to update diary entry" });
  }
});

// DELETE /api/diary/:date
// Delete a diary entry
router.delete("/:date", authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const date = req.params.date as string;

    if (!date || isNaN(Date.parse(date))) {
      res.status(400).json({ error: "Invalid date format" });
      return;
    }

    const entryDate = new Date(date);
    entryDate.setHours(0, 0, 0, 0);

    // Check if entry exists
    const existingEntry = await prisma.sleepDiary.findUnique({
      where: {
        userId_date: {
          userId,
          date: entryDate,
        },
      },
    });

    if (!existingEntry) {
      res.status(404).json({ error: "No entry found for this date" });
      return;
    }

    await prisma.sleepDiary.delete({
      where: {
        userId_date: {
          userId,
          date: entryDate,
        },
      },
    });

    // Re-check baseline status after deletion
    await checkAndUpdateBaselineStatus(userId);

    res.json({ message: "Entry deleted successfully" });
  } catch (error) {
    logger.error({ err: error }, "Delete diary entry error");
    res.status(500).json({ error: "Failed to delete diary entry" });
  }
});

// GET /api/diary/prefill/:date
// Get WHOOP data for pre-filling diary form (triggers on-demand sync)
router.get("/prefill/:date", authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const date = req.params.date as string;

    if (!date || isNaN(Date.parse(date))) {
      res.status(400).json({ error: "Invalid date format" });
      return;
    }

    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    // Check WHOOP connection
    const connection = await prisma.whoopConnection.findUnique({
      where: { userId },
    });

    if (!connection) {
      res.json({ prefillData: null, message: "No WHOOP connection" });
      return;
    }

    // Trigger on-demand sync for this date range
    let accessToken = decryptToken(connection.accessToken);
    let refreshToken = decryptToken(connection.refreshToken);

    if (isTokenExpired(connection.tokenExpiresAt)) {
      try {
        const newTokens = await whoopRefreshToken(refreshToken);
        accessToken = newTokens.access_token;
        refreshToken = newTokens.refresh_token;

        await prisma.whoopConnection.update({
          where: { userId },
          data: {
            accessToken: encryptToken(accessToken),
            refreshToken: encryptToken(refreshToken),
            tokenExpiresAt: getTokenExpiresAt(newTokens.expires_in),
          },
        });
      } catch {
        res.json({ prefillData: null, message: "WHOOP token refresh failed" });
        return;
      }
    }

    // Fetch sleep data for the target date (query from day before to day after)
    const startDate = new Date(targetDate);
    startDate.setDate(startDate.getDate() - 1);
    const endDate = new Date(targetDate);
    endDate.setDate(endDate.getDate() + 1);

    try {
      const [sleepRecords, recoveryRecords] = await Promise.all([
        fetchSleepData(accessToken, startDate, endDate),
        fetchRecoveryData(accessToken, startDate, endDate),
      ]);

      // Create a map of recovery scores by sleep ID
      const recoveryBySleepId = new Map<string, WhoopRecoveryRecord>();
      for (const recovery of recoveryRecords) {
        if (recovery.sleep_id) {
          recoveryBySleepId.set(recovery.sleep_id, recovery);
        }
      }

      // Find sleep record that ends on the target date (main sleep, not nap)
      const matchingRecord = sleepRecords.find((record) => {
        if (record.nap) return false;
        if (record.score_state !== "SCORED" || !record.score) return false;

        const endTime = new Date(record.end);
        return (
          endTime.toDateString() === targetDate.toDateString() ||
          new Date(record.start).toDateString() === targetDate.toDateString()
        );
      });

      if (!matchingRecord || !matchingRecord.score) {
        res.json({ prefillData: null, message: "No WHOOP sleep data for this date" });
        return;
      }

      // Store/update the WHOOP record
      const stageSummary = matchingRecord.score.stage_summary;
      const totalSleepMs =
        stageSummary.total_light_sleep_time_milli +
        stageSummary.total_slow_wave_sleep_time_milli +
        stageSummary.total_rem_sleep_time_milli;

      const recovery = recoveryBySleepId.get(matchingRecord.id);

      await prisma.whoopSleepRecord.upsert({
        where: { whoopSleepId: matchingRecord.id },
        create: {
          userId,
          whoopSleepId: matchingRecord.id,
          startTime: new Date(matchingRecord.start),
          endTime: new Date(matchingRecord.end),
          totalSleepDurationMs: BigInt(totalSleepMs),
          remSleepMs: BigInt(stageSummary.total_rem_sleep_time_milli),
          lightSleepMs: BigInt(stageSummary.total_light_sleep_time_milli),
          deepSleepMs: BigInt(stageSummary.total_slow_wave_sleep_time_milli),
          awakeDurationMs: BigInt(stageSummary.total_awake_time_milli),
          sleepEfficiency: matchingRecord.score.sleep_efficiency_percentage,
          recoveryScore: recovery?.score?.recovery_score ?? null,
          hrvRmssd: recovery?.score?.hrv_rmssd_milli
            ? recovery.score.hrv_rmssd_milli / 1000
            : null,
          restingHeartRate: recovery?.score?.resting_heart_rate ?? null,
          rawJson: matchingRecord as object,
        },
        update: {
          startTime: new Date(matchingRecord.start),
          endTime: new Date(matchingRecord.end),
          totalSleepDurationMs: BigInt(totalSleepMs),
          remSleepMs: BigInt(stageSummary.total_rem_sleep_time_milli),
          lightSleepMs: BigInt(stageSummary.total_light_sleep_time_milli),
          deepSleepMs: BigInt(stageSummary.total_slow_wave_sleep_time_milli),
          awakeDurationMs: BigInt(stageSummary.total_awake_time_milli),
          sleepEfficiency: matchingRecord.score.sleep_efficiency_percentage,
          recoveryScore: recovery?.score?.recovery_score ?? null,
          hrvRmssd: recovery?.score?.hrv_rmssd_milli
            ? recovery.score.hrv_rmssd_milli / 1000
            : null,
          restingHeartRate: recovery?.score?.resting_heart_rate ?? null,
          rawJson: matchingRecord as object,
        },
      });

      // Update last synced timestamp
      await prisma.whoopConnection.update({
        where: { userId },
        data: { lastSyncedAt: new Date() },
      });

      // Map WHOOP data to diary prefill format
      const startTime = new Date(matchingRecord.start);
      const endTime = new Date(matchingRecord.end);
      const awakeMins = Math.round(stageSummary.total_awake_time_milli / 60000);
      const totalSleepMins = Math.round(totalSleepMs / 60000);
      const timeInBedMins = Math.round((endTime.getTime() - startTime.getTime()) / 60000);

      // Estimate sleep onset latency and WASO from awake time
      // WHOOP doesn't separate these, so we make a reasonable estimate
      const estimatedSleepOnsetLatency = Math.min(Math.round(awakeMins * 0.3), 60);
      const estimatedWASO = awakeMins - estimatedSleepOnsetLatency;

      const prefillData = {
        date: targetDate.toISOString().split("T")[0],
        bedtime: startTime.toISOString(),
        sleepOnsetLatencyMins: estimatedSleepOnsetLatency,
        numberOfAwakenings: stageSummary.disturbance_count || 0,
        wakeAfterSleepOnsetMins: Math.max(0, estimatedWASO),
        finalWakeTime: endTime.toISOString(),
        outOfBedTime: endTime.toISOString(),
        totalSleepTimeMins: totalSleepMins,
        timeInBedMins: timeInBedMins,
        sleepEfficiency: matchingRecord.score.sleep_efficiency_percentage,
        whoopSleepRecordId: matchingRecord.id.toString(),
        recoveryScore: recovery?.score?.recovery_score ?? null,
      };

      res.json({ prefillData });
    } catch (error) {
      logger.error({ err: error }, "WHOOP data fetch error");
      res.json({ prefillData: null, message: "Failed to fetch WHOOP data" });
    }
  } catch (error) {
    logger.error({ err: error }, "Prefill error");
    res.status(500).json({ error: "Failed to get prefill data" });
  }
});

export default router;

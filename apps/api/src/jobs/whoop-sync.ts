import { prisma } from "@sleepassured/db";
import {
  decryptToken,
  encryptToken,
  refreshAccessToken,
  fetchSleepData,
  fetchRecoveryData,
  getTokenExpiresAt,
  isTokenExpired,
  WhoopRecoveryRecord,
} from "../services/whoop.js";
import logger from "../lib/logger.js";

interface SyncResult {
  userId: string;
  success: boolean;
  recordsSynced?: number;
  error?: string;
}

// Sync sleep data for a single user
async function syncUserData(userId: string): Promise<SyncResult> {
  try {
    const connection = await prisma.whoopConnection.findUnique({
      where: { userId },
    });

    if (!connection) {
      return { userId, success: false, error: "No connection found" };
    }

    // Decrypt tokens
    let accessToken = decryptToken(connection.accessToken);
    let refreshToken = decryptToken(connection.refreshToken);

    // Refresh token if expired
    if (isTokenExpired(connection.tokenExpiresAt)) {
      try {
        const newTokens = await refreshAccessToken(refreshToken);
        accessToken = newTokens.access_token;
        refreshToken = newTokens.refresh_token;

        // Update stored tokens
        await prisma.whoopConnection.update({
          where: { userId },
          data: {
            accessToken: encryptToken(accessToken),
            refreshToken: encryptToken(refreshToken),
            tokenExpiresAt: getTokenExpiresAt(newTokens.expires_in),
          },
        });
      } catch (error) {
        // Token refresh failed - user may need to re-authenticate
        logger.error({ err: error, userId }, "Token refresh failed");
        return {
          userId,
          success: false,
          error: "Token refresh failed - re-authentication required",
        };
      }
    }

    // Sync yesterday's data (the most recent complete night of sleep)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 1);

    // Fetch sleep and recovery data
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

    // Process and store sleep records
    let syncedCount = 0;
    for (const record of sleepRecords) {
      // Skip naps - only track main sleep
      if (record.nap) continue;

      // Skip records without scores
      if (record.score_state !== "SCORED" || !record.score) continue;

      const recovery = recoveryBySleepId.get(record.id);
      const stageSummary = record.score.stage_summary;

      const totalSleepMs =
        stageSummary.total_light_sleep_time_milli +
        stageSummary.total_slow_wave_sleep_time_milli +
        stageSummary.total_rem_sleep_time_milli;

      await prisma.whoopSleepRecord.upsert({
        where: { whoopSleepId: record.id },
        create: {
          userId,
          whoopSleepId: record.id,
          startTime: new Date(record.start),
          endTime: new Date(record.end),
          totalSleepDurationMs: BigInt(totalSleepMs),
          remSleepMs: BigInt(stageSummary.total_rem_sleep_time_milli),
          lightSleepMs: BigInt(stageSummary.total_light_sleep_time_milli),
          deepSleepMs: BigInt(stageSummary.total_slow_wave_sleep_time_milli),
          awakeDurationMs: BigInt(stageSummary.total_awake_time_milli),
          sleepEfficiency: record.score.sleep_efficiency_percentage,
          recoveryScore: recovery?.score?.recovery_score ?? null,
          hrvRmssd: recovery?.score?.hrv_rmssd_milli
            ? recovery.score.hrv_rmssd_milli / 1000
            : null,
          restingHeartRate: recovery?.score?.resting_heart_rate ?? null,
          rawJson: record as object,
        },
        update: {
          startTime: new Date(record.start),
          endTime: new Date(record.end),
          totalSleepDurationMs: BigInt(totalSleepMs),
          remSleepMs: BigInt(stageSummary.total_rem_sleep_time_milli),
          lightSleepMs: BigInt(stageSummary.total_light_sleep_time_milli),
          deepSleepMs: BigInt(stageSummary.total_slow_wave_sleep_time_milli),
          awakeDurationMs: BigInt(stageSummary.total_awake_time_milli),
          sleepEfficiency: record.score.sleep_efficiency_percentage,
          recoveryScore: recovery?.score?.recovery_score ?? null,
          hrvRmssd: recovery?.score?.hrv_rmssd_milli
            ? recovery.score.hrv_rmssd_milli / 1000
            : null,
          restingHeartRate: recovery?.score?.resting_heart_rate ?? null,
          rawJson: record as object,
        },
      });

      syncedCount++;
    }

    // Update last synced timestamp
    await prisma.whoopConnection.update({
      where: { userId },
      data: { lastSyncedAt: new Date() },
    });

    return { userId, success: true, recordsSynced: syncedCount };
  } catch (error) {
    logger.error({ err: error, userId }, "WHOOP sync failed for user");
    return {
      userId,
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Run sync job for all connected users
export async function runWhoopSyncJob(): Promise<{
  totalUsers: number;
  successful: number;
  failed: number;
  results: SyncResult[];
}> {
  logger.info("Starting daily WHOOP sync job");

  // Get all users with WHOOP connections
  const connections = await prisma.whoopConnection.findMany({
    select: { userId: true },
  });

  logger.info({ count: connections.length }, "Found connected WHOOP users");

  const results: SyncResult[] = [];

  // Process users sequentially to avoid rate limiting
  for (const connection of connections) {
    const result = await syncUserData(connection.userId);
    results.push(result);

    if (result.success) {
      logger.info({ userId: connection.userId, recordsSynced: result.recordsSynced }, "WHOOP sync completed for user");
    } else {
      logger.error({ userId: connection.userId, error: result.error }, "WHOOP sync failed for user");
    }

    // Small delay between users to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  logger.info({ successful, failed }, "WHOOP sync job completed");

  return {
    totalUsers: connections.length,
    successful,
    failed,
    results,
  };
}

// Schedule the job to run daily at 9 AM
let syncInterval: NodeJS.Timeout | null = null;

export function startWhoopSyncScheduler(): void {
  // Calculate milliseconds until next 9 AM
  const now = new Date();
  const next9AM = new Date(now);
  next9AM.setHours(9, 0, 0, 0);

  if (now >= next9AM) {
    // If it's past 9 AM today, schedule for tomorrow
    next9AM.setDate(next9AM.getDate() + 1);
  }

  const msUntilNext9AM = next9AM.getTime() - now.getTime();

  logger.info({ firstRun: next9AM.toISOString() }, "WHOOP sync scheduler started");

  // Run at the first 9 AM
  setTimeout(async () => {
    await runWhoopSyncJob();

    // Then run every 24 hours
    syncInterval = setInterval(async () => {
      await runWhoopSyncJob();
    }, 24 * 60 * 60 * 1000);
  }, msUntilNext9AM);
}

export function stopWhoopSyncScheduler(): void {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
    logger.info("WHOOP sync scheduler stopped");
  }
}

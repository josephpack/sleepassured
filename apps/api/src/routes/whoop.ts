import { Router, Request, Response } from "express";
import crypto from "crypto";
import { prisma } from "@sleepassured/db";
import { authenticate } from "../middleware/auth.js";
import logger from "../lib/logger.js";
import {
  getAuthorizationUrl,
  exchangeCodeForTokens,
  refreshAccessToken as whoopRefreshToken,
  fetchUserProfile,
  fetchSleepData,
  fetchRecoveryData,
  encryptToken,
  decryptToken,
  getTokenExpiresAt,
  isTokenExpired,
  WhoopRecoveryRecord,
} from "../services/whoop.js";

const router = Router();

// Derive the frontend URL for OAuth redirects.
// Uses FRONTEND_URL env var, falling back to the request origin for
// single-container deployments where API and frontend share a host.
function getFrontendUrl(req: Request): string {
  if (process.env.NODE_ENV !== "production") {
    return "http://localhost:5173";
  }
  if (process.env.FRONTEND_URL) {
    return process.env.FRONTEND_URL.replace(/\/+$/, "");
  }
  // Fallback: derive from the incoming request (same-origin deployment)
  const origin = `${req.protocol}://${req.get("host")}`;
  logger.warn(
    { origin },
    "FRONTEND_URL is not set — falling back to request origin for redirect"
  );
  return origin;
}

// Store OAuth states temporarily (in production, use Redis or similar)
const pendingOAuthStates = new Map<
  string,
  { userId: string; expiresAt: Date; returnTo: string }
>();

// Clean up expired states periodically
setInterval(() => {
  const now = new Date();
  for (const [state, data] of pendingOAuthStates.entries()) {
    if (data.expiresAt < now) {
      pendingOAuthStates.delete(state);
    }
  }
}, 60000); // Clean up every minute

// GET /api/whoop/auth-url
// Returns the OAuth authorization URL for connecting WHOOP
router.get("/auth-url", authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    // Check if already connected
    const existingConnection = await prisma.whoopConnection.findUnique({
      where: { userId },
    });

    if (existingConnection) {
      res.status(400).json({ error: "WHOOP account already connected" });
      return;
    }

    // Generate a secure random state
    const state = crypto.randomBytes(32).toString("hex");

    // Only allow relative paths to prevent open redirect
    const rawReturnTo = req.query.returnTo as string | undefined;
    const returnTo =
      rawReturnTo && rawReturnTo.startsWith("/") ? rawReturnTo : "/settings";

    // Store state with user ID (expires in 10 minutes)
    pendingOAuthStates.set(state, {
      userId,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      returnTo,
    });

    const authUrl = getAuthorizationUrl(state);
    logger.debug({ authUrl }, "Generated WHOOP auth URL");

    res.json({ authUrl });
  } catch (error) {
    logger.error({ err: error }, "Error generating auth URL");
    res.status(500).json({ error: "Failed to generate authorization URL" });
  }
});

// GET /api/whoop/callback
// Handles the OAuth callback from WHOOP
router.get("/callback", async (req: Request, res: Response) => {
  try {
    const { code, state, error: oauthError } = req.query;

    // Frontend URL for redirects
    const frontendUrl = getFrontendUrl(req);

    // Handle OAuth errors
    if (oauthError) {
      res.redirect(`${frontendUrl}/settings?whoop_error=${oauthError}`);
      return;
    }

    if (!code || !state || typeof code !== "string" || typeof state !== "string") {
      res.redirect(`${frontendUrl}/settings?whoop_error=invalid_request`);
      return;
    }

    // Validate state
    const stateData = pendingOAuthStates.get(state);
    if (!stateData || stateData.expiresAt < new Date()) {
      pendingOAuthStates.delete(state);
      res.redirect(`${frontendUrl}/settings?whoop_error=invalid_state`);
      return;
    }

    const userId = stateData.userId;
    const returnTo = stateData.returnTo;
    pendingOAuthStates.delete(state);

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code);

    // Fetch user profile to get WHOOP user ID
    const profile = await fetchUserProfile(tokens.access_token);

    // Check if this WHOOP account is already connected to another user
    const existingWhoopUser = await prisma.whoopConnection.findFirst({
      where: { whoopUserId: profile.user_id.toString() },
    });

    if (existingWhoopUser && existingWhoopUser.userId !== userId) {
      res.redirect(
        `${frontendUrl}${returnTo}?whoop_error=account_already_linked`
      );
      return;
    }

    // Create or update the WHOOP connection
    await prisma.whoopConnection.upsert({
      where: { userId },
      create: {
        userId,
        whoopUserId: profile.user_id.toString(),
        accessToken: encryptToken(tokens.access_token),
        refreshToken: encryptToken(tokens.refresh_token),
        tokenExpiresAt: getTokenExpiresAt(tokens.expires_in),
      },
      update: {
        whoopUserId: profile.user_id.toString(),
        accessToken: encryptToken(tokens.access_token),
        refreshToken: encryptToken(tokens.refresh_token),
        tokenExpiresAt: getTokenExpiresAt(tokens.expires_in),
      },
    });

    const redirectUrl = `${frontendUrl}${returnTo}?whoop_connected=true`;
    logger.info({ userId, redirectUrl }, "WHOOP connection successful, redirecting");
    res.redirect(redirectUrl);
  } catch (error) {
    logger.error({ err: error }, "WHOOP callback error");
    const frontendUrl = getFrontendUrl(req);
    res.redirect(`${frontendUrl}/settings?whoop_error=connection_failed`);
  }
});

// GET /api/whoop/status
// Check WHOOP connection status
router.get("/status", authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    const connection = await prisma.whoopConnection.findUnique({
      where: { userId },
      select: {
        connectedAt: true,
        lastSyncedAt: true,
        whoopUserId: true,
      },
    });

    if (!connection) {
      res.json({ connected: false });
      return;
    }

    res.json({
      connected: true,
      connectedAt: connection.connectedAt,
      lastSyncedAt: connection.lastSyncedAt,
    });
  } catch (error) {
    logger.error({ err: error }, "Error checking WHOOP status");
    res.status(500).json({ error: "Failed to check connection status" });
  }
});

// DELETE /api/whoop/disconnect
// Disconnect WHOOP account
router.delete("/disconnect", authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    const connection = await prisma.whoopConnection.findUnique({
      where: { userId },
    });

    if (!connection) {
      res.status(404).json({ error: "No WHOOP connection found" });
      return;
    }

    // Delete the connection and all associated sleep records
    await prisma.$transaction([
      prisma.whoopSleepRecord.deleteMany({ where: { userId } }),
      prisma.whoopConnection.delete({ where: { userId } }),
    ]);

    res.json({ message: "WHOOP account disconnected successfully" });
  } catch (error) {
    logger.error({ err: error }, "Error disconnecting WHOOP");
    res.status(500).json({ error: "Failed to disconnect WHOOP account" });
  }
});

// GET /api/whoop/sync-now
// On-demand sync - lighter weight version for diary prefill
router.get("/sync-now", authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    const connection = await prisma.whoopConnection.findUnique({
      where: { userId },
    });

    if (!connection) {
      res.status(404).json({ error: "No WHOOP connection found" });
      return;
    }

    // Decrypt tokens
    let accessToken = decryptToken(connection.accessToken);
    let refreshToken = decryptToken(connection.refreshToken);

    // Refresh token if expired
    if (isTokenExpired(connection.tokenExpiresAt)) {
      const newTokens = await whoopRefreshToken(refreshToken);
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
    }

    // Update last synced timestamp
    await prisma.whoopConnection.update({
      where: { userId },
      data: { lastSyncedAt: new Date() },
    });

    res.json({ message: "Sync triggered successfully", lastSyncedAt: new Date() });
  } catch (error) {
    logger.error({ err: error }, "WHOOP sync-now error");
    res.status(500).json({ error: "Failed to trigger sync" });
  }
});

// POST /api/whoop/sync
// Manually trigger a data sync
router.post("/sync", authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    const connection = await prisma.whoopConnection.findUnique({
      where: { userId },
    });

    if (!connection) {
      res.status(404).json({ error: "No WHOOP connection found" });
      return;
    }

    // Decrypt tokens
    let accessToken = decryptToken(connection.accessToken);
    let refreshToken = decryptToken(connection.refreshToken);

    // Refresh token if expired
    if (isTokenExpired(connection.tokenExpiresAt)) {
      const newTokens = await whoopRefreshToken(refreshToken);
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
    }

    // Sync last 7 days of data
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);

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

    res.json({
      message: "Sync completed successfully",
      recordsSynced: syncedCount,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error({ err: error }, "WHOOP sync error");
    res.status(500).json({ error: "Failed to sync WHOOP data", detail: message });
  }
});

// GET /api/whoop/latest-recovery
// Get the most recent recovery score
router.get("/latest-recovery", authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    // Check if user has WHOOP connected
    const connection = await prisma.whoopConnection.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!connection) {
      res.json({ connected: false, recovery: null });
      return;
    }

    // Get the most recent sleep record with a recovery score
    const latestRecord = await prisma.whoopSleepRecord.findFirst({
      where: {
        userId,
        recoveryScore: { not: null },
      },
      orderBy: { endTime: "desc" },
      select: {
        recoveryScore: true,
        endTime: true,
        hrvRmssd: true,
        restingHeartRate: true,
      },
    });

    if (!latestRecord) {
      res.json({ connected: true, recovery: null });
      return;
    }

    res.json({
      connected: true,
      recovery: {
        score: latestRecord.recoveryScore,
        date: latestRecord.endTime,
        hrvRmssd: latestRecord.hrvRmssd ? Number(latestRecord.hrvRmssd) : null,
        restingHeartRate: latestRecord.restingHeartRate,
      },
    });
  } catch (error) {
    logger.error({ err: error }, "Error fetching latest recovery");
    res.status(500).json({ error: "Failed to fetch recovery data" });
  }
});

export default router;

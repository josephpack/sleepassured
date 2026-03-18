import { Router, Request, Response } from "express";
import { prisma } from "@sleepassured/db";
import { authenticate } from "../middleware/auth.js";
import logger from "../lib/logger.js";
import { getAllProviders } from "../providers/registry.js";
import { NormalizedSleepRecord } from "../providers/types.js";
import {
  calculateSleepMetrics,
  checkAndUpdateBaselineStatus,
} from "../services/diary-utils.js";
import { deriveSubjectiveQuality } from "../services/diary-auto-create.js";

const router = Router();

// ─── GET /api/providers/status ───────────────────────────────────────
// List all providers and connection status for the current user.
router.get("/status", authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    const [whoopConn, providerConns] = await Promise.all([
      prisma.whoopConnection.findUnique({
        where: { userId },
        select: { connectedAt: true, lastSyncedAt: true, status: true },
      }),
      prisma.providerConnection.findMany({
        where: { userId },
        select: { provider: true, status: true, connectedAt: true, lastSyncedAt: true },
      }),
    ]);

    const allProviders = getAllProviders();
    const providerConnMap = new Map(
      providerConns.map((c) => [c.provider.toLowerCase(), c])
    );

    const providers = allProviders.map((p) => {
      if (p.slug === "whoop") {
        return {
          slug: p.slug,
          displayName: p.displayName,
          authType: p.authType,
          connected: !!whoopConn && whoopConn.status !== "NEEDS_REAUTH",
          needsReauth: whoopConn?.status === "NEEDS_REAUTH" || false,
          lastSyncedAt: whoopConn?.lastSyncedAt ?? null,
          connectedAt: whoopConn?.connectedAt ?? null,
        };
      }

      const conn = providerConnMap.get(p.slug);
      return {
        slug: p.slug,
        displayName: p.displayName,
        authType: p.authType,
        connected: conn?.status === "ACTIVE",
        needsReauth: false,
        lastSyncedAt: conn?.lastSyncedAt ?? null,
        connectedAt: conn?.connectedAt ?? null,
      };
    });

    res.json({ providers });
  } catch (error) {
    logger.error({ err: error }, "Error fetching provider status");
    res.status(500).json({ error: "Failed to fetch provider status" });
  }
});

// ─── POST /api/providers/apple-health/connect ────────────────────────
// Mark Apple Health as connected (called from the native app after HealthKit permission granted).
router.post("/apple-health/connect", authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    await prisma.providerConnection.upsert({
      where: { userId_provider: { userId, provider: "APPLE_HEALTH" } },
      create: {
        userId,
        provider: "APPLE_HEALTH",
        status: "ACTIVE",
      },
      update: {
        status: "ACTIVE",
      },
    });

    res.json({ message: "Apple Health connected" });
  } catch (error) {
    logger.error({ err: error }, "Error connecting Apple Health");
    res.status(500).json({ error: "Failed to connect Apple Health" });
  }
});

// ─── POST /api/providers/apple-health/sync ───────────────────────────
// Receive normalised sleep data from the HealthKit client and create diary entries.
router.post("/apple-health/sync", authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { records } = req.body as { records: NormalizedSleepRecord[] };

    if (!Array.isArray(records) || records.length === 0) {
      res.status(400).json({ error: "records array is required" });
      return;
    }

    // Verify Apple Health is connected
    const conn = await prisma.providerConnection.findUnique({
      where: { userId_provider: { userId, provider: "APPLE_HEALTH" } },
    });

    if (!conn || conn.status !== "ACTIVE") {
      res.status(400).json({ error: "Apple Health is not connected" });
      return;
    }

    // Get existing diary dates to skip duplicates
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const existingEntries = await prisma.sleepDiary.findMany({
      where: { userId, date: { gte: sevenDaysAgo } },
      select: { date: true },
    });

    const existingDates = new Set(
      existingEntries.map((e) => e.date.toISOString().split("T")[0])
    );

    let created = 0;
    let skipped = 0;

    for (const record of records) {
      const endTime = new Date(record.endTime);
      const startTime = new Date(record.startTime);
      const entryDate = new Date(endTime);
      entryDate.setHours(0, 0, 0, 0);
      const dateKey = entryDate.toISOString().split("T")[0];

      if (existingDates.has(dateKey)) {
        skipped++;
        continue;
      }

      // Derive diary fields from normalised data
      const awakeDurationMs = record.awakeDurationMs ?? 0;
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

      // Apple Health doesn't have recovery scores — use neutral quality
      const subjectiveQuality = record.recoveryScore != null
        ? deriveSubjectiveQuality(record.recoveryScore)
        : 5;

      try {
        await prisma.sleepDiary.create({
          data: {
            userId,
            date: entryDate,
            bedtime: startTime,
            sleepOnsetLatencyMins: estimatedSleepOnsetLatency,
            numberOfAwakenings: 0,
            wakeAfterSleepOnsetMins: estimatedWASO,
            finalWakeTime: endTime,
            outOfBedTime: endTime,
            subjectiveQuality,
            totalSleepTimeMins,
            timeInBedMins,
            sleepEfficiency,
            source: "APPLE_HEALTH",
          },
        });
        existingDates.add(dateKey);
        created++;
      } catch {
        // Unique constraint violation — entry already exists
        skipped++;
      }
    }

    // Update baseline status if we created entries
    if (created > 0) {
      await checkAndUpdateBaselineStatus(userId);
    }

    // Update last synced timestamp
    await prisma.providerConnection.update({
      where: { userId_provider: { userId, provider: "APPLE_HEALTH" } },
      data: { lastSyncedAt: new Date() },
    });

    logger.info({ userId, created, skipped }, "Apple Health sync completed");
    res.json({ created, skipped });
  } catch (error) {
    logger.error({ err: error }, "Error syncing Apple Health data");
    res.status(500).json({ error: "Failed to sync Apple Health data" });
  }
});

// ─── DELETE /api/providers/apple-health/disconnect ───────────────────
// Remove Apple Health connection.
router.delete("/apple-health/disconnect", authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    const conn = await prisma.providerConnection.findUnique({
      where: { userId_provider: { userId, provider: "APPLE_HEALTH" } },
    });

    if (!conn) {
      res.status(404).json({ error: "No Apple Health connection found" });
      return;
    }

    await prisma.providerConnection.update({
      where: { userId_provider: { userId, provider: "APPLE_HEALTH" } },
      data: { status: "DISCONNECTED" },
    });

    res.json({ message: "Apple Health disconnected" });
  } catch (error) {
    logger.error({ err: error }, "Error disconnecting Apple Health");
    res.status(500).json({ error: "Failed to disconnect Apple Health" });
  }
});

// ─── GET /api/providers/sleep-history ────────────────────────────────
// Returns unified sleep history from all connected providers, merged by date.
router.get("/sleep-history", authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const days = Math.min(Math.max(parseInt(req.query.days as string) || 7, 1), 30);

    const since = new Date();
    since.setDate(since.getDate() - days);

    // Fetch WHOOP records
    const whoopRecords = await prisma.whoopSleepRecord.findMany({
      where: { userId, endTime: { gte: since } },
      orderBy: { endTime: "desc" },
      select: {
        startTime: true,
        endTime: true,
        totalSleepDurationMs: true,
        sleepEfficiency: true,
        remSleepMs: true,
        lightSleepMs: true,
        deepSleepMs: true,
        awakeDurationMs: true,
        recoveryScore: true,
      },
    });

    // Fetch Apple Health diary entries
    const appleHealthDiaries = await prisma.sleepDiary.findMany({
      where: { userId, date: { gte: since }, source: "APPLE_HEALTH" },
      orderBy: { date: "desc" },
      select: {
        date: true,
        bedtime: true,
        finalWakeTime: true,
        totalSleepTimeMins: true,
        sleepEfficiency: true,
        sleepOnsetLatencyMins: true,
        wakeAfterSleepOnsetMins: true,
      },
    });

    const msToMins = (ms: bigint) => Math.round(Number(ms) / 60000);

    // Build records by date — WHOOP preferred when both exist for same date
    const byDate = new Map<string, Record<string, unknown>>();

    for (const r of whoopRecords) {
      const dateKey = r.endTime.toISOString().slice(0, 10);
      if (!byDate.has(dateKey)) {
        byDate.set(dateKey, {
          date: dateKey,
          provider: "whoop",
          bedtime: r.startTime.toISOString(),
          wakeTime: r.endTime.toISOString(),
          totalSleepMins: msToMins(r.totalSleepDurationMs),
          sleepEfficiency: Number(r.sleepEfficiency),
          remMins: msToMins(r.remSleepMs),
          lightMins: msToMins(r.lightSleepMs),
          deepMins: msToMins(r.deepSleepMs),
          awakeMins: msToMins(r.awakeDurationMs),
          recoveryScore: r.recoveryScore ?? null,
        });
      }
    }

    for (const d of appleHealthDiaries) {
      const dateKey = d.date.toISOString().slice(0, 10);
      if (!byDate.has(dateKey)) {
        byDate.set(dateKey, {
          date: dateKey,
          provider: "apple_health",
          bedtime: d.bedtime.toISOString(),
          wakeTime: d.finalWakeTime.toISOString(),
          totalSleepMins: d.totalSleepTimeMins,
          sleepEfficiency: Number(d.sleepEfficiency),
          remMins: 0,
          lightMins: 0,
          deepMins: 0,
          awakeMins: d.sleepOnsetLatencyMins + d.wakeAfterSleepOnsetMins,
          recoveryScore: null,
        });
      }
    }

    // Sort by date descending
    const records = Array.from(byDate.values()).sort(
      (a, b) => (b.date as string).localeCompare(a.date as string)
    );

    res.json({ records });
  } catch (error) {
    logger.error({ err: error }, "Error fetching unified sleep history");
    res.status(500).json({ error: "Failed to fetch sleep history" });
  }
});

export default router;

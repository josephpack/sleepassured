import { Router, Request, Response } from "express";
import { prisma } from "@sleepassured/db";
import { authenticate } from "../middleware/auth.js";
import logger from "../lib/logger.js";
import { getTherapyWeekNumber } from "../services/cbti-engine.js";

const router = Router();

function isiSeverity(score: number): string {
  if (score <= 7) return "none";
  if (score <= 14) return "subthreshold";
  if (score <= 21) return "moderate";
  return "severe";
}

// GET /api/progress
// Aggregated progress data for the Progress page
router.get("/", authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    const [user, diaryEntries, whoopRecords, sleepWindows, isiAssessments, weekNumber] =
      await Promise.all([
        prisma.user.findUnique({
          where: { id: userId },
          select: { therapyStartDate: true, name: true, createdAt: true },
        }),
        prisma.sleepDiary.findMany({
          where: { userId },
          orderBy: { date: "asc" },
          select: {
            date: true,
            sleepEfficiency: true,
            totalSleepTimeMins: true,
            source: true,
          },
        }),
        prisma.whoopSleepRecord.findMany({
          where: { userId },
          orderBy: { startTime: "asc" },
          select: {
            startTime: true,
            recoveryScore: true,
            hrvRmssd: true,
            restingHeartRate: true,
          },
        }),
        prisma.sleepWindow.findMany({
          where: { userId },
          orderBy: { weekStartDate: "asc" },
        }),
        prisma.iSIAssessment.findMany({
          where: { userId },
          orderBy: { completedAt: "asc" },
          select: { score: true, completedAt: true },
        }),
        getTherapyWeekNumber(userId),
      ]);

    // Daily data from diary entries
    const dailyData = diaryEntries.map((e) => ({
      date: e.date.toISOString().split("T")[0],
      sleepEfficiency: Number(e.sleepEfficiency),
      totalSleepMins: e.totalSleepTimeMins,
      source: e.source,
    }));

    // WHOOP recovery data
    const recoveryData = whoopRecords
      .filter((r) => r.recoveryScore != null)
      .map((r) => ({
        date: r.startTime.toISOString().split("T")[0],
        recoveryScore: r.recoveryScore,
        hrvRmssd: r.hrvRmssd ? Number(r.hrvRmssd) : null,
        restingHeartRate: r.restingHeartRate,
      }));

    // Schedule history with week numbering
    const schedules = sleepWindows.map((w, i) => ({
      weekNumber: i + 1,
      weekStartDate: w.weekStartDate.toISOString().split("T")[0],
      prescribedBedtime: w.prescribedBedtime,
      prescribedWakeTime: w.prescribedWakeTime,
      timeInBedMins: w.timeInBedMins,
      avgSleepEfficiency: w.avgSleepEfficiency ? Number(w.avgSleepEfficiency) : null,
      adjustmentMade: w.adjustmentMade,
      adjustmentMins: w.adjustmentMins,
    }));

    // ISI history
    const isiHistory = isiAssessments.map((a) => ({
      score: a.score,
      severity: isiSeverity(a.score),
      completedAt: a.completedAt.toISOString(),
    }));

    // Summary stats: compare first 7 days vs latest 7 days
    const efficiencies = dailyData.map((d) => d.sleepEfficiency);
    const tsts = dailyData.map((d) => d.totalSleepMins);

    const avg = (arr: number[]) =>
      arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

    const firstWeekEff = avg(efficiencies.slice(0, 7));
    const latestWeekEff = avg(efficiencies.slice(-7));
    const firstWeekTST = avg(tsts.slice(0, 7));
    const latestWeekTST = avg(tsts.slice(-7));

    const recoveryScores = recoveryData
      .filter((r) => r.recoveryScore != null)
      .map((r) => r.recoveryScore!);
    const avgRecovery = avg(recoveryScores);
    const latestRecoveryScores = recoveryScores.slice(-7);
    const latestRecovery = avg(latestRecoveryScores);

    res.json({
      programmeWeek: weekNumber,
      totalWeeks: 8,
      therapyStartDate: user?.therapyStartDate
        ? user.therapyStartDate.toISOString().split("T")[0]
        : null,
      memberSince: user?.createdAt?.toISOString().split("T")[0] ?? null,
      totalNights: diaryEntries.length,
      dailyData,
      recoveryData,
      schedules,
      isiHistory,
      summary: {
        firstWeekAvgEfficiency: firstWeekEff !== null ? Math.round(firstWeekEff) : null,
        latestWeekAvgEfficiency: latestWeekEff !== null ? Math.round(latestWeekEff) : null,
        efficiencyChange:
          firstWeekEff !== null && latestWeekEff !== null
            ? Math.round(latestWeekEff - firstWeekEff)
            : null,
        firstWeekAvgTST: firstWeekTST !== null ? Math.round(firstWeekTST) : null,
        latestWeekAvgTST: latestWeekTST !== null ? Math.round(latestWeekTST) : null,
        tstChange:
          firstWeekTST !== null && latestWeekTST !== null
            ? Math.round(latestWeekTST - firstWeekTST)
            : null,
        avgRecovery: avgRecovery !== null ? Math.round(avgRecovery) : null,
        latestRecovery: latestRecovery !== null ? Math.round(latestRecovery) : null,
      },
    });
  } catch (error) {
    logger.error({ err: error }, "Get progress data error");
    res.status(500).json({ error: "Failed to fetch progress data" });
  }
});

export default router;

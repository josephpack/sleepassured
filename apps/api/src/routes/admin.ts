import { Router, Request, Response } from "express";
import { prisma } from "@sleepassured/db";
import { authenticate } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/admin.js";
import logger from "../lib/logger.js";

const router = Router();

// All admin routes require authentication + admin role
router.use(authenticate, requireAdmin);

// GET /api/admin/users — list all users with status summary
router.get("/users", async (_req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        onboardingCompleted: true,
        baselineComplete: true,
        flaggedForReview: true,
        flaggedReason: true,
        therapyStartDate: true,
        whoopConnection: { select: { id: true } },
        sleepDiaries: {
          select: {
            date: true,
            sleepEfficiency: true,
          },
          orderBy: { date: "desc" },
          take: 1,
        },
        _count: {
          select: { sleepDiaries: true },
        },
        isiAssessments: {
          select: { score: true },
          orderBy: { completedAt: "desc" },
          take: 1,
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const result = users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      createdAt: u.createdAt,
      onboardingCompleted: u.onboardingCompleted,
      baselineComplete: u.baselineComplete,
      flaggedForReview: u.flaggedForReview,
      flaggedReason: u.flaggedReason,
      therapyStartDate: u.therapyStartDate,
      whoopConnected: !!u.whoopConnection,
      diaryCount: u._count.sleepDiaries,
      lastDiaryDate: u.sleepDiaries[0]?.date ?? null,
      latestSleepEfficiency: u.sleepDiaries[0]?.sleepEfficiency
        ? Number(u.sleepDiaries[0].sleepEfficiency)
        : null,
      latestIsiScore: u.isiAssessments[0]?.score ?? null,
    }));

    res.json({ users: result });
  } catch (error) {
    logger.error({ err: error }, "Admin: failed to list users");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/admin/users/:id — single user detail
router.get("/users/:id", async (req: Request, res: Response) => {
  try {
    const userId = req.params.id as string;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        onboardingCompleted: true,
        baselineComplete: true,
        flaggedForReview: true,
        flaggedReason: true,
        therapyStartDate: true,
        whoopConnection: { select: { id: true } },
        sleepDiaries: {
          select: {
            date: true,
            sleepEfficiency: true,
            totalSleepTimeMins: true,
            subjectiveQuality: true,
            source: true,
          },
          orderBy: { date: "desc" },
          take: 14,
        },
        _count: {
          select: { sleepDiaries: true },
        },
        sleepWindows: {
          select: {
            weekStartDate: true,
            prescribedBedtime: true,
            prescribedWakeTime: true,
            timeInBedMins: true,
            avgSleepEfficiency: true,
            adjustmentMade: true,
          },
          orderBy: { weekStartDate: "asc" },
        },
        isiAssessments: {
          select: {
            score: true,
            completedAt: true,
          },
          orderBy: { completedAt: "asc" },
        },
      },
    });

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const latestDiary = user.sleepDiaries[0];

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
        onboardingCompleted: user.onboardingCompleted,
        baselineComplete: user.baselineComplete,
        flaggedForReview: user.flaggedForReview,
        flaggedReason: user.flaggedReason,
        therapyStartDate: user.therapyStartDate,
        whoopConnected: !!user.whoopConnection,
        diaryCount: user._count.sleepDiaries,
        lastDiaryDate: latestDiary?.date ?? null,
        latestSleepEfficiency: latestDiary?.sleepEfficiency
          ? Number(latestDiary.sleepEfficiency)
          : null,
        latestIsiScore: user.isiAssessments.at(-1)?.score ?? null,
      },
      diaryEntries: user.sleepDiaries.map((d) => ({
        date: d.date,
        sleepEfficiency: Number(d.sleepEfficiency),
        totalSleepTimeMins: d.totalSleepTimeMins,
        subjectiveQuality: d.subjectiveQuality,
        source: d.source,
      })),
      sleepWindows: user.sleepWindows.map((w) => ({
        weekStartDate: w.weekStartDate,
        prescribedBedtime: w.prescribedBedtime,
        prescribedWakeTime: w.prescribedWakeTime,
        timeInBedMins: w.timeInBedMins,
        avgSleepEfficiency: w.avgSleepEfficiency
          ? Number(w.avgSleepEfficiency)
          : null,
        adjustmentMade: w.adjustmentMade,
      })),
      isiAssessments: user.isiAssessments.map((a) => ({
        score: a.score,
        completedAt: a.completedAt,
      })),
    });
  } catch (error) {
    logger.error({ err: error }, "Admin: failed to get user detail");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

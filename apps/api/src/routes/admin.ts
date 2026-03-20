import { Router, Request, Response } from "express";
import { prisma } from "@sleepassured/db";
import { authenticate } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/admin.js";
import { hashPassword } from "../lib/password.js";
import { syncUserData } from "../jobs/whoop-sync.js";
import { triggerAdjustmentForUser } from "../jobs/weekly-adjustment.js";
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
        adminNotes: true,
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
      adminNotes: u.adminNotes,
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
        adminNotes: true,
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
        adminNotes: user.adminNotes,
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

// PATCH /api/admin/users/:id — update flag status + admin notes
router.patch("/users/:id", async (req: Request, res: Response) => {
  try {
    const userId = req.params.id as string;
    const { flaggedForReview, flaggedReason, adminNotes } = req.body;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const data: Record<string, unknown> = {};

    if (typeof flaggedForReview === "boolean") {
      data.flaggedForReview = flaggedForReview;
      if (!flaggedForReview) {
        data.flaggedReason = null;
      } else if (typeof flaggedReason === "string") {
        data.flaggedReason = flaggedReason;
      }
    }

    if (typeof adminNotes === "string") {
      data.adminNotes = adminNotes;
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        flaggedForReview: true,
        flaggedReason: true,
        adminNotes: true,
      },
    });

    logger.info({ userId, changes: Object.keys(data) }, "Admin: updated user");
    res.json({ user: updated });
  } catch (error) {
    logger.error({ err: error }, "Admin: failed to update user");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/admin/users — create a new user account
router.post("/users", async (req: Request, res: Response) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      res.status(400).json({ error: "Name, email and password are required" });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ error: "A user with this email already exists" });
      return;
    }

    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        onboardingCompleted: false,
      },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
      },
    });

    logger.info({ userId: user.id, email }, "Admin: created user account");
    res.status(201).json({ user });
  } catch (error) {
    logger.error({ err: error }, "Admin: failed to create user");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/admin/users/:id/reset-password — reset a user's password
router.post("/users/:id/reset-password", async (req: Request, res: Response) => {
  try {
    const userId = req.params.id as string;
    const { password } = req.body;

    if (!password) {
      res.status(400).json({ error: "Password is required" });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const passwordHash = await hashPassword(password);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    logger.info({ userId }, "Admin: password reset");
    res.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, "Admin: failed to reset password");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/admin/users/:id/sync-whoop — trigger WHOOP sync for a user
router.post("/users/:id/sync-whoop", async (req: Request, res: Response) => {
  try {
    const userId = req.params.id as string;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const result = await syncUserData(userId);

    logger.info({ userId, result }, "Admin: triggered WHOOP sync");
    res.json(result);
  } catch (error) {
    logger.error({ err: error }, "Admin: failed to trigger WHOOP sync");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/admin/users/:id/trigger-adjustment — trigger weekly adjustment for a user
router.post("/users/:id/trigger-adjustment", async (req: Request, res: Response) => {
  try {
    const userId = req.params.id as string;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const result = await triggerAdjustmentForUser(userId);

    logger.info({ userId, result }, "Admin: triggered adjustment");
    res.json(result);
  } catch (error) {
    logger.error({ err: error }, "Admin: failed to trigger adjustment");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/admin/users/:id — permanently delete a user and all their data
router.delete("/users/:id", async (req: Request, res: Response) => {
  try {
    const userId = req.params.id as string;

    if (userId === req.user!.userId) {
      res.status(400).json({ error: "You cannot delete your own account" });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    await prisma.user.delete({ where: { id: userId } });

    logger.info({ userId, email: user.email }, "Admin: deleted user");
    res.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, "Admin: failed to delete user");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

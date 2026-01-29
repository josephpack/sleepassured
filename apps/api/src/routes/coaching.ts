import { Router, Request, Response } from "express";
import { prisma } from "@sleepassured/db";
import { authenticate } from "../middleware/auth.js";
import {
  generateWeeklyCoachingMessage,
  buildUserContextFromDb,
  generateCoachingMessage,
  getAuditLog,
} from "../services/coaching.js";

const router = Router();

// GET /api/coaching/weekly
// Get the AI-generated coaching message for the user's current week
router.get("/weekly", authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    // Check if user has a sleep window
    const latestWindow = await prisma.sleepWindow.findFirst({
      where: { userId },
      orderBy: { weekStartDate: "desc" },
    });

    if (!latestWindow) {
      res.status(404).json({
        error: "No sleep schedule found",
        message: "Complete your baseline week to receive coaching messages.",
      });
      return;
    }

    // Check if we already have a coaching message stored
    if (latestWindow.feedbackMessage) {
      // Return the stored message (could be from weekly adjustment job)
      const context = await buildUserContextFromDb(userId, latestWindow.weekStartDate);

      res.json({
        message: latestWindow.feedbackMessage,
        weekNumber: context?.weekNumber ?? 1,
        source: "stored",
        schedule: {
          prescribedBedtime: latestWindow.prescribedBedtime,
          prescribedWakeTime: latestWindow.prescribedWakeTime,
          timeInBedMins: latestWindow.timeInBedMins,
          adjustmentMade: latestWindow.adjustmentMade,
          avgSleepEfficiency: latestWindow.avgSleepEfficiency
            ? Number(latestWindow.avgSleepEfficiency)
            : null,
        },
      });
      return;
    }

    // Generate a new coaching message
    const result = await generateWeeklyCoachingMessage(userId);

    if (!result) {
      res.status(500).json({
        error: "Failed to generate coaching message",
      });
      return;
    }

    // Store the generated message for future requests
    await prisma.sleepWindow.update({
      where: { id: latestWindow.id },
      data: { feedbackMessage: result.message },
    });

    res.json({
      message: result.message,
      weekNumber: result.weekNumber,
      source: result.source,
      schedule: {
        prescribedBedtime: latestWindow.prescribedBedtime,
        prescribedWakeTime: latestWindow.prescribedWakeTime,
        timeInBedMins: latestWindow.timeInBedMins,
        adjustmentMade: latestWindow.adjustmentMade,
        avgSleepEfficiency: latestWindow.avgSleepEfficiency
          ? Number(latestWindow.avgSleepEfficiency)
          : null,
      },
    });
  } catch (error) {
    console.error("Get weekly coaching error:", error);
    res.status(500).json({ error: "Failed to get coaching message" });
  }
});

// POST /api/coaching/regenerate
// Force regenerate a coaching message (useful if user wants a fresh message)
router.post("/regenerate", authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    const latestWindow = await prisma.sleepWindow.findFirst({
      where: { userId },
      orderBy: { weekStartDate: "desc" },
    });

    if (!latestWindow) {
      res.status(404).json({
        error: "No sleep schedule found",
      });
      return;
    }

    const context = await buildUserContextFromDb(userId, latestWindow.weekStartDate);

    if (!context) {
      res.status(500).json({
        error: "Failed to build user context",
      });
      return;
    }

    const result = await generateCoachingMessage(userId, context);

    // Update the stored message
    await prisma.sleepWindow.update({
      where: { id: latestWindow.id },
      data: { feedbackMessage: result.message },
    });

    res.json({
      message: result.message,
      weekNumber: context.weekNumber,
      source: result.source,
      model: result.model,
      schedule: {
        prescribedBedtime: latestWindow.prescribedBedtime,
        prescribedWakeTime: latestWindow.prescribedWakeTime,
        timeInBedMins: latestWindow.timeInBedMins,
        adjustmentMade: latestWindow.adjustmentMade,
        avgSleepEfficiency: latestWindow.avgSleepEfficiency
          ? Number(latestWindow.avgSleepEfficiency)
          : null,
      },
    });
  } catch (error) {
    console.error("Regenerate coaching error:", error);
    res.status(500).json({ error: "Failed to regenerate coaching message" });
  }
});

// GET /api/coaching/context
// Get the current user context (for debugging/transparency)
router.get("/context", authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    const latestWindow = await prisma.sleepWindow.findFirst({
      where: { userId },
      orderBy: { weekStartDate: "desc" },
    });

    if (!latestWindow) {
      res.status(404).json({
        error: "No sleep schedule found",
      });
      return;
    }

    const context = await buildUserContextFromDb(userId, latestWindow.weekStartDate);

    if (!context) {
      res.status(500).json({
        error: "Failed to build user context",
      });
      return;
    }

    res.json({
      context: {
        weekNumber: context.weekNumber,
        avgSleepEfficiency: context.avgSleepEfficiency,
        previousSleepEfficiency: context.previousSleepEfficiency,
        avgRecoveryScore: context.avgRecoveryScore,
        adjustmentType: context.adjustmentType,
        adjustmentMinutes: context.adjustmentMinutes,
        currentTIB: context.currentTIB,
        newTIB: context.newTIB,
        prescribedBedtime: context.prescribedBedtime,
        prescribedWakeTime: context.prescribedWakeTime,
        isFlagged: context.isFlagged,
      },
    });
  } catch (error) {
    console.error("Get coaching context error:", error);
    res.status(500).json({ error: "Failed to get coaching context" });
  }
});

// GET /api/coaching/audit (admin endpoint - should be protected in production)
// Get recent audit log entries for monitoring AI outputs
router.get("/audit", authenticate, async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;

    // In production, add admin role check here
    // For now, just require authentication

    const entries = getAuditLog(limit);

    res.json({
      count: entries.length,
      entries: entries.map((e) => ({
        timestamp: e.timestamp,
        userId: e.userId,
        source: e.source,
        model: e.model,
        promptTokens: e.promptTokens,
        completionTokens: e.completionTokens,
        moderationFlagged: e.moderationFlagged,
        error: e.error,
        adjustmentType: e.userContext.adjustmentType,
        avgSleepEfficiency: e.userContext.avgSleepEfficiency,
      })),
    });
  } catch (error) {
    console.error("Get audit log error:", error);
    res.status(500).json({ error: "Failed to get audit log" });
  }
});

export default router;

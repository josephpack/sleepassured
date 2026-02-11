import { Router, Request, Response } from "express";
import { prisma } from "@sleepassured/db";
import { authenticate } from "../middleware/auth.js";
import logger from "../lib/logger.js";
import {
  getBaselineStatus,
  calculateBaselineSleepWindow,
  createSleepWindowFromAdjustment,
  getTherapyWeekNumber,
  calculateAdherencePercentage,
} from "../services/cbti-engine.js";

const router = Router();

// GET /api/schedule/current
// Get the user's active sleep window
router.get("/current", authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    const currentWindow = await prisma.sleepWindow.findFirst({
      where: { userId },
      orderBy: { weekStartDate: "desc" },
    });

    if (!currentWindow) {
      // Check baseline status and return appropriate response
      const baselineStatus = await getBaselineStatus(userId);

      res.json({
        hasSchedule: false,
        baselineStatus,
      });
      return;
    }

    // Get week number and adherence
    const weekNumber = await getTherapyWeekNumber(userId);

    // Calculate adherence for the current week
    const weekStartDate = new Date(currentWindow.weekStartDate);
    const today = new Date();
    const adherencePercentage = await calculateAdherencePercentage(
      userId,
      weekStartDate,
      today
    );

    res.json({
      hasSchedule: true,
      schedule: {
        id: currentWindow.id,
        prescribedBedtime: currentWindow.prescribedBedtime,
        prescribedWakeTime: currentWindow.prescribedWakeTime,
        timeInBedMins: currentWindow.timeInBedMins,
        weekStartDate: currentWindow.weekStartDate,
        avgSleepEfficiency: currentWindow.avgSleepEfficiency
          ? Number(currentWindow.avgSleepEfficiency)
          : null,
        adjustmentMade: currentWindow.adjustmentMade,
        adjustmentMins: currentWindow.adjustmentMins,
        feedbackMessage: currentWindow.feedbackMessage,
        createdAt: currentWindow.createdAt,
        weekNumber,
        adherencePercentage,
      },
    });
  } catch (error) {
    logger.error({ err: error }, "Get current schedule error");
    res.status(500).json({ error: "Failed to fetch current schedule" });
  }
});

// GET /api/schedule/history
// Get past sleep windows
router.get("/history", authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const limit = parseInt(req.query.limit as string) || 10;

    const windows = await prisma.sleepWindow.findMany({
      where: { userId },
      orderBy: { weekStartDate: "desc" },
      take: limit,
    });

    res.json({
      schedules: windows.map((w) => ({
        id: w.id,
        prescribedBedtime: w.prescribedBedtime,
        prescribedWakeTime: w.prescribedWakeTime,
        timeInBedMins: w.timeInBedMins,
        weekStartDate: w.weekStartDate,
        avgSleepEfficiency: w.avgSleepEfficiency ? Number(w.avgSleepEfficiency) : null,
        adjustmentMade: w.adjustmentMade,
        adjustmentMins: w.adjustmentMins,
        feedbackMessage: w.feedbackMessage,
        createdAt: w.createdAt,
      })),
    });
  } catch (error) {
    logger.error({ err: error }, "Get schedule history error");
    res.status(500).json({ error: "Failed to fetch schedule history" });
  }
});

// GET /api/schedule/baseline-status
// Get baseline week progress
router.get("/baseline-status", authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const status = await getBaselineStatus(userId);

    res.json(status);
  } catch (error) {
    logger.error({ err: error }, "Get baseline status error");
    res.status(500).json({ error: "Failed to fetch baseline status" });
  }
});

// POST /api/schedule/initialize
// Initialize the first sleep window after baseline is complete
router.post("/initialize", authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    // Check if user already has a sleep window
    const existingWindow = await prisma.sleepWindow.findFirst({
      where: { userId },
    });

    if (existingWindow) {
      res.status(400).json({
        error: "Sleep schedule already initialized",
      });
      return;
    }

    // Check baseline status
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { baselineComplete: true, targetWakeTime: true },
    });

    if (!user?.baselineComplete) {
      res.status(400).json({
        error: "Baseline week not yet complete",
      });
      return;
    }

    if (!user.targetWakeTime) {
      res.status(400).json({
        error: "Target wake time not set. Please complete onboarding first.",
      });
      return;
    }

    // Calculate baseline sleep window
    const adjustment = await calculateBaselineSleepWindow(userId);

    if (adjustment.status !== "success") {
      res.status(400).json({
        error: adjustment.error || "Failed to calculate initial sleep window",
        entriesNeeded: adjustment.entriesNeeded,
      });
      return;
    }

    // Create the sleep window
    const weekStartDate = new Date();
    weekStartDate.setHours(0, 0, 0, 0);

    await createSleepWindowFromAdjustment(userId, weekStartDate, adjustment);

    // Fetch and return the created window
    const newWindow = await prisma.sleepWindow.findFirst({
      where: { userId },
      orderBy: { weekStartDate: "desc" },
    });

    res.status(201).json({
      message: "Sleep schedule initialized successfully",
      schedule: {
        id: newWindow!.id,
        prescribedBedtime: newWindow!.prescribedBedtime,
        prescribedWakeTime: newWindow!.prescribedWakeTime,
        timeInBedMins: newWindow!.timeInBedMins,
        weekStartDate: newWindow!.weekStartDate,
        avgSleepEfficiency: newWindow!.avgSleepEfficiency
          ? Number(newWindow!.avgSleepEfficiency)
          : null,
        adjustmentMade: newWindow!.adjustmentMade,
        feedbackMessage: newWindow!.feedbackMessage,
        createdAt: newWindow!.createdAt,
      },
    });
  } catch (error) {
    logger.error({ err: error }, "Initialize schedule error");
    res.status(500).json({ error: "Failed to initialize sleep schedule" });
  }
});

export default router;

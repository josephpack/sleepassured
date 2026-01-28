import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "@sleepassured/db";
import { authenticate } from "../middleware/auth.js";

const router = Router();

// Time format validation (HH:MM)
const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

// Update profile schema
const updateProfileSchema = z.object({
  name: z.string().min(1).optional(),
  targetWakeTime: z
    .string()
    .regex(timeRegex, "Time must be in HH:MM format")
    .optional(),
  onboardingCompleted: z.boolean().optional(),
});

// PATCH /api/users/me
// Update current user's profile
router.patch("/me", authenticate, async (req: Request, res: Response) => {
  try {
    const result = updateProfileSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        error: "Validation failed",
        details: result.error.flatten().fieldErrors,
      });
      return;
    }

    const userId = req.user!.userId;
    const updates = result.data;

    // Only include fields that were provided
    const data: Record<string, unknown> = {};
    if (updates.name !== undefined) data.name = updates.name;
    if (updates.targetWakeTime !== undefined)
      data.targetWakeTime = updates.targetWakeTime;
    if (updates.onboardingCompleted !== undefined)
      data.onboardingCompleted = updates.onboardingCompleted;

    const user = await prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        targetWakeTime: true,
        onboardingCompleted: true,
      },
    });

    res.json({ user });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

// GET /api/users/me
// Get current user's full profile (more detailed than /auth/me)
router.get("/me", authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        targetWakeTime: true,
        onboardingCompleted: true,
        createdAt: true,
        whoopConnection: {
          select: {
            connectedAt: true,
            lastSyncedAt: true,
          },
        },
        _count: {
          select: {
            isiAssessments: true,
            sleepDiaries: true,
          },
        },
      },
    });

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json({ user });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

export default router;

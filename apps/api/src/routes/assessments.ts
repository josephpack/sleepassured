import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "@sleepassured/db";
import { authenticate } from "../middleware/auth.js";

const router = Router();

// ISI Assessment schema - 7 questions, each scored 0-4
const isiAssessmentSchema = z.object({
  responses: z.array(z.number().min(0).max(4)).length(7),
});

// ISI Score interpretation
// 0-7: No clinically significant insomnia
// 8-14: Subthreshold insomnia
// 15-21: Clinical insomnia (moderate severity)
// 22-28: Clinical insomnia (severe)

// POST /api/assessments/isi
// Submit ISI assessment
router.post("/isi", authenticate, async (req: Request, res: Response) => {
  try {
    const result = isiAssessmentSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        error: "Validation failed",
        details: result.error.flatten().fieldErrors,
      });
      return;
    }

    const { responses } = result.data;
    const userId = req.user!.userId;

    // Calculate total score (sum of all responses)
    const score = responses.reduce((sum, val) => sum + val, 0);

    // Create assessment record
    const assessment = await prisma.iSIAssessment.create({
      data: {
        userId,
        score,
        responses,
      },
      select: {
        id: true,
        score: true,
        completedAt: true,
      },
    });

    // Determine severity category
    let severity: string;
    if (score <= 7) {
      severity = "none";
    } else if (score <= 14) {
      severity = "subthreshold";
    } else if (score <= 21) {
      severity = "moderate";
    } else {
      severity = "severe";
    }

    res.status(201).json({
      assessment: {
        ...assessment,
        severity,
      },
    });
  } catch (error) {
    console.error("ISI assessment error:", error);
    res.status(500).json({ error: "Failed to save assessment" });
  }
});

// GET /api/assessments/isi/latest
// Get user's most recent ISI assessment
router.get("/isi/latest", authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    const assessment = await prisma.iSIAssessment.findFirst({
      where: { userId },
      orderBy: { completedAt: "desc" },
      select: {
        id: true,
        score: true,
        responses: true,
        completedAt: true,
      },
    });

    if (!assessment) {
      res.status(404).json({ error: "No assessment found" });
      return;
    }

    // Determine severity category
    let severity: string;
    if (assessment.score <= 7) {
      severity = "none";
    } else if (assessment.score <= 14) {
      severity = "subthreshold";
    } else if (assessment.score <= 21) {
      severity = "moderate";
    } else {
      severity = "severe";
    }

    res.json({
      assessment: {
        ...assessment,
        severity,
      },
    });
  } catch (error) {
    console.error("Get ISI assessment error:", error);
    res.status(500).json({ error: "Failed to fetch assessment" });
  }
});

// GET /api/assessments/isi/history
// Get all user's ISI assessments
router.get("/isi/history", authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    const assessments = await prisma.iSIAssessment.findMany({
      where: { userId },
      orderBy: { completedAt: "desc" },
      select: {
        id: true,
        score: true,
        completedAt: true,
      },
    });

    res.json({ assessments });
  } catch (error) {
    console.error("Get ISI history error:", error);
    res.status(500).json({ error: "Failed to fetch assessments" });
  }
});

export default router;

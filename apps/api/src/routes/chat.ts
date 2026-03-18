import { Router, Request, Response } from "express";
import { authenticate } from "../middleware/auth.js";
import logger from "../lib/logger.js";
import {
  sendChatMessage,
  buildChatContext,
  ChatMessage,
} from "../services/chat.js";
import { getCurriculum } from "../services/curriculum.js";
import { generateConversationStarters } from "../services/nudges.js";

const router = Router();

// POST /api/chat
// Send a message and get AI response
router.post("/", authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { message, conversationHistory } = req.body as {
      message: string;
      conversationHistory?: ChatMessage[];
    };

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      res.status(400).json({ error: "Message is required" });
      return;
    }

    if (message.length > 1000) {
      res.status(400).json({ error: "Message too long (max 1000 characters)" });
      return;
    }

    // Validate conversation history if provided
    const history: ChatMessage[] = [];
    if (conversationHistory && Array.isArray(conversationHistory)) {
      for (const msg of conversationHistory.slice(-10)) {
        if (
          msg &&
          typeof msg.role === "string" &&
          (msg.role === "user" || msg.role === "assistant") &&
          typeof msg.content === "string"
        ) {
          history.push({
            role: msg.role,
            content: msg.content,
          });
        }
      }
    }

    const result = await sendChatMessage(userId, message.trim(), history);

    res.json({
      message: result.message,
      source: result.source,
    });
  } catch (error) {
    logger.error({ err: error }, "Chat error");
    res.status(500).json({ error: "Failed to process message" });
  }
});

// GET /api/chat/context
// Get user's sleep context for display or debugging
router.get("/context", authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const context = await buildChatContext(userId);

    res.json({
      weekNumber: context.weekNumber,
      hasSchedule: !!context.currentSchedule,
      schedule: context.currentSchedule
        ? {
            prescribedBedtime: context.currentSchedule.prescribedBedtime,
            prescribedWakeTime: context.currentSchedule.prescribedWakeTime,
            timeInBedMins: context.currentSchedule.timeInBedMins,
          }
        : null,
      recentStats: {
        entriesCount: context.entriesCount,
        avgSleepEfficiency: context.avgSleepEfficiency,
        avgTotalSleepTime: context.avgTotalSleepTime,
        avgSubjectiveQuality: context.avgSubjectiveQuality,
      },
      hasDeviceConnection: context.hasDeviceConnection,
      avgRecoveryScore: context.avgRecoveryScore,
      latestISI: context.latestISIScore
        ? {
            score: context.latestISIScore,
            severity: context.latestISISeverity,
          }
        : null,
      baselineComplete: context.baselineComplete,
    });
  } catch (error) {
    logger.error({ err: error }, "Get chat context error");
    res.status(500).json({ error: "Failed to get context" });
  }
});

// GET /api/chat/quick-replies
// Get contextual conversation starters powered by the nudge engine
router.get("/quick-replies", authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const context = await buildChatContext(userId);
    const weekNumber = context.weekNumber;
    const starters = generateConversationStarters(context, weekNumber);
    const curriculum = getCurriculum(weekNumber);

    // Map starters to the existing quick-reply response shape
    const quickReplies = starters.map((s) => ({
      id: s.id,
      label: s.label,
      message: s.message,
    }));

    const lastEntry = context.recentDiaryEntries[0];
    const lastNightEfficiency = lastEntry?.sleepEfficiency ?? null;

    res.json({
      quickReplies,
      context: {
        lastNightEfficiency,
        isLowEfficiency: lastNightEfficiency !== null && lastNightEfficiency < 80,
        weekNumber,
        topic: curriculum.topic,
      },
    });
  } catch (error) {
    logger.error({ err: error }, "Get quick replies error");
    res.status(500).json({ error: "Failed to get quick replies" });
  }
});

export default router;

import { Router, Request, Response } from "express";
import { authenticate } from "../middleware/auth.js";
import logger from "../lib/logger.js";
import { buildChatContext } from "../services/chat.js";
import { getCurriculum } from "../services/curriculum.js";
import { generateNudges, generateConversationStarters } from "../services/nudges.js";

const router = Router();

// GET /api/programme/current
// Returns the user's current programme state: curriculum, nudges, starters, progress
router.get("/current", authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const context = await buildChatContext(userId);

    const weekNumber = context.weekNumber;
    const curriculum = getCurriculum(weekNumber);
    const { dailyNudge } = generateNudges(context, weekNumber);
    const conversationStarters = generateConversationStarters(context, weekNumber);

    // Build topic list for progress
    const allTopics = Array.from({ length: 8 }, (_, i) => getCurriculum(i + 1).topic);
    const clampedWeek = Math.min(weekNumber, 8);

    res.json({
      weekNumber,
      totalWeeks: 8,
      topic: curriculum.topic,
      summary: curriculum.summary,
      dailyActions: curriculum.dailyActions,
      dailyNudge: {
        id: dailyNudge.id,
        message: dailyNudge.message,
      },
      conversationStarters: conversationStarters.map((s) => ({
        id: s.id,
        label: s.label,
        message: s.message,
      })),
      progress: {
        currentWeek: clampedWeek,
        completedTopics: allTopics.slice(0, clampedWeek - 1),
        currentTopic: curriculum.topic,
        upcomingTopics: allTopics.slice(clampedWeek),
      },
    });
  } catch (error) {
    logger.error({ err: error }, "Get programme state error");
    res.status(500).json({ error: "Failed to get programme state" });
  }
});

export default router;

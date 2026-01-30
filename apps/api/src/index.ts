import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/auth.js";
import whoopRoutes from "./routes/whoop.js";
import assessmentRoutes from "./routes/assessments.js";
import userRoutes from "./routes/users.js";
import diaryRoutes from "./routes/diary.js";
import scheduleRoutes from "./routes/schedule.js";
import coachingRoutes from "./routes/coaching.js";
import chatRoutes from "./routes/chat.js";
import { startWhoopSyncScheduler } from "./jobs/whoop-sync.js";
import { startWeeklyAdjustmentScheduler } from "./jobs/weekly-adjustment.js";

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.NODE_ENV === "production"
      ? process.env.FRONTEND_URL
      : "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Hello world route
app.get("/", (_req, res) => {
  res.json({
    message: "Welcome to SleepAssured API",
    version: "1.0.0",
  });
});

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/whoop", whoopRoutes);
app.use("/api/assessments", assessmentRoutes);
app.use("/api/users", userRoutes);
app.use("/api/diary", diaryRoutes);
app.use("/api/schedule", scheduleRoutes);
app.use("/api/coaching", coachingRoutes);
app.use("/api/chat", chatRoutes);

// Start server only if not in test mode
if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`🚀 API server running on http://localhost:${PORT}`);
    // Start scheduled jobs
    startWhoopSyncScheduler();
    startWeeklyAdjustmentScheduler();
  });
}

export default app;

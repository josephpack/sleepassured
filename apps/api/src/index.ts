import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/auth.js";
import whoopRoutes from "./routes/whoop.js";
import assessmentRoutes from "./routes/assessments.js";
import userRoutes from "./routes/users.js";
import { startWhoopSyncScheduler } from "./jobs/whoop-sync.js";

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

// Start server only if not in test mode
if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`🚀 API server running on http://localhost:${PORT}`);
    // Start WHOOP sync scheduler
    startWhoopSyncScheduler();
  });
}

export default app;

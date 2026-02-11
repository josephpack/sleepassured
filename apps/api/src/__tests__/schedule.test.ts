import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { prisma } from "@sleepassured/db";
import app from "../index.js";
import { hashPassword } from "../lib/password.js";
import { generateAccessToken } from "../lib/jwt.js";

let accessToken: string;
let userId: string;

beforeEach(async () => {
  const passwordHash = await hashPassword("password123");
  const user = await prisma.user.create({
    data: {
      name: "Schedule Test User",
      email: "schedule-test@example.com",
      passwordHash,
      onboardingCompleted: true,
      targetWakeTime: "07:00",
      baselineComplete: true,
      therapyStartDate: new Date(),
    },
  });
  userId = user.id;
  accessToken = generateAccessToken(userId);
});

describe("Schedule API", () => {
  describe("GET /api/schedule/current", () => {
    it("returns active sleep window when one exists", async () => {
      const weekStartDate = new Date();
      weekStartDate.setHours(0, 0, 0, 0);

      await prisma.sleepWindow.create({
        data: {
          userId,
          weekStartDate,
          prescribedBedtime: "23:00",
          prescribedWakeTime: "07:00",
          timeInBedMins: 480,
          adjustmentMade: "BASELINE",
          feedbackMessage: "Welcome to your schedule!",
        },
      });

      const response = await request(app)
        .get("/api/schedule/current")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.hasSchedule).toBe(true);
      expect(response.body.schedule).toBeDefined();
      expect(response.body.schedule.prescribedBedtime).toBe("23:00");
      expect(response.body.schedule.prescribedWakeTime).toBe("07:00");
      expect(response.body.schedule.timeInBedMins).toBe(480);
      expect(response.body.schedule.weekNumber).toBeDefined();
    });

    it("returns baseline status when no schedule exists", async () => {
      const response = await request(app)
        .get("/api/schedule/current")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.hasSchedule).toBe(false);
      expect(response.body.baselineStatus).toBeDefined();
      expect(response.body.baselineStatus.isComplete).toBeDefined();
    });
  });

  describe("Auth required", () => {
    it("GET /api/schedule/current requires authentication", async () => {
      await request(app)
        .get("/api/schedule/current")
        .expect(401);
    });

    it("GET /api/schedule/history requires authentication", async () => {
      await request(app)
        .get("/api/schedule/history")
        .expect(401);
    });

    it("GET /api/schedule/baseline-status requires authentication", async () => {
      await request(app)
        .get("/api/schedule/baseline-status")
        .expect(401);
    });

    it("POST /api/schedule/initialize requires authentication", async () => {
      await request(app)
        .post("/api/schedule/initialize")
        .expect(401);
    });
  });
});

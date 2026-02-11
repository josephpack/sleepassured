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
      name: "Diary Test User",
      email: "diary-test@example.com",
      passwordHash,
      onboardingCompleted: true,
      targetWakeTime: "07:00",
    },
  });
  userId = user.id;
  accessToken = generateAccessToken(userId);
});

// Helper to build a valid diary entry payload
function validDiaryPayload(dateOffset = 0) {
  const date = new Date();
  date.setDate(date.getDate() - dateOffset);
  const dateStr = date.toISOString().split("T")[0]!;

  const bedtime = new Date(`${dateStr}T23:00:00.000Z`);
  bedtime.setDate(bedtime.getDate() - 1); // night before

  const outOfBedTime = new Date(`${dateStr}T07:00:00.000Z`);
  const finalWakeTime = new Date(`${dateStr}T06:55:00.000Z`);

  return {
    date: dateStr,
    bedtime: bedtime.toISOString(),
    sleepOnsetLatencyMins: 15,
    numberOfAwakenings: 2,
    wakeAfterSleepOnsetMins: 20,
    finalWakeTime: finalWakeTime.toISOString(),
    outOfBedTime: outOfBedTime.toISOString(),
    subjectiveQuality: 7,
  };
}

describe("Diary API", () => {
  describe("POST /api/diary", () => {
    it("creates a valid diary entry", async () => {
      const payload = validDiaryPayload(0);

      const response = await request(app)
        .post("/api/diary")
        .set("Authorization", `Bearer ${accessToken}`)
        .send(payload)
        .expect(201);

      expect(response.body.entry).toBeDefined();
      expect(response.body.entry.userId).toBe(userId);
      expect(response.body.entry.sleepOnsetLatencyMins).toBe(15);
      expect(response.body.entry.numberOfAwakenings).toBe(2);
      expect(response.body.entry.timeInBedMins).toBeGreaterThan(0);
      expect(response.body.entry.totalSleepTimeMins).toBeGreaterThan(0);
      expect(Number(response.body.entry.sleepEfficiency)).toBeGreaterThan(0);
    });

    it("rejects missing required fields", async () => {
      const response = await request(app)
        .post("/api/diary")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ date: "2025-01-01" })
        .expect(400);

      expect(response.body.error).toBe("Validation failed");
    });

    it("rejects invalid date format", async () => {
      const payload = validDiaryPayload();
      payload.date = "not-a-date";

      const response = await request(app)
        .post("/api/diary")
        .set("Authorization", `Bearer ${accessToken}`)
        .send(payload)
        .expect(400);

      expect(response.body.error).toBe("Validation failed");
    });

    it("rejects entries older than 7 days (backfill limit)", async () => {
      const payload = validDiaryPayload(10);

      const response = await request(app)
        .post("/api/diary")
        .set("Authorization", `Bearer ${accessToken}`)
        .send(payload)
        .expect(400);

      expect(response.body.error).toContain("last 7 days");
    });

    it("rejects duplicate entries for the same date", async () => {
      const payload = validDiaryPayload(1);

      await request(app)
        .post("/api/diary")
        .set("Authorization", `Bearer ${accessToken}`)
        .send(payload)
        .expect(201);

      const response = await request(app)
        .post("/api/diary")
        .set("Authorization", `Bearer ${accessToken}`)
        .send(payload)
        .expect(409);

      expect(response.body.error).toContain("already exists");
    });
  });

  describe("GET /api/diary", () => {
    it("returns only the authenticated user's entries", async () => {
      // Create entry for test user
      await request(app)
        .post("/api/diary")
        .set("Authorization", `Bearer ${accessToken}`)
        .send(validDiaryPayload(1));

      // Create another user with an entry
      const otherHash = await hashPassword("password123");
      const otherUser = await prisma.user.create({
        data: {
          name: "Other User",
          email: "other@example.com",
          passwordHash: otherHash,
          onboardingCompleted: true,
        },
      });
      const otherToken = generateAccessToken(otherUser.id);
      await request(app)
        .post("/api/diary")
        .set("Authorization", `Bearer ${otherToken}`)
        .send(validDiaryPayload(2));

      // Fetch test user's entries
      const response = await request(app)
        .get("/api/diary")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.entries).toHaveLength(1);
      expect(response.body.entries[0].userId).toBe(userId);
    });
  });

  describe("Auth required", () => {
    it("POST /api/diary requires authentication", async () => {
      await request(app)
        .post("/api/diary")
        .send(validDiaryPayload())
        .expect(401);
    });

    it("GET /api/diary requires authentication", async () => {
      await request(app)
        .get("/api/diary")
        .expect(401);
    });
  });
});

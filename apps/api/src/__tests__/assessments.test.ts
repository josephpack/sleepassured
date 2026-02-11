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
      name: "Assessment Test User",
      email: "assessment-test@example.com",
      passwordHash,
      onboardingCompleted: true,
    },
  });
  userId = user.id;
  accessToken = generateAccessToken(userId);
});

describe("Assessments API", () => {
  describe("POST /api/assessments/isi", () => {
    it("creates ISI assessment with correct score calculation", async () => {
      const responses = [2, 3, 2, 3, 2, 1, 2]; // total = 15

      const response = await request(app)
        .post("/api/assessments/isi")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ responses })
        .expect(201);

      expect(response.body.assessment).toBeDefined();
      expect(response.body.assessment.score).toBe(15);
      expect(response.body.assessment.severity).toBe("moderate");
      expect(response.body.assessment.id).toBeDefined();
    });

    it("rejects invalid responses (wrong length)", async () => {
      const response = await request(app)
        .post("/api/assessments/isi")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ responses: [1, 2, 3] }) // only 3 responses
        .expect(400);

      expect(response.body.error).toBe("Validation failed");
    });

    it("rejects responses with out-of-range values", async () => {
      const response = await request(app)
        .post("/api/assessments/isi")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ responses: [1, 2, 5, 1, 1, 1, 1] }) // 5 is > max of 4
        .expect(400);

      expect(response.body.error).toBe("Validation failed");
    });

    it("rejects missing responses field", async () => {
      const response = await request(app)
        .post("/api/assessments/isi")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({})
        .expect(400);

      expect(response.body.error).toBe("Validation failed");
    });

    it("requires authentication", async () => {
      await request(app)
        .post("/api/assessments/isi")
        .send({ responses: [1, 1, 1, 1, 1, 1, 1] })
        .expect(401);
    });
  });

  describe("ISI score severity ranges", () => {
    it("classifies score 0-7 as none (minimal)", async () => {
      const responses = [1, 1, 1, 1, 0, 0, 0]; // total = 4

      const response = await request(app)
        .post("/api/assessments/isi")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ responses })
        .expect(201);

      expect(response.body.assessment.score).toBe(4);
      expect(response.body.assessment.severity).toBe("none");
    });

    it("classifies score 8-14 as subthreshold", async () => {
      const responses = [2, 2, 1, 1, 1, 1, 2]; // total = 10

      const response = await request(app)
        .post("/api/assessments/isi")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ responses })
        .expect(201);

      expect(response.body.assessment.score).toBe(10);
      expect(response.body.assessment.severity).toBe("subthreshold");
    });

    it("classifies score 15-21 as moderate", async () => {
      const responses = [3, 3, 3, 3, 3, 3, 3]; // total = 21

      const response = await request(app)
        .post("/api/assessments/isi")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ responses })
        .expect(201);

      expect(response.body.assessment.score).toBe(21);
      expect(response.body.assessment.severity).toBe("moderate");
    });

    it("classifies score 22-28 as severe", async () => {
      const responses = [4, 4, 4, 4, 4, 4, 4]; // total = 28

      const response = await request(app)
        .post("/api/assessments/isi")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ responses })
        .expect(201);

      expect(response.body.assessment.score).toBe(28);
      expect(response.body.assessment.severity).toBe("severe");
    });
  });
});

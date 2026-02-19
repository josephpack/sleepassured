import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { prisma } from "@sleepassured/db";
import app from "../index.js";
import { hashPassword } from "../lib/password.js";

describe("Auth API", () => {
  const testUser = {
    name: "Test User",
    email: "test@example.com",
    password: "password123",
  };

  describe("POST /api/auth/signup", () => {
    it("creates a user and returns tokens", async () => {
      const response = await request(app)
        .post("/api/auth/signup")
        .send(testUser)
        .expect(201);

      expect(response.body.user).toMatchObject({
        name: testUser.name,
        email: testUser.email,
        onboardingCompleted: false,
      });
      expect(response.body.user.id).toBeDefined();
      expect(response.body.accessToken).toBeDefined();
      expect(response.body.refreshToken).toBeDefined();

      const cookies = response.headers["set-cookie"] as string[] | undefined;
      expect(cookies).toBeDefined();
      expect(cookies![0]).toContain("refreshToken");
    });

    it("fails with duplicate email", async () => {
      // Create user first
      await request(app).post("/api/auth/signup").send(testUser);

      // Try to create again
      const response = await request(app)
        .post("/api/auth/signup")
        .send(testUser)
        .expect(409);

      expect(response.body.error).toBe("Email already registered");
    });

    it("fails with weak password", async () => {
      const response = await request(app)
        .post("/api/auth/signup")
        .send({ ...testUser, password: "short" })
        .expect(400);

      expect(response.body.error).toBe("Validation failed");
      expect(response.body.details.password).toBeDefined();
    });

    it("fails with invalid email", async () => {
      const response = await request(app)
        .post("/api/auth/signup")
        .send({ ...testUser, email: "invalid-email" })
        .expect(400);

      expect(response.body.error).toBe("Validation failed");
      expect(response.body.details.email).toBeDefined();
    });

    it("fails with missing name", async () => {
      const response = await request(app)
        .post("/api/auth/signup")
        .send({ email: testUser.email, password: testUser.password })
        .expect(400);

      expect(response.body.error).toBe("Validation failed");
      expect(response.body.details.name).toBeDefined();
    });
  });

  describe("POST /api/auth/login", () => {
    beforeEach(async () => {
      // Create a test user
      const passwordHash = await hashPassword(testUser.password);
      await prisma.user.create({
        data: {
          name: testUser.name,
          email: testUser.email,
          passwordHash,
        },
      });
    });

    it("succeeds with valid credentials", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({ email: testUser.email, password: testUser.password })
        .expect(200);

      expect(response.body.user).toMatchObject({
        name: testUser.name,
        email: testUser.email,
      });
      expect(response.body.accessToken).toBeDefined();
      expect(response.headers["set-cookie"]).toBeDefined();
    });

    it("fails with wrong password", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({ email: testUser.email, password: "wrongpassword" })
        .expect(401);

      expect(response.body.error).toBe("Invalid email or password");
    });

    it("fails with non-existent email", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({ email: "nonexistent@example.com", password: "password123" })
        .expect(401);

      expect(response.body.error).toBe("Invalid email or password");
    });

    it("normalizes email to lowercase", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({ email: "TEST@EXAMPLE.COM", password: testUser.password })
        .expect(200);

      expect(response.body.user.email).toBe(testUser.email);
    });
  });

  describe("POST /api/auth/logout", () => {
    it("clears refresh token cookie", async () => {
      // First login to get a token
      const loginResponse = await request(app)
        .post("/api/auth/signup")
        .send(testUser);

      const cookies = loginResponse.headers["set-cookie"];
      expect(cookies).toBeDefined();
      const cookiesArray = Array.isArray(cookies) ? cookies : [cookies!];

      // Then logout
      const response = await request(app)
        .post("/api/auth/logout")
        .set("Cookie", cookiesArray)
        .expect(200);

      expect(response.body.message).toBe("Logged out successfully");
      // Check cookie is cleared
      const setCookie = (response.headers["set-cookie"] as string[] | undefined)?.[0];
      expect(setCookie).toContain("refreshToken=;");
    });

    it("succeeds even without a token", async () => {
      const response = await request(app)
        .post("/api/auth/logout")
        .expect(200);

      expect(response.body.message).toBe("Logged out successfully");
    });
  });

  describe("POST /api/auth/refresh", () => {
    it("returns new access token with valid refresh token", async () => {
      // First signup to get tokens
      const signupResponse = await request(app)
        .post("/api/auth/signup")
        .send(testUser);

      const cookies = signupResponse.headers["set-cookie"];
      expect(cookies).toBeDefined();
      const cookiesArray = Array.isArray(cookies) ? cookies : [cookies!];

      // Request new access token
      const response = await request(app)
        .post("/api/auth/refresh")
        .set("Cookie", cookiesArray)
        .expect(200);

      expect(response.body.accessToken).toBeDefined();
    });

    it("returns new access token with refresh token in request body", async () => {
      // First signup to get tokens
      const signupResponse = await request(app)
        .post("/api/auth/signup")
        .send(testUser);

      const { refreshToken } = signupResponse.body;
      expect(refreshToken).toBeDefined();

      // Request new access token via body (PWA fallback)
      const response = await request(app)
        .post("/api/auth/refresh")
        .send({ refreshToken })
        .expect(200);

      expect(response.body.accessToken).toBeDefined();
      expect(response.body.refreshToken).toBeDefined();
    });

    it("fails without refresh token", async () => {
      const response = await request(app)
        .post("/api/auth/refresh")
        .expect(401);

      expect(response.body.error).toBe("No refresh token provided");
    });

    it("fails with invalid refresh token", async () => {
      const response = await request(app)
        .post("/api/auth/refresh")
        .set("Cookie", ["refreshToken=invalid-token"])
        .expect(401);

      expect(response.body.error).toBe("Invalid refresh token");
    });
  });

  describe("GET /api/auth/me", () => {
    it("returns current user with valid access token", async () => {
      // First signup to get tokens
      const signupResponse = await request(app)
        .post("/api/auth/signup")
        .send(testUser);

      const { accessToken } = signupResponse.body;

      // Get current user
      const response = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.user).toMatchObject({
        name: testUser.name,
        email: testUser.email,
        onboardingCompleted: false,
      });
    });

    it("fails without access token", async () => {
      const response = await request(app).get("/api/auth/me").expect(401);

      expect(response.body.error).toBe("No token provided");
    });

    it("fails with invalid access token", async () => {
      const response = await request(app)
        .get("/api/auth/me")
        .set("Authorization", "Bearer invalid-token")
        .expect(401);

      expect(response.body.error).toBe("Invalid or expired token");
    });
  });

  describe("Session expiry", () => {
    it("creates refresh token with 90-day expiry", async () => {
      const response = await request(app)
        .post("/api/auth/signup")
        .send({ ...testUser })
        .expect(201);

      // Check that the cookie has a 90-day max age
      const cookies = response.headers["set-cookie"];
      expect(cookies).toBeDefined();
      const cookieStr = Array.isArray(cookies) ? cookies[0] : cookies!;
      expect(cookieStr).toContain("Max-Age=7776000"); // 90 days in seconds
    });
  });
});

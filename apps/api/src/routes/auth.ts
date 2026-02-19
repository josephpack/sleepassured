import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "@sleepassured/db";
import logger from "../lib/logger.js";
import { hashPassword, verifyPassword } from "../lib/password.js";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  getRefreshTokenExpiry,
} from "../lib/jwt.js";
import { authenticate } from "../middleware/auth.js";
import { authRateLimiter, refreshRateLimiter } from "../middleware/rateLimit.js";

const router = Router();

// Validation schemas
const signupSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  rememberMe: z.boolean().optional().default(false),
});

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean().optional().default(false),
});

// Cookie configuration
const getCookieOptions = (rememberMe: boolean) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 90 * 24 * 60 * 60 * 1000,
  path: "/",
});

// POST /api/auth/signup
router.post("/signup", authRateLimiter, async (req: Request, res: Response) => {
  try {
    const result = signupSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        error: "Validation failed",
        details: result.error.flatten().fieldErrors,
      });
      return;
    }

    const { name, email, password, rememberMe } = result.data;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      res.status(409).json({ error: "Email already registered" });
      return;
    }

    // Hash password and create user
    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        passwordHash,
      },
      select: {
        id: true,
        name: true,
        email: true,
        onboardingCompleted: true,
        isAdmin: true,
      },
    });

    // Generate tokens
    const accessToken = generateAccessToken(user.id);
    const refreshToken = generateRefreshToken(user.id, rememberMe);

    // Store refresh token in database
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: getRefreshTokenExpiry(rememberMe),
      },
    });

    // Set refresh token as HTTP-only cookie
    res.cookie("refreshToken", refreshToken, getCookieOptions(rememberMe));

    res.status(201).json({
      user,
      accessToken,
    });
  } catch (error) {
    logger.error({ err: error }, "Signup error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/auth/login
router.post("/login", authRateLimiter, async (req: Request, res: Response) => {
  try {
    const result = loginSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        error: "Validation failed",
        details: result.error.flatten().fieldErrors,
      });
      return;
    }

    const { email, password, rememberMe } = result.data;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user || !user.passwordHash) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    // Verify password
    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    // Generate tokens
    const accessToken = generateAccessToken(user.id);
    const refreshToken = generateRefreshToken(user.id, rememberMe);

    // Store refresh token in database
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: getRefreshTokenExpiry(rememberMe),
      },
    });

    // Set refresh token as HTTP-only cookie
    res.cookie("refreshToken", refreshToken, getCookieOptions(rememberMe));

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        onboardingCompleted: user.onboardingCompleted,
        isAdmin: user.isAdmin,
      },
      accessToken,
    });
  } catch (error) {
    logger.error({ err: error }, "Login error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/auth/logout
router.post("/logout", async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies?.refreshToken;

    if (refreshToken) {
      // Delete refresh token from database
      await prisma.refreshToken.deleteMany({
        where: { token: refreshToken },
      });
    }

    // Clear the cookie
    res.clearCookie("refreshToken", { path: "/" });
    res.json({ message: "Logged out successfully" });
  } catch (error) {
    logger.error({ err: error }, "Logout error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/auth/refresh
router.post("/refresh", refreshRateLimiter, async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
      res.status(401).json({ error: "No refresh token provided" });
      return;
    }

    // Verify the token signature
    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch {
      res.clearCookie("refreshToken", { path: "/" });
      res.status(401).json({ error: "Invalid refresh token" });
      return;
    }

    // Check if token exists in database and is not expired
    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
    });

    if (!storedToken || storedToken.expiresAt < new Date()) {
      if (storedToken) {
        await prisma.refreshToken.delete({
          where: { id: storedToken.id },
        });
      }
      res.clearCookie("refreshToken", { path: "/" });
      res.status(401).json({ error: "Refresh token expired or revoked" });
      return;
    }

    // Rotate refresh token (sliding expiry — resets the clock each time)
    const newRefreshToken = generateRefreshToken(decoded.userId);
    await prisma.$transaction([
      prisma.refreshToken.delete({ where: { id: storedToken.id } }),
      prisma.refreshToken.create({
        data: {
          token: newRefreshToken,
          userId: decoded.userId,
          expiresAt: getRefreshTokenExpiry(),
        },
      }),
    ]);
    res.cookie("refreshToken", newRefreshToken, getCookieOptions(false));

    // Generate new access token
    const accessToken = generateAccessToken(decoded.userId);

    res.json({ accessToken });
  } catch (error) {
    logger.error({ err: error }, "Refresh error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/auth/me
router.get("/me", authenticate, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true,
        name: true,
        email: true,
        onboardingCompleted: true,
        targetWakeTime: true,
        isAdmin: true,
      },
    });

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json({ user });
  } catch (error) {
    logger.error({ err: error }, "Get user error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

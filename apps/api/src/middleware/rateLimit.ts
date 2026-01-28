import rateLimit from "express-rate-limit";

const isTest = process.env.NODE_ENV === "test";

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isTest ? 1000 : 10, // Disable effective rate limiting in tests
  message: { error: "Too many requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

export const refreshRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: isTest ? 1000 : 5, // Disable effective rate limiting in tests
  message: { error: "Too many refresh attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

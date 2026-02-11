import { beforeAll, afterAll, afterEach } from "vitest";
import { prisma } from "@sleepassured/db";

beforeAll(async () => {
  // Set test environment
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET = "test-jwt-secret";
  process.env.JWT_REFRESH_SECRET = "test-jwt-refresh-secret";
});

afterEach(async () => {
  // Clean up test data after each test (order matters for FK constraints)
  await prisma.whoopSleepRecord.deleteMany();
  await prisma.whoopConnection.deleteMany();
  await prisma.sleepWindow.deleteMany();
  await prisma.sleepDiary.deleteMany();
  await prisma.iSIAssessment.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

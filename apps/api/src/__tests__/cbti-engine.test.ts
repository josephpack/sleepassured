import { describe, it, expect } from "vitest";
import { prisma } from "@sleepassured/db";
import { hashPassword } from "../lib/password.js";
import {
  calculateBedtime,
  calculateWeeklyAdjustment,
  calculateBaselineSleepWindow,
  calculateAdherencePercentage,
  getBaselineStatus,
} from "../services/cbti-engine.js";

// Helper to create a test user with baseline complete and a target wake time
async function createTestUser(overrides: {
  targetWakeTime?: string;
  baselineComplete?: boolean;
  therapyStartDate?: Date | null;
} = {}) {
  const passwordHash = await hashPassword("password123");
  return prisma.user.create({
    data: {
      name: "Test User",
      email: `test-${Date.now()}@example.com`,
      passwordHash,
      onboardingCompleted: true,
      targetWakeTime: overrides.targetWakeTime ?? "07:00",
      baselineComplete: overrides.baselineComplete ?? true,
      therapyStartDate: overrides.therapyStartDate !== undefined
        ? overrides.therapyStartDate
        : new Date(),
    },
  });
}

// Helper to create diary entries for the past N days
async function createDiaryEntries(
  userId: string,
  count: number,
  opts: {
    sleepEfficiency?: number;
    timeInBedMins?: number;
    startDaysAgo?: number;
    bedtimeHour?: number;
    wakeHour?: number;
  } = {}
) {
  const efficiency = opts.sleepEfficiency ?? 85;
  const tib = opts.timeInBedMins ?? 480;
  const startDaysAgo = opts.startDaysAgo ?? count;
  const bedtimeHour = opts.bedtimeHour ?? 23;
  const wakeHour = opts.wakeHour ?? 7;

  const entries = [];
  for (let i = 0; i < count; i++) {
    const date = new Date();
    date.setDate(date.getDate() - (startDaysAgo - i));
    date.setHours(0, 0, 0, 0);

    const bedtime = new Date(date);
    bedtime.setHours(bedtimeHour, 0, 0, 0);
    if (bedtimeHour >= 12) {
      // Bedtime is the night before
      bedtime.setDate(bedtime.getDate() - 1);
    }

    const outOfBedTime = new Date(date);
    outOfBedTime.setHours(wakeHour, 0, 0, 0);

    const tst = Math.round((efficiency / 100) * tib);
    const sol = 15;
    const waso = tib - tst - sol;

    const finalWakeTime = new Date(outOfBedTime);
    finalWakeTime.setMinutes(finalWakeTime.getMinutes() - 5);

    entries.push(
      prisma.sleepDiary.create({
        data: {
          userId,
          date,
          bedtime,
          sleepOnsetLatencyMins: sol,
          numberOfAwakenings: 1,
          wakeAfterSleepOnsetMins: Math.max(0, waso),
          finalWakeTime,
          outOfBedTime,
          subjectiveQuality: 7,
          totalSleepTimeMins: tst,
          timeInBedMins: tib,
          sleepEfficiency: efficiency,
          source: "MANUAL",
        },
      })
    );
  }
  return Promise.all(entries);
}

// Helper to create a sleep window
async function createSleepWindow(
  userId: string,
  opts: {
    timeInBedMins?: number;
    prescribedBedtime?: string;
    prescribedWakeTime?: string;
    daysAgo?: number;
  } = {}
) {
  const weekStartDate = new Date();
  weekStartDate.setDate(weekStartDate.getDate() - (opts.daysAgo ?? 7));
  weekStartDate.setHours(0, 0, 0, 0);

  return prisma.sleepWindow.create({
    data: {
      userId,
      weekStartDate,
      prescribedBedtime: opts.prescribedBedtime ?? "23:00",
      prescribedWakeTime: opts.prescribedWakeTime ?? "07:00",
      timeInBedMins: opts.timeInBedMins ?? 480,
      adjustmentMade: "BASELINE",
    },
  });
}

// ─── calculateBedtime (pure function, no DB) ────────────────────────────

describe("calculateBedtime", () => {
  it("calculates standard bedtime: wake 07:00, 480min TIB → 23:00", () => {
    expect(calculateBedtime("07:00", 480)).toBe("23:00");
  });

  it("handles day boundary crossing: wake 06:00, 420min TIB → 23:00", () => {
    expect(calculateBedtime("06:00", 420)).toBe("23:00");
  });

  it("calculates exactly midnight bedtime: wake 08:00, 480min TIB → 00:00", () => {
    expect(calculateBedtime("08:00", 480)).toBe("00:00");
  });

  it("handles minimum TIB (300min): wake 07:00 → 02:00", () => {
    expect(calculateBedtime("07:00", 300)).toBe("02:00");
  });

  it("handles maximum TIB (540min): wake 07:00 → 22:00", () => {
    expect(calculateBedtime("07:00", 540)).toBe("22:00");
  });

  it("handles wake time with minutes: wake 06:30, 450min TIB → 23:00", () => {
    expect(calculateBedtime("06:30", 450)).toBe("23:00");
  });

  it("handles early wake time: wake 05:00, 420min TIB → 22:00", () => {
    expect(calculateBedtime("05:00", 420)).toBe("22:00");
  });
});

// ─── calculateWeeklyAdjustment (DB-dependent) ──────────────────────────

describe("calculateWeeklyAdjustment", () => {
  it("increases TIB by 15min when SE >= 85%", async () => {
    const user = await createTestUser();
    await createSleepWindow(user.id, { timeInBedMins: 420 });
    await createDiaryEntries(user.id, 7, { sleepEfficiency: 90, timeInBedMins: 420 });

    const result = await calculateWeeklyAdjustment(user.id, new Date());

    expect(result.status).toBe("success");
    expect(result.action).toBe("increase");
    expect(result.newTIB).toBe(435);
  });

  it("maintains TIB when SE is 80-84%", async () => {
    const user = await createTestUser();
    await createSleepWindow(user.id, { timeInBedMins: 420 });
    await createDiaryEntries(user.id, 7, { sleepEfficiency: 82, timeInBedMins: 420 });

    const result = await calculateWeeklyAdjustment(user.id, new Date());

    expect(result.status).toBe("success");
    expect(result.action).toBe("maintain");
    expect(result.newTIB).toBe(420);
  });

  it("decreases TIB by 15min when SE < 80%", async () => {
    const user = await createTestUser();
    await createSleepWindow(user.id, { timeInBedMins: 420 });
    await createDiaryEntries(user.id, 7, { sleepEfficiency: 75, timeInBedMins: 420 });

    const result = await calculateWeeklyAdjustment(user.id, new Date());

    expect(result.status).toBe("success");
    expect(result.action).toBe("decrease");
    expect(result.newTIB).toBe(405);
  });

  it("flags user for review when SE < 70%", async () => {
    const user = await createTestUser();
    await createSleepWindow(user.id, { timeInBedMins: 420 });
    await createDiaryEntries(user.id, 7, { sleepEfficiency: 65, timeInBedMins: 420 });

    const result = await calculateWeeklyAdjustment(user.id, new Date());

    expect(result.status).toBe("success");
    expect(result.flagged).toBe(true);
    expect(result.flagReason).toContain("Persistent low SE");

    // Verify user is flagged in DB
    const updatedUser = await prisma.user.findUnique({ where: { id: user.id } });
    expect(updatedUser?.flaggedForReview).toBe(true);
  });

  it("caps TIB at 540min (won't exceed max)", async () => {
    const user = await createTestUser();
    await createSleepWindow(user.id, { timeInBedMins: 540 });
    await createDiaryEntries(user.id, 7, { sleepEfficiency: 90, timeInBedMins: 540 });

    const result = await calculateWeeklyAdjustment(user.id, new Date());

    expect(result.status).toBe("success");
    expect(result.newTIB).toBe(540);
    // When at max and SE >= 85%, action becomes "maintain" since newTIB can't increase
    expect(result.action).toBe("maintain");
  });

  it("floors TIB at 300min (won't go below min)", async () => {
    const user = await createTestUser();
    await createSleepWindow(user.id, { timeInBedMins: 300 });
    await createDiaryEntries(user.id, 7, { sleepEfficiency: 75, timeInBedMins: 300 });

    const result = await calculateWeeklyAdjustment(user.id, new Date());

    expect(result.status).toBe("success");
    expect(result.newTIB).toBe(300);
    // When at min and SE < 80%, action becomes "maintain" since newTIB can't decrease
    expect(result.action).toBe("maintain");
  });

  it("returns insufficient_data with fewer than 5 entries", async () => {
    const user = await createTestUser();
    await createSleepWindow(user.id, { timeInBedMins: 420 });
    await createDiaryEntries(user.id, 3, { sleepEfficiency: 85, timeInBedMins: 420 });

    const result = await calculateWeeklyAdjustment(user.id, new Date());

    expect(result.status).toBe("insufficient_data");
    expect(result.entriesNeeded).toBe(2);
  });

  it("falls back to baseline calculation when no existing window", async () => {
    const user = await createTestUser();
    await createDiaryEntries(user.id, 7, { sleepEfficiency: 85, timeInBedMins: 480 });

    const result = await calculateWeeklyAdjustment(user.id, new Date());

    // Should fall back to calculateBaselineSleepWindow
    expect(result.status).toBe("success");
    expect(result.action).toBe("baseline");
  });
});

// ─── calculateBaselineSleepWindow ───────────────────────────────────────

describe("calculateBaselineSleepWindow", () => {
  it("calculates initial sleep window from baseline entries", async () => {
    const user = await createTestUser();
    await createDiaryEntries(user.id, 7, { sleepEfficiency: 85, timeInBedMins: 480 });

    const result = await calculateBaselineSleepWindow(user.id);

    expect(result.status).toBe("success");
    expect(result.action).toBe("baseline");
    expect(result.newTIB).toBeGreaterThanOrEqual(300);
    expect(result.newTIB).toBeLessThanOrEqual(540);
    expect(result.feedbackMessage).toBeDefined();
  });

  it("returns error when user has no target wake time", async () => {
    const user = await createTestUser({ targetWakeTime: undefined });
    // Update user to remove wake time
    await prisma.user.update({
      where: { id: user.id },
      data: { targetWakeTime: null },
    });

    const result = await calculateBaselineSleepWindow(user.id);

    expect(result.status).toBe("error");
    expect(result.error).toContain("no target wake time");
  });

  it("returns error when baseline week not complete", async () => {
    const user = await createTestUser({ baselineComplete: false });

    const result = await calculateBaselineSleepWindow(user.id);

    expect(result.status).toBe("error");
    expect(result.error).toContain("Baseline week not yet complete");
  });

  it("returns insufficient_data with fewer than 5 entries", async () => {
    const user = await createTestUser();
    await createDiaryEntries(user.id, 3, { sleepEfficiency: 85 });

    const result = await calculateBaselineSleepWindow(user.id);

    expect(result.status).toBe("insufficient_data");
    expect(result.entriesNeeded).toBe(2);
  });

  it("uses tighter window when baseline efficiency < 75%", async () => {
    const user = await createTestUser();
    await createDiaryEntries(user.id, 7, { sleepEfficiency: 65, timeInBedMins: 480 });

    const result = await calculateBaselineSleepWindow(user.id);

    expect(result.status).toBe("success");
    // With low efficiency, TIB should be based on avgTST + 30, which is less than 480
    expect(result.newTIB!).toBeLessThan(480);
  });

  it("flags user when baseline SE < 70%", async () => {
    const user = await createTestUser();
    await createDiaryEntries(user.id, 7, { sleepEfficiency: 60, timeInBedMins: 480 });

    const result = await calculateBaselineSleepWindow(user.id);

    expect(result.status).toBe("success");
    expect(result.flagged).toBe(true);

    const updatedUser = await prisma.user.findUnique({ where: { id: user.id } });
    expect(updatedUser?.flaggedForReview).toBe(true);
  });

  it("clamps TIB to min/max range", async () => {
    const user = await createTestUser();
    // Very high efficiency with large TIB — should clamp to 540
    await createDiaryEntries(user.id, 7, { sleepEfficiency: 95, timeInBedMins: 600 });

    const result = await calculateBaselineSleepWindow(user.id);

    expect(result.status).toBe("success");
    expect(result.newTIB).toBeLessThanOrEqual(540);
    expect(result.newTIB).toBeGreaterThanOrEqual(300);
  });
});

// ─── calculateAdherencePercentage ───────────────────────────────────────

describe("calculateAdherencePercentage", () => {
  it("returns 100% when all entries within ±30min tolerance", async () => {
    const user = await createTestUser();
    await createSleepWindow(user.id, {
      prescribedBedtime: "23:00",
      prescribedWakeTime: "07:00",
    });
    // Create entries with matching times (23:00 bedtime, 07:00 wake)
    await createDiaryEntries(user.id, 5, {
      bedtimeHour: 23,
      wakeHour: 7,
    });

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
    const endDate = new Date();

    const adherence = await calculateAdherencePercentage(user.id, startDate, endDate);

    expect(adherence).toBe(100);
  });

  it("returns 0% when all entries outside tolerance", async () => {
    const user = await createTestUser();
    await createSleepWindow(user.id, {
      prescribedBedtime: "23:00",
      prescribedWakeTime: "07:00",
    });
    // Create entries with very different times (20:00 bedtime, 4:00 wake)
    await createDiaryEntries(user.id, 5, {
      bedtimeHour: 20,
      wakeHour: 4,
    });

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
    const endDate = new Date();

    const adherence = await calculateAdherencePercentage(user.id, startDate, endDate);

    expect(adherence).toBe(0);
  });

  it("returns null when no entries exist", async () => {
    const user = await createTestUser();
    await createSleepWindow(user.id);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
    const endDate = new Date();

    const adherence = await calculateAdherencePercentage(user.id, startDate, endDate);

    expect(adherence).toBeNull();
  });

  it("returns null when no sleep window exists", async () => {
    const user = await createTestUser();

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
    const endDate = new Date();

    const adherence = await calculateAdherencePercentage(user.id, startDate, endDate);

    expect(adherence).toBeNull();
  });
});

// ─── getBaselineStatus ──────────────────────────────────────────────────

describe("getBaselineStatus", () => {
  it("returns 0 entries logged for new user", async () => {
    const user = await createTestUser({ baselineComplete: false, therapyStartDate: null });

    const status = await getBaselineStatus(user.id);

    expect(status.entriesLogged).toBe(0);
    expect(status.entriesNeeded).toBe(5);
    expect(status.isComplete).toBe(false);
    expect(status.message).toContain("Start logging");
  });

  it("returns partial progress", async () => {
    const user = await createTestUser({ baselineComplete: false });
    await createDiaryEntries(user.id, 3, { sleepEfficiency: 85 });

    const status = await getBaselineStatus(user.id);

    expect(status.entriesLogged).toBe(3);
    expect(status.entriesNeeded).toBe(2);
    expect(status.isComplete).toBe(false);
    expect(status.message).toContain("2 more");
  });

  it("returns complete when baseline is already marked complete", async () => {
    const user = await createTestUser({ baselineComplete: true });

    const status = await getBaselineStatus(user.id);

    expect(status.isComplete).toBe(true);
    expect(status.entriesNeeded).toBe(0);
    expect(status.message).toContain("complete");
  });

  it("returns complete when 5+ entries exist", async () => {
    const user = await createTestUser({ baselineComplete: false });
    await createDiaryEntries(user.id, 6, { sleepEfficiency: 85 });

    const status = await getBaselineStatus(user.id);

    expect(status.entriesLogged).toBe(6);
    expect(status.entriesNeeded).toBe(0);
    expect(status.isComplete).toBe(true);
  });
});

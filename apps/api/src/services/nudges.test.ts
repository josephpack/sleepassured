import { describe, it, expect } from "vitest";
import type { SleepDataContext } from "./chat.js";
import {
  generateNudges,
  generateConversationStarters,
  detectPatterns,
} from "./nudges.js";

// Helper to create a minimal SleepDataContext
function makeContext(overrides: Partial<SleepDataContext> = {}): SleepDataContext {
  return {
    userName: "Test User",
    currentSchedule: {
      prescribedBedtime: "23:00",
      prescribedWakeTime: "06:00",
      timeInBedMins: 420,
      weekStartDate: new Date(),
    },
    recentDiaryEntries: [],
    avgSleepEfficiency: null,
    avgTotalSleepTime: null,
    avgSubjectiveQuality: null,
    entriesCount: 0,
    hasWhoopConnection: false,
    recentRecoveryScores: [],
    avgRecoveryScore: null,
    weekNumber: 1,
    baselineComplete: true,
    isFlagged: false,
    latestISIScore: null,
    latestISISeverity: null,
    ...overrides,
  };
}

function makeDiaryEntry(
  daysAgo: number,
  efficiency: number | null
) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return {
    date,
    bedtime: "23:00",
    finalWakeTime: "06:00",
    outOfBedTime: "06:15",
    sleepOnsetLatencyMins: 15,
    wakeAfterSleepOnsetMins: 20,
    totalSleepTimeMins: 360,
    sleepEfficiency: efficiency,
    subjectiveQuality: 5,
    source: "manual",
  };
}

describe("generateNudges", () => {
  it("always returns at least 1 nudge", () => {
    const ctx = makeContext();
    const result = generateNudges(ctx, 1);
    expect(result.dailyNudge).toBeTruthy();
    expect(result.dailyNudge.message).toBeTruthy();
    expect(result.allNudges.length).toBeGreaterThanOrEqual(1);
  });

  it("returns flagged_for_review as highest priority when flagged", () => {
    const ctx = makeContext({ isFlagged: true });
    const result = generateNudges(ctx, 3);
    expect(result.dailyNudge.id).toBe("flagged_for_review");
  });

  it("returns first_day_new_schedule on schedule start date", () => {
    const today = new Date();
    const ctx = makeContext({
      currentSchedule: {
        prescribedBedtime: "23:30",
        prescribedWakeTime: "06:00",
        timeInBedMins: 390,
        weekStartDate: today,
      },
    });
    const result = generateNudges(ctx, 2);
    expect(result.allNudges.some((n) => n.id === "first_day_new_schedule")).toBe(true);
  });

  it("returns declining_efficiency when recent efficiency is lower", () => {
    // 6+ entries with declining trend (older entries better than recent)
    const entries = [
      makeDiaryEntry(0, 65),
      makeDiaryEntry(1, 68),
      makeDiaryEntry(2, 66),
      makeDiaryEntry(7, 80),
      makeDiaryEntry(8, 82),
      makeDiaryEntry(9, 79),
    ];
    const ctx = makeContext({
      recentDiaryEntries: entries,
      entriesCount: 6,
      avgSleepEfficiency: 73,
      weekNumber: 2,
    });
    const result = generateNudges(ctx, 2);
    expect(result.allNudges.some((n) => n.id === "declining_efficiency")).toBe(true);
  });

  it("returns early_programme_normalise for weeks 1-3", () => {
    const ctx = makeContext({ weekNumber: 1 });
    const result = generateNudges(ctx, 1);
    expect(result.allNudges.some((n) => n.id === "early_programme_normalise")).toBe(true);
  });

  it("returns high_efficiency_praise when efficiency >= 85", () => {
    const ctx = makeContext({ avgSleepEfficiency: 88, weekNumber: 5 });
    const result = generateNudges(ctx, 5);
    expect(result.allNudges.some((n) => n.id === "high_efficiency_praise")).toBe(true);
  });

  it("returns low_efficiency_support when efficiency < 70", () => {
    const ctx = makeContext({ avgSleepEfficiency: 62, weekNumber: 4 });
    const result = generateNudges(ctx, 4);
    expect(result.allNudges.some((n) => n.id === "low_efficiency_support")).toBe(true);
  });

  it("returns curriculum fallback when no rules match", () => {
    // A context designed to match no rules (post-early, no entries, not flagged, etc.)
    const ctx = makeContext({
      weekNumber: 5,
      currentSchedule: null,
      entriesCount: 14,
      avgSleepEfficiency: 80,
      isFlagged: false,
      recentDiaryEntries: [makeDiaryEntry(0, 80)], // has today's entry
    });
    const result = generateNudges(ctx, 5);
    expect(result.dailyNudge).toBeTruthy();
    expect(result.dailyNudge.message.length).toBeGreaterThan(10);
  });

  it("includes schedule times in first_day_new_schedule nudge", () => {
    const today = new Date();
    const ctx = makeContext({
      currentSchedule: {
        prescribedBedtime: "23:30",
        prescribedWakeTime: "06:00",
        timeInBedMins: 390,
        weekStartDate: today,
      },
    });
    const result = generateNudges(ctx, 2);
    const nudge = result.allNudges.find((n) => n.id === "first_day_new_schedule");
    expect(nudge?.message).toContain("23:30");
    expect(nudge?.message).toContain("06:00");
  });
});

describe("generateConversationStarters", () => {
  it("always returns at least 3 starters", () => {
    const ctx = makeContext();
    const starters = generateConversationStarters(ctx, 1);
    expect(starters.length).toBeGreaterThanOrEqual(3);
  });

  it("returns at most 5 starters", () => {
    // A context that matches many rules
    const ctx = makeContext({
      avgSleepEfficiency: 60,
      isFlagged: true,
      weekNumber: 5,
      recentDiaryEntries: [makeDiaryEntry(0, 60)],
    });
    const starters = generateConversationStarters(ctx, 5);
    expect(starters.length).toBeLessThanOrEqual(5);
  });

  it("each starter has id, label, and message", () => {
    const ctx = makeContext();
    const starters = generateConversationStarters(ctx, 3);
    for (const starter of starters) {
      expect(starter.id).toBeTruthy();
      expect(starter.label).toBeTruthy();
      expect(starter.message).toBeTruthy();
    }
  });

  it("includes 'is this normal' for early programme weeks", () => {
    const ctx = makeContext({ weekNumber: 2 });
    const starters = generateConversationStarters(ctx, 2);
    expect(starters.some((s) => s.id === "is_this_normal")).toBe(true);
  });

  it("includes 'when does window change' for week 3+", () => {
    const ctx = makeContext({ weekNumber: 4 });
    const starters = generateConversationStarters(ctx, 4);
    expect(starters.some((s) => s.id === "when_does_window_increase")).toBe(true);
  });

  it("falls back to curriculum check-in prompts when few rules match", () => {
    // A context with very few matching starter rules
    const ctx = makeContext({
      weekNumber: 8,
      avgSleepEfficiency: 90,
      recentDiaryEntries: [], // no entries = no "how did I sleep"
    });
    const starters = generateConversationStarters(ctx, 8);
    expect(starters.length).toBeGreaterThanOrEqual(3);
  });
});

describe("detectPatterns", () => {
  it("detects improving efficiency trend", () => {
    const entries = [
      makeDiaryEntry(0, 85),
      makeDiaryEntry(1, 83),
      makeDiaryEntry(2, 82),
      makeDiaryEntry(7, 72),
      makeDiaryEntry(8, 70),
      makeDiaryEntry(9, 71),
    ];
    const ctx = makeContext({ recentDiaryEntries: entries, entriesCount: 6 });
    const patterns = detectPatterns(ctx);
    expect(patterns.efficiencyTrend).toBe("improving");
  });

  it("detects declining efficiency trend", () => {
    const entries = [
      makeDiaryEntry(0, 65),
      makeDiaryEntry(1, 67),
      makeDiaryEntry(2, 64),
      makeDiaryEntry(7, 80),
      makeDiaryEntry(8, 78),
      makeDiaryEntry(9, 81),
    ];
    const ctx = makeContext({ recentDiaryEntries: entries, entriesCount: 6 });
    const patterns = detectPatterns(ctx);
    expect(patterns.efficiencyTrend).toBe("declining");
  });

  it("detects plateaued efficiency trend", () => {
    const entries = [
      makeDiaryEntry(0, 76),
      makeDiaryEntry(1, 77),
      makeDiaryEntry(2, 75),
      makeDiaryEntry(7, 76),
      makeDiaryEntry(8, 75),
      makeDiaryEntry(9, 77),
    ];
    const ctx = makeContext({ recentDiaryEntries: entries, entriesCount: 6 });
    const patterns = detectPatterns(ctx);
    expect(patterns.efficiencyTrend).toBe("plateaued");
  });

  it("returns insufficient when < 6 entries", () => {
    const entries = [makeDiaryEntry(0, 80), makeDiaryEntry(1, 78)];
    const ctx = makeContext({ recentDiaryEntries: entries, entriesCount: 2 });
    const patterns = detectPatterns(ctx);
    expect(patterns.efficiencyTrend).toBe("insufficient");
  });

  it("detects WHOOP recovery dropping", () => {
    const ctx = makeContext({
      recentRecoveryScores: [40, 42, 38, 60, 62, 58], // recent avg ~40, older avg ~60
    });
    const patterns = detectPatterns(ctx);
    expect(patterns.whoopRecoveryDropping).toBe(true);
  });
});

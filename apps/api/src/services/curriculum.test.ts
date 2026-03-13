import { describe, it, expect } from "vitest";
import {
  getCurriculum,
  getIntentGuidance,
  getAllIntentGuidances,
  formatCurriculumForSystemPrompt,
  type IntentId,
} from "./curriculum.js";

const ALL_INTENT_IDS: IntentId[] = [
  "sr_initial_window_confusion",
  "sr_minimum_window_safety",
  "catastrophic_sleep_deprivation",
  "sr_not_following_rules",
  "sr_worse_before_better_fear",
  "catastrophic_never_better",
  "motivation_is_it_worth_it",
  "sr_thresholds_and_adjustments",
  "sr_plateau_at_5h",
  "cbti_vs_sleep_hygiene_confusion",
  "evidence_and_expectations",
  "success_story_reframe",
];

describe("getCurriculum", () => {
  it("returns valid data for weeks 1-8", () => {
    for (let week = 1; week <= 8; week++) {
      const curriculum = getCurriculum(week);
      expect(curriculum.weekNumber).toBe(week);
      expect(curriculum.topic).toBeTruthy();
      expect(curriculum.summary).toBeTruthy();
      expect(curriculum.dailyActions.length).toBeGreaterThanOrEqual(3);
      expect(curriculum.commonConcerns.length).toBeGreaterThanOrEqual(1);
      expect(curriculum.checkInPrompts.length).toBeGreaterThanOrEqual(1);

      // Each action has an id and text
      for (const action of curriculum.dailyActions) {
        expect(action.id).toBeTruthy();
        expect(action.text).toBeTruthy();
      }
    }
  });

  it("returns week 8 for week 9+", () => {
    const week9 = getCurriculum(9);
    const week8 = getCurriculum(8);
    expect(week9).toEqual(week8);

    const week100 = getCurriculum(100);
    expect(week100).toEqual(week8);
  });

  it("clamps week 0 or negative to week 1", () => {
    const week0 = getCurriculum(0);
    const week1 = getCurriculum(1);
    expect(week0).toEqual(week1);

    const weekNeg = getCurriculum(-5);
    expect(weekNeg).toEqual(week1);
  });

  it("has unique action IDs within each week", () => {
    for (let week = 1; week <= 8; week++) {
      const curriculum = getCurriculum(week);
      const ids = curriculum.dailyActions.map((a) => a.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});

describe("getIntentGuidance", () => {
  it("returns guidance for all 12 intents", () => {
    for (const intentId of ALL_INTENT_IDS) {
      const guidance = getIntentGuidance(intentId, 1);
      expect(guidance).toBeTruthy();
      expect(guidance.length).toBeGreaterThan(20);
    }
  });

  it("includes week-specific guidance when available", () => {
    // Week 1 has sr_initial_window_confusion as a common concern
    const guidance = getIntentGuidance("sr_initial_window_confusion", 1);
    expect(guidance).toContain("General guidance:");
  });

  it("returns generic guidance for intents not mapped to the current week", () => {
    // Week 1 does not map success_story_reframe
    const guidance = getIntentGuidance("success_story_reframe", 1);
    expect(guidance).not.toContain("General guidance:");
    expect(guidance).toBeTruthy();
  });
});

describe("getAllIntentGuidances", () => {
  it("returns all 12 intents", () => {
    const guidances = getAllIntentGuidances();
    expect(Object.keys(guidances)).toHaveLength(12);
    for (const intentId of ALL_INTENT_IDS) {
      expect(guidances[intentId]).toBeTruthy();
    }
  });
});

describe("formatCurriculumForSystemPrompt", () => {
  it("produces non-empty output for each week", () => {
    for (let week = 1; week <= 8; week++) {
      const output = formatCurriculumForSystemPrompt(week);
      expect(output).toBeTruthy();
      expect(output.length).toBeGreaterThan(100);
    }
  });

  it("includes the week number and topic", () => {
    const output = formatCurriculumForSystemPrompt(3);
    expect(output).toContain("WEEK 3 OF 8");
    expect(output).toContain("Surviving the dip");
  });

  it("includes actions and check-in prompts", () => {
    const output = formatCurriculumForSystemPrompt(1);
    expect(output).toContain("THIS WEEK'S ACTIONS");
    expect(output).toContain("CHECK-IN PROMPTS");
    expect(output).toContain("COMMON CONCERNS");
  });
});

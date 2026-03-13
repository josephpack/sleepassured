// Rule-based nudge & conversation-starter engine.
// No AI calls — pure functions on SleepDataContext + week number.

import type { SleepDataContext } from "./chat.js";
import { getCurriculum } from "./curriculum.js";

export interface Nudge {
  id: string;
  message: string;
  priority: number; // lower = higher priority
}

export interface ConversationStarter {
  id: string;
  label: string;
  message: string;
}

// ────────────────────────────────────────────────────
// Pattern detection helpers
// ────────────────────────────────────────────────────

interface DetectedPatterns {
  isFirstDayOnSchedule: boolean;
  efficiencyTrend: "improving" | "declining" | "plateaued" | "insufficient";
  hasMissedEntries: boolean;
  whoopRecoveryDropping: boolean;
  lowAdherence: boolean;
  isFlagged: boolean;
  noEntryToday: boolean;
  isEarlyProgramme: boolean;
  highEfficiency: boolean;
  lowEfficiency: boolean;
  avgEfficiency: number | null;
}

function detectPatterns(ctx: SleepDataContext): DetectedPatterns {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // First day on new schedule
  let isFirstDayOnSchedule = false;
  if (ctx.currentSchedule) {
    const weekStart = new Date(ctx.currentSchedule.weekStartDate);
    const weekStartDay = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate());
    isFirstDayOnSchedule = today.getTime() === weekStartDay.getTime();
  }

  // Efficiency trend: compare first 3 vs last 3 entries
  let efficiencyTrend: DetectedPatterns["efficiencyTrend"] = "insufficient";
  const entriesWithEff = ctx.recentDiaryEntries.filter((e) => e.sleepEfficiency !== null);
  if (entriesWithEff.length >= 6) {
    // Entries are sorted desc (newest first)
    const recent3 = entriesWithEff.slice(0, 3);
    const older3 = entriesWithEff.slice(-3);
    const avgRecent = recent3.reduce((s, e) => s + e.sleepEfficiency!, 0) / 3;
    const avgOlder = older3.reduce((s, e) => s + e.sleepEfficiency!, 0) / 3;
    const diff = avgRecent - avgOlder;
    if (diff > 3) efficiencyTrend = "improving";
    else if (diff < -3) efficiencyTrend = "declining";
    else efficiencyTrend = "plateaued";
  }

  // Missed diary entries (gap between expected days and actual entries)
  const hasMissedEntries = ctx.entriesCount < 7 && ctx.weekNumber >= 2;

  // WHOOP recovery dropping (last 3 vs previous 3)
  let whoopRecoveryDropping = false;
  if (ctx.recentRecoveryScores.length >= 6) {
    const recentRecov = ctx.recentRecoveryScores.slice(0, 3);
    const olderRecov = ctx.recentRecoveryScores.slice(3, 6);
    const avgRecentR = recentRecov.reduce((a, b) => a + b, 0) / 3;
    const avgOlderR = olderRecov.reduce((a, b) => a + b, 0) / 3;
    whoopRecoveryDropping = avgRecentR < avgOlderR - 5;
  }

  // Low adherence: < 60% of entries relative to days in the 2-week window
  const lowAdherence = ctx.entriesCount > 0 && ctx.entriesCount < 14 * 0.6;

  // No entry today
  let noEntryToday = true;
  if (ctx.recentDiaryEntries.length > 0) {
    const latestDate = new Date(ctx.recentDiaryEntries[0]!.date);
    const latestDay = new Date(latestDate.getFullYear(), latestDate.getMonth(), latestDate.getDate());
    noEntryToday = today.getTime() !== latestDay.getTime();
  }

  const isEarlyProgramme = ctx.weekNumber >= 1 && ctx.weekNumber <= 3;
  const highEfficiency = ctx.avgSleepEfficiency !== null && ctx.avgSleepEfficiency >= 85;
  const lowEfficiency = ctx.avgSleepEfficiency !== null && ctx.avgSleepEfficiency < 70;

  return {
    isFirstDayOnSchedule,
    efficiencyTrend,
    hasMissedEntries,
    whoopRecoveryDropping,
    lowAdherence,
    isFlagged: ctx.isFlagged,
    noEntryToday,
    isEarlyProgramme,
    highEfficiency,
    lowEfficiency,
    avgEfficiency: ctx.avgSleepEfficiency,
  };
}

// ────────────────────────────────────────────────────
// Nudge rules (priority-ranked, lower = higher priority)
// ────────────────────────────────────────────────────

interface NudgeRule {
  id: string;
  priority: number;
  condition: (patterns: DetectedPatterns, ctx: SleepDataContext, week: number) => boolean;
  template: (ctx: SleepDataContext, week: number) => string;
}

const NUDGE_RULES: NudgeRule[] = [
  {
    id: "flagged_for_review",
    priority: 1,
    condition: (p) => p.isFlagged,
    template: () =>
      "Your coach has flagged your sleep for a check-in. Things can feel difficult at this stage — that's expected. Tap below to talk through what you're experiencing.",
  },
  {
    id: "first_day_new_schedule",
    priority: 2,
    condition: (p) => p.isFirstDayOnSchedule,
    template: (ctx) => {
      const sched = ctx.currentSchedule!;
      return `Your new sleep window starts tonight: ${sched.prescribedBedtime} – ${sched.prescribedWakeTime}. Remember, do not get into bed before your prescribed bedtime.`;
    },
  },
  {
    id: "no_entry_today",
    priority: 3,
    condition: (p) => p.noEntryToday,
    template: () =>
      "You haven't logged your sleep diary today. It takes 2 minutes and it's what drives your programme forward — every entry counts.",
  },
  {
    id: "declining_efficiency",
    priority: 4,
    condition: (p) => p.efficiencyTrend === "declining",
    template: (_ctx, week) => {
      if (week <= 3) {
        return "Your sleep efficiency has dipped this week. That's expected in the early weeks — the discomfort is the sleep pressure building. It's doing its job.";
      }
      return "Your efficiency has dipped a bit recently. One or two tougher nights don't erase your progress. Stick to your schedule tonight and let the trajectory do its work.";
    },
  },
  {
    id: "whoop_recovery_dropping",
    priority: 5,
    condition: (p) => p.whoopRecoveryDropping,
    template: () =>
      "Your WHOOP recovery has been lower recently. Remember, recovery scores fluctuate — how you actually feel matters more than the number. How are you feeling today?",
  },
  {
    id: "low_adherence",
    priority: 6,
    condition: (p) => p.lowAdherence,
    template: () =>
      "Your diary entries have been a bit sparse recently. The programme works best with consistent data — could you log tonight's sleep in the morning?",
  },
  {
    id: "missed_entries",
    priority: 7,
    condition: (p) => p.hasMissedEntries,
    template: () =>
      "A few diary entries are missing from this week. Each entry helps the algorithm tune your schedule — even a quick log helps.",
  },
  {
    id: "early_programme_normalise",
    priority: 8,
    condition: (p) => p.isEarlyProgramme && !p.isFlagged,
    template: (_ctx, week) => {
      if (week === 1) return "Week 1 is about adjusting to your new schedule. If it feels tough, that's normal — the tighter window is building sleep pressure on purpose.";
      if (week === 2) return "Week 2 focuses on stimulus control: bed is for sleep. If you're lying awake, get up and return when sleepy. It feels odd, but it works.";
      return "Week 3 is often the hardest. If you're more tired than before, that's the process working. The dip is temporary — hang in there.";
    },
  },
  {
    id: "high_efficiency_praise",
    priority: 9,
    condition: (p) => p.highEfficiency,
    template: (ctx) =>
      `Your average efficiency is ${ctx.avgSleepEfficiency!.toFixed(0)}% — that's strong. Your brain is relearning that bed means sleep. Keep going.`,
  },
  {
    id: "low_efficiency_support",
    priority: 10,
    condition: (p) => p.lowEfficiency && !p.isFlagged,
    template: (ctx) =>
      `Your efficiency is sitting around ${ctx.avgSleepEfficiency!.toFixed(0)}%. That's lower than ideal, but it's the starting point — not the destination. The programme is designed to work from here.`,
  },
  {
    id: "improving_trend",
    priority: 11,
    condition: (p) => p.efficiencyTrend === "improving",
    template: () =>
      "Your sleep efficiency is trending upwards — that's your nervous system recalibrating. The numbers reflect a real change in how your brain responds to bed.",
  },
  {
    id: "plateaued_efficiency",
    priority: 12,
    condition: (p) => p.efficiencyTrend === "plateaued",
    template: (_ctx, week) => {
      if (week <= 4) return "Your efficiency has levelled off for now. Plateaus are normal, especially in the early weeks. Stay consistent and it will shift.";
      return "Your efficiency has been steady recently. Plateaus are part of the process — they often break within a week or two. Focus on how you feel, not just the numbers.";
    },
  },
];

// ────────────────────────────────────────────────────
// Conversation starter rules
// ────────────────────────────────────────────────────

interface StarterRule {
  id: string;
  priority: number;
  condition: (patterns: DetectedPatterns, ctx: SleepDataContext, week: number) => boolean;
  label: string;
  messageTemplate: (ctx: SleepDataContext, week: number) => string;
}

const STARTER_RULES: StarterRule[] = [
  {
    id: "how_did_i_sleep",
    priority: 1,
    condition: (p) => !p.noEntryToday,
    label: "How did I sleep?",
    messageTemplate: () => "How did I sleep last night?",
  },
  {
    id: "is_this_normal",
    priority: 2,
    condition: (p) => p.isEarlyProgramme,
    label: "Is this normal?",
    messageTemplate: (_ctx, week) =>
      `I'm in week ${week} and things feel harder. Is this normal?`,
  },
  {
    id: "struggling_with_schedule",
    priority: 3,
    condition: (p) => p.lowEfficiency || p.isFlagged,
    label: "I'm struggling",
    messageTemplate: () => "I'm finding it hard to stick to my schedule. What can I do?",
  },
  {
    id: "when_does_window_increase",
    priority: 4,
    condition: (_p, _ctx, week) => week >= 3,
    label: "When does my window change?",
    messageTemplate: () => "When will my sleep window increase?",
  },
  {
    id: "why_am_i_so_tired",
    priority: 5,
    condition: (p) => p.isEarlyProgramme,
    label: "Why am I so tired?",
    messageTemplate: () => "I'm more tired than before I started. Why?",
  },
  {
    id: "does_this_work",
    priority: 6,
    condition: (p) => p.efficiencyTrend !== "improving",
    label: "Does CBT-I work?",
    messageTemplate: () => "Does CBT-I actually work? What's the evidence?",
  },
  {
    id: "bad_night",
    priority: 7,
    condition: () => true, // always available
    label: "I had a bad night",
    messageTemplate: () => "I had a terrible night last night. I barely slept.",
  },
  {
    id: "progress_check",
    priority: 8,
    condition: (_p, _ctx, week) => week >= 4,
    label: "Am I making progress?",
    messageTemplate: () => "Am I making progress? It doesn't feel like it.",
  },
  {
    id: "explain_my_schedule",
    priority: 9,
    condition: (_p, ctx) => !!ctx.currentSchedule,
    label: "Explain my schedule",
    messageTemplate: () => "Can you explain why my sleep window is set the way it is?",
  },
  {
    id: "whats_this_week_about",
    priority: 10,
    condition: () => true, // always available
    label: "What's this week about?",
    messageTemplate: (_ctx, week) => `What should I focus on in week ${week}?`,
  },
];

// ────────────────────────────────────────────────────
// Exports
// ────────────────────────────────────────────────────

export interface NudgeResult {
  dailyNudge: Nudge;
  allNudges: Nudge[];
}

/**
 * Generate the daily nudge (highest-priority matching rule).
 * Always returns at least 1 nudge (curriculum-derived fallback).
 */
export function generateNudges(ctx: SleepDataContext, weekNumber: number): NudgeResult {
  const patterns = detectPatterns(ctx);
  const matched: Nudge[] = [];

  for (const rule of NUDGE_RULES) {
    if (rule.condition(patterns, ctx, weekNumber)) {
      matched.push({
        id: rule.id,
        message: rule.template(ctx, weekNumber),
        priority: rule.priority,
      });
    }
  }

  // Sort by priority (lower = higher priority)
  matched.sort((a, b) => a.priority - b.priority);

  // Curriculum fallback if nothing matched
  if (matched.length === 0) {
    const week = getCurriculum(weekNumber);
    matched.push({
      id: "curriculum_fallback",
      message: `This week's focus: ${week.topic}. ${week.summary.split(".")[0]}.`,
      priority: 99,
    });
  }

  return {
    dailyNudge: matched[0]!,
    allNudges: matched,
  };
}

/**
 * Generate conversation starters (top 5 matching rules).
 * Always returns at least 3 starters (curriculum-derived fallbacks).
 */
export function generateConversationStarters(
  ctx: SleepDataContext,
  weekNumber: number
): ConversationStarter[] {
  const patterns = detectPatterns(ctx);
  const matched: Array<ConversationStarter & { priority: number }> = [];

  for (const rule of STARTER_RULES) {
    if (rule.condition(patterns, ctx, weekNumber)) {
      matched.push({
        id: rule.id,
        label: rule.label,
        message: rule.messageTemplate(ctx, weekNumber),
        priority: rule.priority,
      });
    }
  }

  // Sort by priority
  matched.sort((a, b) => a.priority - b.priority);

  // Ensure at least 3 starters via curriculum fallbacks
  if (matched.length < 3) {
    const week = getCurriculum(weekNumber);
    const fallbacks: ConversationStarter[] = week.checkInPrompts.map((prompt, i) => ({
      id: `checkin_${i}`,
      label: prompt.length > 30 ? prompt.slice(0, 27) + "..." : prompt,
      message: prompt,
    }));

    for (const fb of fallbacks) {
      if (matched.length >= 3) break;
      if (!matched.some((m) => m.id === fb.id)) {
        matched.push({ ...fb, priority: 50 + matched.length });
      }
    }
  }

  // Return top 5, stripping priority
  return matched.slice(0, 5).map(({ priority: _, ...rest }) => rest);
}

// Export for testing
export { detectPatterns, type DetectedPatterns };

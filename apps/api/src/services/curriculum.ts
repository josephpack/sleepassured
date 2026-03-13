// 8-week CBT-I curriculum — pure data module, no DB or AI calls.
// Deterministic from week number.

export type IntentId =
  | "sr_initial_window_confusion"
  | "sr_minimum_window_safety"
  | "catastrophic_sleep_deprivation"
  | "sr_not_following_rules"
  | "sr_worse_before_better_fear"
  | "catastrophic_never_better"
  | "motivation_is_it_worth_it"
  | "sr_thresholds_and_adjustments"
  | "sr_plateau_at_5h"
  | "cbti_vs_sleep_hygiene_confusion"
  | "evidence_and_expectations"
  | "success_story_reframe";

export interface DailyAction {
  id: string;
  text: string;
}

export interface IntentMapping {
  intentId: IntentId;
  coachingGuidance: string;
}

export interface WeekCurriculum {
  weekNumber: number;
  topic: string;
  summary: string;
  dailyActions: DailyAction[];
  commonConcerns: IntentMapping[];
  checkInPrompts: string[];
}

// ────────────────────────────────────────────────────
// Intent guidance — context-independent coaching notes
// ────────────────────────────────────────────────────

const INTENT_GUIDANCE: Record<IntentId, string> = {
  sr_initial_window_confusion:
    "The user is confused about their prescribed sleep window. Explain that the window is calculated from their baseline data — it is deliberately short to build sleep pressure. Walk them through the two-process model: a shorter window means higher Process S at bedtime, which drives faster onset and fewer awakenings. Reassure them that the window will be extended as their efficiency improves.",

  sr_minimum_window_safety:
    "The user is worried their sleep window is dangerously short. Validate the concern — it is natural to feel alarmed. Explain that the minimum is 5 hours (never lower), which is safe for healthy adults. Brief sleep restriction does not cause medical harm; the discomfort is temporary and functional. Suggest they speak to their GP if they have specific health concerns.",

  catastrophic_sleep_deprivation:
    "The user fears serious harm from sleep loss. Use Socratic questioning first: 'What specifically are you worried will happen?' Then offer brief psychoeducation: one or two poor nights have far less impact on functioning than the anxiety about them. The brain compensates with deeper sleep the following night. Avoid minimising their feelings — acknowledge the fear is real, then gently test it against their actual experience.",

  sr_not_following_rules:
    "The user has broken their schedule rules (e.g. going to bed early, napping, lying in). Do NOT shame or lecture. Acknowledge that the rules are hard, especially early on. Then explain why the specific rule matters — e.g. going to bed early dilutes sleep pressure. Help them plan for tonight rather than dwelling on last night. One lapse does not undo progress.",

  sr_worse_before_better_fear:
    "The user is panicking because sleep has got worse since starting. This is the most critical moment for retention. Lead with validation: 'This is genuinely the hardest part, and what you're feeling is expected.' Explain the mechanism: the compressed window intentionally increases daytime tiredness in the short term — that tiredness IS the sleep pressure building. It is uncomfortable but functional. The dip typically lasts 1–2 weeks.",

  catastrophic_never_better:
    "The user believes they will never sleep well again. This is a deeply held belief, not a casual comment. Do NOT rush to reassure. Use Socratic questioning: 'Has there been any night in the last month, even one, where sleep was slightly better?' Help them notice exceptions. Then offer hope grounded in mechanism, not empty encouragement: 'CBT-I has the strongest evidence base of any insomnia treatment — stronger than medication — because it addresses the root cause.'",

  motivation_is_it_worth_it:
    "The user is questioning whether continuing is worth the effort. Acknowledge their frustration genuinely. Then help them weigh short-term discomfort against long-term gain. If they have data showing any improvement (even small), reference it. If not, explain that most improvement happens in weeks 3–6 and the early weeks are the hardest. Offer a concrete small commitment: 'Could you try one more week and we'll review together?'",

  sr_thresholds_and_adjustments:
    "The user wants to know when their window will increase or how adjustments work. Explain: the algorithm looks at sleep efficiency over the past week. When efficiency is consistently above 85%, the window increases by 15 minutes. Below 80%, it may decrease. Between 80–85%, it stays the same. This is gradual and data-driven — the system is working for them, not against them.",

  sr_plateau_at_5h:
    "The user is stuck at a short window and frustrated it hasn't increased. Validate the frustration. Check whether adherence might be the issue (going to bed early, sleeping in, napping). If adherence is good, explain that plateaus are normal and often break within 1–2 more weeks. The body is still recalibrating. Suggest focusing on sleep quality (how they feel) rather than quantity for now.",

  cbti_vs_sleep_hygiene_confusion:
    "The user thinks CBT-I is just sleep hygiene tips. Clarify the distinction clearly: sleep hygiene (dark room, no caffeine late) supports sleep but does NOT fix insomnia. The active ingredients are sleep restriction (building sleep pressure) and stimulus control (retraining bed = sleep). CBT-I is a structured therapeutic programme with the strongest evidence base for chronic insomnia — stronger than sleeping pills long-term.",

  evidence_and_expectations:
    "The user wants to know if CBT-I actually works or how long it takes. Share evidence: CBT-I is recommended as the first-line treatment for chronic insomnia by NICE, the American College of Physicians, and the European Sleep Research Society. Most people see meaningful improvement within 4–6 weeks. It works by addressing the root cause (conditioned arousal) rather than masking symptoms.",

  success_story_reframe:
    "The user is seeing progress but not recognising it, or comparing themselves unfavourably. Help them reframe: progress in CBT-I is not linear. A week with 78% efficiency after starting at 62% IS significant improvement, even if it doesn't feel dramatic. Encourage them to compare against their baseline, not against an idealised '8 hours every night'. Quality and consistency matter more than quantity.",
};

// ────────────────────────────────────────────────────
// 8-week curriculum
// ────────────────────────────────────────────────────

const CURRICULUM: WeekCurriculum[] = [
  {
    weekNumber: 1,
    topic: "Sleep restriction: how and why it works",
    summary:
      "Your sleep window has been calculated from your baseline data. This week is about understanding why a shorter window leads to better sleep — it builds sleep pressure (Process S) so you fall asleep faster and stay asleep longer. It will feel tough, but the discomfort is the mechanism working.",
    dailyActions: [
      { id: "w1_a1", text: "Set one alarm for your prescribed wake time. No snooze." },
      { id: "w1_a2", text: "Do not get into bed until your prescribed bedtime — not a minute earlier." },
      { id: "w1_a3", text: "Avoid napping, even if you feel exhausted. The tiredness is building sleep pressure." },
      { id: "w1_a4", text: "Log your sleep diary every morning — it takes 2 minutes and drives your programme." },
    ],
    commonConcerns: [
      {
        intentId: "sr_initial_window_confusion",
        coachingGuidance: "Week 1 users often feel the window is too narrow. Explain it is calculated from their data and will expand as efficiency improves.",
      },
      {
        intentId: "sr_minimum_window_safety",
        coachingGuidance: "Safety fears are highest in week 1. Reassure: the minimum is 5 hours, which is safe. The discomfort is temporary.",
      },
      {
        intentId: "catastrophic_sleep_deprivation",
        coachingGuidance: "Fear of sleep deprivation peaks early. Validate the feeling, then explain the brain compensates with deeper sleep.",
      },
    ],
    checkInPrompts: [
      "How are you finding the new schedule so far?",
      "What time did you actually get into bed last night?",
      "How are you feeling during the day — honestly?",
    ],
  },
  {
    weekNumber: 2,
    topic: "Stimulus control: retraining bed = sleep",
    summary:
      "This week focuses on breaking the association between bed and wakefulness. If you have been lying awake in bed, your brain has learnt that bed means 'think, worry, be alert'. Stimulus control retrains it: bed means sleep. Get up if you cannot sleep, return when sleepy.",
    dailyActions: [
      { id: "w2_a1", text: "Only get into bed when you feel genuinely sleepy — not just tired." },
      { id: "w2_a2", text: "If you are awake for roughly 20 minutes, get up and sit somewhere calm in dim light. Return when sleepy." },
      { id: "w2_a3", text: "Keep your phone out of the bedroom entirely — charge it in another room." },
      { id: "w2_a4", text: "Maintain your fixed wake time every day, including weekends." },
      { id: "w2_a5", text: "Log your sleep diary every morning." },
    ],
    commonConcerns: [
      {
        intentId: "sr_not_following_rules",
        coachingGuidance: "Week 2 is when rule-breaking starts. Do not shame — help them plan for tonight.",
      },
      {
        intentId: "sr_worse_before_better_fear",
        coachingGuidance: "Sleep may feel worse this week. Normalise: the dip is expected and typically lasts 1–2 weeks.",
      },
      {
        intentId: "catastrophic_never_better",
        coachingGuidance: "If hopelessness surfaces early, lead with validation. Help them notice even small exceptions.",
      },
    ],
    checkInPrompts: [
      "Have you had to get out of bed during the night? How did it go?",
      "Do you notice a difference between feeling tired and feeling sleepy?",
      "Is there anything about the schedule that feels particularly hard right now?",
    ],
  },
  {
    weekNumber: 3,
    topic: "Surviving the dip: it gets worse before better",
    summary:
      "If you are feeling more tired than before you started, that is expected. Weeks 2–3 are typically the hardest. Your body is adjusting to the compressed sleep window, and the increased daytime tiredness IS the sleep pressure building. This discomfort is temporary and functional — it drives the consolidation that comes next.",
    dailyActions: [
      { id: "w3_a1", text: "Keep following your schedule even though it is hard. Consistency now pays off soon." },
      { id: "w3_a2", text: "Plan a rewarding activity for the time between dinner and bedtime — something you enjoy." },
      { id: "w3_a3", text: "If you feel overwhelmed, talk to your coach. That is what this chat is for." },
      { id: "w3_a4", text: "Notice whether you are falling asleep faster than in week 1 — this is early progress." },
      { id: "w3_a5", text: "Log your sleep diary every morning." },
    ],
    commonConcerns: [
      {
        intentId: "sr_worse_before_better_fear",
        coachingGuidance: "This is the peak fear week. Lead with 'this is the hardest part' — match their experience, do not minimise.",
      },
      {
        intentId: "catastrophic_sleep_deprivation",
        coachingGuidance: "Reassure that brief sleep restriction is safe and the tiredness is temporary.",
      },
      {
        intentId: "motivation_is_it_worth_it",
        coachingGuidance: "Motivation dips here. Help them commit to 'one more week' rather than the whole programme.",
      },
    ],
    checkInPrompts: [
      "On a scale of 1–10, how tough is this week feeling?",
      "Are you falling asleep faster than when you started?",
      "What is helping you get through the difficult evenings?",
    ],
  },
  {
    weekNumber: 4,
    topic: "The sleep effort paradox",
    summary:
      "The more you try to sleep, the harder it becomes. Sleep is involuntary — like digestion. You can create the conditions for it, but you cannot force it. This week is about recognising when you are 'working' at sleep (clock-watching, rigid routines done anxiously, scoring your night) and learning to let go within the structure.",
    dailyActions: [
      { id: "w4_a1", text: "Remove or turn around any visible clocks in the bedroom." },
      { id: "w4_a2", text: "Resist checking your WHOOP or sleep score first thing — notice how you actually feel instead." },
      { id: "w4_a3", text: "If you catch yourself trying to 'make' sleep happen, take three slow breaths and let go." },
      { id: "w4_a4", text: "When you wake at night, remind yourself: 'The programme handles the structure. My job is to let go.'" },
      { id: "w4_a5", text: "Log your sleep diary every morning." },
    ],
    commonConcerns: [
      {
        intentId: "sr_not_following_rules",
        coachingGuidance: "By week 4, some users relax the rules. Gently re-emphasise why consistency matters.",
      },
      {
        intentId: "catastrophic_never_better",
        coachingGuidance: "If the user is still struggling, check whether sleep effort is the hidden barrier.",
      },
      {
        intentId: "cbti_vs_sleep_hygiene_confusion",
        coachingGuidance: "Some users confuse the effort paradox with 'just relax'. Clarify: it is about letting the structure work, not passive acceptance.",
      },
    ],
    checkInPrompts: [
      "Do you find yourself checking the time during the night?",
      "How do you feel when you check your sleep data in the morning?",
      "What would it look like if you were not trying to sleep tonight?",
    ],
  },
  {
    weekNumber: 5,
    topic: "Breaking unhelpful sleep beliefs",
    summary:
      "Many people hold beliefs about sleep that actually make insomnia worse — 'I need 8 hours to function', 'A bad night ruins the next day', 'I have always been a bad sleeper'. This week is about noticing these beliefs and testing them against your actual experience. Sleep need varies (6–9 hours), and your body is better at coping than you think.",
    dailyActions: [
      { id: "w5_a1", text: "After a night you rate as 'bad', notice how the day actually goes — not how you expect it to go." },
      { id: "w5_a2", text: "Write down one belief you hold about your sleep. Ask: where did this come from? Is it still true?" },
      { id: "w5_a3", text: "Compare your current data to your baseline — look for the trend, not any single night." },
      { id: "w5_a4", text: "If your window has increased, notice how it feels to have earned that through your own data." },
      { id: "w5_a5", text: "Log your sleep diary every morning." },
    ],
    commonConcerns: [
      {
        intentId: "sr_thresholds_and_adjustments",
        coachingGuidance: "Users often ask about window adjustments around week 5. Explain the 85% threshold clearly.",
      },
      {
        intentId: "sr_plateau_at_5h",
        coachingGuidance: "If still at minimum window, check adherence. If adherence is good, reassure that plateaus often break within 1–2 weeks.",
      },
      {
        intentId: "evidence_and_expectations",
        coachingGuidance: "Week 5 users may question whether CBT-I works for them. Share the evidence base and help them compare to their own baseline.",
      },
    ],
    checkInPrompts: [
      "What do you believe you need to sleep well? Where does that belief come from?",
      "Looking at your data over the past few weeks, what trend do you notice?",
      "After a shorter night, how does the day actually go compared to what you expected?",
    ],
  },
  {
    weekNumber: 6,
    topic: "Dealing with plateaus and setbacks",
    summary:
      "Progress in CBT-I is not linear. You may have weeks where efficiency stalls or dips — this does not mean it has stopped working. Setbacks are a normal part of the process. What matters is the overall trajectory from your baseline to now. This week is about building resilience and trusting the process through the ups and downs.",
    dailyActions: [
      { id: "w6_a1", text: "Compare this week's average efficiency to your very first week — not to last week." },
      { id: "w6_a2", text: "If you have a bad night, follow the same schedule the next day. Do not compensate." },
      { id: "w6_a3", text: "Write down one thing that has improved since you started, even if it is small." },
      { id: "w6_a4", text: "Practise responding to a bad night with 'one night does not define my sleep' instead of catastrophising." },
      { id: "w6_a5", text: "Log your sleep diary every morning." },
    ],
    commonConcerns: [
      {
        intentId: "sr_plateau_at_5h",
        coachingGuidance: "Plateaus are most frustrating around week 6. Help the user focus on what has changed rather than what has not.",
      },
      {
        intentId: "sr_thresholds_and_adjustments",
        coachingGuidance: "Explain that the algorithm is data-driven and gradual. Small, consistent gains lead to window increases.",
      },
      {
        intentId: "motivation_is_it_worth_it",
        coachingGuidance: "If motivation wanes, help them see how far they have come from baseline. Reference their actual numbers.",
      },
    ],
    checkInPrompts: [
      "Have you noticed any setbacks this week? How did you respond?",
      "What has changed about your sleep since you started the programme?",
      "How do you feel about your progress overall?",
    ],
  },
  {
    weekNumber: 7,
    topic: "Reframing progress: quality over quantity",
    summary:
      "Many people measure sleep success by hours alone. But sleep quality — falling asleep quickly, staying asleep, waking refreshed — matters more than raw quantity. This week is about shifting your definition of 'good sleep' from a number to a feeling. Your nervous system is relearning that bed means sleep — that is a real, lasting change.",
    dailyActions: [
      { id: "w7_a1", text: "Rate how rested you feel on waking, before checking any data or scores." },
      { id: "w7_a2", text: "Notice three things that are easier or better in your day compared to when you started." },
      { id: "w7_a3", text: "If your total sleep time is shorter than you would like, check your efficiency — quality is consolidating." },
      { id: "w7_a4", text: "Start thinking about what 'good enough' sleep looks like for you — not a perfect 8 hours." },
      { id: "w7_a5", text: "Log your sleep diary every morning." },
    ],
    commonConcerns: [
      {
        intentId: "success_story_reframe",
        coachingGuidance: "Help the user see their gains. Compare to baseline, not to an idealised standard.",
      },
      {
        intentId: "evidence_and_expectations",
        coachingGuidance: "By week 7, most users have seen meaningful change. Help them trust the trajectory.",
      },
      {
        intentId: "cbti_vs_sleep_hygiene_confusion",
        coachingGuidance: "Some users may wonder what is next. Clarify that the habits they have built ARE the treatment — not something separate.",
      },
    ],
    checkInPrompts: [
      "How do you feel when you wake up compared to a month ago?",
      "What does 'good enough' sleep look like for you?",
      "What has this programme changed about how you think about sleep?",
    ],
  },
  {
    weekNumber: 8,
    topic: "Maintaining gains and preventing relapse",
    summary:
      "You have built new sleep habits and challenged old beliefs. The final week is about making these changes stick. Occasional bad nights are normal — they do not mean your insomnia is back. The tools you have learnt (stimulus control, letting go of effort, not catastrophising) are yours to keep. If sleep wobbles, return to the basics: fixed wake time, bed only when sleepy, no compensating.",
    dailyActions: [
      { id: "w8_a1", text: "Write down the three most important things you have learnt about your sleep." },
      { id: "w8_a2", text: "Plan what you will do if you have a bad night next month — your personal relapse prevention plan." },
      { id: "w8_a3", text: "Keep your fixed wake time, even after the programme ends. This is the single most important habit." },
      { id: "w8_a4", text: "Continue logging your diary for at least 2 more weeks to consolidate the habit." },
      { id: "w8_a5", text: "Celebrate how far you have come. You did the hard work." },
    ],
    commonConcerns: [
      {
        intentId: "evidence_and_expectations",
        coachingGuidance: "Help the user understand that maintenance is part of recovery. The skills they have built are permanent tools.",
      },
      {
        intentId: "success_story_reframe",
        coachingGuidance: "Encourage the user to own their progress. They did the work — the app provided the structure.",
      },
      {
        intentId: "motivation_is_it_worth_it",
        coachingGuidance: "If they still have doubts, help them compare their current data to their baseline. The numbers tell the story.",
      },
    ],
    checkInPrompts: [
      "What would you tell someone who is just starting this programme?",
      "What will you do differently if sleep gets difficult again in the future?",
      "How has your relationship with sleep changed?",
    ],
  },
];

// ────────────────────────────────────────────────────
// Exports
// ────────────────────────────────────────────────────

/**
 * Get the curriculum for a given week. Week 9+ returns week 8 (maintenance mode).
 */
export function getCurriculum(weekNumber: number): WeekCurriculum {
  const clamped = Math.min(Math.max(weekNumber, 1), 8);
  return CURRICULUM[clamped - 1]!;
}

/**
 * Get coaching guidance for a specific intent, optionally contextualised to the week.
 * Falls back to generic intent guidance if no week-specific mapping exists.
 */
export function getIntentGuidance(intentId: IntentId, weekNumber: number): string {
  const week = getCurriculum(weekNumber);
  const weekSpecific = week.commonConcerns.find((c) => c.intentId === intentId);
  const generic = INTENT_GUIDANCE[intentId];

  if (weekSpecific) {
    return `${weekSpecific.coachingGuidance}\n\nGeneral guidance: ${generic}`;
  }
  return generic;
}

/**
 * Get all intent guidances as a record (for system prompt injection).
 */
export function getAllIntentGuidances(): Record<IntentId, string> {
  return { ...INTENT_GUIDANCE };
}

/**
 * Format the curriculum for injection into the AI system prompt.
 */
export function formatCurriculumForSystemPrompt(weekNumber: number): string {
  const week = getCurriculum(weekNumber);
  const lines: string[] = [];

  lines.push(`═══════════════════════════════════════`);
  lines.push(`THIS WEEK'S CURRICULUM — WEEK ${week.weekNumber} OF 8`);
  lines.push(`═══════════════════════════════════════`);
  lines.push("");
  lines.push(`TOPIC: ${week.topic}`);
  lines.push("");
  lines.push(week.summary);
  lines.push("");
  lines.push("THIS WEEK'S ACTIONS (remind the user of these proactively):");
  for (const action of week.dailyActions) {
    lines.push(`• ${action.text}`);
  }
  lines.push("");
  lines.push("COMMON CONCERNS THIS WEEK:");
  for (const concern of week.commonConcerns) {
    lines.push(`• [${concern.intentId}] ${concern.coachingGuidance}`);
  }
  lines.push("");
  lines.push("CHECK-IN PROMPTS (use these proactively when appropriate):");
  for (const prompt of week.checkInPrompts) {
    lines.push(`• "${prompt}"`);
  }

  return lines.join("\n");
}

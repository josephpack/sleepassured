import OpenAI from "openai";
import { prisma } from "@sleepassured/db";
import logger from "../lib/logger.js";

// Lazy-initialize OpenAI client
let openai: OpenAI | null = null;

function getOpenAIClient(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openai;
}

// CBT-I system prompt with structured cognitive work for conversational chat
const CHAT_SYSTEM_PROMPT = `You are a knowledgeable, supportive sleep coach embedded in a CBT-I (Cognitive Behavioural Therapy for Insomnia) app called SleepAssured. You understand the science of sleep and help users not just follow their programme, but understand *why* it works — including the cognitive patterns that maintain insomnia.

═══════════════════════════════════════
CORE SLEEP SCIENCE
═══════════════════════════════════════

TWO-PROCESS MODEL OF SLEEP
Sleep is governed by two biological systems:
• Process S (sleep pressure/homeostatic drive) — a chemical drive that builds during every hour of wakefulness (mainly adenosine accumulation). The longer you stay awake, the stronger the pressure to sleep. It dissipates during sleep.
• Process C (circadian rhythm) — your internal ~24-hour clock, driven by the suprachiasmatic nucleus. It creates predictable windows of alertness and sleepiness, independent of how long you've been awake.

Good sleep happens when Process S is high and Process C is in its sleepiness window. Sleep restriction works by compressing time in bed so Process S builds higher — faster onset, fewer awakenings, deeper sleep. This is the core mechanism. Ground schedule explanations here.

STIMULUS CONTROL
These rules retrain the brain's association between bed and sleep:
• Only go to bed when genuinely *sleepy* (heavy eyelids, head nodding) — not just tired or fatigued. Tiredness is low energy; sleepiness is difficulty staying awake. Teach this difference when relevant.
• Bed is for sleep and intimacy only — no phones, no TV, no worrying.
• If unable to sleep after roughly 20 minutes, get up, do something calm in dim light, return when sleepy. This is the "quarter-of-an-hour rule."
• Fixed wake time every day — including weekends. This anchors the circadian rhythm.
• Avoid napping if possible. If necessary, <30 minutes before 3pm.

SLEEP HYGIENE — IN CONTEXT
Sleep hygiene supports sleep but does NOT fix insomnia on its own. The active ingredients are sleep restriction and stimulus control. Never over-emphasise hygiene at the expense of the core protocol.

═══════════════════════════════════════
COGNITIVE WORK — YOUR PRIMARY TOOL
═══════════════════════════════════════

You address three core cognitive patterns that maintain insomnia. Your style is a mix of Socratic questioning and brief psychoeducation. NEVER label a thought as a "distortion" or "catastrophising" — surface the belief, gently test it, then offer an alternative perspective.

PATTERN 1: CATASTROPHISING ABOUT A BAD NIGHT
Beliefs like: "I only got 5 hours, tomorrow will be ruined", "This is never going to work", "I'm getting worse not better."

How to respond:
• First, use a Socratic question to surface what the user is telling themselves — e.g. "What are you predicting will happen tomorrow?" or "How does your body actually feel right now compared to what you're expecting?"
• Then, brief psychoeducation (2–3 sentences max): One poor night has far less impact on next-day performance than the anxiety about it. The brain compensates by increasing deep sleep the following night. The trajectory matters more than any single night.
• IMPORTANT: A user in week 1 with SE of 65% who says "this isn't working" needs validation and normalisation (this is the hardest part, the discomfort IS the mechanism). A user in week 6 with SE of 82% saying the same thing needs gentle redirection to their own data — the numbers show it IS working, even if it doesn't always feel like it.

PATTERN 2: THE SLEEP EFFORT PARADOX
This is not a side note — it is a central mechanism. The more a user monitors, controls, or "works" at sleep, the more they activate the arousal system that prevents sleep. Letting go of control is the therapeutic mechanism.

Recognise effort in disguise:
• Clock-watching, counting hours, checking WHOOP first thing to "score" their night
• Rigid pre-bed routines done anxiously rather than calmly
• "I did everything right and still didn't sleep" — this reveals performance pressure around sleep
• "I'm trying so hard" — trying IS the problem

How to respond:
• Socratic first: "What would it look like if you weren't trying to sleep tonight?" or "What happens in your body when you notice yourself working at it?"
• Then explain briefly: Sleep is an involuntary process — like digestion. You can create the conditions for it, but you can't force it. The moment you try to make yourself sleep, you activate the alertness system. The programme handles the structure; your job is to let go within it.
• Do NOT address WHOOP metric over-monitoring unless the user brings it up directly. But if the user says something like "My WHOOP says my sleep was terrible so today will be bad," gently separate the metric from actual felt experience: "How do you actually feel right now, setting the number aside?"

PATTERN 3: UNHELPFUL BELIEFS ABOUT SLEEP REQUIREMENTS
Beliefs like: "I need 8 hours to function", "I haven't had a full sleep cycle", "My sleep score was low so I must be impaired."

How to respond:
• Socratic: "Where does that number come from for you?" or "On the nights you've slept less than you'd like, how did the day actually go — not how you expected it to go, but how it actually went?"
• Psychoeducation: Sleep need varies between 6–9 hours and changes with age. Most people overestimate how much they need and underestimate how well they cope. The body is remarkably good at getting the sleep it needs when the conditions are right — that's what this programme builds.
• Never tell the user what to think. Surface their belief, test it against their own experience, then offer a different lens.

═══════════════════════════════════════
WHEN COGNITIVE WORK IS MOST NEEDED
═══════════════════════════════════════

Use the user's week number, sleep efficiency, and flagged status to calibrate your response. Cognitive work should be contextual and personalised, not generic.

WEEKS 1–3 (EARLY PROGRAMME)
Sleep often gets worse before it gets better. Users are most likely to panic, question the programme, and want to quit. Do NOT wait for them to express distress — proactively normalise what they're probably experiencing:
• "It's common around this point to feel like things are going backwards. That's actually the sleep pressure building — it's uncomfortable, but it's the mechanism doing its job."
• If they express doubt or frustration, lead with validation before any reframe. Acknowledge the difficulty is real. Then briefly explain that the discomfort is temporary and functional — it's the compressed sleep window forcing the brain to consolidate.
• This is NOT the time for cheerful encouragement. Match their experience. Be honest that it's hard.

LOW SE OR FLAGGED FOR REVIEW
This is the highest-risk moment for dropout. Shift your approach:
• Less coaching, more validation. The user needs to feel heard, not taught.
• Use Socratic questioning to surface what they're telling themselves about their sleep: "What goes through your mind when you see those numbers?" or "What story is building up about how this is going?"
• Only after they've expressed their thought should you gently offer a reframe — and frame it as an alternative perspective, not a correction.
• If SE has been persistently low, acknowledge the frustration directly: "I can see this has been a really tough stretch." Then ground any hope in the mechanism, not empty reassurance: "The programme is designed to work with this — lower efficiency now is what drives the consolidation later."

WEEKS 4+ WITH IMPROVING DATA
When the data shows progress, reinforce the cognitive shift alongside the behavioural one:
• "Your nervous system is relearning that bed means sleep — that's not just a number improving, it's a real change in how your brain responds to the bedroom."
• Help the user notice their own changed relationship with sleep, not just the metrics.

═══════════════════════════════════════
CRITICAL CONSTRAINTS
═══════════════════════════════════════
1. NEVER provide medical advice beyond CBT-I sleep strategies.
2. NEVER suggest medications, supplements, melatonin, or sleep aids of any kind.
3. NEVER contradict or question the user's prescribed sleep schedule — the CBT-I algorithm has made that decision. Even if the user says they slept fine without following it, do not validate abandoning the schedule.
4. NEVER diagnose any condition. NEVER label a user's thoughts using clinical terms (e.g. don't say "you're catastrophising" or "that's a cognitive distortion").
5. If the user describes symptoms suggesting a different sleep disorder (gasping/choking awake, irresistible urge to move legs, acting out dreams), do NOT diagnose. Acknowledge what they've described and gently suggest mentioning it to their GP.
6. If the user reports persistent extreme daytime sleepiness affecting driving or safety, gently suggest speaking with their GP.
7. If the user mentions severe distress, suicidal thoughts, or severe depression, recommend they contact a healthcare professional or crisis service.
8. Keep responses CONCISE — 2–4 sentences for straightforward questions, up to 5–6 if doing cognitive work or explaining a concept.
9. Stay STRICTLY focused on sleep. If asked about unrelated topics, redirect warmly: "I'm here to help with your sleep. Is there anything about your sleep or schedule I can help with?"
10. Do NOT address WHOOP metric over-monitoring unless the user raises it directly.

WHAT YOU CAN DO:
• Explain the user's sleep data in simple, personalised terms.
• Explain *why* things work — ground explanations in sleep pressure, circadian rhythm, and stimulus control.
• Do structured cognitive work: surface unhelpful beliefs using Socratic questions, then offer brief psychoeducation as an alternative perspective.
• Normalise difficulties contextually — different responses for week 1 vs week 6, for SE of 65% vs 85%.
• Proactively normalise the expected experience in early weeks without waiting for the user to complain.

TONE: Warm, curious, non-judgmental. When a user expresses distress or a negative belief, your first move is a question, not a correction. You're genuinely interested in what they're experiencing and thinking. Explain the "why" behind advice, not just the "what."

Remember: The user's sleep data is provided below. Use it to make cognitive interventions feel personalised — reference their actual week number, SE, and trends. Never ask them questions about data you already have.`;

export interface SleepDataContext {
  userName: string | null;
  // Current sleep window
  currentSchedule: {
    prescribedBedtime: string;
    prescribedWakeTime: string;
    timeInBedMins: number;
    weekStartDate: Date;
  } | null;
  // Recent diary entries (current + previous week)
  recentDiaryEntries: Array<{
    date: Date;
    bedtime: string;
    finalWakeTime: string;
    outOfBedTime: string;
    sleepOnsetLatencyMins: number;
    wakeAfterSleepOnsetMins: number;
    totalSleepTimeMins: number | null;
    sleepEfficiency: number | null;
    subjectiveQuality: number;
    source: string;
  }>;
  // Aggregate stats
  avgSleepEfficiency: number | null;
  avgTotalSleepTime: number | null;
  avgSubjectiveQuality: number | null;
  entriesCount: number;
  // WHOOP data if available
  hasWhoopConnection: boolean;
  recentRecoveryScores: number[];
  avgRecoveryScore: number | null;
  // Program status
  weekNumber: number;
  baselineComplete: boolean;
  isFlagged: boolean;
  // Latest ISI score
  latestISIScore: number | null;
  latestISISeverity: string | null;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatResult {
  message: string;
  source: "ai" | "fallback";
}

// Build context from user's sleep data (current week + previous week)
export async function buildChatContext(userId: string): Promise<SleepDataContext> {
  const now = new Date();
  const twoWeeksAgo = new Date(now);
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

  // Fetch user info
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      therapyStartDate: true,
      baselineComplete: true,
      flaggedForReview: true,
    },
  });

  // Fetch current sleep window
  const currentSchedule = await prisma.sleepWindow.findFirst({
    where: { userId },
    orderBy: { weekStartDate: "desc" },
    select: {
      prescribedBedtime: true,
      prescribedWakeTime: true,
      timeInBedMins: true,
      weekStartDate: true,
    },
  });

  // Fetch diary entries from last 2 weeks
  const diaryEntries = await prisma.sleepDiary.findMany({
    where: {
      userId,
      date: { gte: twoWeeksAgo },
    },
    orderBy: { date: "desc" },
    select: {
      date: true,
      bedtime: true,
      finalWakeTime: true,
      outOfBedTime: true,
      sleepOnsetLatencyMins: true,
      wakeAfterSleepOnsetMins: true,
      totalSleepTimeMins: true,
      sleepEfficiency: true,
      subjectiveQuality: true,
      source: true,
    },
  });

  // Calculate averages
  const entriesWithEfficiency = diaryEntries.filter((e) => e.sleepEfficiency !== null);
  const avgSleepEfficiency =
    entriesWithEfficiency.length > 0
      ? entriesWithEfficiency.reduce((sum, e) => sum + Number(e.sleepEfficiency), 0) /
        entriesWithEfficiency.length
      : null;

  const entriesWithTST = diaryEntries.filter((e) => e.totalSleepTimeMins !== null);
  const avgTotalSleepTime =
    entriesWithTST.length > 0
      ? entriesWithTST.reduce((sum, e) => sum + (e.totalSleepTimeMins ?? 0), 0) /
        entriesWithTST.length
      : null;

  const avgSubjectiveQuality =
    diaryEntries.length > 0
      ? diaryEntries.reduce((sum, e) => sum + e.subjectiveQuality, 0) / diaryEntries.length
      : null;

  // Check WHOOP connection and get recovery scores
  const whoopConnection = await prisma.whoopConnection.findUnique({
    where: { userId },
  });

  let recentRecoveryScores: number[] = [];
  let avgRecoveryScore: number | null = null;

  if (whoopConnection) {
    const whoopRecords = await prisma.whoopSleepRecord.findMany({
      where: {
        userId,
        startTime: { gte: twoWeeksAgo },
        recoveryScore: { not: null },
      },
      orderBy: { startTime: "desc" },
      select: { recoveryScore: true },
      take: 14,
    });

    recentRecoveryScores = whoopRecords.map((r) => r.recoveryScore!);
    avgRecoveryScore =
      recentRecoveryScores.length > 0
        ? recentRecoveryScores.reduce((a, b) => a + b, 0) / recentRecoveryScores.length
        : null;
  }

  // Calculate week number
  let weekNumber = 1;
  if (user?.therapyStartDate) {
    const daysSinceStart = Math.floor(
      (now.getTime() - new Date(user.therapyStartDate).getTime()) / (1000 * 60 * 60 * 24)
    );
    weekNumber = Math.max(1, Math.ceil(daysSinceStart / 7));
  }

  // Get latest ISI score
  const latestISI = await prisma.iSIAssessment.findFirst({
    where: { userId },
    orderBy: { completedAt: "desc" },
    select: { score: true },
  });

  let latestISISeverity: string | null = null;
  if (latestISI) {
    if (latestISI.score <= 7) latestISISeverity = "none";
    else if (latestISI.score <= 14) latestISISeverity = "subthreshold";
    else if (latestISI.score <= 21) latestISISeverity = "moderate";
    else latestISISeverity = "severe";
  }

  // Helper to format DateTime to HH:MM string
  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
  };

  return {
    userName: user?.name ?? null,
    currentSchedule,
    recentDiaryEntries: diaryEntries.map((e) => ({
      date: e.date,
      bedtime: formatTime(e.bedtime),
      finalWakeTime: formatTime(e.finalWakeTime),
      outOfBedTime: formatTime(e.outOfBedTime),
      sleepOnsetLatencyMins: e.sleepOnsetLatencyMins,
      wakeAfterSleepOnsetMins: e.wakeAfterSleepOnsetMins,
      totalSleepTimeMins: e.totalSleepTimeMins,
      sleepEfficiency: e.sleepEfficiency ? Number(e.sleepEfficiency) : null,
      subjectiveQuality: e.subjectiveQuality,
      source: e.source,
    })),
    avgSleepEfficiency,
    avgTotalSleepTime,
    avgSubjectiveQuality,
    entriesCount: diaryEntries.length,
    hasWhoopConnection: !!whoopConnection,
    recentRecoveryScores,
    avgRecoveryScore,
    weekNumber,
    baselineComplete: user?.baselineComplete ?? false,
    isFlagged: user?.flaggedForReview ?? false,
    latestISIScore: latestISI?.score ?? null,
    latestISISeverity,
  };
}

// Format context into a string for the AI
function formatContextForAI(context: SleepDataContext): string {
  const lines: string[] = [];

  if (context.userName) {
    lines.push(`User's name: ${context.userName}`);
  }

  lines.push(`Week ${context.weekNumber} of CBT-I program`);
  lines.push(`Baseline complete: ${context.baselineComplete ? "Yes" : "No"}`);

  if (context.currentSchedule) {
    lines.push(`\nCURRENT PRESCRIBED SCHEDULE:`);
    lines.push(`- Bedtime: ${context.currentSchedule.prescribedBedtime}`);
    lines.push(`- Wake time: ${context.currentSchedule.prescribedWakeTime}`);
    lines.push(`- Time in bed: ${Math.floor(context.currentSchedule.timeInBedMins / 60)}h ${context.currentSchedule.timeInBedMins % 60}m`);
  }

  if (context.entriesCount > 0) {
    lines.push(`\nRECENT SLEEP DATA (last 2 weeks):`);
    lines.push(`- Entries logged: ${context.entriesCount}`);
    if (context.avgSleepEfficiency !== null) {
      lines.push(`- Average sleep efficiency: ${context.avgSleepEfficiency.toFixed(1)}%`);
    }
    if (context.avgTotalSleepTime !== null) {
      const hours = Math.floor(context.avgTotalSleepTime / 60);
      const mins = Math.round(context.avgTotalSleepTime % 60);
      lines.push(`- Average total sleep time: ${hours}h ${mins}m`);
    }
    if (context.avgSubjectiveQuality !== null) {
      lines.push(`- Average subjective quality: ${context.avgSubjectiveQuality.toFixed(1)}/10`);
    }

    // Most recent entry details
    const latest = context.recentDiaryEntries[0];
    if (latest) {
      const dateStr = new Date(latest.date).toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
      });
      lines.push(`\nMOST RECENT NIGHT (${dateStr}):`);
      lines.push(`- Bedtime: ${latest.bedtime}`);
      lines.push(`- Wake time: ${latest.finalWakeTime}`);
      lines.push(`- Time to fall asleep: ${latest.sleepOnsetLatencyMins} mins`);
      lines.push(`- Time awake during night: ${latest.wakeAfterSleepOnsetMins} mins`);
      if (latest.sleepEfficiency !== null) {
        lines.push(`- Sleep efficiency: ${latest.sleepEfficiency.toFixed(1)}%`);
      }
      lines.push(`- Subjective quality: ${latest.subjectiveQuality}/10`);
      lines.push(`- Data source: ${latest.source}`);
    }
  }

  if (context.hasWhoopConnection && context.avgRecoveryScore !== null) {
    lines.push(`\nWHOOP DATA:`);
    lines.push(`- Average recovery score: ${context.avgRecoveryScore.toFixed(0)}%`);
  }

  if (context.latestISIScore !== null) {
    lines.push(`\nINSOMNIA SEVERITY INDEX:`);
    lines.push(`- Latest score: ${context.latestISIScore}/28 (${context.latestISISeverity})`);
  }

  if (context.isFlagged) {
    lines.push(`\nNote: This user has been flagged for review due to persistently low sleep efficiency. Be extra supportive and encouraging.`);
  }

  return lines.join("\n");
}

// Fallback responses with cognitive framing
const FALLBACK_RESPONSES = {
  default:
    "I'm here to help with your sleep. By sticking to your prescribed schedule, you're building stronger sleep pressure — that's what leads to faster onset and fewer awakenings. The structure handles the mechanics; your job is just to follow the schedule and let go of the rest.",
  how_did_i_sleep:
    "Your recent entries show your sleep is consolidating — more of your time in bed is being spent asleep. That's not just a number improving; it's your nervous system relearning that bed means sleep. The trajectory matters more than any single night.",
  struggling:
    "This is genuinely the hardest part, and what you're feeling is real — not a sign it isn't working. The tiredness is sleep pressure building, which is exactly what drives deeper, more consolidated sleep. How does your body actually feel right now, compared to what you're predicting about the day ahead?",
} as const;

// Main chat function
export async function sendChatMessage(
  userId: string,
  userMessage: string,
  conversationHistory: ChatMessage[]
): Promise<ChatResult> {
  const client = getOpenAIClient();

  // Build context from user's sleep data
  const context = await buildChatContext(userId);
  const contextString = formatContextForAI(context);

  // If no OpenAI client, return fallback
  if (!client) {
    logger.info("OpenAI API key not configured, using fallback message");
    return {
      message: FALLBACK_RESPONSES.default,
      source: "fallback",
    };
  }

  try {
    // Build messages array
    const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      {
        role: "system",
        content: `${CHAT_SYSTEM_PROMPT}\n\n---\n\nUSER'S SLEEP DATA:\n${contextString}`,
      },
    ];

    // Add conversation history (limited to last 10 messages to manage context)
    const recentHistory = conversationHistory.slice(-10);
    for (const msg of recentHistory) {
      messages.push({
        role: msg.role,
        content: msg.content,
      });
    }

    // Add current user message
    messages.push({
      role: "user",
      content: userMessage,
    });

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      max_tokens: 250,
      temperature: 0.7,
    });

    const aiMessage = completion.choices[0]?.message?.content?.trim();

    if (!aiMessage) {
      throw new Error("Empty response from OpenAI");
    }

    return {
      message: aiMessage,
      source: "ai",
    };
  } catch (error) {
    logger.error({ err: error }, "OpenAI chat error");
    return {
      message: FALLBACK_RESPONSES.default,
      source: "fallback",
    };
  }
}

// Get context for quick reply suggestions
export async function getQuickReplyContext(userId: string): Promise<{
  lastNightEfficiency: number | null;
  isLowEfficiency: boolean;
}> {
  const context = await buildChatContext(userId);
  const lastEntry = context.recentDiaryEntries[0];
  const lastNightEfficiency = lastEntry?.sleepEfficiency ?? null;
  const isLowEfficiency = lastNightEfficiency !== null && lastNightEfficiency < 80;

  return {
    lastNightEfficiency,
    isLowEfficiency,
  };
}

import { PrismaClient, DiarySource, Mood, WindowAdjustment } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

const TEST_EMAIL = "test@sleepassured.com";
const TEST_PASSWORD = "Test1234!";
const TARGET_WAKE_TIME = "07:00";
const SALT_ROUNDS = 12;

/**
 * Seed script for SleepAssured — creates a test user with 14 days of
 * realistic sleep diary data, ISI assessment, and sleep windows.
 *
 * Usage: npx tsx prisma/seed.ts
 */
async function main() {
  console.log("Seeding SleepAssured test data...\n");

  // 1. Create or update test user
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, SALT_ROUNDS);
  const therapyStartDate = daysAgo(14);

  const user = await prisma.user.upsert({
    where: { email: TEST_EMAIL },
    update: {
      name: "Test User",
      passwordHash,
      targetWakeTime: TARGET_WAKE_TIME,
      onboardingCompleted: true,
      therapyStartDate,
      baselineComplete: true,
    },
    create: {
      email: TEST_EMAIL,
      passwordHash,
      name: "Test User",
      targetWakeTime: TARGET_WAKE_TIME,
      onboardingCompleted: true,
      therapyStartDate,
      baselineComplete: true,
    },
  });

  console.log(`  User: ${user.email} (${user.id})`);
  console.log(`  Password: ${TEST_PASSWORD}\n`);

  // 2. Clean existing seed data for this user
  await prisma.sleepDiary.deleteMany({ where: { userId: user.id } });
  await prisma.sleepWindow.deleteMany({ where: { userId: user.id } });
  await prisma.iSIAssessment.deleteMany({ where: { userId: user.id } });

  // 3. Create ISI assessment (score 18 = moderate clinical insomnia)
  const isiResponses = [3, 3, 3, 2, 3, 2, 2]; // 7 questions, 0-4 each
  await prisma.iSIAssessment.create({
    data: {
      userId: user.id,
      score: isiResponses.reduce((a, b) => a + b, 0),
      responses: isiResponses,
      completedAt: daysAgo(14),
    },
  });
  console.log("  ISI assessment created (score: 18, moderate insomnia)");

  // 4. Create baseline sleep window (week 1)
  //    Baseline: 6h TIB (360 mins), bedtime 01:00, wake 07:00
  const baselineWindow = await prisma.sleepWindow.create({
    data: {
      userId: user.id,
      weekStartDate: daysAgo(14),
      prescribedBedtime: "01:00",
      prescribedWakeTime: TARGET_WAKE_TIME,
      timeInBedMins: 360,
      avgSleepEfficiency: null,
      adjustmentMade: WindowAdjustment.BASELINE,
      adjustmentMins: 0,
      feedbackMessage:
        "Welcome to your personalised sleep programme! Your initial sleep window is 01:00–07:00. Stick to these times as closely as you can this week.",
    },
  });

  // Week 2 adjustment: SE improved to ~82%, so maintain
  const week2Window = await prisma.sleepWindow.create({
    data: {
      userId: user.id,
      weekStartDate: daysAgo(7),
      prescribedBedtime: "01:00",
      prescribedWakeTime: TARGET_WAKE_TIME,
      timeInBedMins: 360,
      avgSleepEfficiency: 82.0,
      adjustmentMade: WindowAdjustment.NONE,
      adjustmentMins: 0,
      feedbackMessage:
        "You're on the right track! Your sleep efficiency is improving nicely. Keep consistent with your 01:00–07:00 window this week.",
    },
  });

  console.log("  Sleep windows created (baseline + week 2 adjustment)");

  // 5. Generate 14 days of sleep diary entries with improving trend
  const diaryEntries = [];

  for (let dayOffset = 14; dayOffset >= 1; dayOffset--) {
    const entry = generateDiaryEntry(user.id, dayOffset);
    diaryEntries.push(entry);
  }

  for (const entry of diaryEntries) {
    await prisma.sleepDiary.create({ data: entry });
  }

  console.log(`  ${diaryEntries.length} diary entries created (14 days)\n`);

  // Summary
  const avgSE =
    diaryEntries.reduce((sum, e) => sum + Number(e.sleepEfficiency), 0) /
    diaryEntries.length;
  const week1Entries = diaryEntries.slice(0, 7);
  const week2Entries = diaryEntries.slice(7, 14);
  const avgSE1 =
    week1Entries.reduce((sum, e) => sum + Number(e.sleepEfficiency), 0) /
    week1Entries.length;
  const avgSE2 =
    week2Entries.reduce((sum, e) => sum + Number(e.sleepEfficiency), 0) /
    week2Entries.length;

  console.log("  Summary:");
  console.log(`    Overall avg SE: ${avgSE.toFixed(1)}%`);
  console.log(`    Week 1 avg SE:  ${avgSE1.toFixed(1)}%`);
  console.log(`    Week 2 avg SE:  ${avgSE2.toFixed(1)}%`);
  console.log("\nSeed complete!");
}

// --- Helpers ---

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

function generateDiaryEntry(userId: string, dayOffset: number) {
  // Progress factor: 0 (oldest) → 1 (most recent)
  const progress = (14 - dayOffset) / 13;

  // Bedtime: gradually getting closer to prescribed (01:00)
  // Start: 00:00–01:30 range, End: 00:45–01:15 range
  const bedtimeBaseMinutes = 24 * 60; // midnight
  const bedtimeVariation = lerp(90, 30, progress); // range shrinks
  const bedtimeOffset = randomInRange(-10, bedtimeVariation);
  const bedtimeMinutes = bedtimeBaseMinutes + 60 + bedtimeOffset; // ~01:00 ± variation

  // Sleep onset latency: improving from 25-45 min to 10-20 min
  const solMin = lerp(25, 10, progress);
  const solMax = lerp(45, 20, progress);
  const sleepOnsetLatencyMins = Math.round(randomInRange(solMin, solMax));

  // Awakenings: improving from 2-4 to 1-2
  const awakMin = lerp(2, 1, progress);
  const awakMax = lerp(4, 2, progress);
  const numberOfAwakenings = Math.round(randomInRange(awakMin, awakMax));

  // WASO: improving from 20-40 to 5-15
  const wasoMin = lerp(20, 5, progress);
  const wasoMax = lerp(40, 15, progress);
  const wakeAfterSleepOnsetMins = Math.round(randomInRange(wasoMin, wasoMax));

  // Wake time: 06:45–07:15 (close to target)
  const wakeTimeBaseMinutes = 7 * 60; // 07:00
  const wakeOffset = randomInRange(-15, 15);
  const finalWakeMinutes = wakeTimeBaseMinutes + Math.round(wakeOffset);

  // Out of bed: 0-15 min after wake
  const outOfBedMinutes = finalWakeMinutes + Math.round(randomInRange(0, 15));

  // Calculate derived fields
  const timeInBedMins = outOfBedMinutes + 24 * 60 - bedtimeMinutes; // crosses midnight
  const totalSleepTimeMins = Math.max(
    0,
    timeInBedMins - sleepOnsetLatencyMins - wakeAfterSleepOnsetMins
  );
  const sleepEfficiency =
    timeInBedMins > 0
      ? Math.round((totalSleepTimeMins / timeInBedMins) * 10000) / 100
      : 0;

  // Subjective quality: correlated with efficiency (1-10)
  const qualityBase = (sleepEfficiency / 100) * 10;
  const subjectiveQuality = Math.max(
    1,
    Math.min(10, Math.round(qualityBase + randomInRange(-1, 1)))
  );

  // Build actual Date objects for the entry
  const entryDate = daysAgo(dayOffset);

  const bedtime = new Date(entryDate);
  const bedtimeHours = Math.floor(bedtimeMinutes / 60) % 24;
  const bedtimeMins = bedtimeMinutes % 60;
  bedtime.setHours(bedtimeHours, bedtimeMins, 0, 0);

  const nextDay = new Date(entryDate);
  nextDay.setDate(nextDay.getDate() + 1);

  const finalWakeTime = new Date(nextDay);
  const fwHours = Math.floor(finalWakeMinutes / 60);
  const fwMins = finalWakeMinutes % 60;
  finalWakeTime.setHours(fwHours, fwMins, 0, 0);

  const outOfBedTime = new Date(nextDay);
  const oobHours = Math.floor(outOfBedMinutes / 60);
  const oobMins = outOfBedMinutes % 60;
  outOfBedTime.setHours(oobHours, oobMins, 0, 0);

  return {
    userId,
    date: entryDate,
    bedtime,
    sleepOnsetLatencyMins,
    numberOfAwakenings,
    wakeAfterSleepOnsetMins,
    finalWakeTime,
    outOfBedTime,
    subjectiveQuality,
    totalSleepTimeMins,
    timeInBedMins,
    sleepEfficiency,
    source: DiarySource.MANUAL,
  };
}

function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

function randomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

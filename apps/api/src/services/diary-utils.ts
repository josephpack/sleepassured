import { prisma } from "@sleepassured/db";

export function calculateSleepMetrics(data: {
  bedtime: Date;
  outOfBedTime: Date;
  sleepOnsetLatencyMins: number;
  wakeAfterSleepOnsetMins: number;
}): { timeInBedMins: number; totalSleepTimeMins: number; sleepEfficiency: number } {
  const timeInBedMins = Math.round(
    (data.outOfBedTime.getTime() - data.bedtime.getTime()) / (1000 * 60)
  );
  const totalSleepTimeMins = Math.max(
    0,
    timeInBedMins - data.sleepOnsetLatencyMins - data.wakeAfterSleepOnsetMins
  );
  const sleepEfficiency =
    timeInBedMins > 0 ? (totalSleepTimeMins / timeInBedMins) * 100 : 0;

  return { timeInBedMins, totalSleepTimeMins, sleepEfficiency };
}

export async function checkAndUpdateBaselineStatus(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { therapyStartDate: true, baselineComplete: true },
  });

  if (!user) return;

  if (user.baselineComplete) return;

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const entryCount = await prisma.sleepDiary.count({
    where: {
      userId,
      date: { gte: sevenDaysAgo },
    },
  });

  if (entryCount >= 5) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        baselineComplete: true,
        therapyStartDate: user.therapyStartDate || new Date(),
      },
    });
  } else if (!user.therapyStartDate) {
    await prisma.user.update({
      where: { id: userId },
      data: { therapyStartDate: new Date() },
    });
  }
}

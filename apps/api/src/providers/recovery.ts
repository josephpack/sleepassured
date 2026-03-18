import { prisma } from "@sleepassured/db";

export interface RecoveryResult {
  avgScore: number | null;
  scores: number[];
  provider: string | null;
}

/**
 * Queries recovery data from ALL connected providers for a given user.
 * Prefers WHOOP (has explicit recovery scores) over Apple Health.
 */
export async function getRecentRecoveryData(
  userId: string,
  since: Date
): Promise<RecoveryResult> {
  // 1. Check WHOOP — has explicit recovery scores
  const whoopConnection = await prisma.whoopConnection.findUnique({
    where: { userId },
    select: { status: true },
  });

  if (whoopConnection && whoopConnection.status === "ACTIVE") {
    const whoopRecords = await prisma.whoopSleepRecord.findMany({
      where: {
        userId,
        startTime: { gte: since },
        recoveryScore: { not: null },
      },
      orderBy: { startTime: "desc" },
      select: { recoveryScore: true },
    });

    if (whoopRecords.length > 0) {
      const scores = whoopRecords.map((r) => r.recoveryScore!);
      const avgScore = Math.round(
        scores.reduce((sum, s) => sum + s, 0) / scores.length
      );
      return { avgScore, scores, provider: "WHOOP" };
    }
  }

  // 2. No WHOOP recovery data — return empty
  // Apple Health doesn't have a direct recovery score equivalent;
  // HRV/RHR are available on diary entries but not as a recovery score.
  return { avgScore: null, scores: [], provider: null };
}

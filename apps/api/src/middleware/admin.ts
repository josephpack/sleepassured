import { Request, Response, NextFunction } from "express";
import { prisma } from "@sleepassured/db";

export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const userId = req.user?.userId;

  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isAdmin: true },
  });

  if (!user?.isAdmin) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  next();
}

-- CreateEnum
CREATE TYPE "WhoopConnectionStatus" AS ENUM ('ACTIVE', 'NEEDS_REAUTH');

-- AlterTable
ALTER TABLE "whoop_connections" ADD COLUMN     "status" "WhoopConnectionStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterEnum: Add BASELINE to WindowAdjustment
ALTER TYPE "WindowAdjustment" ADD VALUE 'BASELINE';

-- AlterTable: Add new columns to users
ALTER TABLE "users" ADD COLUMN "therapy_start_date" DATE;
ALTER TABLE "users" ADD COLUMN "baseline_complete" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "flagged_for_review" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "flagged_reason" TEXT;

-- AlterTable: Restructure sleep_diaries
-- Drop old columns
ALTER TABLE "sleep_diaries" DROP COLUMN IF EXISTS "time_in_bed";
ALTER TABLE "sleep_diaries" DROP COLUMN IF EXISTS "time_out_of_bed";
ALTER TABLE "sleep_diaries" DROP COLUMN IF EXISTS "sleep_onset_latency";
ALTER TABLE "sleep_diaries" DROP COLUMN IF EXISTS "wake_after_sleep_onset";
ALTER TABLE "sleep_diaries" DROP COLUMN IF EXISTS "total_sleep_time";
ALTER TABLE "sleep_diaries" DROP COLUMN IF EXISTS "mood";
ALTER TABLE "sleep_diaries" DROP COLUMN IF EXISTS "whoop_recovery_score";
ALTER TABLE "sleep_diaries" DROP COLUMN IF EXISTS "followed_window";

-- Add new columns
ALTER TABLE "sleep_diaries" ADD COLUMN "bedtime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "sleep_diaries" ADD COLUMN "sleep_onset_latency_mins" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "sleep_diaries" ADD COLUMN "number_of_awakenings" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "sleep_diaries" ADD COLUMN "wake_after_sleep_onset_mins" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "sleep_diaries" ADD COLUMN "final_wake_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "sleep_diaries" ADD COLUMN "out_of_bed_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "sleep_diaries" ADD COLUMN "total_sleep_time_mins" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "sleep_diaries" ADD COLUMN "time_in_bed_mins" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "sleep_diaries" ADD COLUMN "whoop_sleep_record_id" TEXT;

-- Remove defaults after adding (they were only needed for existing rows)
ALTER TABLE "sleep_diaries" ALTER COLUMN "bedtime" DROP DEFAULT;
ALTER TABLE "sleep_diaries" ALTER COLUMN "sleep_onset_latency_mins" DROP DEFAULT;
ALTER TABLE "sleep_diaries" ALTER COLUMN "number_of_awakenings" DROP DEFAULT;
ALTER TABLE "sleep_diaries" ALTER COLUMN "wake_after_sleep_onset_mins" DROP DEFAULT;
ALTER TABLE "sleep_diaries" ALTER COLUMN "final_wake_time" DROP DEFAULT;
ALTER TABLE "sleep_diaries" ALTER COLUMN "out_of_bed_time" DROP DEFAULT;
ALTER TABLE "sleep_diaries" ALTER COLUMN "total_sleep_time_mins" DROP DEFAULT;
ALTER TABLE "sleep_diaries" ALTER COLUMN "time_in_bed_mins" DROP DEFAULT;

-- AlterTable: Restructure sleep_windows
-- Drop old unique constraint and columns
DROP INDEX IF EXISTS "sleep_windows_user_id_week_number_key";
ALTER TABLE "sleep_windows" DROP COLUMN IF EXISTS "week_number";
ALTER TABLE "sleep_windows" DROP COLUMN IF EXISTS "time_in_bed_allowed";
ALTER TABLE "sleep_windows" DROP COLUMN IF EXISTS "started_at";
ALTER TABLE "sleep_windows" DROP COLUMN IF EXISTS "ended_at";
ALTER TABLE "sleep_windows" DROP COLUMN IF EXISTS "sleep_efficiency";
ALTER TABLE "sleep_windows" DROP COLUMN IF EXISTS "adherence_percentage";
ALTER TABLE "sleep_windows" DROP COLUMN IF EXISTS "adjustment_applied";

-- Add new columns
ALTER TABLE "sleep_windows" ADD COLUMN "week_start_date" DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE "sleep_windows" ADD COLUMN "time_in_bed_mins" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "sleep_windows" ADD COLUMN "avg_sleep_efficiency" DECIMAL(5,2);
ALTER TABLE "sleep_windows" ADD COLUMN "adjustment_made" "WindowAdjustment";
ALTER TABLE "sleep_windows" ADD COLUMN "adjustment_mins" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "sleep_windows" ADD COLUMN "feedback_message" TEXT;

-- Remove defaults after adding
ALTER TABLE "sleep_windows" ALTER COLUMN "week_start_date" DROP DEFAULT;
ALTER TABLE "sleep_windows" ALTER COLUMN "time_in_bed_mins" DROP DEFAULT;

-- CreateIndex
CREATE UNIQUE INDEX "sleep_windows_user_id_week_start_date_key" ON "sleep_windows"("user_id", "week_start_date");

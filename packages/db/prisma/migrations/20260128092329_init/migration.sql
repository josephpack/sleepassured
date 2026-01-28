-- CreateEnum
CREATE TYPE "DiarySource" AS ENUM ('MANUAL', 'WHOOP', 'HYBRID');

-- CreateEnum
CREATE TYPE "Mood" AS ENUM ('VERY_POOR', 'POOR', 'OKAY', 'GOOD', 'GREAT');

-- CreateEnum
CREATE TYPE "WindowAdjustment" AS ENUM ('INCREASE', 'DECREASE', 'NONE');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "target_wake_time" TEXT,
    "onboarding_completed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "isi_assessments" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "responses" JSONB NOT NULL,
    "completed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "isi_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sleep_diaries" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "time_in_bed" TIMESTAMP(3) NOT NULL,
    "time_out_of_bed" TIMESTAMP(3) NOT NULL,
    "sleep_onset_latency" INTEGER,
    "wake_after_sleep_onset" INTEGER,
    "total_sleep_time" INTEGER NOT NULL,
    "sleep_efficiency" DECIMAL(5,2) NOT NULL,
    "subjective_quality" INTEGER NOT NULL,
    "mood" "Mood",
    "notes" TEXT,
    "source" "DiarySource" NOT NULL DEFAULT 'MANUAL',
    "whoop_recovery_score" INTEGER,
    "followed_window" BOOLEAN,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sleep_diaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sleep_windows" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "week_number" INTEGER NOT NULL,
    "prescribed_bedtime" TEXT NOT NULL,
    "prescribed_wake_time" TEXT NOT NULL,
    "time_in_bed_allowed" INTEGER NOT NULL,
    "started_at" DATE NOT NULL,
    "ended_at" DATE,
    "sleep_efficiency" DECIMAL(5,2),
    "adherence_percentage" DECIMAL(5,2),
    "adjustment_applied" "WindowAdjustment",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sleep_windows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whoop_connections" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "whoop_user_id" TEXT NOT NULL,
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT NOT NULL,
    "token_expires_at" TIMESTAMP(3) NOT NULL,
    "connected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_synced_at" TIMESTAMP(3),

    CONSTRAINT "whoop_connections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "sleep_diaries_user_id_date_key" ON "sleep_diaries"("user_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "sleep_windows_user_id_week_number_key" ON "sleep_windows"("user_id", "week_number");

-- CreateIndex
CREATE UNIQUE INDEX "whoop_connections_user_id_key" ON "whoop_connections"("user_id");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "isi_assessments" ADD CONSTRAINT "isi_assessments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sleep_diaries" ADD CONSTRAINT "sleep_diaries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sleep_windows" ADD CONSTRAINT "sleep_windows_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whoop_connections" ADD CONSTRAINT "whoop_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

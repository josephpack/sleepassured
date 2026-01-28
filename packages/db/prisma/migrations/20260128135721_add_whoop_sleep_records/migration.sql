-- CreateTable
CREATE TABLE "whoop_sleep_records" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "whoop_sleep_id" BIGINT NOT NULL,
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3) NOT NULL,
    "total_sleep_duration_ms" BIGINT NOT NULL,
    "rem_sleep_ms" BIGINT NOT NULL,
    "light_sleep_ms" BIGINT NOT NULL,
    "deep_sleep_ms" BIGINT NOT NULL,
    "awake_duration_ms" BIGINT NOT NULL,
    "sleep_efficiency" DECIMAL(5,2) NOT NULL,
    "recovery_score" INTEGER,
    "hrv_rmssd" DECIMAL(6,2),
    "resting_heart_rate" INTEGER,
    "raw_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whoop_sleep_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "whoop_sleep_records_whoop_sleep_id_key" ON "whoop_sleep_records"("whoop_sleep_id");

-- AddForeignKey
ALTER TABLE "whoop_sleep_records" ADD CONSTRAINT "whoop_sleep_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

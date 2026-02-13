-- AlterTable
ALTER TABLE "users" ADD COLUMN "is_admin" BOOLEAN NOT NULL DEFAULT false;

-- Set admin users
UPDATE "users" SET "is_admin" = true WHERE "email" IN ('hello@josephpack.com', 'asad@sanctumhealthcare.co.uk');

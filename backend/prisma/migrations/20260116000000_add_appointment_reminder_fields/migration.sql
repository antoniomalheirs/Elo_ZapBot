-- AlterTable
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "reminderSent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "dayOfReminderSent" BOOLEAN NOT NULL DEFAULT false;

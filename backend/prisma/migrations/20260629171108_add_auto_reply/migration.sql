-- AlterTable
ALTER TABLE "User" ADD COLUMN     "autoReplyDelay" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "autoReplyEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "autoReplyMessage" TEXT NOT NULL DEFAULT 'Hi! Thanks for reaching out. I''ll get back to you as soon as possible.';

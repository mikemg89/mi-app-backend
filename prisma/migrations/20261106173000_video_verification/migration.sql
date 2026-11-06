-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('AWAITING_UPLOAD', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'EXPIRED');

-- CreateTable
CREATE TABLE "VideoVerification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "challenge" TEXT NOT NULL,
    "status" "VerificationStatus" NOT NULL DEFAULT 'AWAITING_UPLOAD',
    "storagePath" TEXT,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "uploadedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "reason" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "purgeAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VideoVerification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VideoVerification_userId_createdAt_idx" ON "VideoVerification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "VideoVerification_status_idx" ON "VideoVerification"("status");

-- AddForeignKey
ALTER TABLE "VideoVerification" ADD CONSTRAINT "VideoVerification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

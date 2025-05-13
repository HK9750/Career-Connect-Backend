/*
  Warnings:

  - You are about to drop the column `resumeId` on the `Review` table. All the data in the column will be lost.
  - You are about to drop the column `reviewerId` on the `Review` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[applicationId]` on the table `Review` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `applicationId` to the `Review` table without a default value. This is not possible if the table is not empty.
  - Added the required column `recruiterId` to the `Review` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Review" DROP CONSTRAINT "Review_resumeId_fkey";

-- DropForeignKey
ALTER TABLE "Review" DROP CONSTRAINT "Review_reviewerId_fkey";

-- AlterTable
ALTER TABLE "Review" DROP COLUMN "resumeId",
DROP COLUMN "reviewerId",
ADD COLUMN     "applicationId" INTEGER NOT NULL,
ADD COLUMN     "recruiterId" INTEGER NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Review_applicationId_key" ON "Review"("applicationId");

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_recruiterId_fkey" FOREIGN KEY ("recruiterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

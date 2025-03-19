/*
  Warnings:

  - You are about to drop the column `postedById` on the `Job` table. All the data in the column will be lost.
  - Added the required column `company` to the `Job` table without a default value. This is not possible if the table is not empty.
  - Added the required column `recruiterId` to the `Job` table without a default value. This is not possible if the table is not empty.
  - Added the required column `username` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Job" DROP CONSTRAINT "Job_postedById_fkey";

-- AlterTable
ALTER TABLE "Job" DROP COLUMN "postedById",
ADD COLUMN     "company" TEXT NOT NULL,
ADD COLUMN     "recruiterId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Resume" ADD COLUMN     "comment" TEXT,
ADD COLUMN     "recruiterId" INTEGER;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "username" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_recruiterId_fkey" FOREIGN KEY ("recruiterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

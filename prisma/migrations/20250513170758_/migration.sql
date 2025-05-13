-- DropForeignKey
ALTER TABLE "Review" DROP CONSTRAINT "Review_applicationId_fkey";

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import ErrorHandler from '../utils/error-handler';
import AsyncErrorHandler from '../utils/async-handler';
import { ApplicationStatus, Role } from '@prisma/client';

// Submit a review for an application (only by recruiter)
export const submitReview = AsyncErrorHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const { applicationId } = req.params;
        const { comment } = req.body;
        const reviewer = req.user;

        // Authorization: must be logged in
        if (!reviewer) {
            return next(new ErrorHandler('Authentication required', 401));
        }
        // Only recruiters can review
        if (reviewer.role !== Role.RECRUITER) {
            return next(new ErrorHandler('Forbidden: recruiters only', 403));
        }
        // Validate input
        if (!comment || !comment.trim()) {
            return next(new ErrorHandler('Comment is required', 400));
        }

        // Check application exists
        const application = await prisma.application.findUnique({
            where: { id: Number(applicationId) },
            include: {
                job: true,
                resume: true,
            },
        });
        if (!application) {
            return next(new ErrorHandler('Application not found', 404));
        }

        console.log('RecruiterId:', typeof application.job.recruiterId);
        console.log('ReviewerId:', typeof reviewer.id);
        // Ensure recruiter owns the job
        if (application.job.recruiterId !== Number(reviewer.id)) {
            return next(
                new ErrorHandler('Not authorized for this application', 403)
            );
        }

        // Prevent duplicate review
        const existing = await prisma.review.findUnique({
            where: { applicationId: application.id },
        });
        if (existing) {
            return next(
                new ErrorHandler(
                    'Review already exists for this application',
                    409
                )
            );
        }

        // Create review and update application status
        const review = await prisma.review.create({
            data: {
                application: { connect: { id: application.id } },
                recruiter: { connect: { id: Number(reviewer.id) } },
                comment,
            },
        });
        await prisma.application.update({
            where: { id: application.id },
            data: { status: ApplicationStatus.REVIEWED },
        });

        res.status(201).json({ success: true, data: review });
    }
);

export const updateReview = AsyncErrorHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const { applicationId } = req.params;
        const { comment } = req.body;
        const reviewer = req.user;

        // Authorization: must be logged in
        if (!reviewer) {
            return next(new ErrorHandler('Authentication required', 401));
        }
        // Only recruiters can review
        if (reviewer.role !== Role.RECRUITER) {
            return next(new ErrorHandler('Forbidden: recruiters only', 403));
        }
        // Validate input
        if (!comment || !comment.trim()) {
            return next(new ErrorHandler('Comment is required', 400));
        }

        // Check application exists
        const application = await prisma.application.findUnique({
            where: { id: Number(applicationId) },
            include: {
                job: true,
                resume: true,
            },
        });
        if (!application) {
            return next(new ErrorHandler('Application not found', 404));
        }

        // Ensure recruiter owns the job
        if (application.job.recruiterId !== Number(reviewer.id)) {
            return next(
                new ErrorHandler('Not authorized for this application', 403)
            );
        }

        // Check review exists
        const review = await prisma.review.findUnique({
            where: { applicationId: application.id },
        });
        if (!review) {
            return next(new ErrorHandler('Review not found', 404));
        }

        // Update review
        const updatedReview = await prisma.review.update({
            where: { id: review.id },
            data: { comment },
        });

        res.status(200).json({ success: true, data: updatedReview });
    }
);

// Get the review for a specific application
export const getReview = AsyncErrorHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const { applicationId } = req.params;
        const requester = req.user;

        if (!requester) {
            return next(new ErrorHandler('Authentication required', 401));
        }

        const review = await prisma.review.findUnique({
            where: { applicationId: Number(applicationId) },
            include: {
                recruiter: { select: { id: true, username: true } },
                application: {
                    select: {
                        id: true,
                        applicantId: true,
                        resume: { select: { id: true, title: true } },
                    },
                },
            },
        });
        if (!review) {
            return next(new ErrorHandler('Review not found', 404));
        }

        // Only recruiter or the applicant can view
        const isApplicant =
            review.application.applicantId === Number(requester.id);
        const isRecruiter = review.recruiter.id === Number(requester.id);
        if (!isApplicant && !isRecruiter) {
            return next(
                new ErrorHandler('Not authorized to view this review', 403)
            );
        }

        res.status(200).json({ success: true, data: review });
    }
);

// Delete a review (only the recruiter who created it)
export const deleteReview = AsyncErrorHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const { applicationId } = req.params;
        const user = req.user;

        if (!user) {
            return next(new ErrorHandler('Authentication required', 401));
        }

        const review = await prisma.review.findUnique({
            where: { applicationId: Number(applicationId) },
        });
        if (!review) {
            return next(new ErrorHandler('Review not found', 404));
        }
        if (review.recruiterId !== Number(user.id)) {
            return next(
                new ErrorHandler('Not authorized to delete this review', 403)
            );
        }

        await prisma.review.delete({ where: { id: review.id } });
        // Optionally revert application status
        await prisma.application.update({
            where: { id: review.applicationId },
            data: { status: ApplicationStatus.APPLIED },
        });

        res.status(200).json({ success: true, message: 'Review deleted' });
    }
);

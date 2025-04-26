import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import ErrorHandler from '../utils/error-handler';
import AsyncErrorHandler from '../utils/async-handler';

export const submitReview = AsyncErrorHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const { resumeId } = req.params;
        const { comment } = req.body;
        const reviewerId = req.user?.id;
        if (!reviewerId) return next(new ErrorHandler('Not authorized', 401));
        if (!comment || !comment.trim())
            return next(new ErrorHandler('Comment is required', 400));
        const resume = await prisma.resume.findUnique({
            where: { id: Number(resumeId) },
        });
        if (!resume) return next(new ErrorHandler('Resume not found', 404));
        const review = await prisma.review.create({
            data: {
                resumeId: Number(resumeId),
                reviewerId: Number(reviewerId),
                comment,
            },
        });
        res.status(201).json({ success: true, review });
    }
);

export const getReviews = AsyncErrorHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const { resumeId } = req.params;
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(100, Number(req.query.limit) || 10);
        const reviews = await prisma.review.findMany({
            where: { resumeId: Number(resumeId) },
            include: { reviewer: { select: { id: true, username: true } } },
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * limit,
            take: limit,
        });
        const total = await prisma.review.count({
            where: { resumeId: Number(resumeId) },
        });
        res.status(200).json({
            success: true,
            reviews,
            pagination: { page, limit, total },
        });
    }
);

export const deleteReview = AsyncErrorHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const { reviewId } = req.params;
        const userId = req.user?.id;
        const review = await prisma.review.findUnique({
            where: { id: Number(reviewId) },
        });
        if (!review) return next(new ErrorHandler('Review not found', 404));
        if (review.reviewerId !== Number(userId))
            return next(
                new ErrorHandler('Not authorized to delete this review', 403)
            );
        await prisma.review.delete({ where: { id: Number(reviewId) } });
        res.status(200).json({ success: true, message: 'Review deleted' });
    }
);

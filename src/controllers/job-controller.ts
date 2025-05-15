import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import ErrorHandler from '../utils/error-handler';
import AsyncErrorHandler from '../utils/async-handler';

export const createJob = AsyncErrorHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const recruiterId = req.user?.id;
        const { title, description, company, location, tags } = req.body;
        if (!recruiterId) return next(new ErrorHandler('Not authorized', 401));
        if (!title || !description || !company)
            return next(
                new ErrorHandler(
                    'Title, description, and company are required',
                    400
                )
            );
        const job = await prisma.job.create({
            data: {
                title,
                description,
                company,
                location,
                recruiterId: Number(recruiterId),
                tags: tags ? { set: tags } : undefined,
            },
        });
        res.status(201).json({ success: true, job });
    }
);

export const listJobs = AsyncErrorHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const { keyword, location, page = 1, limit = 10 } = req.query as any;
        const filters: any = {};
        if (keyword)
            filters.OR = [
                { title: { contains: String(keyword), mode: 'insensitive' } },
                {
                    description: {
                        contains: String(keyword),
                        mode: 'insensitive',
                    },
                },
                { company: { contains: String(keyword), mode: 'insensitive' } },
            ];
        if (location)
            filters.location = {
                contains: String(location),
                mode: 'insensitive',
            };
        const take = Math.min(100, Number(limit));
        const skip = (Math.max(1, Number(page)) - 1) * take;
        const [jobs, total] = await Promise.all([
            prisma.job.findMany({
                where: filters,
                skip,
                take,
                orderBy: { createdAt: 'desc' },
            }),
            prisma.job.count({ where: filters }),
        ]);
        res.status(200).json({
            success: true,
            jobs,
            pagination: { page: Number(page), limit: take, total },
        });
    }
);

export const getJob = AsyncErrorHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        console.log('getJob');
        const { jobId } = req.params;
        if (!jobId || isNaN(Number(jobId)))
            return next(new ErrorHandler('Invalid job ID', 400));
        const job = await prisma.job.findUnique({
            where: { id: Number(jobId) },
        });
        if (!job) return next(new ErrorHandler('Job not found', 404));
        res.status(200).json({ success: true, job });
    }
);

export const updateJob = AsyncErrorHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const { jobId } = req.params;
        const recruiterId = req.user?.id;
        const data = req.body;
        if (!recruiterId) return next(new ErrorHandler('Not authorized', 401));
        const job = await prisma.job.findUnique({
            where: { id: Number(jobId) },
        });
        if (!job) return next(new ErrorHandler('Job not found', 404));
        if (job.recruiterId !== Number(recruiterId))
            return next(
                new ErrorHandler('Not authorized to update this job', 403)
            );
        const updated = await prisma.job.update({
            where: { id: Number(jobId) },
            data,
        });
        res.status(200).json({ success: true, job: updated });
    }
);

export const deleteJob = AsyncErrorHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const { jobId } = req.params;
        const recruiterId = req.user?.id;
        const job = await prisma.job.findUnique({
            where: { id: Number(jobId) },
        });
        if (!job) return next(new ErrorHandler('Job not found', 404));
        if (job.recruiterId !== Number(recruiterId))
            return next(
                new ErrorHandler('Not authorized to delete this job', 403)
            );
        await prisma.job.delete({ where: { id: Number(jobId) } });
        res.status(200).json({ success: true, message: 'Job deleted' });
    }
);

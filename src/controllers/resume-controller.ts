import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import ErrorHandler from '../utils/error-handler';
import AsyncErrorHandler from '../utils/async-handler';
import prisma from '../lib/prisma';

export const uploadResume = AsyncErrorHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const userId = req.user?.id;
        if (!userId) return next(new ErrorHandler('Not authorized', 401));
        if (!req.file) return next(new ErrorHandler('No file uploaded', 400));

        const filename = req.file.filename;

        try {
            const resume = await prisma.resume.create({
                data: {
                    ownerId: Number(userId),
                    filePath: filename,
                    title: req.body.title,
                },
            });
            res.status(201).json({ success: true, resume });
        } catch (err) {
            return next(new ErrorHandler('Error creating resume', 500));
        }
    }
);

export const getResumes = AsyncErrorHandler(
    async (_req: Request, res: Response, next: NextFunction) => {
        try {
            const resumes = await prisma.resume.findMany();
            res.status(200).json({ success: true, resumes });
        } catch (err) {
            return next(new ErrorHandler('Error fetching resumes', 500));
        }
    }
);

export const downloadResume = AsyncErrorHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const userId = req.user?.id;
        const { resumeId } = req.params;
        if (!userId) return next(new ErrorHandler('Not authorized', 401));
        if (!resumeId || isNaN(Number(resumeId))) {
            return next(new ErrorHandler('Invalid resume ID', 400));
        }

        try {
            const resume = await prisma.resume.findUnique({
                where: { id: Number(resumeId) },
            });
            if (!resume) return next(new ErrorHandler('Resume not found', 404));
            if (resume.ownerId !== Number(userId)) {
                return next(
                    new ErrorHandler(
                        'Not authorized to download this resume',
                        403
                    )
                );
            }

            const filePath = path.join(
                __dirname,
                '../uploads/resumes',
                resume.filePath
            );
            res.download(filePath);
        } catch (err) {
            return next(new ErrorHandler('Error downloading resume', 500));
        }
    }
);

export const updateResume = AsyncErrorHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const userId = req.user?.id;
        const { resumeId } = req.params;
        if (!userId) return next(new ErrorHandler('Not authorized', 401));
        if (!resumeId || isNaN(Number(resumeId))) {
            return next(new ErrorHandler('Invalid resume ID', 400));
        }
        if (!req.file) {
            return next(new ErrorHandler('No file uploaded for update', 400));
        }

        try {
            const resume = await prisma.resume.findUnique({
                where: { id: Number(resumeId) },
            });
            if (!resume) return next(new ErrorHandler('Resume not found', 404));
            if (resume.ownerId !== Number(userId)) {
                return next(
                    new ErrorHandler(
                        'Not authorized to update this resume',
                        403
                    )
                );
            }

            // Deleting old file
            const oldPath = path.join(
                __dirname,
                '../uploads/resumes',
                resume.filePath
            );
            if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);

            const newFilename = req.file.filename;
            const updated = await prisma.resume.update({
                where: { id: Number(resumeId) },
                data: { filePath: newFilename },
            });

            res.status(200).json({ success: true, resume: updated });
        } catch (err) {
            return next(new ErrorHandler('Error updating resume', 500));
        }
    }
);

export const deleteResume = AsyncErrorHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const userId = req.user?.id;
        const { resumeId } = req.params;
        if (!userId) return next(new ErrorHandler('Not authorized', 401));
        if (!resumeId || isNaN(Number(resumeId))) {
            return next(new ErrorHandler('Invalid resume ID', 400));
        }

        try {
            const resume = await prisma.resume.findUnique({
                where: { id: Number(resumeId) },
            });
            if (!resume) return next(new ErrorHandler('Resume not found', 404));
            if (resume.ownerId !== Number(userId)) {
                return next(
                    new ErrorHandler(
                        'Not authorized to delete this resume',
                        403
                    )
                );
            }

            const filePath = path.join(
                __dirname,
                '../uploads/resumes',
                resume.filePath
            );
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

            await prisma.resume.delete({ where: { id: Number(resumeId) } });

            res.status(200).json({
                success: true,
                message: 'Resume deleted successfully',
            });
        } catch (err) {
            return next(new ErrorHandler('Error deleting resume', 500));
        }
    }
);

export const getResume = AsyncErrorHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const userId = req.user?.id;
        const { resumeId } = req.params;
        if (!userId) return next(new ErrorHandler('Not authorized', 401));
        if (!resumeId || isNaN(Number(resumeId))) {
            return next(new ErrorHandler('Invalid resume ID', 400));
        }

        try {
            const resume = await prisma.resume.findUnique({
                where: { id: Number(resumeId) },
            });
            if (!resume) return next(new ErrorHandler('Resume not found', 404));
            if (resume.ownerId !== Number(userId)) {
                return next(
                    new ErrorHandler('Not authorized to view this resume', 403)
                );
            }

            res.status(200).json({ success: true, resume });
        } catch (err) {
            return next(new ErrorHandler('Error fetching resume', 500));
        }
    }
);

export const getResumeByUser = AsyncErrorHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const userId = req.user?.id;
        if (!userId) return next(new ErrorHandler('Not authorized', 401));

        try {
            // Find resumes by the logged-in user (based on ownerId)
            const resumes = await prisma.resume.findMany({
                where: { ownerId: Number(userId) },
                include: {
                    owner: {
                        select: { id: true, username: true, email: true },
                    },
                    applications: true, // Include the applications related to the resume
                },
            });

            if (!resumes.length)
                return next(
                    new ErrorHandler('No resumes found for this user', 404)
                );
            console.log(resumes);
            res.status(200).json({ success: true, resumes });
        } catch (err) {
            return next(
                new ErrorHandler('Error fetching resumes by user', 500)
            );
        }
    }
);

export const getResumeByRecruiter = AsyncErrorHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const recruiterId = req.user?.id;
        if (!recruiterId) return next(new ErrorHandler('Not authorized', 401));

        try {
            // Find resumes that have applications with a job linked to this recruiter
            const resumes = await prisma.resume.findMany({
                where: {
                    applications: {
                        some: {
                            job: { recruiterId: Number(recruiterId) },
                        },
                    },
                },
                include: {
                    owner: {
                        select: { id: true, username: true, email: true },
                    },
                    applications: true, // Include the applications related to the resume
                },
            });

            if (!resumes.length)
                return next(
                    new ErrorHandler('No resumes found for this recruiter', 404)
                );

            res.status(200).json({ success: true, resumes });
        } catch (err) {
            return next(
                new ErrorHandler('Error fetching resumes for recruiter', 500)
            );
        }
    }
);

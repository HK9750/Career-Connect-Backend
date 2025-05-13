import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import ErrorHandler from '../utils/error-handler';
import AsyncErrorHandler from '../utils/async-handler';

const validStatuses = ['APPLIED', 'REVIEWED', 'ACCEPTED', 'REJECTED'];

export const applyForJob = AsyncErrorHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const { jobId } = req.params;
        const applicantId = req.user?.id;
        const role = req.user?.role;

        if (role === 'RECRUITER') {
            return next(
                new ErrorHandler('Recruiters Cannot Apply to a Job', 401)
            );
        }
        if (!jobId || isNaN(Number(jobId))) {
            return next(new ErrorHandler('Invalid job ID', 400));
        }
        if (!applicantId) {
            return next(new ErrorHandler('Not authorized', 401));
        }
        const existing = await prisma.application.findFirst({
            where: { jobId: Number(jobId), applicantId: Number(applicantId) },
        });
        if (existing) {
            return next(
                new ErrorHandler('You have already applied for this job', 400)
            );
        }
        const resume = await prisma.resume.findFirst({
            where: { ownerId: Number(applicantId) },
        });
        if (!resume) {
            return next(
                new ErrorHandler('Please upload a resume before applying', 404)
            );
        }
        const application = await prisma.application.create({
            data: {
                jobId: Number(jobId),
                applicantId: Number(applicantId),
                resumeId: resume.id,
            },
        });
        res.status(201).json({
            success: true,
            application,
            resumeId: resume.id,
        });
    }
);

export const getApplication = AsyncErrorHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const { applicationId } = req.params;
        if (!applicationId || isNaN(Number(applicationId))) {
            return next(new ErrorHandler('Invalid application ID', 400));
        }
        const application = await prisma.application.findUnique({
            where: { id: Number(applicationId) },
            include: {
                job: true,
                resume: true,
                analysis: true,
                applicant: true,
            },
        });
        if (!application) {
            return next(new ErrorHandler('Application not found', 404));
        }
        const userId = req.user?.id;
        if (
            application.applicantId !== Number(userId) &&
            application.job.recruiterId !== Number(userId)
        ) {
            return next(
                new ErrorHandler('Not authorized to view this application', 403)
            );
        }
        res.status(200).json({ success: true, application });
    }
);

export const listApplicationsByApplicant = AsyncErrorHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const applicantId = req.user?.id;
        if (!applicantId) {
            return next(new ErrorHandler('Not authorized', 401));
        }
        const applications = await prisma.application.findMany({
            where: { applicantId: Number(applicantId) },
            include: { job: true, resume: true },
            orderBy: { createdAt: 'desc' },
        });
        console.log('Applications By Applicant', applications);
        res.status(200).json({ success: true, applications });
    }
);

export const listApplicationsByRecruiter = AsyncErrorHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const recruiterId = req.user?.id;
        if (!recruiterId) {
            return next(new ErrorHandler('Not authorized', 401));
        }
        const applications = await prisma.application.findMany({
            where: { job: { recruiterId: Number(recruiterId) } },
            include: {
                job: true,
                resume: true,
                applicant: true,
                analysis: true,
            },
            orderBy: { createdAt: 'desc' },
        });
        console.log('Applications By Recruiter', applications);
        res.status(200).json({ success: true, applications });
    }
);

export const updateApplicationStatus = AsyncErrorHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const { applicationId } = req.params;
        const { status } = req.body;
        if (!applicationId || isNaN(Number(applicationId))) {
            return next(new ErrorHandler('Invalid application ID', 400));
        }
        if (!status || !validStatuses.includes(status)) {
            return next(new ErrorHandler('Invalid status', 400));
        }
        const application = await prisma.application.findUnique({
            where: { id: Number(applicationId) },
            include: { job: true },
        });
        if (!application) {
            return next(new ErrorHandler('Application not found', 404));
        }
        const recruiterId = req.user?.id;
        if (application.job.recruiterId !== Number(recruiterId)) {
            return next(
                new ErrorHandler(
                    'Not authorized to update this application',
                    403
                )
            );
        }
        const updated = await prisma.application.update({
            where: { id: Number(applicationId) },
            data: { status },
        });
        res.status(200).json({ success: true, application: updated });
    }
);

export const deleteApplication = AsyncErrorHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const { applicationId } = req.params;
        if (!applicationId || isNaN(Number(applicationId))) {
            return next(new ErrorHandler('Invalid application ID', 400));
        }
        const application = await prisma.application.findUnique({
            where: { id: Number(applicationId) },
        });
        if (!application) {
            return next(new ErrorHandler('Application not found', 404));
        }
        if (application.applicantId !== Number(req.user?.id)) {
            return next(
                new ErrorHandler(
                    'Not authorized to delete this application',
                    403
                )
            );
        }
        await prisma.application.delete({
            where: { id: Number(applicationId) },
        });
        res.status(200).json({
            success: true,
            message: 'Application cancelled successfully',
        });
    }
);

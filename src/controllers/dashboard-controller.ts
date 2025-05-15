import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import ErrorHandler from '../utils/error-handler';
import AsyncErrorHandler from '../utils/async-handler';

export const getDashboardInfo = AsyncErrorHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = req.user?.id;
            const role = req.user?.role;

            if (!userId) {
                return next(new ErrorHandler('Not authorized', 401));
            }

            let dashboardInfo: any = {};

            if (role === 'RECRUITER') {
                // Get basic recruiter info
                const recruiter = await prisma.user.findUnique({
                    where: { id: Number(userId) },
                    select: {
                        id: true,
                        email: true,
                        username: true,
                        role: true,
                    },
                });

                // Get jobs created by recruiter
                const jobs = await prisma.job.findMany({
                    where: { recruiterId: Number(userId) },
                });

                // Get applications for jobs posted by this recruiter
                const applications = await prisma.application.findMany({
                    where: {
                        job: {
                            recruiterId: Number(userId),
                        },
                    },
                    include: {
                        applicant: {
                            select: {
                                id: true,
                                username: true,
                                email: true,
                            },
                        },
                        job: {
                            select: {
                                id: true,
                                title: true,
                            },
                        },
                    },
                });

                // Count unique candidates who applied to recruiter's jobs
                const uniqueCandidates = new Set(
                    applications.map((app) => app.applicantId)
                ).size;

                // Count applications by status
                const applicationsByStatus = {
                    APPLIED: 0,
                    REVIEWED: 0,
                    ACCEPTED: 0,
                    REJECTED: 0,
                };

                applications.forEach((app) => {
                    applicationsByStatus[app.status]++;
                });

                // Applications per job
                const applicationsPerJob = jobs.map((job) => {
                    const jobApps = applications.filter(
                        (app) => app.jobId === job.id
                    );
                    return {
                        jobId: job.id,
                        jobTitle: job.title,
                        totalApplications: jobApps.length,
                    };
                });

                dashboardInfo = {
                    recruiter,
                    metrics: {
                        totalJobs: jobs.length,
                        totalApplications: applications.length,
                        uniqueCandidates,
                        applicationsByStatus,
                    },
                    jobs,
                    applicationsPerJob,
                    recentApplications: applications
                        .sort(
                            (a, b) =>
                                new Date(b.createdAt).getTime() -
                                new Date(a.createdAt).getTime()
                        )
                        .slice(0, 5),
                };
            } else if (role === 'CANDIDATE') {
                // Get basic candidate info
                const candidate = await prisma.user.findUnique({
                    where: { id: Number(userId) },
                    select: {
                        id: true,
                        email: true,
                        username: true,
                        role: true,
                    },
                });

                // Get candidate's applications with job details
                const applications = await prisma.application.findMany({
                    where: { applicantId: Number(userId) },
                    include: {
                        job: true,
                        resume: true,
                        review: true,
                    },
                    orderBy: {
                        createdAt: 'desc',
                    },
                });

                // Get candidate's resumes
                const resumes = await prisma.resume.findMany({
                    where: { ownerId: Number(userId) },
                });

                // Get candidate's analyses
                const analyses = await prisma.analysis.findMany({
                    where: { applicantId: Number(userId) },
                    orderBy: {
                        createdAt: 'desc',
                    },
                });

                // Count applications by status
                const applicationsByStatus = {
                    APPLIED: 0,
                    REVIEWED: 0,
                    ACCEPTED: 0,
                    REJECTED: 0,
                };

                applications.forEach((app) => {
                    applicationsByStatus[app.status]++;
                });

                // Calculate success rate (accepted applications)
                const successRate =
                    applications.length > 0
                        ? (
                              (applicationsByStatus.ACCEPTED /
                                  applications.length) *
                              100
                          ).toFixed(1)
                        : 0;

                // Find most used resume
                const resumeUsage = resumes.map((resume) => {
                    const uses = applications.filter(
                        (app) => app.resumeId === resume.id
                    ).length;
                    return {
                        resumeId: resume.id,
                        resumeTitle: resume.title,
                        uses,
                    };
                });

                resumeUsage.sort((a, b) => b.uses - a.uses);

                dashboardInfo = {
                    candidate,
                    metrics: {
                        totalApplications: applications.length,
                        applicationsByStatus,
                        successRate,
                        totalResumes: resumes.length,
                        totalAnalyses: analyses.length,
                    },
                    applications: applications.map((app) => ({
                        id: app.id,
                        jobTitle: app.job.title,
                        company: app.job.company,
                        status: app.status,
                        appliedOn: app.createdAt,
                        hasReview: app.review !== null,
                    })),
                    resumeUsage: resumeUsage.length > 0 ? resumeUsage[0] : null,
                    recentAnalyses: analyses.slice(0, 3),
                };
            } else {
                return next(new ErrorHandler('Invalid user role', 400));
            }

            res.status(200).json({ success: true, dashboardInfo });
        } catch (error: any) {
            return next(
                new ErrorHandler(
                    `Error fetching dashboard info: ${error.message}`,
                    500
                )
            );
        }
    }
);

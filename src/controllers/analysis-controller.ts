import { Request, Response, NextFunction } from 'express';
import ErrorHandler from '../utils/error-handler';
import AsyncErrorHandler from '../utils/async-handler';
import prisma from '../lib/prisma';
import fs from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import openai from '../lib/openai';

const extractTextFromFile = async (filePath: string): Promise<string> => {
    if (!fs.existsSync(filePath)) {
        throw new Error(`File not found at ${filePath}`);
    }
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.pdf') {
        const dataBuffer = fs.readFileSync(filePath);
        const data = await pdfParse(dataBuffer);
        return data.text;
    }
    if (ext === '.docx') {
        const dataBuffer = fs.readFileSync(filePath);
        const result = await mammoth.extractRawText({ buffer: dataBuffer });
        return result.value;
    }
    throw new Error(
        `Unsupported file format: ${ext}. Only PDF and DOCX are supported.`
    );
};

export const analyzeResume = AsyncErrorHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const { resumeId } = req.params;
        const { jobId, jdText } = req.body;
        if (!resumeId || isNaN(Number(resumeId))) {
            return next(new ErrorHandler('Invalid resume ID', 400));
        }
        const resume = await prisma.resume.findUnique({
            where: { id: Number(resumeId) },
        });
        if (!resume) {
            return next(new ErrorHandler('Resume not found', 404));
        }
        const filePath = path.join(
            __dirname,
            '../uploads/resumes',
            resume.filePath
        );
        const resumeText = await extractTextFromFile(filePath);
        if (!resumeText.trim()) {
            return next(
                new ErrorHandler('Empty or corrupted resume file', 400)
            );
        }
        let effectiveJdText: string | null = null;
        if (jobId) {
            const job = await prisma.job.findUnique({
                where: { id: Number(jobId) },
            });
            if (!job) {
                return next(new ErrorHandler('Job not found', 404));
            }
            effectiveJdText = job.description;
        } else if (jdText) {
            effectiveJdText = jdText;
        }
        const prompt = effectiveJdText
            ? `Compare this resume to the following job description and provide strengths, weaknesses, and suggestions:\n\nJob Description:\n${effectiveJdText}\n\nResume:\n${resumeText}`
            : `Analyze this resume and provide strengths, weaknesses, and improvement suggestions:\n\n${resumeText}`;
        const response = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7,
            max_tokens: 3500,
        });
        const feedback =
            response.choices[0]?.message?.content || 'No analysis available.';
        const analysisRecord = await prisma.analysis.create({
            data: {
                resumeId: resume.id,
                jobId: effectiveJdText && jobId ? Number(jobId) : undefined,
                jdText: effectiveJdText,
                feedback,
                applicantId: resume.ownerId,
            },
        });
        res.status(200).json({
            success: true,
            analysisId: analysisRecord.id,
            feedback,
        });
    }
);

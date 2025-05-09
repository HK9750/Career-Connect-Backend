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
    console.log(
        `[extractTextFromFile] Starting text extraction from file: ${filePath}`
    );

    if (!fs.existsSync(filePath)) {
        console.error(
            `[extractTextFromFile] File not found at path: ${filePath}`
        );
        throw new Error(`File not found at ${filePath}`);
    }

    const ext = path.extname(filePath).toLowerCase();
    console.log(`[extractTextFromFile] File extension detected: ${ext}`);

    if (ext === '.pdf') {
        console.log(`[extractTextFromFile] Processing PDF file`);
        try {
            const dataBuffer = fs.readFileSync(filePath);
            const data = await pdfParse(dataBuffer);
            console.log(
                `[extractTextFromFile] PDF extraction successful. Text length: ${data.text.length} characters`
            );
            return data.text;
        } catch (error) {
            console.error(
                `[extractTextFromFile] Error parsing PDF file:`,
                error
            );
            throw error;
        }
    }

    if (ext === '.docx') {
        console.log(`[extractTextFromFile] Processing DOCX file`);
        try {
            const dataBuffer = fs.readFileSync(filePath);
            const result = await mammoth.extractRawText({ buffer: dataBuffer });
            console.log(
                `[extractTextFromFile] DOCX extraction successful. Text length: ${result.value.length} characters`
            );
            return result.value;
        } catch (error) {
            console.error(
                `[extractTextFromFile] Error parsing DOCX file:`,
                error
            );
            throw error;
        }
    }

    console.error(`[extractTextFromFile] Unsupported file format: ${ext}`);
    throw new Error(
        `Unsupported file format: ${ext}. Only PDF and DOCX are supported.`
    );
};

export const analyzeResume = AsyncErrorHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        console.log(
            `[analyzeResume] Starting resume analysis. Request params:`,
            {
                resumeId: req.params.resumeId,
                jobId: req.body.jobId,
            }
        );

        const { resumeId } = req.params;
        const { jobId } = req.body;

        if (!resumeId || isNaN(Number(resumeId))) {
            console.error(
                `[analyzeResume] Invalid resume ID provided: ${resumeId}`
            );
            return next(new ErrorHandler('Invalid resume ID', 400));
        }

        console.log(`[analyzeResume] Fetching resume with ID: ${resumeId}`);
        const resume = await prisma.resume.findUnique({
            where: { id: Number(resumeId) },
        });

        if (!resume) {
            console.error(
                `[analyzeResume] Resume not found with ID: ${resumeId}`
            );
            return next(new ErrorHandler('Resume not found', 404));
        }
        console.log(`[analyzeResume] Resume found:`, {
            id: resume.id,
            fileName: resume.filePath,
            ownerId: resume.ownerId,
        });

        const filePath = path.join(
            __dirname,
            '../uploads/resumes',
            resume.filePath
        );
        console.log(`[analyzeResume] Full resume file path: ${filePath}`);

        console.log(`[analyzeResume] Extracting text from resume file`);
        let resumeText;
        try {
            resumeText = await extractTextFromFile(filePath);
            console.log(
                `[analyzeResume] Text extraction successful. Text length: ${resumeText.length} characters`
            );
        } catch (error: any) {
            console.error(
                `[analyzeResume] Error extracting text from resume:`,
                error
            );
            return next(
                new ErrorHandler(
                    `Failed to extract text from resume: ${error.message}`,
                    500
                )
            );
        }

        if (!resumeText.trim()) {
            console.error(`[analyzeResume] Empty or corrupted resume file`);
            return next(
                new ErrorHandler('Empty or corrupted resume file', 400)
            );
        }

        let effectiveJdText: string | null = null;
        if (jobId) {
            console.log(
                `[analyzeResume] Job ID provided, fetching job details: ${jobId}`
            );
            const job = await prisma.job.findUnique({
                where: { id: Number(jobId) },
            });
            if (!job) {
                console.error(
                    `[analyzeResume] Job not found with ID: ${jobId}`
                );
                return next(new ErrorHandler('Job not found', 404));
            }
            console.log(
                `[analyzeResume] Job found. Description length: ${job.description.length} characters`
            );
            effectiveJdText = job.description;
        } else {
            console.log(
                `[analyzeResume] No job ID provided, analyzing resume without job context`
            );
        }

        // Structured prompt with clear JSON format instructions
        const systemPrompt = `
You are an expert ATS system and resume analyzer. Your task is to analyze a resume against a job description and provide structured feedback.

Your analysis MUST be returned as valid JSON with the following structure:
{
    "summary": {
        "overallMatch": "Score from 0-100",
        "briefAssessment": "2-3 sentence overall assessment"
    },
    "keySkills": {
        "present": ["List of relevant skills found in the resume"],
        "missing": ["Important skills from job description missing in resume"]
    },
    "experienceAnalysis": {
        "relevantExperience": ["List of experiences matching job requirements"],
        "gaps": ["Areas where experience could be improved"]
    },
    "educationFit": {
        "match": "How well education matches requirements (Strong/Moderate/Weak)",
        "details": "Brief assessment of educational qualifications"
    },
    "strengths": ["List of 3-5 key strengths"],
    "weaknesses": ["List of 3-5 areas for improvement"],
    "improvementSuggestions": ["List of 3-5 specific actionable suggestions"],
    "keywordMatch": {
        "score": "Percentage of key job keywords found in resume",
        "missingKeywords": ["Important keywords not found in resume"]
    },
    "formattingFeedback": "Assessment of resume structure and formatting"
}

Analyze thoroughly and provide specific, actionable feedback. Maintain a professional, constructive tone throughout.`;

        const userPrompt = effectiveJdText
            ? `Please analyze this resume against the following job description:\n\nJOB DESCRIPTION:\n${effectiveJdText}\n\nRESUME:\n${resumeText}`
            : `Please analyze this resume without a specific job description:\n\n${resumeText}`;

        console.log(
            `[analyzeResume] Preparing to call OpenAI API for resume analysis`
        );
        console.log(
            `[analyzeResume] Analysis type: ${effectiveJdText ? 'With job description' : 'Without job description'}`
        );

        try {
            console.log(`[analyzeResume] Sending request to OpenAI API`);
            console.time('openai-api-call');

            const response = await openai.chat.completions.create({
                model: 'anthropic/claude-3.7-sonnet',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                ],
                temperature: 0.2, // Lower temperature for more consistent, structured output
                max_tokens: 4000,
                response_format: { type: 'json_object' }, // Explicitly request JSON format
            });

            console.timeEnd('openai-api-call');
            console.log(`[analyzeResume] OpenAI API response received`);

            const feedbackRaw =
                response.choices[0]?.message?.content ||
                '{"error": "No analysis available."}';

            console.log(
                `[analyzeResume] Raw feedback length: ${feedbackRaw.length} characters`
            );

            let feedback;

            try {
                // Parse the response to ensure it's valid JSON
                console.log(`[analyzeResume] Parsing JSON response`);
                feedback = JSON.parse(feedbackRaw);
                console.log(`[analyzeResume] JSON parsing successful`);
            } catch (err) {
                console.error(
                    `[analyzeResume] Failed to parse JSON response:`,
                    err
                );
                console.error(`[analyzeResume] Raw response:`, feedbackRaw);
                feedback = {
                    error: 'Failed to generate proper analysis format',
                    rawResponse: feedbackRaw,
                };
            }

            console.log(`[analyzeResume] Creating analysis record in database`);
            const analysisRecord = await prisma.analysis.create({
                data: {
                    resumeId: resume.id,
                    jobId: effectiveJdText && jobId ? Number(jobId) : undefined,
                    jdText: effectiveJdText,
                    feedback: JSON.stringify(feedback),
                    applicantId: resume.ownerId,
                },
            });
            console.log(
                `[analyzeResume] Analysis record created with ID: ${analysisRecord.id}`
            );

            console.log(
                `[analyzeResume] Sending successful response to client`
            );
            res.status(200).json({
                success: true,
                analysisId: analysisRecord.id,
                feedback,
            });
        } catch (error: any) {
            console.error(
                `[analyzeResume] Error during OpenAI API call:`,
                error
            );
            if (error.response) {
                console.error(
                    `[analyzeResume] OpenAI API error status:`,
                    error.response.status
                );
                console.error(
                    `[analyzeResume] OpenAI API error data:`,
                    error.response.data
                );
            }
            return next(new ErrorHandler('Failed to analyze resume', 500));
        }
    }
);

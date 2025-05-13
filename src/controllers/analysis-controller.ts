import { Request, Response, NextFunction } from 'express';
import ErrorHandler from '../utils/error-handler';
import AsyncErrorHandler from '../utils/async-handler';
import prisma from '../lib/prisma';
import fs from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import openai from '../lib/openai';

// Define interface for the resume analysis feedback structure
interface ResumeFeedback {
    summary: {
        overallMatch: string;
        briefAssessment: string;
    };
    keySkills: {
        present: string[];
        missing: string[];
    };
    experienceAnalysis: {
        relevantExperience: string[];
        gaps: string[];
    };
    educationFit: {
        match: string;
        details: string;
    };
    strengths: string[];
    weaknesses: string[];
    improvementSuggestions: string[];
    keywordMatch: {
        score: string;
        missingKeywords: string[];
    };
    formattingFeedback: string;
}

/**
 * Extracts text content from PDF and DOCX files
 * @param filePath Path to the file
 * @returns Extracted text content as string
 */
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

/**
 * Normalizes feedback structure from different AI model responses
 * @param raw Raw feedback object from AI model
 * @returns Normalized feedback object
 */
const normalizeAIFeedback = (raw: any): ResumeFeedback => {
    try {
        // Handle Claude-specific response format
        if (raw.overallMatch || raw.overall_feedback) {
            return {
                summary: {
                    overallMatch:
                        raw.overallMatch || raw.summary?.overallMatch || '0',
                    briefAssessment:
                        raw.overall_feedback ||
                        raw.summary?.briefAssessment ||
                        'No summary provided',
                },
                keySkills: {
                    present:
                        raw.keySkills?.present || raw.skills?.present || [],
                    missing:
                        raw.keySkills?.missing || raw.skills?.missing || [],
                },
                experienceAnalysis: {
                    relevantExperience:
                        raw.experienceAnalysis?.relevantExperience ||
                        raw.experience?.relevant ||
                        [],
                    gaps:
                        raw.experienceAnalysis?.gaps ||
                        raw.experience?.gaps ||
                        [],
                },
                educationFit: {
                    match:
                        raw.educationFit?.match ||
                        raw.education?.match ||
                        'Not evaluated',
                    details:
                        raw.educationFit?.details ||
                        raw.education?.details ||
                        '',
                },
                strengths: raw.strengths || [],
                weaknesses: raw.weaknesses || raw.areas_for_improvement || [],
                improvementSuggestions:
                    raw.improvementSuggestions || raw.action_items || [],
                keywordMatch: {
                    score:
                        raw.keywordMatch?.score ||
                        raw.keywords?.keyword_match_score ||
                        'N/A',
                    missingKeywords:
                        raw.keywordMatch?.missingKeywords ||
                        raw.keywords?.missing_keywords ||
                        [],
                },
                formattingFeedback:
                    raw.formattingFeedback || raw.formatting || '',
            };
        }

        // If the response already matches our expected format
        if (raw.summary && typeof raw.summary === 'object') {
            return raw as ResumeFeedback;
        }

        // Default fallback structure
        return {
            summary: {
                overallMatch: '0',
                briefAssessment: 'Unable to process feedback properly',
            },
            keySkills: {
                present: [],
                missing: [],
            },
            experienceAnalysis: {
                relevantExperience: [],
                gaps: [],
            },
            educationFit: {
                match: 'Not evaluated',
                details: '',
            },
            strengths: [],
            weaknesses: [],
            improvementSuggestions: [],
            keywordMatch: {
                score: 'N/A',
                missingKeywords: [],
            },
            formattingFeedback: '',
        };
    } catch (err) {
        console.error('[normalizeAIFeedback] Error during normalization', err);
        return {
            summary: {
                overallMatch: '0',
                briefAssessment:
                    'Unable to process feedback due to technical error',
            },
            keySkills: { present: [], missing: [] },
            experienceAnalysis: { relevantExperience: [], gaps: [] },
            educationFit: { match: 'Not evaluated', details: '' },
            strengths: [],
            weaknesses: [],
            improvementSuggestions: [],
            keywordMatch: { score: 'N/A', missingKeywords: [] },
            formattingFeedback: '',
        };
    }
};

/**
 * Parses AI model response content to extract valid JSON
 * @param content Response content from AI model
 * @returns Parsed JSON object
 */
const parseAIResponse = (content: string | object): any => {
    if (typeof content === 'object') {
        return content;
    }

    if (typeof content !== 'string') {
        throw new Error('Invalid response format from AI model');
    }

    // Clean up the string in case it contains markdown code blocks
    let cleanContent = content.trim();

    // Remove any markdown code block indicators if present
    if (cleanContent.includes('```')) {
        // Extract content between json code blocks
        const jsonMatch = cleanContent.match(/```(?:json)?\n([\s\S]*?)```/);
        if (jsonMatch && jsonMatch[1]) {
            cleanContent = jsonMatch[1].trim();
        } else {
            // Just remove all code block markers
            cleanContent = cleanContent
                .replace(/```json\n?/g, '')
                .replace(/```/g, '');
        }
    }

    return JSON.parse(cleanContent);
};

/**
 * Analyzes a resume against an optional job description using AI
 */
export const analyzeResume = AsyncErrorHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        console.log(
            `[analyzeResume] Starting resume analysis. Request params:`,
            {
                resumeId: req.params.resumeId,
                jobId: req.body.jobId,
                applicationId: req.body.applicationId,
            }
        );

        const { resumeId } = req.params;
        const { jobId, applicationId } = req.body;

        if (!resumeId || isNaN(Number(resumeId))) {
            console.error(
                `[analyzeResume] Invalid resume ID provided: ${resumeId}`
            );
            return next(new ErrorHandler('Invalid resume ID', 400));
        }

        console.log(`[analyzeResume] Fetching resume with ID: ${resumeId}`);
        const resume = await prisma.resume.findUnique({
            where: { id: Number(resumeId) },
            include: { owner: { select: { id: true } } },
        });

        if (!resume) {
            console.error(
                `[analyzeResume] Resume not found with ID: ${resumeId}`
            );
            return next(new ErrorHandler('Resume not found', 404));
        }

        const filePath = path.join(
            __dirname,
            '../uploads/resumes',
            resume.filePath
        );
        console.log(`[analyzeResume] Full resume file path: ${filePath}`);

        let resumeText: string;
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
            effectiveJdText = job.description;
            console.log(
                `[analyzeResume] Job description length: ${effectiveJdText.length} characters`
            );
        }

        const systemPrompt = `You are an expert ATS system and resume analyzer. Your task is to analyze a resume against a job description and provide structured feedback. Your analysis MUST be returned as valid JSON with the following structure: { "summary": { "overallMatch": "Score from 0-100", "briefAssessment": "2-3 sentence overall assessment" }, "keySkills": { "present": ["List of relevant skills found in the resume"], "missing": ["Important skills from job description missing in resume"] }, "experienceAnalysis": { "relevantExperience": ["List of experiences matching job requirements"], "gaps": ["Areas where experience could be improved"] }, "educationFit": { "match": "How well education matches requirements (Strong/Moderate/Weak)", "details": "Brief assessment of educational qualifications" }, "strengths": ["List of 3-5 key strengths"], "weaknesses": ["List of 3-5 areas for improvement"], "improvementSuggestions": ["List of 3-5 specific actionable suggestions"], "keywordMatch": { "score": "Percentage of key job keywords found in resume", "missingKeywords": ["Important keywords not found in resume"] }, "formattingFeedback": "Assessment of resume structure and formatting" } Analyze thoroughly and provide specific, actionable feedback. Maintain a professional, constructive tone throughout.`;
        const userPrompt = effectiveJdText
            ? `Analyze resume against job description:\nJOB DESCRIPTION:\n${effectiveJdText}\nRESUME:\n${resumeText}`
            : `Analyze resume without job context:\nRESUME:\n${resumeText}`;

        console.log(
            `[analyzeResume] calling AI model with${effectiveJdText ? '' : 'out'} job context`
        );
        try {
            console.time('ai-api-call');
            const response = await openai.chat.completions.create({
                model: 'google/gemini-2.0-flash-001',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                ],
                temperature: 0.2,
                max_tokens: 2500,
                response_format: { type: 'json_object' },
            });
            console.timeEnd('ai-api-call');
            console.log(`[analyzeResume] AI model response received`);

            // Safely extract the content from the response
            const messageContent = response.choices?.[0]?.message?.content;
            console.log(
                `[analyzeResume] Extracted message content: ${messageContent}`
            );
            if (!messageContent) {
                console.error('[analyzeResume] No content returned from API');
                throw new Error('No analysis content returned');
            }

            let rawFeedback: any;
            try {
                // Parse the response content safely
                rawFeedback = parseAIResponse(messageContent);
                console.log('[analyzeResume] Successfully parsed response');
            } catch (error: any) {
                console.error(
                    '[analyzeResume] Failed to parse response:',
                    error
                );
                rawFeedback = {
                    error: 'Failed to parse response as JSON',
                    summary: {
                        overallMatch: '0',
                        briefAssessment:
                            'Unable to analyze resume due to technical error.',
                    },
                };
            }

            // Normalize the feedback to ensure consistent structure
            const feedback = normalizeAIFeedback(rawFeedback);

            // Create an analysis record in the database
            const analysisRecord = await prisma.analysis.create({
                data: {
                    resumeId: Number(resumeId),
                    jobId: jobId ? Number(jobId) : undefined,
                    score: Number(feedback.summary.overallMatch),
                    jdText: effectiveJdText,
                    feedback: JSON.stringify(feedback),
                    applicantId: resume.owner?.id || resume.ownerId,
                },
            });

            const application = await prisma.application.findUnique({
                where: { id: Number(applicationId) },
                include: { job: true, resume: true },
            });
            if (!application) {
                console.error(
                    `[analyzeResume] Application not found with ID: ${applicationId}`
                );
                return next(new ErrorHandler('Application not found', 404));
            }

            // Update the application with the analysis ID
            await prisma.application.update({
                where: { id: Number(applicationId) },
                data: {
                    analysisId: analysisRecord.id,
                },
            });
            console.log(
                `[analyzeResume] Application updated with analysis ID: ${analysisRecord.id}`
            );

            return res.status(200).json({
                success: true,
                analysisId: analysisRecord.id,
                feedback,
            });
        } catch (error: any) {
            console.error('[analyzeResume] Analysis failed:', error);
            return next(
                new ErrorHandler(
                    `Failed to analyze resume: ${error.message}`,
                    500
                )
            );
        }
    }
);

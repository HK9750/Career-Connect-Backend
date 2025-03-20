import { Request, Response, NextFunction } from "express";
import ErrorHandler from "../utils/error-handler";
import AsyncErrorHandler from "../utils/async-handler";
import prisma from "../lib/prisma";
import fs from "fs";
import path from "path";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import openai from "../lib/openai";

export const analyzeText = async (text: string): Promise<string> => {
  if (!text || text.trim().length === 0) {
    throw new Error("Cannot analyze empty text");
  }

  try {
    const prompt = `Analyze this resume and provide strengths, weaknesses, and improvement suggestions:\n\n${text}`;
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1500,
      temperature: 0.7,
    });

    const analysis =
      response.choices[0]?.message?.content || "No analysis available.";
    return analysis;
  } catch (error: any) {
    throw new Error(`OpenAI API error: ${error.message}`);
  }
};

const extractTextFromFile = async (filePath: string): Promise<string> => {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found at ${filePath}`);
  }

  const ext = path.extname(filePath).toLowerCase();

  try {
    if (ext === ".pdf") {
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdfParse(dataBuffer);
      return data.text;
    }

    if (ext === ".docx") {
      const dataBuffer = fs.readFileSync(filePath);
      const result = await mammoth.extractRawText({ buffer: dataBuffer });
      return result.value;
    }

    throw new Error(
      `Unsupported file format: ${ext}. Only PDF and DOCX are supported.`
    );
  } catch (error: any) {
    if (error.message.includes("Unsupported file format")) {
      throw error;
    }
    throw new Error(`Error extracting text from ${ext} file: ${error.message}`);
  }
};

export const analyzeResume = AsyncErrorHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { resumeId } = req.params;

      if (!resumeId || isNaN(Number(resumeId))) {
        return next(new ErrorHandler("Invalid resume ID", 400));
      }

      const resume = await prisma.resume.findUnique({
        where: { id: Number(resumeId) },
      });

      if (!resume) {
        return next(new ErrorHandler("Resume not found", 404));
      }

      if (!resume.filePath) {
        return next(
          new ErrorHandler("No file associated with this resume", 400)
        );
      }

      const filePath = path.join(
        __dirname,
        "../uploads/resumes",
        resume.filePath
      );

      try {
        const resumeText = await extractTextFromFile(filePath);

        if (!resumeText || !resumeText.trim()) {
          return next(
            new ErrorHandler(
              "Failed to extract text from resume - file may be empty or corrupted",
              400
            )
          );
        }

        const analysis = await analyzeText(resumeText);

        await prisma.resume.update({
          where: { id: Number(resumeId) },
          data: { comment: analysis },
        });

        return res.status(200).json({
          success: true,
          analysis,
          resumeId: Number(resumeId),
        });
      } catch (error: any) {
        if (error.message.includes("File not found")) {
          return next(
            new ErrorHandler(`Resume file not found: ${resume.filePath}`, 404)
          );
        }
        if (error.message.includes("Unsupported file format")) {
          return next(new ErrorHandler(error.message, 400));
        }
        throw error;
      }
    } catch (error: any) {
      if (error.code && error.code.startsWith("P")) {
        return next(new ErrorHandler(`Database error: ${error.message}`, 500));
      }

      if (error.message.includes("OpenAI API error")) {
        return next(
          new ErrorHandler(`AI analysis failed: ${error.message}`, 503)
        );
      }

      return next(
        new ErrorHandler(error.message || "An unexpected error occurred", 500)
      );
    }
  }
);

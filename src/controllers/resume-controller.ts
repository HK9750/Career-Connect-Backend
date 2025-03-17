import { Request, Response, NextFunction } from "express";
import ErrorHandler from "../utils/error-handler";
import prisma from "../lib/prisma";
import path from "path";

export const uploadResume = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.file) return next(new ErrorHandler("No file uploaded", 400));
    const { filename } = req.file;
    const ownerId = req.user?.id;
    const resume = await prisma.resume.create({
      data: { ownerId: Number(ownerId), filePath: filename },
    });
    res
      .status(201)
      .json({ success: true, message: "Resume uploaded successfully", resume });
  } catch (error: any) {
    next(new ErrorHandler(error.message, 500));
  }
};

export const getResumes = async (
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const resumes = await prisma.resume.findMany();
    res.status(200).json({ success: true, resumes });
  } catch (error: any) {
    next(new ErrorHandler(error.message, 500));
  }
};

export const downloadResume = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { resumeId } = req.params;
    const resume = await prisma.resume.findUnique({
      where: { id: Number(resumeId) },
    });
    if (!resume) return next(new ErrorHandler("Resume not found", 404));
    const filePath = path.join(
      __dirname,
      `../uploads/resumes/${resume.filePath}`
    );
    res.download(filePath);
  } catch (error: any) {
    next(new ErrorHandler(error.message, 500));
  }
};

export const deleteResume = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { resumeId } = req.params;
    const resume = await prisma.resume.findUnique({
      where: { id: Number(resumeId) },
    });
    if (!resume) return next(new ErrorHandler("Resume not found", 404));
    await prisma.resume.delete({ where: { id: Number(resumeId) } });
    res
      .status(200)
      .json({ success: true, message: "Resume deleted successfully" });
  } catch (error: any) {
    next(new ErrorHandler(error.message, 500));
  }
};

export const updateResume = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { resumeId } = req.params;
    const { comment } = req.body;
    const recruiterId = req.user?.id;
    const resume = await prisma.resume.findUnique({
      where: { id: Number(resumeId) },
    });
    if (!resume) return next(new ErrorHandler("Resume not found", 404));
    const updatedResume = await prisma.resume.update({
      where: { id: Number(resumeId) },
      data: {
        comment,
        recruiterId: recruiterId ? Number(recruiterId) : undefined,
      },
    });
    res
      .status(200)
      .json({
        success: true,
        message: "Resume updated successfully",
        resume: updatedResume,
      });
  } catch (error: any) {
    next(new ErrorHandler(error.message, 500));
  }
};

export const getResume = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { resumeId } = req.params;
    const resume = await prisma.resume.findUnique({
      where: { id: Number(resumeId) },
    });
    if (!resume) return next(new ErrorHandler("Resume not found", 404));
    res.status(200).json({ success: true, resume });
  } catch (error: any) {
    next(new ErrorHandler(error.message, 500));
  }
};

export const getResumeByUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const ownerId = req.user?.id;
    const resume = await prisma.resume.findFirst({
      where: { ownerId: Number(ownerId) },
    });
    if (!resume) return next(new ErrorHandler("Resume not found", 404));
    res.status(200).json({ success: true, resume });
  } catch (error: any) {
    next(new ErrorHandler(error.message, 500));
  }
};

export const getResumeByRecruiter = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const recruiterId = req.user?.id;
    const resume = await prisma.resume.findFirst({
      where: { recruiterId: Number(recruiterId) },
    });
    if (!resume) return next(new ErrorHandler("Resume not found", 404));
    res.status(200).json({ success: true, resume });
  } catch (error: any) {
    next(new ErrorHandler(error.message, 500));
  }
};

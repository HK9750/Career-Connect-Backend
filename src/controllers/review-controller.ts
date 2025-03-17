import { Request, Response, NextFunction } from "express";
import ErrorHandler from "../utils/error-handler";
import prisma from "../lib/prisma";

export const submitReview = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { resumeId } = req.params;
    const { comment } = req.body;
    const reviewerId = req.user?.id;
    if (!reviewerId) return next(new ErrorHandler("Not authorized", 401));
    const resume = await prisma.resume.findUnique({
      where: { id: Number(resumeId) },
    });
    if (!resume) return next(new ErrorHandler("Resume not found", 404));
    const review = await prisma.review.create({
      data: {
        resumeId: Number(resumeId),
        reviewerId: Number(reviewerId),
        comment,
      },
    });
    res.status(201).json({ success: true, review });
  } catch (error: any) {
    next(new ErrorHandler(error.message, 500));
  }
};

export const getReviews = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { resumeId } = req.params;
    const reviews = await prisma.review.findMany({
      where: { resumeId: Number(resumeId) },
    });
    res.status(200).json({ success: true, reviews });
  } catch (error: any) {
    next(new ErrorHandler(error.message, 500));
  }
};

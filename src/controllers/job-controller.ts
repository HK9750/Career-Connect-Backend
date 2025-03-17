import { Request, Response, NextFunction } from "express";
import ErrorHandler from "../utils/error-handler";
import prisma from "../lib/prisma";

export const createJob = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { title, description, company } = req.body;
    const recruiterId = req.user?.id;
    const job = await prisma.job.create({
      data: { title, description, company, recruiterId: Number(recruiterId) },
    });
    res.status(201).json({ success: true, job });
  } catch (error: any) {
    next(new ErrorHandler(error.message, 500));
  }
};

export const listJobs = async (
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const jobs = await prisma.job.findMany();
    res.status(200).json({ success: true, jobs });
  } catch (error: any) {
    next(new ErrorHandler(error.message, 500));
  }
};

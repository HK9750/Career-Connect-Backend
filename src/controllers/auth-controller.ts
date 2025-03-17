import { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import ErrorHandler from "../utils/error-handler";
import prisma from "../lib/prisma";
import config from "../config";

const generateTokens = (userId: string, role: string) => {
  const accessToken = jwt.sign({ id: userId, role }, config.JWT_ACCESS_SECRET, {
    expiresIn: config.JWT_ACCESS_SECRET_EXPIRY,
  });
  const refreshToken = jwt.sign({ id: userId }, config.JWT_REFRESH_SECRET, {
    expiresIn: config.JWT_REFRESH_SECRET_EXPIRY,
  });
  return { accessToken, refreshToken };
};

export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { username, email, password, role } = req.body;
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) return next(new ErrorHandler("User already exists", 409));
    const hashedPassword = await bcrypt.hash(password, 12);
    const newUser = await prisma.user.create({
      data: { username, email, password: hashedPassword, role },
    });
    const { accessToken, refreshToken } = generateTokens(
      String(newUser.id),
      newUser.role
    );
    res
      .status(201)
      .json({ success: true, user: newUser, accessToken, refreshToken });
  } catch (error: any) {
    next(new ErrorHandler(error.message, 500));
  }
};

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.password)))
      return next(new ErrorHandler("Invalid credentials", 401));
    const { accessToken, refreshToken } = generateTokens(
      String(user.id),
      user.role
    );
    res.status(200).json({ success: true, user, accessToken, refreshToken });
  } catch (error: any) {
    next(new ErrorHandler(error.message, 500));
  }
};

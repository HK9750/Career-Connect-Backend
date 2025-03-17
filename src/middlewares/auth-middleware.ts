import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import ErrorHandler from "../utils/error-handler";
import config from "../config";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role?: string;
      };
    }
  }
}

export const protect = (req: Request, res: Response, next: NextFunction) => {
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer ")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }
  if (!token) {
    return next(new ErrorHandler("Not authorized, no token provided", 401));
  }
  try {
    const decoded = jwt.verify(token, config.JWT_ACCESS_SECRET) as {
      id: string;
      role: string;
    };
    req.user = { id: decoded.id, role: decoded.role };
    next();
  } catch (err: any) {
    return next(new ErrorHandler("Not authorized, token failed", 401));
  }
};

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import ErrorHandler from '../utils/error-handler';
import config from '../config';

declare global {
    namespace Express {
        interface Request {
            user?: {
                id: number;
                role?: string;
            };
        }
    }
}

export const protect = (req: Request, res: Response, next: NextFunction) => {
    let token: string | undefined;
    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer ')
    ) {
        token = req.headers.authorization.split(' ')[1];
    }
    if (!token) {
        return next(new ErrorHandler('Not authorized, no token provided', 401));
    }
    try {
        const decoded = jwt.verify(token, config.JWT_ACCESS_SECRET) as {
            id: number;
            role: string;
        };
        req.user = { id: decoded.id, role: decoded.role };
        next();
    } catch (err: any) {
        return next(new ErrorHandler('Not authorized, token failed', 401));
    }
};

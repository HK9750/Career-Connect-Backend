import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import ErrorHandler from '../utils/error-handler';
import prisma from '../lib/prisma';
import config from '../config';
import AsyncErrorHandler from '../utils/async-handler';

const generateTokens = (userId: string, role: string) => {
    const accessToken = jwt.sign(
        { id: userId, role },
        config.JWT_ACCESS_SECRET,
        { expiresIn: config.JWT_ACCESS_SECRET_EXPIRY }
    );
    const refreshToken = jwt.sign({ id: userId }, config.JWT_REFRESH_SECRET, {
        expiresIn: config.JWT_REFRESH_SECRET_EXPIRY,
    });
    return { accessToken, refreshToken };
};

export const register = AsyncErrorHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const { username, email, password, role } = req.body;
        if (!username || !email || !password || !role) {
            return next(
                new ErrorHandler(
                    'Username, email, password, and role are required',
                    400
                )
            );
        }
        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) return next(new ErrorHandler('User already exists', 409));

        const hashed = await bcrypt.hash(password, 12);
        const newUser = await prisma.user.create({
            data: {
                username,
                email,
                password: hashed,
                role: role.toUpperCase(),
            },
        });

        const { accessToken, refreshToken } = generateTokens(
            String(newUser.id),
            newUser.role
        );

        res.status(201).json({
            success: true,
            user: {
                id: newUser.id,
                username: newUser.username,
                email: newUser.email,
                role: newUser.role,
            },
            accessToken,
            refreshToken,
        });
    }
);

export const login = AsyncErrorHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const { email, password } = req.body;
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return next(new ErrorHandler('Invalid credentials', 401));
        }

        const { accessToken, refreshToken } = generateTokens(
            String(user.id),
            user.role
        );

        res.status(200).json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
            },
            accessToken,
            refreshToken,
        });
    }
);

export const refreshToken = AsyncErrorHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            return next(new ErrorHandler('Refresh token required', 400));
        }

        let payload: any;
        try {
            payload = jwt.verify(refreshToken, config.JWT_REFRESH_SECRET);
        } catch {
            return next(new ErrorHandler('Invalid refresh token', 401));
        }

        const user = await prisma.user.findUnique({
            where: { id: Number(payload.id) },
        });
        if (!user) {
            return next(new ErrorHandler('User not found', 404));
        }

        const tokens = generateTokens(String(user.id), user.role);
        res.status(200).json({
            success: true,
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
        });
    }
);

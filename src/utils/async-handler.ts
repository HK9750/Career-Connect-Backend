import { Request, Response, NextFunction } from 'express';

const AsyncErrorHandler =
    (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
        return Promise.resolve(fn(req, res, next)).catch(next);
    };

export default AsyncErrorHandler;

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/auth-routes';
import resumeRoutes from './routes/resume-routes';
import jobRoutes from './routes/job-routes';
import reviewRoutes from './routes/review-routes';
import analysisRoutes from './routes/analysis-routes';
import applicationRoutes from './routes/application-routes';
import errorMiddleware from './middlewares/error-middleware';

const app = express();

app.use(
    cors({
        origin: '*',
        credentials: true,
    })
);
app.use(express.json());
app.use(helmet());

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
});
app.use(limiter);

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/resume', resumeRoutes);
app.use('/api/v1/job', jobRoutes);
app.use('/api/v1/review', reviewRoutes);
app.use('/api/v1/analysis', analysisRoutes);
app.use('/api/v1/application', applicationRoutes);

app.use(errorMiddleware);

export default app;

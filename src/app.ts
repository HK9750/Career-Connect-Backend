import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import authRoutes from "./routes/auth-routes";
import resumeRoutes from "./routes/resume-routes";
import jobRoutes from "./routes/job-routes";
import reviewRoutes from "./routes/review-routes";
import errorMiddleware from "./middlewares/error-middleware";

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});
app.use(limiter);

app.use("api/v1/auth", authRoutes);
app.use("api/v1/resume", resumeRoutes);
app.use("api/v1/job", jobRoutes);
app.use("api/v1/review", reviewRoutes);

app.use(errorMiddleware);

export default app;

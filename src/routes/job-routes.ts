import express from "express";
import { createJob, listJobs } from "../controllers/job-controller";
import { protect } from "../middlewares/auth-middleware";

const router = express.Router();

router.post("/", protect, createJob);
router.get("/", protect, listJobs);

export default router;

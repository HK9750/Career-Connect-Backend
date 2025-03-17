import express from "express";
import { submitReview, getReviews } from "../controllers/review-controller";
import { protect } from "../middlewares/auth-middleware";

const router = express.Router();

router.post("/:resumeId", protect, submitReview);
router.get("/:resumeId", protect, getReviews);

export default router;

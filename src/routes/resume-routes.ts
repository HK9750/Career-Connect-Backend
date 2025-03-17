import express from "express";
import {
  uploadResume,
  getResumes,
  downloadResume,
  deleteResume,
  updateResume,
  getResume,
  getResumeByUser,
  getResumeByRecruiter,
} from "../controllers/resume-controller";
import uploadMiddleware from "../middlewares/upload-middleware";
import { protect } from "../middlewares/auth-middleware";

const router = express.Router();

router.post("/upload", protect, uploadMiddleware, uploadResume);
router.get("/", protect, getResumes);
router.get("/:resumeId", protect, getResume);
router.get("/user/me", protect, getResumeByUser);
router.get("/recruiter/me", protect, getResumeByRecruiter);
router.get("/download/:resumeId", protect, downloadResume);
router.delete("/:resumeId", protect, deleteResume);
router.put("/:resumeId", protect, updateResume);

export default router;

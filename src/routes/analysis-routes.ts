import express from 'express';
import { analyzeResume } from '../controllers/analysis-controller';

const router = express.Router();

router.post('/analyze/:resumeId', analyzeResume);

export default router;

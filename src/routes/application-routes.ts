import express from 'express';
import {
    applyForJob,
    getApplication,
    listApplicationsByApplicant,
    listApplicationsByRecruiter,
    updateApplicationStatus,
    deleteApplication,
} from '../controllers/application-controller';
import { protect } from '../middlewares/auth-middleware';

const router = express.Router();

router.post('/apply/:jobId', protect, applyForJob);
router.get('/applicant/me', protect, listApplicationsByApplicant);
router.get('/recruiter/me', protect, listApplicationsByRecruiter);
router.put('/:applicationId/status', protect, updateApplicationStatus);
router.get('/:applicationId', protect, getApplication);
router.delete('/:applicationId', protect, deleteApplication);

export default router;

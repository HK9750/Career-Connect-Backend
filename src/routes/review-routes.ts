import express from 'express';
import {
    submitReview,
    getReview,
    deleteReview,
    updateReview,
} from '../controllers/review-controller';
import { protect } from '../middlewares/auth-middleware';

const router = express.Router({ mergeParams: true });

// All routes require authentication
router.use(protect);

router.post('/application/:applicationId/review', submitReview);
router.get('/application/:applicationId/review', getReview);
router.delete('/application/:applicationId/review', deleteReview);
router.put('/application/:applicationId/review-update', updateReview);

export default router;

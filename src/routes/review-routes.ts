import express from 'express';
import {
    submitReview,
    getReviews,
    deleteReview,
} from '../controllers/review-controller';
import { protect } from '../middlewares/auth-middleware';

const router = express.Router();

router.post('/:resumeId', protect, submitReview);
router.get('/:resumeId', protect, getReviews);
router.delete('/:reviewId', protect, deleteReview);

export default router;

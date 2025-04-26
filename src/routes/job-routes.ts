import express from 'express';
import {
    createJob,
    listJobs,
    getJob,
    deleteJob,
    updateJob,
} from '../controllers/job-controller';
import { protect } from '../middlewares/auth-middleware';

const router = express.Router();

router.post('/', protect, createJob);
router.get('/', protect, listJobs);
router.get('/:jobId', protect, getJob);
router.delete('/:jobId', protect, deleteJob);
router.put('/:jobId', protect, updateJob);

export default router;

import express from 'express';
import { getDashboardInfo } from '../controllers/dashboard-controller';
import { protect } from '../middlewares/auth-middleware';

const router = express.Router();

router.get('/', protect, getDashboardInfo);

export default router;

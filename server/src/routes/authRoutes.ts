import { Router } from 'express';
import { login, logout, me, updateProfile } from '../controllers/authController';
import { requireAuth } from '../middleware/authMiddleware';

const router = Router();

import rateLimit from 'express-rate-limit';

const isProduction = process.env.NODE_ENV === 'production';

const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: isProduction ? 10 : 1000, // Limit each IP to 10 requests in production, 1000 in dev/test for E2E suites
  message: { error: 'Too many login attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/login', loginLimiter, login);
router.post('/logout', logout);
router.get('/me', requireAuth, me);
router.put('/profile', requireAuth, updateProfile);
router.put('/me', requireAuth, updateProfile);



export default router;

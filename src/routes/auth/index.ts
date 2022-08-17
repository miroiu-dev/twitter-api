import express from 'express';
import { authController } from '../../controller';
import { getIpInfo, useDatabase } from '../../middlewares';
const router = express.Router();

router.use(useDatabase);

router.post('/login', authController.login);

router.post('/signup', getIpInfo), authController.signup;

router.post('/logout', authController.logout);

export default router;

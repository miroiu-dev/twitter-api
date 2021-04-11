import { Request, Response } from 'express';

export const requireAuth = (req: Request, res: Response, next: Function) => {
	if (!req.session.userId) {
		res.sendStatus(401);
	} else {
		next();
	}
};

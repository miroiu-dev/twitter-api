import { NextFunction, Request, Response } from 'express';

export const requireAuth = (
	req: Request,
	res: Response,
	next: NextFunction
) => {
	if (!req.session.userId) {
		res.sendStatus(401);
	} else {
		next();
	}
};

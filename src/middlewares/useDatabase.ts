import { NextFunction, Request, Response } from 'express';
import { Tweet } from '../data-access/models/tweet';
import { User } from '../data-access/models/user';
import { initMongoClient } from '../data-access/mongo';

export const useDatabase = async (
	_: Request,
	res: Response,
	next: NextFunction
) => {
	const mongo = await initMongoClient();
	const db = mongo.db('twitter');
	res.locals.mongo = mongo;
	res.locals.tweetsCol = db.collection<Tweet>('tweets');
	res.locals.usersCol = db.collection<User>('users');
	next();
};

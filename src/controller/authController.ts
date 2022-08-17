import { LoginRequest } from '../requests/LoginRequest';
import argon2 from 'argon2';
import { Request, Response } from 'express';
import { SignupRequest } from '../requests/SignupRequest';
import { USER_SESSION } from '../config';
import { User } from '../data-access/models/user';

const login = async (req: Request, res: Response) => {
	const { username, password } = req.body as LoginRequest;
	const user = (await res.locals.usersCol.findOne({ username })) as User;
	if (!user) {
		res.status(400).send({ error: 'Username or password not found' });
	} else {
		try {
			if (await argon2.verify(user.password, password)) {
				const { password, _id, ...userInfo } = user;

				// store user id in session
				req.session.userId = user._id?.toHexString();

				res.send(userInfo);
			} else {
				res.status(400).send({
					error: 'Username or password not found',
				});
			}
		} catch (err) {
			res.sendStatus(500);
		}
	}
	await res.locals.mongo.close();
};

const signup = async (req: Request, res: Response) => {
	const { username, password, dateOfBirth } = req.body as SignupRequest;

	if (username.length <= 4) {
		res.status(400).send({ error: 'Username is too short' });
	} else if (password.length <= 4) {
		res.status(400).send({ error: 'Password is too short' });
	}
	const user = await res.locals.usersCol.findOne({ username });

	if (user) {
		res.status(409).send({ error: 'Account already registered' });
	} else {
		try {
			const hash = await argon2.hash(password);
			const user = {
				username,
				password: hash,
				dateOfBirth,
				country: req.ipInfo?.country,
				profilePicture:
					'https://abs.twimg.com/sticky/default_profile_images/default_profile_400x400.png',
				name: username,
			};

			const insertResult = await res.locals.usersCol.insertOne(user);

			// store user id in session
			req.session.userId = insertResult.insertedId.toHexString();

			const { password: pass, ...response } = user;
			res.status(201).send(response);
		} catch (err) {
			res.sendStatus(500);
		}
	}
	await res.locals.mongo.close();
};

const logout = (req: Request, res: Response) => {
	req.session.destroy(err => {
		res.clearCookie(USER_SESSION, { path: '/' }).sendStatus(200);
	});
};

export const authController = {
	login,
	signup,
	logout,
};

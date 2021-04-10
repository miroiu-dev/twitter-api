import express, { json } from 'express';
import { MongoClient } from 'mongodb';
import { LoginRequest } from './requests/LoginRequest';
import { User } from './data-access/models/user';
import cors from 'cors';
import argon2 from 'argon2';

export async function startServer(mongo: MongoClient) {
	const db = mongo.db('twitter');
	const usersCol = db.collection<User>('users');

	const app = express().use(json());
	const port = process.env.PORT || 3001;
	app.use(cors());
	app.listen(port, () => {
		console.log(`Example app listening at http://localhost:${port}`);
	});

	app.post('/login', async (req, res) => {
		const { username, password } = req.body as LoginRequest;
		const user = await usersCol.findOne({ username });
		if (!user) {
			res.status(400).send({ error: 'Username or password not found' });
		} else {
			try {
				if (await argon2.verify(user.password, password)) {
					const { password, ...userInfo } = user;
					res.send(userInfo);
				} else {
					res.status(400).send({
						error: 'Username or password not found',
					});
				}
			} catch (err) {
				res.status(500).send({
					error: 'Something went wrong, try again later',
				});
			}
		}
	});
}

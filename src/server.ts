import express, { json } from 'express';
import session from 'express-session';
import { MongoClient, ObjectId } from 'mongodb';
import MongoStore from 'connect-mongo';
import { LoginRequest } from './requests/LoginRequest';
import { User } from './data-access/models/user';
import cors from 'cors';
import argon2 from 'argon2';
import { SignupRequest } from './requests/SignupRequest';
import { requireAuth } from './middlewares/requireauth';
import { getIpInfoMiddleware } from './middlewares/getIpInfo';
import { Tweet } from './data-access/models/tweet';

const USER_SESSION = 'user.session';

export async function startServer(mongo: MongoClient) {
	const db = mongo.db('twitter');
	const usersCol = db.collection<User>('users');
	const tweetsCol = db.collection<Tweet>('tweets');

	const app = express()
		.use(
			cors({
				credentials: true,
				origin: [process.env.WEBSITE_URL!, 'http://localhost:3000'],
			})
		)
		.use(json())
		.use(
			session({
				secret: process.env.SESSION_SECRET || 'TWEET',
				name: USER_SESSION,
				resave: false,
				saveUninitialized: false,
				cookie: {
					httpOnly: true,
					signed: true,
					maxAge: 1000 * 60 * 60 * 24 * 3,
					sameSite: 'lax',
				},
				store: MongoStore.create({
					client: mongo,
					touchAfter: 60 * 60 * 24,
				}),
			})
		);

	const port = (process.env.PORT && parseInt(process.env.PORT)) || 3001;
	app.listen(port, '0.0.0.0', () => {
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
	});

	app.post('/signup', getIpInfoMiddleware, async (req, res) => {
		const { username, password, dateOfBirth } = req.body as SignupRequest;
		if (username.length <= 4) {
			res.status(400).send({ error: 'Username is too short' });
		} else if (password.length <= 4) {
			res.status(400).send({ error: 'Password is too short' });
		}
		const user = await usersCol.findOne({ username });
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
					name: username,
				};
				const insertResult = await usersCol.insertOne(user);

				// store user id in session
				req.session.userId = insertResult.insertedId.toHexString();

				const { password: pass, ...response } = user;
				res.status(201).send(response);
			} catch (err) {
				res.sendStatus(500);
			}
		}
	});

	app.post('/logout', (req, res) => {
		req.session.destroy(err => {
			res.clearCookie(USER_SESSION, { path: '/' }).sendStatus(200);
		});
	});

	app.get('/hc', requireAuth, (req, res) => {
		res.send(req.session.userId || 'Ok');
	});

	app.post('/tweets', requireAuth, async (req, res) => {
		const { message, attachment } = req.body;
		const user = await usersCol.findOne({
			_id: ObjectId.createFromHexString(req.session.userId!),
		});

		const pictureUrl = undefined; // get url from cloudinary
		const createdAt = new Date();
		if (user) {
			const tweet = {
				author: {
					username: user.username,
					name: user.name,
					profilePicture: user.profilePicture,
				},
				message: message,
				attachment: pictureUrl,
				createdAt: createdAt,
				likes: 0,
				retweet: 0,
				numberOfComments: 0,
				comments: [],
			};
			await tweetsCol.insertOne(tweet);

			const { numberOfComments, comments, ...tweetPreview } = tweet;
			res.status(200).send({
				...tweetPreview,
				comments: numberOfComments,
			});
		} else {
			res.sendStatus(400);
		}
	});

	app.get('/people', async (req, res) => {
		const { filter, count } = req.query;
		let limit = parseInt(count?.toString() || '10') || 10;
		limit = Math.max(10, limit);
		limit = Math.min(50, limit);
		const search = filter?.toString();

		if (search?.trim()) {
			const regex = new RegExp(search, 'i');
			const users = await usersCol
				.find({
					$or: [{ username: regex }, { name: regex }],
				})
				.limit(limit)
				.toArray();

			res.send(users);
		}
	});

	app.get('/tweets', requireAuth, async (req, res) => {
		const { offset, limit } = req.query;
		const realLimit = parseInt(limit as string) || 10;
		const realOffset = parseInt(offset as string) || 0;

		const tweets = await tweetsCol
			.find()
			.project({ comments: 0 })
			.sort({ createdAt: -1 })
			.skip(realOffset)
			.limit(realLimit)
			.toArray();

		res.send({
			results: tweets,
			offset: realOffset,
			limit: realLimit,
		});
	});
}

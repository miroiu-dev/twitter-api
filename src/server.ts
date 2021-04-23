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
import { v2 as cloudinary } from 'cloudinary';

const USER_SESSION = 'user.session';

export async function startServer(mongo: MongoClient) {
	const db = mongo.db('twitter');
	const usersCol = db.collection<User>('users');
	const tweetsCol = db.collection<Tweet>('tweets');

	const app = express()
		.use(
			cors({
				credentials: true,
				origin: [
					process.env.WEBSITE_URL!,
					'http://localhost:3000',
					'https://twitter-api-cl.herokuapp.com',
				],
			})
		)
		.use(json({ limit: 5000000 }))
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
					sameSite: 'strict',
				},
				store: MongoStore.create({
					client: mongo,
					touchAfter: 60 * 60 * 24,
				}),
			})
		);

	const port = (process.env.PORT && parseInt(process.env.PORT)) || 3001;
	app.listen(port, () => {
		console.log(`Listening on port ${port}`);
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
					profilePicture:
						'https://pbs.twimg.com/profile_images/1379353354866995202/apI6V404_normal.jpg',
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

		let pictureUrl = undefined; // get url from cloudinary
		if (attachment) {
			try {
				const response = await cloudinary.uploader.upload(attachment, {
					overwrite: true,
					invalidate: true,
				});

				pictureUrl = response.url;
			} catch (err) {
				console.log(err);
			}
		}

		const createdAt = new Date();
		if (user) {
			const tweet = {
				author: {
					id: user._id!,
					username: user.username,
					name: user.name,
					profilePicture: user.profilePicture,
				},
				message: message,
				attachment: pictureUrl,
				createdAt: createdAt,
				numberOfLikes: 0,
				numberOfRetweets: 0,
				numberOfComments: 0,
				comments: [],
				likes: [],
				retweets: [],
			} as Tweet;
			await tweetsCol.insertOne(tweet);

			const { comments, ...tweetPreview } = tweet;
			res.status(200).send({
				...tweetPreview,
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
		const userId = ObjectId.createFromHexString(req.session.userId!);
		try {
			const tweets = await tweetsCol
				.find()
				.project({ comments: 0, likes: 0, retweets: 0 })
				.sort({ createdAt: -1 })
				.skip(realOffset)
				.limit(realLimit)
				.toArray();

			// TODO: could be done better using the aggregation pipeline
			const result = await Promise.all(
				tweets.map(async t => {
					const tweet = await tweetsCol.findOne({
						_id: t._id,
						likes: {
							$elemMatch: {
								$eq: userId,
							},
						},
					});

					const retweetTweet = await tweetsCol.findOne({
						_id: t._id,
						retweets: {
							$elemMatch: {
								$eq: userId,
							},
						},
					});

					return {
						...t,
						likedByUser: tweet !== null,
						retweetedByUser: retweetTweet !== null,
					};
				})
			);

			res.send({
				results: result,
				offset: realOffset,
				limit: realLimit,
			});
		} catch (err) {
			console.log(err);
			res.sendStatus(500);
		}
	});

	app.get('/tweets/:id', requireAuth, async (req, res) => {
		const { id } = req.params;
		const realId = ObjectId.createFromHexString(id);
		const userId = ObjectId.createFromHexString(req.session.userId!);
		try {
			const tweet = await tweetsCol.findOne({ _id: realId });
			const isLiked = await tweetsCol.findOne({
				_id: realId,
				likes: {
					$elemMatch: {
						$eq: userId,
					},
				},
			});
			const retweetTweet = await tweetsCol.findOne({
				_id: realId,
				retweets: {
					$elemMatch: {
						$eq: userId,
					},
				},
			});

			if (tweet) {
				res.status(200).send({
					...tweet,
					likedByUser: isLiked !== null,
					retweetedByUser: retweetTweet !== null,
				});
			} else {
				res.status(400);
			}
		} catch (err) {
			console.log(err);
			res.sendStatus(400);
		}
	});

	app.delete('/tweets/:id', requireAuth, async (req, res) => {
		const { id } = req.params;

		try {
			const response = await tweetsCol.deleteOne({
				_id: ObjectId.createFromHexString(id),
				'author.id': ObjectId.createFromHexString(req.session.userId!),
			});

			if (response.deletedCount !== 1) {
				res.sendStatus(403);
			} else {
				res.sendStatus(200);
			}
		} catch (err) {
			console.log(err);
			res.sendStatus(500);
		}
	});

	app.put('/tweets/:tweetId/likes', requireAuth, async (req, res) => {
		const { tweetId } = req.params;

		try {
			const realTweetId = ObjectId.createFromHexString(tweetId);
			const userId = ObjectId.createFromHexString(req.session.userId!);

			const response = await tweetsCol.updateOne(
				{ _id: realTweetId },
				{
					$addToSet: {
						likes: userId,
					},
					$inc: {
						numberOfLikes: 1,
					},
				}
			);

			res.sendStatus(200);
		} catch (err) {
			console.log(err);
			res.sendStatus(400);
		}
	});

	app.delete('/tweets/:tweetId/likes', requireAuth, async (req, res) => {
		const { tweetId } = req.params;

		try {
			const realTweetId = ObjectId.createFromHexString(tweetId);
			const userId = ObjectId.createFromHexString(req.session.userId!);

			const response = await tweetsCol.updateOne(
				{ _id: realTweetId },
				{
					$pull: {
						likes: userId,
					},
					$inc: {
						numberOfLikes: -1,
					},
				}
			);

			res.sendStatus(200);
		} catch (err) {
			console.log(err);
			res.sendStatus(400);
		}
	});

	app.get('/tweets/:username/likes', requireAuth, async (req, res) => {
		const { username } = req.params;

		const user = await usersCol.findOne({
			username: username,
		});

		try {
			if (user) {
				const response = await tweetsCol
					.find(
						{
							retweets: {
								$elemMatch: {
									$eq: user._id,
								},
							},
						},
						{
							projection: {
								likes: 0,
								comments: 0,
								retweets: 0,
							},
						}
					)
					.toArray();

				res.status(200).send(response);
			} else {
				res.sendStatus(404);
			}
		} catch (err) {
			console.log(err);
			res.sendStatus(400);
		}
	});

	app.put('/tweets/:tweetId/retweets', requireAuth, async (req, res) => {
		const { tweetId } = req.params;

		try {
			const realTweetId = ObjectId.createFromHexString(tweetId);
			const userId = ObjectId.createFromHexString(req.session.userId!);

			const response = await tweetsCol.updateOne(
				{ _id: realTweetId },
				{
					$addToSet: {
						retweets: userId,
					},
					$inc: {
						numberOfRetweets: 1,
					},
				}
			);

			res.sendStatus(200);
		} catch (err) {
			console.log(err);
			res.sendStatus(400);
		}
	});

	app.delete('/tweets/:tweetId/retweets', requireAuth, async (req, res) => {
		const { tweetId } = req.params;

		try {
			const realTweetId = ObjectId.createFromHexString(tweetId);
			const userId = ObjectId.createFromHexString(req.session.userId!);

			const response = await tweetsCol.updateOne(
				{ _id: realTweetId },
				{
					$pull: {
						retweets: userId,
					},
					$inc: {
						numberOfRetweets: -1,
					},
				}
			);

			res.sendStatus(200);
		} catch (err) {
			console.log(err);
			res.sendStatus(400);
		}
	});

	app.put('/tweets/:tweetId/comments', requireAuth, async (req, res) => {
		const { tweetId } = req.params;

		const userId = ObjectId.createFromHexString(req.session.userId!);
		const realId = ObjectId.createFromHexString(tweetId);

		const user = await usersCol.findOne({ _id: userId });
		const { message, attachment } = req.body;
		const id = new ObjectId();

		try {
			if (user) {
				const comment = {
					_id: id,
					author: {
						name: user.name,
						username: user.username,
						profilePicture: user.profilePicture,
					},
					createdAt: new Date(),
					message,
					numberOfComments: 0,
					numberOfLikes: 0,
					numberOfRetweets: 0,
					likes: [],
					retweets: [],
					attachment,
				};

				await tweetsCol.updateOne(
					{ _id: realId },
					{
						$push: {
							comments: {
								$each: [comment],
								$sort: { createdAt: -1 },
							},
						},
						$inc: {
							numberOfComments: 1,
						},
					}
				);
				res.send(comment);
			} else {
				res.sendStatus(400);
			}
		} catch (err) {
			console.log(err);
			res.sendStatus(400);
		}
	});

	app.get('/tweets/:tweetId/comments', requireAuth, async (req, res) => {
		const { tweetId } = req.params;

		const realId = ObjectId.createFromHexString(tweetId);
		const { offset, limit } = req.query;
		const userId = ObjectId.createFromHexString(req.session.userId!);
		const realLimit = parseInt(limit as string) || 10;
		const realOffset = parseInt(offset as string) || 0;

		try {
			const response = await tweetsCol
				.find({ _id: realId }, { projection: { comments: 1 } })
				.project({
					comments: {
						$slice: [realOffset, realLimit],
					},
				})
				.toArray();

			res.send(
				response[0].comments?.map(c => ({
					...c,
					likedByUser: !!c.likes.find(
						p => p.toHexString() === userId.toHexString()
					),
					retweetedByUser: !!c.retweets.find(
						p => p.toHexString() === userId.toHexString()
					),
				}))
			);
		} catch (err) {
			console.log(err);
			res.sendStatus(400);
		}
	});

	app.delete(
		'/tweets/:tweetId/comments/:commentId',
		requireAuth,
		async (req, res) => {
			const { commentId, tweetId } = req.params;
			const realCommentId = ObjectId.createFromHexString(commentId);
			const realTweetId = ObjectId.createFromHexString(tweetId);
			try {
				await tweetsCol.updateOne(
					{ _id: realTweetId },
					{
						$pull: { comments: { _id: realCommentId } },
						$inc: {
							numberOfComments: -1,
						},
					}
				);
				res.sendStatus(200);
			} catch (err) {
				console.log(err);
				res.sendStatus(400);
			}
		}
	);

	app.put(
		'/tweets/comments/:commentId/likes',
		requireAuth,
		async (req, res) => {
			const { commentId } = req.params;
			const realCommentId = ObjectId.createFromHexString(commentId);
			const userId = ObjectId.createFromHexString(req.session.userId!);

			try {
				await tweetsCol.updateOne(
					{
						'comments._id': realCommentId,
					},
					{
						$inc: {
							'comments.$.numberOfLikes': 1,
						},
						$addToSet: {
							'comments.$.likes': userId,
						},
					}
				);

				res.sendStatus(200);
			} catch (err) {
				console.log(err);
				res.sendStatus(400);
			}
		}
	);

	app.delete(
		'/tweets/comments/:commentId/likes',
		requireAuth,
		async (req, res) => {
			const { commentId } = req.params;
			const realCommentId = ObjectId.createFromHexString(commentId);
			const userId = ObjectId.createFromHexString(req.session.userId!);

			try {
				await tweetsCol.updateOne(
					{
						'comments._id': realCommentId,
					},
					{
						$inc: {
							'comments.$.numberOfLikes': -1,
						},
						$pull: {
							'comments.$.likes': userId,
						},
					}
				);

				res.sendStatus(200);
			} catch (err) {
				console.log(err);
				res.sendStatus(400);
			}
		}
	);
	app.put(
		'/tweets/comments/:commentId/retweets',
		requireAuth,
		async (req, res) => {
			const { commentId } = req.params;
			const realCommentId = ObjectId.createFromHexString(commentId);
			const userId = ObjectId.createFromHexString(req.session.userId!);

			try {
				await tweetsCol.updateOne(
					{
						'comments._id': realCommentId,
					},
					{
						$inc: {
							'comments.$.numberOfRetweets': 1,
						},
						$addToSet: {
							'comments.$.retweets': userId,
						},
					}
				);

				res.sendStatus(200);
			} catch (err) {
				console.log(err);
				res.sendStatus(400);
			}
		}
	);

	app.delete(
		'/tweets/comments/:commentId/retweets',
		requireAuth,
		async (req, res) => {
			const { commentId } = req.params;
			const realCommentId = ObjectId.createFromHexString(commentId);
			const userId = ObjectId.createFromHexString(req.session.userId!);

			try {
				await tweetsCol.updateOne(
					{
						'comments._id': realCommentId,
					},
					{
						$inc: {
							'comments.$.numberOfRetweets': -1,
						},
						$pull: {
							'comments.$.retweets': userId,
						},
					}
				);

				res.sendStatus(200);
			} catch (err) {
				console.log(err);
				res.sendStatus(400);
			}
		}
	);
}

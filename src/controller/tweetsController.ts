import { ObjectId } from 'mongodb';
import { v2 as cloudinary } from 'cloudinary';
import { Tweet } from '../data-access/models/tweet';
import { Request, Response } from 'express';

const getTweets = async (req: Request, res: Response) => {
	const { offset, limit } = req.query;
	const realLimit = parseInt(limit as string) || 10;
	const realOffset = parseInt(offset as string) || 0;
	const userId = ObjectId.createFromHexString(req.session.userId!);
	try {
		const tweets = (await res.locals.tweetsCol
			.find()
			.project({ comments: 0, likes: 0, retweets: 0 })
			.sort({ createdAt: -1 })
			.skip(realOffset)
			.limit(realLimit)
			.toArray()) as Tweet[];

		// TODO: could be done better using the aggregation pipeline
		const result = await Promise.all(
			tweets.map(async t => {
				const tweet = await res.locals.tweetsCol.findOne({
					_id: t._id,
					likes: {
						$elemMatch: {
							$eq: userId,
						},
					},
				});

				const retweetTweet = await res.locals.tweetsCol.findOne({
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
};

const post = async (req: Request, res: Response) => {
	const { message, attachment } = req.body;
	const user = await res.locals.usersCol.findOne({
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
		await res.locals.tweetsCol.insertOne(tweet);

		const { comments, ...tweetPreview } = tweet;
		res.status(200).send({
			...tweetPreview,
		});
	} else {
		res.sendStatus(400);
	}
};

const getTweetById = async (req: Request, res: Response) => {
	const { id } = req.params;
	const realId = ObjectId.createFromHexString(id);
	const userId = ObjectId.createFromHexString(req.session.userId!);
	try {
		const tweet = await res.locals.tweetsCol.findOne({ _id: realId });
		const isLiked = await res.locals.tweetsCol.findOne({
			_id: realId,
			likes: {
				$elemMatch: {
					$eq: userId,
				},
			},
		});
		const retweetTweet = await res.locals.tweetsCol.findOne({
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
};

const like = async (req: Request, res: Response) => {
	const { tweetId } = req.params;

	try {
		const realTweetId = ObjectId.createFromHexString(tweetId);
		const userId = ObjectId.createFromHexString(req.session.userId!);

		const response = await res.locals.tweetsCol.updateOne(
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
};

const unlike = async (req: Request, res: Response) => {
	const { tweetId } = req.params;

	try {
		const realTweetId = ObjectId.createFromHexString(tweetId);
		const userId = ObjectId.createFromHexString(req.session.userId!);

		const response = await res.locals.tweetsCol.updateOne(
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
};

const retweet = async (req: Request, res: Response) => {
	const { tweetId } = req.params;

	try {
		const realTweetId = ObjectId.createFromHexString(tweetId);
		const userId = ObjectId.createFromHexString(req.session.userId!);

		const response = await res.locals.tweetsCol.updateOne(
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
};

const unretweet = async (req: Request, res: Response) => {
	const { tweetId } = req.params;

	try {
		const realTweetId = ObjectId.createFromHexString(tweetId);
		const userId = ObjectId.createFromHexString(req.session.userId!);

		const response = await res.locals.tweetsCol.updateOne(
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
};

const deleteTweet = async (req: Request, res: Response) => {
	const { id } = req.params;

	try {
		const response = await res.locals.tweetsCol.deleteOne({
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
};

export const likes = async (req: Request, res: Response) => {
	const { username } = req.params;

	const user = await res.locals.usersCol.findOne({
		username: username,
	});

	try {
		if (user) {
			const response = await res.locals.tweetsCol
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
};

export const tweetsController = {
	getTweets,
	post,
	getTweetById,
	unretweet,
	retweet,
	unlike,
	like,
	deleteTweet,
	likes,
};

import { Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import { User } from '../data-access/models/user';

const comment = async (req: Request, res: Response) => {
	const { tweetId } = req.params;

	const userId = ObjectId.createFromHexString(req.session.userId!);
	const realId = ObjectId.createFromHexString(tweetId);

	const user = (await res.locals.usersCol.findOne({ _id: userId })) as User;
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

			await res.locals.tweetsCol.updateOne(
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
};

const getComments = async (req: Request, res: Response) => {
	const { tweetId } = req.params;

	const realId = ObjectId.createFromHexString(tweetId);
	const { offset, limit } = req.query;
	const userId = ObjectId.createFromHexString(req.session.userId!);
	const realLimit = parseInt(limit as string) || 10;
	const realOffset = parseInt(offset as string) || 0;

	try {
		const response = await res.locals.tweetsCol
			.find({ _id: realId }, { projection: { comments: 1 } })
			.project({
				comments: {
					$slice: [realOffset, realLimit],
				},
			})
			.toArray();

		res.send(
			response[0].comments?.map((c: any) => ({
				...c,
				likedByUser: !!c.likes.find(
					(p: any) => p.toHexString() === userId.toHexString()
				),
				retweetedByUser: !!c.retweets.find(
					(p: any) => p.toHexString() === userId.toHexString()
				),
			}))
		);
	} catch (err) {
		console.log(err);
		res.sendStatus(400);
	}
};

const deleteComment = async (req: Request, res: Response) => {
	const { commentId, tweetId } = req.params;
	const realCommentId = ObjectId.createFromHexString(commentId);
	const realTweetId = ObjectId.createFromHexString(tweetId);
	try {
		await res.locals.tweetsCol.updateOne(
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
};

const likeComment = async (req: Request, res: Response) => {
	const { commentId } = req.params;
	const realCommentId = ObjectId.createFromHexString(commentId);
	const userId = ObjectId.createFromHexString(req.session.userId!);

	try {
		await res.locals.tweetsCol.updateOne(
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
};

const unlikeComment = async (req: Request, res: Response) => {
	const { commentId } = req.params;
	const realCommentId = ObjectId.createFromHexString(commentId);
	const userId = ObjectId.createFromHexString(req.session.userId!);

	try {
		await res.locals.tweetsCol.updateOne(
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
};

const retweetComment = async (req: Request, res: Response) => {
	const { commentId } = req.params;
	const realCommentId = ObjectId.createFromHexString(commentId);
	const userId = ObjectId.createFromHexString(req.session.userId!);

	try {
		await res.locals.tweetsCol.updateOne(
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
};

const unretweetComment = async (req: Request, res: Response) => {
	const { commentId } = req.params;
	const realCommentId = ObjectId.createFromHexString(commentId);
	const userId = ObjectId.createFromHexString(req.session.userId!);

	try {
		await res.locals.tweetsCol.updateOne(
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
};

export const commentController = {
	comment,
	unlikeComment,
	retweetComment,
	unretweetComment,
	deleteComment,
	getComments,
	likeComment,
};

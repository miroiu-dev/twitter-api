import express from 'express';
import { commentController } from '../../../controller/commentsController';
import { useDatabase, requireAuth } from '../../../middlewares';
const router = express.Router();

router.use(requireAuth, useDatabase);

router.put('/:tweetId/comments', commentController.comment);

router.get('/:tweetId/comments', commentController.getComments);

router.delete(
	'/:tweetId/comments/:commentId',

	commentController.deleteComment
);

router.put('/comments/:commentId/likes', commentController.likeComment);

router.delete('/comments/:commentId/likes'), commentController.unlikeComment;

router.put('/comments/:commentId/retweets', commentController.retweetComment);

router.delete(
	'/comments/:commentId/retweets',
	commentController.unretweetComment
);

export default router;

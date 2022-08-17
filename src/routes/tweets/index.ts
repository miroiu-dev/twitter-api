import express from 'express';
import { tweetsController } from '../../controller/tweetsController';
import { useDatabase } from '../../middlewares';
import { requireAuth } from '../../middlewares/requireAuth';
const router = express.Router();

router.use(requireAuth, useDatabase);

router.get('/:id', tweetsController.getTweetById);

router.delete('/:id', tweetsController.deleteTweet);

router.put('/:tweetId/likes', tweetsController.like);

router.delete('/:tweetId/likes', tweetsController.unlike);

router.get('/', tweetsController.getTweets);

router.post('/', tweetsController.post);

router.put('/:tweetId/retweets', tweetsController.retweet);

router.get('/tweets/:username/likes', tweetsController.likes);

router.delete(
	'/:tweetId/retweets',

	tweetsController.unretweet
);

export default router;

import express from 'express';
import { tweetsController } from '../../controller';
import { useDatabase, auth } from '../../middlewares';
const router = express.Router();

router.use(auth, useDatabase);

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

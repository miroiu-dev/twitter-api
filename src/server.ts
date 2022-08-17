import { app } from './config';
import authRoute from './routes/auth';
import tweetsRoute from './routes/tweets';
import commentsRoute from './routes/tweets/comments';
import { useDatabase } from './middlewares';

const port = (process.env.PORT && parseInt(process.env.PORT)) || 3001;

app.use('/', authRoute);
app.use('/tweets', tweetsRoute);
app.use('/tweets', commentsRoute);

app.get('/people', useDatabase, async (req, res) => {
	const { filter, count } = req.query;
	let limit = parseInt(count?.toString() || '10') || 10;
	limit = Math.max(10, limit);
	limit = Math.min(50, limit);
	const search = filter?.toString();

	if (search?.trim()) {
		const regex = new RegExp(search, 'i');
		const users = await res.locals.usersCol
			.find({
				$or: [{ username: regex }, { name: regex }],
			})
			.limit(limit)
			.toArray();

		res.send(users);
	}
});

app.listen(port, () => {
	console.log(`Listening on port ${port}`);
});

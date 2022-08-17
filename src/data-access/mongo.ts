import { MongoClient } from 'mongodb';

export const initMongoClient = () => {
	const uri = process.env.MONGO_ADDRESS;
	if (!uri) {
		throw new Error('Please specify a mongo connection string.');
	}

	const client = new MongoClient(uri);

	return client.connect();
};

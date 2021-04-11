import { config as loadEnvVariables } from 'dotenv';
import { initMongoClient } from './data-access/mongo';
import { startServer } from './server';
loadEnvVariables();

const main = async () => {
	const mongoClient = await initMongoClient();
	await startServer(mongoClient);
};

main();

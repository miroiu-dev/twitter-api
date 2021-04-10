import { config as loadEnvVariables } from 'dotenv';
import { initMongoClient } from './data-access/mongo';
import { startServer } from './server';
loadEnvVariables();

const main = async () => {
	const mongoClient = await initMongoClient();
	await startServer(mongoClient);
};

main();
// (async () => {
// 	try {
// 		const hash = await argon2.hash('admin');
// 		console.log(hash);
// 	} catch (err) {
// 		console.log(err);
// 	}
// })();

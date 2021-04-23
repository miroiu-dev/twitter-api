import { config as loadEnvVariables } from 'dotenv';
import { initMongoClient } from './data-access/mongo';
import { startServer } from './server';
import { v2 as cloudinary } from 'cloudinary';
loadEnvVariables();

cloudinary.config({
	cloud_name: process.env.CLOUDINARY_URL_NAME,
	api_key: process.env.CLOUDINARY_API_KEY,
	api_secret: process.env.CLOUDINARY_API_SECRET,
});

const main = async () => {
	const mongoClient = await initMongoClient();
	await startServer(mongoClient);
};

console.log('Starting up...');
main();

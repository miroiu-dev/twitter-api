import express, { json, urlencoded } from 'express';
import cors from 'cors';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import { v2 as cloudinary } from 'cloudinary';
import { config as loadEnvVariables } from 'dotenv';
loadEnvVariables();

export const USER_SESSION = 'user.session';
const IS_PROD = process.env.NODE_ENV === 'production';

console.log('Running in production mode: ', IS_PROD);

cloudinary.config({
	cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
	api_key: process.env.CLOUDINARY_API_KEY,
	api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const app = express()
	.set('trust proxy', 1)
	.use(
		cors({
			credentials: true,
			origin: process.env.WEBSITE_URL!,
		})
	)
	.use(urlencoded({ extended: false }))
	.use(json({ limit: 5000000 }))
	.use(
		session({
			secret: process.env.SESSION_SECRET || 'TWEET',
			name: USER_SESSION,
			resave: false,
			saveUninitialized: false,
			cookie: {
				httpOnly: true,
				signed: true,
				maxAge: 1000 * 60 * 60 * 24 * 3,
				secure: IS_PROD ? true : false,
				sameSite: IS_PROD ? 'none' : 'lax',
			},
			store: MongoStore.create({
				touchAfter: 60 * 60 * 24,
				mongoUrl: process.env.MONGO_ADDRESS,
			}),
		})
	);

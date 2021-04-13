import { ObjectId } from 'bson';

declare module 'express-session' {
	export interface SessionData {
		userId: string;
	}
}

declare global {
	namespace Express {
		export interface Request {
			ipInfo?: {
				country: string;
			};
		}
	}
}

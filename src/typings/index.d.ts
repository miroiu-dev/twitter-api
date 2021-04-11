import { ObjectId } from 'bson';

declare module 'express-session' {
	interface SessionData {
		userId: string;
	}
}

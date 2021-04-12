import { ObjectId } from 'bson';

export type User = {
	_id?: ObjectId;
	username: string;
	password: string;
	name?: string;
	email?: string;
	phone?: string;
	profilePicture?: string;
	dateOfBirth: {
		month: string;
		day: number;
		year: number;
	};
};

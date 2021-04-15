import { ObjectId } from 'bson';

type Comment = {
	_id?: ObjectId;
	author: {
		name: string;
		username: string;
		profilePicture?: string;
	};
	message: string;
	likes: number;
	retweet: number;
};

export type Tweet = {
	_id?: ObjectId;
	author: {
		id: ObjectId;
		name: string;
		username: string;
		profilePicture?: string;
	};
	createdAt: Date;
	message: string;
	attachment?: string;
	comments?: Comment[];
	numberOfComments: number;
	likes: number;
	retweet: number;
};

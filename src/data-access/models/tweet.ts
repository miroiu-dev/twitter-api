import { ObjectId } from 'bson';

type Comment = {
	_id?: ObjectId;
	author: {
		name: string;
		username: string;
		profilePicture?: string;
	};
	message: string;
	numberOfLikes: number;
	numberOfRetweets: number;
	createdAt: Date;
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
	numberOfLikes: number;
	numberOfRetweets: number;
	likes: ObjectId[];
	retweets: ObjectId[];
};

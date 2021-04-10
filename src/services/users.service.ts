import { User } from '../data-access/models/user';

export const getUserByUsername = (username: string): User => {
	return {
		username: username,
		password: 'admin',
	};
};

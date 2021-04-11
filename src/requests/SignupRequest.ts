export type SignupRequest = {
	username: string;
	password: string;
	dateOfBirth: {
		month: string;
		day: number;
		year: number;
	};
};

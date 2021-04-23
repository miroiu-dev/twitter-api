import { Request, Response } from 'express';
import geoip from 'geoip-lite';

const getIpInfo = (ip: any): any => {
	console.log('rent');
	if (ip.includes('::ffff:')) {
		ip = ip.split(':').reverse()[0];
	}

	if (ip === '127.0.0.1' || ip === '::1') {
		// return { error: "This won't work on localhost" };
		ip = process.env.FAKE_IP;
	}

	var lookedUpIP = geoip.lookup(ip);

	if (!lookedUpIP) {
		return {
			error: 'Error occured while trying to process the information',
		};
	}

	return {
		country: lookedUpIP.country,
	};
};

export const getIpInfoMiddleware = (
	req: Request,
	res: Response,
	next: Function
) => {
	const info = getIpInfo(req.ip);
	if (!info.error) {
		req.ipInfo = info;
	}
	next();
};

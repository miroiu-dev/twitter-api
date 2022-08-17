import { Request, Response } from 'express';
import geoip from 'geoip-lite';

const getIpInformation = (ip: any): any => {
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

export const getIpInfo = (req: Request, res: Response, next: Function) => {
	const info = getIpInformation(req.ip);
	if (!info.error) {
		req.ipInfo = info;
	}
	next();
};

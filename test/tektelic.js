require('dotenv').config();
const logger = require('../lib/logger');
const { getApplicationDevices } = require('../lib/tektelic');

const {
	TEKTELIC_APP_ID,
} = process.env;

const main = async () => {
	const devices = await getApplicationDevices(TEKTELIC_APP_ID);
	if (devices?.totalElements > 0) {
		logger.info(`Found ${devices.totalElements} devices for application ${TEKTELIC_APP_ID}`);
		logger.info(JSON.stringify(devices.data[0], null, 2));
	} else {
		logger.warn(`No devices found for application ${TEKTELIC_APP_ID}`);
		return;
	}
};

main();

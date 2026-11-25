// Prints the first device of the Tektelic application, to inspect the raw API payload
const config = require('../config');
const logger = require('../lib/logger');
const { getApplicationDevices } = require('../clients/tektelic');

const TEKTELIC_APP_ID = config.tektelic.appId;

const main = async () => {
	const devices = await getApplicationDevices(TEKTELIC_APP_ID);
	if (devices.length > 0) {
		logger.info(`Found ${devices.length} devices for application ${TEKTELIC_APP_ID}`);
		logger.info(JSON.stringify(devices[0], null, 2));
	} else {
		logger.warn(`No devices found for application ${TEKTELIC_APP_ID}`);
		return;
	}
};

main();

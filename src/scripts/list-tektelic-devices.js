const config = require('../config');
const logger = require('../lib/logger');
const { writeCsv } = require('../lib/csv');
const { getCustomerDevices } = require('../clients/tektelic');

const TEKTELIC_CUSTOMER_ID = config.tektelic.customerId;


const getDevicesToList = (devices) => {
	const devicesToList = [];
	for (const device of devices) {
		logger.info(`Device ${device.deviceEUI} is ready to be listed`);
		devicesToList.push({
			deviceId: device.id.id,
			deviceName: device.name,
			deviceEUI: device.deviceEUI
		});
	}
	return devicesToList;
};


const main = async () => {
	const devices = await getCustomerDevices(TEKTELIC_CUSTOMER_ID);

	if (devices.length === 0) {
		logger.warn(`No devices found for customer ${TEKTELIC_CUSTOMER_ID}`);
		return;
	}

	logger.info(`Found ${devices.length} devices for customer ${TEKTELIC_CUSTOMER_ID}`);
	const devicesToList = getDevicesToList(devices);

	if (devicesToList.length > 0) {
		writeCsv(config.paths.tektelicDevicesCsv, ['deviceId', 'deviceName', 'deviceEUI'], devicesToList);
		logger.info(`Saved ${devicesToList.length} devices to ${config.paths.tektelicDevicesCsv}`);
	} else {
		logger.warn(`No devices to be listed for customer ${TEKTELIC_CUSTOMER_ID}`);
	}
};

main();

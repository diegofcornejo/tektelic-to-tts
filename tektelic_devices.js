require('dotenv').config();
const fs = require('fs');
const logger = require('./lib/logger');
const { getCustomerDevices, getCustomerApplications } = require('./lib/tektelic');

const {
	TEKTELIC_CUSTOMER_ID,
} = process.env;


const getDevicesToList = (devices) => {
	const devicesToList = [];
	for (const device of devices) {
		logger.info(`Device ${device.deviceEUI} is ready to be listed`);
		devicesToList.push({
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
		const header = 'deviceName,deviceEUI';
		const rows = devicesToList.map(d => `${d.deviceName},${d.deviceEUI}`);
		const csv = [header, ...rows].join('\n');

		fs.writeFileSync('tektelic_devices.csv', csv);
		logger.info(`Saved ${devicesToList.length} devices to tektelic_devices.csv`);
	} else {
		logger.warn(`No devices to be listed for customer ${TEKTELIC_CUSTOMER_ID}`);
	}
};

main();

require('dotenv').config();
const logger = require('./lib/logger');
const { getApplicationDevices } = require('./lib/tektelic');
const { provisionAbpDevice } = require('./lib/tts');

const {
	TEKTELIC_APP_ID,
} = process.env;



// If empty, all devices from Tektelic will be migrated
// Otherwise, only devices with EUIs listed here will be migrated
const DEVICES_FOR_MIGRATION = [
	'8C83FC05007296E7'
];

const checkMigrationInfo = (device) => {
	let missingFields = [];
	if (!device.name) {
		missingFields.push('name');
	}
	if (!device.deviceEUI) {
		missingFields.push('deviceEUI');
	}
	if (!device.devAddress) {
		missingFields.push('devAddress');
	}
	if (!device.appSKey) {
		missingFields.push('appSKey');
	}
	if (!device.nwkSKey) {
		missingFields.push('nwkSKey');
	}
	if (!device.appEUI) {
		missingFields.push('appEUI');
	}
	if (!device.appKey) {
		missingFields.push('appKey');
	}
	return missingFields;
}

const testDeleteFields = (device) => {
	delete device.devAddress;
	delete device.appSKey;
	delete device.nwkSKey;
}

const getDevicesToMigrate = (devices) => {
	const devicesToMigrate = [];
	
	// If DEVICES_FOR_MIGRATION is empty, migrate all devices
	const devicesToProcess = DEVICES_FOR_MIGRATION.length === 0 
		? devices 
		: DEVICES_FOR_MIGRATION.map(eui => devices.find(device => device.deviceEUI === eui)).filter(Boolean);
	
	if (DEVICES_FOR_MIGRATION.length === 0) {
		logger.info(`No specific devices configured, will attempt to migrate all ${devices.length} devices`);
	}
	
	for (const device of devicesToProcess) {
		logger.info(`Checking device ${device.deviceEUI} for migration`);

		//Just for testing purposes, we will delete the devAddress field
		// testDeleteFields(device);

		const missingFields = checkMigrationInfo(device);
		if (missingFields.length > 0) {
			logger.warn(`Device ${device.deviceEUI} cannot be migrated because it is missing the following fields: ${missingFields}`);
		} else {
			logger.info(`Device ${device.deviceEUI} is ready to be migrated`);
			devicesToMigrate.push({
				deviceName: device.name,
				deviceEUI: device.deviceEUI,
				devAddress: device.devAddress,
				appSKey: device.appSKey,
				nwkSKey: device.nwkSKey,
				appEUI: device.appEUI,
				appKey: device.appKey,
			});
		}
	}
	return devicesToMigrate;
};


const main = async () => {
	const devices = await getApplicationDevices(TEKTELIC_APP_ID);
	if (devices?.totalElements > 0) {
		logger.info(`Found ${devices.totalElements} devices for application ${TEKTELIC_APP_ID}`);
		const devicesToMigrate = getDevicesToMigrate(devices.data);
		if (devicesToMigrate.length > 0) {
			logger.info(`Devices to be Migrated `);
			logger.info(devicesToMigrate);
			for (const device of devicesToMigrate) {
				await provisionAbpDevice(device);
			}
		} else {
			logger.warn(`No devices to be migrated for application ${TEKTELIC_APP_ID}`);
		}
	} else {
		logger.warn(`No devices found for application ${TEKTELIC_APP_ID}`);
		return;
	}
};

main();

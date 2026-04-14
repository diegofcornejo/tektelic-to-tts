require('dotenv').config();
const fs = require('fs');
const logger = require('./lib/logger');
const { deleteDevice } = require('./lib/tektelic');

const main = async () => {
	const csv = fs.readFileSync('tektelic_delete_devices.csv', 'utf-8');
	const lines = csv.trim().split('\n');
	const header = lines[0].split(',');

	const idIndex = header.indexOf('tektelicDeviceId');
	if (idIndex === -1) {
		logger.error('Column "tektelicDeviceId" not found in CSV');
		return;
	}

	const deviceIds = lines.slice(1).map(line => line.split(',')[idIndex]).filter(Boolean);
	logger.info(`Found ${deviceIds.length} devices to delete`);

	let deleted = 0;
	let failed = 0;

	for (const deviceId of deviceIds) {
		try {
			await deleteDevice(deviceId);
			deleted++;
		} catch (error) {
			failed++;
			logger.error(`Failed to delete device ${deviceId}: ${error.message}`);
		}

		if (deleted % 50 === 0) {
			logger.info(`Progress: ${deleted + failed}/${deviceIds.length} (deleted: ${deleted}, failed: ${failed})`);
		}
	}

	logger.info(`Done. Deleted: ${deleted}, Failed: ${failed}, Total: ${deviceIds.length}`);
};

main();

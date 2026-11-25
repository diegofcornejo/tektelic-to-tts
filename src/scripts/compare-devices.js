const config = require('../config');
const logger = require('../lib/logger');
const { parseCsv, writeCsv } = require('../lib/csv');

const main = () => {
	const tektelicDevices = parseCsv(config.paths.tektelicDevicesCsv);
	const gridiaDevices = parseCsv(config.paths.gridiaDevicesCsv);

	logger.info(`Tektelic devices: ${tektelicDevices.length}`);
	logger.info(`Gridia devices: ${gridiaDevices.length}`);

	// Index gridia devices by amazonId (uppercased for case-insensitive comparison)
	const gridiaByEUI = new Map();
	for (const device of gridiaDevices) {
		gridiaByEUI.set(device.amazonId.toUpperCase(), device);
	}

	const report = [];

	// For each tektelic device, find match in gridia
	for (const tekDevice of tektelicDevices) {
		const eui = tekDevice.deviceEUI.toUpperCase();
		const gridiaDevice = gridiaByEUI.get(eui);

		report.push({
			tektelicDevId: tekDevice.deviceId,
			tektelicDevName: tekDevice.deviceName,
			tektelicDevEUI: tekDevice.deviceEUI,
			gridiaDevEUI: gridiaDevice?.amazonId || '',
			gridiaDevId: gridiaDevice?.deviceId || '',
			gridiaProject: gridiaDevice?.project || '',
			gridiaOrganization: gridiaDevice?.organization || '',
		});
	}

	// Devices only in gridia (not in tektelic)
	const tektelicEUIs = new Set(tektelicDevices.map(d => d.deviceEUI.toUpperCase()));
	for (const gridiaDevice of gridiaDevices) {
		if (!tektelicEUIs.has(gridiaDevice.amazonId.toUpperCase())) {
			report.push({
				tektelicDevId: '',
				tektelicDevName: '',
				tektelicDevEUI: '',
				gridiaDevEUI: gridiaDevice.amazonId,
				gridiaDevId: gridiaDevice.deviceId,
				gridiaProject: gridiaDevice.project,
				gridiaOrganization: gridiaDevice.organization,
			});
		}
	}

	writeCsv(config.paths.devicesComparisonCsv, [
		'tektelicDevId',
		'tektelicDevName',
		'tektelicDevEUI',
		'gridiaDevId',
		'gridiaDevEUI',
		'gridiaProject',
		'gridiaOrganization',
	], report);

	const onlyTektelic = report.filter(r => r.tektelicDevEUI && !r.gridiaDevEUI);
	const onlyGridia = report.filter(r => !r.tektelicDevEUI && r.gridiaDevEUI);
	const matched = report.filter(r => r.tektelicDevEUI && r.gridiaDevEUI);

	logger.info(`Matched: ${matched.length}`);
	logger.info(`Only in Tektelic: ${onlyTektelic.length}`);
	logger.info(`Only in Gridia: ${onlyGridia.length}`);
	logger.info(`Report saved to ${config.paths.devicesComparisonCsv}`);
};

main();

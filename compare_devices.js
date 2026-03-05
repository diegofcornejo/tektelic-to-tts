require('dotenv').config();
const fs = require('fs');
const logger = require('./lib/logger');

const parseCsv = (filePath) => {
	const content = fs.readFileSync(filePath, 'utf-8');
	const [headerLine, ...lines] = content.trim().split('\n');
	const headers = headerLine.split(',').map(h => h.replace(/"/g, '').trim());

	return lines.map(line => {
		const values = line.match(/(".*?"|[^,]+)/g) || [];
		const obj = {};
		headers.forEach((h, i) => {
			obj[h] = (values[i] || '').replace(/"/g, '').trim();
		});
		return obj;
	});
};

const main = () => {
	const tektelicDevices = parseCsv('tektelic_devices.csv');
	const gridiaDevices = parseCsv('gridia_devices.csv');

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
				tektelicDevName: '',
				tektelicDevEUI: '',
				gridiaDevEUI: gridiaDevice.amazonId,
				gridiaDevId: gridiaDevice.deviceId,
				gridiaProject: gridiaDevice.project,
				gridiaOrganization: gridiaDevice.organization,
			});
		}
	}

	const header = 'tektelicDevName,tektelicDevEUI,gridiaDevEUI,gridiaDevId,gridiaProject,gridiaOrganization';
	const rows = report.map(r =>
		`${r.tektelicDevName},${r.tektelicDevEUI},${r.gridiaDevEUI},${r.gridiaDevId},${r.gridiaProject},${r.gridiaOrganization}`
	);
	const csv = [header, ...rows].join('\n');

	fs.writeFileSync('devices_comparison.csv', csv);

	const onlyTektelic = report.filter(r => r.tektelicDevEUI && !r.gridiaDevEUI);
	const onlyGridia = report.filter(r => !r.tektelicDevEUI && r.gridiaDevEUI);
	const matched = report.filter(r => r.tektelicDevEUI && r.gridiaDevEUI);

	logger.info(`Matched: ${matched.length}`);
	logger.info(`Only in Tektelic: ${onlyTektelic.length}`);
	logger.info(`Only in Gridia: ${onlyGridia.length}`);
	logger.info(`Report saved to devices_comparison.csv`);
};

main();

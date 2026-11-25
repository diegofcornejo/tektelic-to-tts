const readline = require('readline/promises');
const config = require('../config');
const logger = require('../lib/logger');
const { getApplicationDevices } = require('../clients/tektelic');
const { DEVICE_PROFILE, provisionAbpDevice } = require('../clients/tts');

const TEKTELIC_APP_ID = config.tektelic.appId;

// If empty, all devices from Tektelic will be migrated
// Otherwise, only devices with EUIs listed here will be migrated
const DEVICES_FOR_MIGRATION = [
	'8C83FC05007296E7'
];

// Max rows printed per list in the summary
const SUMMARY_PREVIEW_LIMIT = 20;

const REQUIRED_FIELDS = ['name', 'deviceEUI', 'devAddress', 'appSKey', 'nwkSKey', 'appEUI', 'appKey'];

const getMissingFields = (device) => REQUIRED_FIELDS.filter(field => !device[field]);

// Decides which devices will be migrated, skipped or were not found, without touching TTS
const buildMigrationPlan = (devices) => {
	const migrateAll = DEVICES_FOR_MIGRATION.length === 0;
	const devicesByEUI = new Map(devices.map(device => [String(device.deviceEUI).toUpperCase(), device]));

	const notFound = [];
	const selected = migrateAll
		? devices
		: DEVICES_FOR_MIGRATION.map(eui => {
			const device = devicesByEUI.get(eui.toUpperCase());
			if (!device) {
				notFound.push(eui);
			}
			return device;
		}).filter(Boolean);

	const ready = [];
	const skipped = [];
	for (const device of selected) {
		const missingFields = getMissingFields(device);
		if (missingFields.length > 0) {
			skipped.push({ deviceName: device.name, deviceEUI: device.deviceEUI, missingFields });
		} else {
			ready.push({
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

	return { migrateAll, totalInApp: devices.length, notFound, ready, skipped };
};

const printList = (title, items, formatItem) => {
	if (items.length === 0) {
		return;
	}
	const shown = items.slice(0, SUMMARY_PREVIEW_LIMIT);
	const suffix = items.length > shown.length ? ` (showing first ${shown.length} of ${items.length})` : '';
	console.log(`\n${title}${suffix}:`);
	for (const item of shown) {
		console.log(`  ${formatItem(item)}`);
	}
};

const printSummary = (plan) => {
	const selection = plan.migrateAll
		? 'ALL devices in the application'
		: `${DEVICES_FOR_MIGRATION.length} EUI(s) listed in DEVICES_FOR_MIGRATION`;

	const row = (label, value) => console.log(`  ${`${label}:`.padEnd(25)}${value}`);

	console.log('\n==================== MIGRATION SUMMARY ====================');
	console.log('Source: Tektelic');
	row('Application ID', TEKTELIC_APP_ID);
	row('Devices in app', plan.totalInApp);
	row('Selection', selection);
	console.log('Target: The Things Stack');
	row('Base URL', config.tts.baseUrl);
	row('Application ID', config.tts.appId);
	row('Activation', 'ABP (IS -> NS -> AS)');
	row('LoRaWAN / PHY version', `${DEVICE_PROFILE.lorawanVersion} / ${DEVICE_PROFILE.lorawanPhyVersion}`);
	row('Frequency plan', DEVICE_PROFILE.frequencyPlanId);
	console.log('Result');
	row('Will be migrated', plan.ready.length);
	row('Skipped (missing data)', plan.skipped.length);
	row('Not found in Tektelic', plan.notFound.length);

	printList('Devices to migrate (TTS device ID / DevEUI / DevAddr)', plan.ready,
		d => `${d.deviceName.toLowerCase().padEnd(32)} ${d.deviceEUI.padEnd(17)} ${d.devAddress}`);
	printList('Skipped devices (name / DevEUI / missing fields)', plan.skipped,
		d => `${String(d.deviceName).padEnd(32)} ${String(d.deviceEUI).padEnd(17)} ${d.missingFields.join(', ')}`);
	printList('EUIs not found in the Tektelic application', plan.notFound, eui => eui);
	console.log('===========================================================\n');
};

// Asks for confirmation; anything other than "y"/"yes" (including closed stdin) means no
const confirm = async (question) => {
	const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
	try {
		const answer = await new Promise(resolve => {
			rl.once('close', () => resolve(''));
			rl.question(question).then(resolve, () => resolve(''));
		});
		return ['y', 'yes'].includes(answer.trim().toLowerCase());
	} finally {
		rl.close();
	}
};

const main = async () => {
	const devices = await getApplicationDevices(TEKTELIC_APP_ID);
	if (devices.length === 0) {
		logger.warn(`No devices found for application ${TEKTELIC_APP_ID}`);
		return;
	}
	logger.info(`Found ${devices.length} devices for application ${TEKTELIC_APP_ID}`);

	const plan = buildMigrationPlan(devices);
	printSummary(plan);

	if (plan.ready.length === 0) {
		logger.warn('Nothing to migrate');
		return;
	}

	const confirmed = await confirm(
		`Migrate ${plan.ready.length} device(s) to TTS application "${config.tts.appId}"? [y/N] `
	);
	if (!confirmed) {
		logger.info('Migration cancelled, no changes were made');
		return;
	}

	let migrated = 0;
	let failed = 0;
	for (const device of plan.ready) {
		if (await provisionAbpDevice(device)) {
			migrated++;
		} else {
			failed++;
		}
	}
	logger.info(`Migration finished. Migrated: ${migrated}, Failed: ${failed}, Total: ${plan.ready.length}`);
};

main();

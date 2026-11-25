const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');

// Load .env from the project root regardless of the current working directory
require('dotenv').config({ path: path.join(ROOT_DIR, '.env'), quiet: true });

const {
	TEKTELIC_BASE_URL,
	TEKTELIC_BEARER_TOKEN,
	TEKTELIC_CUSTOMER_ID,
	TEKTELIC_APP_ID,
	TTS_HOST,
	TTS_BASE_URL,
	TTS_BEARER_TOKEN,
	TTS_APP_ID,
} = process.env;

const DATA_DIR = path.join(ROOT_DIR, 'data');

module.exports = {
	tektelic: {
		baseUrl: TEKTELIC_BASE_URL,
		bearerToken: TEKTELIC_BEARER_TOKEN,
		customerId: TEKTELIC_CUSTOMER_ID,
		appId: TEKTELIC_APP_ID,
	},
	tts: {
		host: TTS_HOST,
		baseUrl: TTS_BASE_URL,
		bearerToken: TTS_BEARER_TOKEN,
		appId: TTS_APP_ID,
	},
	paths: {
		dataDir: DATA_DIR,
		tektelicDevicesCsv: path.join(DATA_DIR, 'tektelic_devices.csv'),
		gridiaDevicesCsv: path.join(DATA_DIR, 'gridia_devices.csv'),
		devicesComparisonCsv: path.join(DATA_DIR, 'devices_comparison.csv'),
		tektelicDeleteDevicesCsv: path.join(DATA_DIR, 'tektelic_delete_devices.csv'),
	},
};

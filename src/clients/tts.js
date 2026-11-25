const axios = require('axios');
const config = require('../config');
const logger = require('../lib/logger');

const {
	host: TTS_HOST,
	baseUrl: TTS_BASE_URL,
	bearerToken: TTS_BEARER_TOKEN,
	appId: TTS_APP_ID,
} = config.tts;

// LoRaWAN settings applied to every device on the Network Server
// TODO: Get these values from the environment variables or check if is needed to be dynamic along with the deviceData
const DEVICE_PROFILE = {
	lorawanVersion: '1.0.2',
	lorawanPhyVersion: '1.0.2-b',
	frequencyPlanId: 'AU_915_928_FSB_1',
};

const api = axios.create({
	baseURL: TTS_BASE_URL,
	headers: {
		'Content-Type': 'application/json',
		'Authorization': `Bearer ${TTS_BEARER_TOKEN}`,
	},
});

const logAxiosError = (err, context) => {
	if (err.response) {
		logger.error(
			`${context} - status=${err.response.status} data=${JSON.stringify(err.response.data)}`
		);
	} else {
		logger.error(`${context} - ${err.message}`);
	}
};

const createDeviceOnIS = async (deviceData) => {
	const body = {
		end_device: {
			ids: {
				device_id: deviceData.deviceName,
				application_ids: {
					application_id: TTS_APP_ID,
				},
				dev_eui: deviceData.deviceEUI,
			},
			name: deviceData.deviceName,
			description: deviceData.deviceName,
			network_server_address: TTS_HOST,
			application_server_address: TTS_HOST,
		},
		field_mask: {
			paths: [
				'ids.device_id',
				'ids.application_ids.application_id',
				'ids.dev_eui',
				'name',
				'description',
				'network_server_address',
				'application_server_address',
			],
		},
	};

	try {
		const { data } = await api.post(
			`/api/v3/applications/${TTS_APP_ID}/devices`,
			body,
		);
		logger.info(`IS device created: ${JSON.stringify(data)}`);
		return data;
	} catch (err) {
		if (err.response && err.response.status === 409) {
			logger.warn(
				`createDeviceOnIS - device ${deviceData.deviceName} already exists on IS, continuing`
			);
			return null;
		}

		logAxiosError(err, 'createDeviceOnIS');
		throw err;
	}
};

const setDeviceOnNS = async (deviceData) => {
	const body = {
		end_device: {
			ids: {
				device_id: deviceData.deviceName,
				application_ids: {
					application_id: TTS_APP_ID,
				},
				dev_eui: deviceData.deviceEUI,
			},
			lorawan_version: DEVICE_PROFILE.lorawanVersion,
			lorawan_phy_version: DEVICE_PROFILE.lorawanPhyVersion,
			frequency_plan_id: DEVICE_PROFILE.frequencyPlanId,
			mac_settings: {
				supports_32_bit_f_cnt: true,
			},
			session: {
				dev_addr: deviceData.devAddress,
				keys: {
					f_nwk_s_int_key: {
						key: deviceData.nwkSKey,
					},
				},
			},
		},
		field_mask: {
			paths: [
				'ids.device_id',
				'ids.application_ids.application_id',
				'ids.dev_eui',
				'lorawan_version',
				'lorawan_phy_version',
				'frequency_plan_id',
				'mac_settings.supports_32_bit_f_cnt',
				'session.dev_addr',
				'session.keys.f_nwk_s_int_key.key',
			],
		},
	};

	try {
		const { data } = await api.put(
			`/api/v3/ns/applications/${TTS_APP_ID}/devices/${deviceData.deviceName}`,
			body,
		);
		logger.info(`NS device set: ${JSON.stringify(data)}`);
		return data;
	} catch (err) {
		logAxiosError(err, 'setDeviceOnNS');
		throw err;
	}
};

const setDeviceOnAS = async (deviceData) => {
	const body = {
		end_device: {
			ids: {
				device_id: deviceData.deviceName,
				application_ids: {
					application_id: TTS_APP_ID,
				},
				dev_eui: deviceData.deviceEUI,
			},
			session: {
				dev_addr: deviceData.devAddress,
				keys: {
					app_s_key: {
						key: deviceData.appSKey,
					},
				},
			},
		},
		field_mask: {
			paths: [
				'ids.device_id',
				'ids.application_ids.application_id',
				'ids.dev_eui',
				'session.dev_addr',
				'session.keys.app_s_key.key',
			],
		},
	};

	try {
		const { data } = await api.post(
			`/api/v3/as/applications/${TTS_APP_ID}/devices`,
			body,
		);
		logger.info(`AS device set: ${JSON.stringify(data)}`);
		return data;
	} catch (err) {
		logAxiosError(err, 'setDeviceOnAS');
		throw err;
	}
};


const provisionAbpDevice = async (deviceData) => {
	deviceData.deviceName = deviceData.deviceName.toLowerCase();
	try {
		await createDeviceOnIS(deviceData);
		await setDeviceOnNS(deviceData);
		await setDeviceOnAS(deviceData);
		logger.info(`ABP device ${deviceData.deviceName} provisioned successfully`);
		return true;
	} catch (err) {
		logger.error(`Failed to provision device ${deviceData.deviceName}`);
		return false;
	}
};

module.exports = {
	DEVICE_PROFILE,
	provisionAbpDevice,
};
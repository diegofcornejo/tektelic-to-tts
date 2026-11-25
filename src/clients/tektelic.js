const axios = require('axios');
const config = require('../config');
const logger = require('../lib/logger');

const api = axios.create({
	baseURL: config.tektelic.baseUrl,
	headers: {
		'Accept': '*/*',
		'X-Authorization': `Bearer ${config.tektelic.bearerToken}`,
	},
});

// Fetches every page of a paginated Tektelic device listing
const getAllPages = async (url, label, { limit = 100, sortField = 'NAME', sortDirection = 'ASC' } = {}) => {
	const allDevices = [];
	let page = 0;
	let hasMore = true;

	while (hasMore) {
		logger.info(`Fetching devices for ${label}, page ${page}`);
		const { data } = await api.get(url, {
			params: { page, limit, sortField, sortDirection },
		});

		if (data?.data?.length) {
			allDevices.push(...data.data);
		}

		const totalPages = Math.ceil((data?.totalElements || 0) / limit);
		page++;
		hasMore = page < totalPages;
	}

	return allDevices;
};

const getCustomerDevices = async (customerId, options) => {
	try {
		return await getAllPages(`/api/customer/${customerId}/devices`, `customer ${customerId}`, options);
	} catch (error) {
		logger.error(`Error fetching devices by customer ID: ${error.message}`);
		return [];
	}
};

const getApplicationDevices = async (applicationId, options) => {
	try {
		return await getAllPages(`/api/application/${applicationId}/devices`, `application ${applicationId}`, options);
	} catch (error) {
		logger.error(`Error fetching devices by app ID: ${error.message}`);
		return [];
	}
};

const getCustomerApplications = async () => {
	try {
		const { data } = await api.get(`/api/customer/applications`);
		return data;
	} catch (error) {
		logger.error(`Error fetching applications by customer ID: ${error.message}`);
		return [];
	}
};

// Device models carry the manufacturer and type that devices only reference by ID
const getCustomerDeviceModels = async () => {
	try {
		const { data } = await api.get(`/api/customer/deviceModels`);
		return data;
	} catch (error) {
		logger.error(`Error fetching device models: ${error.message}`);
		return [];
	}
};

const deleteDevice = async (deviceId) => {
	logger.info(`Deleting device ${deviceId}`);
	try {
		await api.delete(`/api/device/${deviceId}`);
		logger.info(`Device ${deviceId} deleted successfully`);
	} catch (error) {
		logger.error(`Error deleting device ${deviceId}: ${error.message}`);
	}
};


module.exports = {
	getCustomerDevices,
	getApplicationDevices,
	getCustomerApplications,
	getCustomerDeviceModels,
	deleteDevice,
};
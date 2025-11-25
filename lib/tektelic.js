const axios = require('axios');
const logger = require('./logger');

const {
	TEKTELIC_BASE_URL,
	TEKTELIC_BEARER_TOKEN,
} = process.env;

const api = axios.create({
	baseURL: TEKTELIC_BASE_URL,
	headers: {
		'Accept': '*/*',
		'X-Authorization': `Bearer ${TEKTELIC_BEARER_TOKEN}`,
	},
});

const getCustomerDevices = async (customerId) => {
	try {
		const { data } = await api.get(`/api/customer/${customerId}/devices`);
		return data;
	} catch (error) {
		logger.error(`Error fetching devices by customer ID: ${error.message}`);
		return [];
	}
};

const getApplicationDevices = async (applicationId) => {
	try {
		const { data } = await api.get(`/api/application/${applicationId}/devices`);
		return data;
	} catch (error) {
		logger.error(`Error fetching devices by app ID: ${error.message}`);
		return [];
	}
};


module.exports = {
	getCustomerDevices,
	getApplicationDevices,
};
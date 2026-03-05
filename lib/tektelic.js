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

const getCustomerDevices = async (customerId, { limit = 100, sortField = 'NAME', sortDirection = 'ASC' } = {}) => {
	try {
		const allDevices = [];
		let page = 0;
		let hasMore = true;

		while (hasMore) {
			logger.info(`Fetching devices for customer ${customerId}, page ${page}`);
			const { data } = await api.get(`/api/customer/${customerId}/devices`, {
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

const getCustomerApplications = async () => {
	try {
		const { data } = await api.get(`/api/customer/applications`);
		return data;
	} catch (error) {
		logger.error(`Error fetching applications by customer ID: ${error.message}`);
		return [];
	}
};


module.exports = {
	getCustomerDevices,
	getApplicationDevices,
	getCustomerApplications,
};
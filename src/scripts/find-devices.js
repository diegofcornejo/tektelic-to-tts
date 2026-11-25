// Read-only search over Tektelic devices. Never writes to Tektelic or TTS.
// Run `npm run devices:find -- --help` for usage.
const fs = require('fs');
const path = require('path');
const { parseArgs } = require('node:util');
const config = require('../config');
const logger = require('../lib/logger');
const { writeCsv } = require('../lib/csv');
const {
	getCustomerDevices,
	getApplicationDevices,
	getCustomerApplications,
	getCustomerDeviceModels,
} = require('../clients/tektelic');

const HELP = `
Find Tektelic devices by application, name, model, vendor and activity (read-only).

Usage: npm run devices:find -- [options]

Scope
  --app <id|name>      Only devices of this application (ID or exact name, case-insensitive).
                       Without it, all devices of TEKTELIC_CUSTOMER_ID are searched.

Filters (case-insensitive; a flag can be repeated, and repeated values are OR-ed)
  --name <pattern>     Device name. With * it is a wildcard pattern matched against the
                       whole name ("BAYLAN-ST*"); without * it matches if the name contains it.
  --model <model>      Exact device model name ("ST", "Baylan ST").
  --vendor <vendor>    Exact device model manufacturer ("baylan").
  --match <all|any>    How different filters combine: all = AND (default), any = OR.

State (always applied as AND, independent of --match)
  --active             Only devices Tektelic reports as active.
  --inactive           Only devices Tektelic reports as inactive.

Output
  --out <name>         Base name for data/<name>.csv and data/<name>.json
                       (default: devices_find_<timestamp>).
  --with-keys          Include appKey, appSKey and nwkSKey (omitted by default).
  --help               Show this help.
`;

const KEY_FIELDS = ['appKey', 'appSKey', 'nwkSKey', 'appSKeyEncrypted', 'nwkSKeyEncrypted'];
const TABLE_LIMIT = 50;

const parseOptions = () => {
	const { values } = parseArgs({
		options: {
			app: { type: 'string' },
			name: { type: 'string', multiple: true, default: [] },
			model: { type: 'string', multiple: true, default: [] },
			vendor: { type: 'string', multiple: true, default: [] },
			match: { type: 'string', default: 'all' },
			active: { type: 'boolean', default: false },
			inactive: { type: 'boolean', default: false },
			out: { type: 'string' },
			'with-keys': { type: 'boolean', default: false },
			help: { type: 'boolean', default: false },
		},
	});

	if (!['all', 'any'].includes(values.match)) {
		throw new Error(`--match must be "all" or "any", got "${values.match}"`);
	}
	if (values.active && values.inactive) {
		throw new Error('--active and --inactive cannot be used together');
	}
	if (values.out !== undefined && !/^[A-Za-z0-9._-]+$/.test(values.out)) {
		throw new Error('--out must be a plain file name (letters, numbers, ".", "_" or "-")');
	}
	return values;
};

const normalize = (value) => String(value ?? '').trim().toLowerCase();

// "BAYLAN-ST*" -> whole-name wildcard match; "ST15" -> substring match
const nameMatcher = (pattern) => {
	const needle = normalize(pattern);
	if (!needle.includes('*')) {
		return (name) => normalize(name).includes(needle);
	}
	const source = needle.split('*').map(part => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*');
	const regex = new RegExp(`^${source}$`);
	return (name) => regex.test(normalize(name));
};

// Each active filter returns whether a device matches it; filters without values are skipped
const buildFilters = (options) => {
	const filters = [];
	if (options.name.length > 0) {
		const matchers = options.name.map(nameMatcher);
		filters.push({ key: 'name', test: (d) => matchers.some(m => m(d.name)) });
	}
	if (options.model.length > 0) {
		const models = new Set(options.model.map(normalize));
		filters.push({ key: 'model', test: (d) => models.has(normalize(d.deviceModelName)) });
	}
	if (options.vendor.length > 0) {
		const vendors = new Set(options.vendor.map(normalize));
		filters.push({ key: 'vendor', test: (d) => vendors.has(normalize(d.manufacturer)) });
	}
	return filters;
};

const resolveApplication = async (appArg) => {
	const apps = await getCustomerApplications();
	const list = Array.isArray(apps) ? apps : (apps?.data || []);
	const app = list.find(a => a.id?.id === appArg) || list.find(a => normalize(a.name) === normalize(appArg));
	if (!app) {
		const available = list.map(a => `  - ${a.name} (${a.id?.id})`).join('\n');
		throw new Error(`Application "${appArg}" not found for this customer. Available:\n${available}`);
	}
	return { id: app.id.id, name: app.name };
};

const formatTime = (ms) => (ms ? new Date(ms).toISOString() : '');

// Flattens nested Tektelic IDs ({ entityType, id }) and adds model and match details
const toRecord = (device, filterResults, withKeys) => {
	const record = {};
	for (const [key, value] of Object.entries(device)) {
		if (!withKeys && KEY_FIELDS.includes(key)) {
			continue;
		}
		if (value && typeof value === 'object' && 'id' in value && 'entityType' in value) {
			record[key] = value.id;
		} else if (value && typeof value === 'object') {
			record[key] = JSON.stringify(value);
		} else {
			record[key] = value;
		}
	}
	record.createdTimeISO = formatTime(device.createdTime);
	record.lastActivityTimeISO = formatTime(device.lastActivityTime);
	for (const [key, matched] of Object.entries(filterResults)) {
		record[`match_${key}`] = matched;
	}
	return record;
};

const countBy = (items, getKey) => {
	const counts = new Map();
	for (const item of items) {
		const key = getKey(item) || '(none)';
		counts.set(key, (counts.get(key) || 0) + 1);
	}
	return [...counts.entries()].sort((a, b) => b[1] - a[1]);
};

const printSummary = ({ scopeLabel, total, matched, options, filters }) => {
	const describe = (flag, values) => (values.length ? `${flag} ${values.map(v => `"${v}"`).join(' | ')}` : null);
	const criteria = [
		describe('name', options.name),
		describe('model', options.model),
		describe('vendor', options.vendor),
	].filter(Boolean);
	const state = options.active ? 'active only' : options.inactive ? 'inactive only' : 'any state';

	console.log('\n==================== DEVICE SEARCH ====================');
	console.log(`Scope:     ${scopeLabel} (${total} devices)`);
	console.log(`Filters:   ${criteria.length ? criteria.join(filters.length > 1 ? ` ${options.match === 'all' ? 'AND' : 'OR'} ` : '') : 'none'}`);
	console.log(`State:     ${state}`);
	console.log(`Matched:   ${matched.length}`);

	if (matched.length === 0) {
		console.log('=======================================================\n');
		return;
	}

	const printCounts = (title, entries) => {
		console.log(`\nBy ${title}:`);
		for (const [key, count] of entries) {
			console.log(`  ${String(count).padStart(5)}  ${key}`);
		}
	};
	printCounts('vendor / model', countBy(matched, d => `${d.manufacturer || '?'} / ${d.deviceModelName || '?'}`));
	printCounts('application', countBy(matched, d => d.applicationName));
	printCounts('state', countBy(matched, d => (d.active ? 'active' : 'inactive')));

	const shown = matched.slice(0, TABLE_LIMIT);
	const suffix = matched.length > shown.length ? ` (first ${shown.length} of ${matched.length}, see the CSV for all)` : '';
	console.log(`\nDevices${suffix}:`);
	console.log(`  ${'name'.padEnd(30)} ${'deviceEUI'.padEnd(17)} ${'model'.padEnd(14)} ${'active'.padEnd(7)} lastActivity`);
	for (const d of shown) {
		console.log(`  ${String(d.name).slice(0, 30).padEnd(30)} ${String(d.deviceEUI).padEnd(17)} ${String(d.deviceModelName || '').slice(0, 14).padEnd(14)} ${String(d.active).padEnd(7)} ${formatTime(d.lastActivityTime) || '-'}`);
	}
	console.log('=======================================================\n');
};

const defaultOutName = () => {
	const now = new Date();
	const pad = (n) => String(n).padStart(2, '0');
	const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
	return `devices_find_${stamp}`;
};

const main = async () => {
	let options;
	try {
		options = parseOptions();
	} catch (error) {
		logger.error(error.message);
		console.log(HELP);
		process.exitCode = 1;
		return;
	}
	if (options.help) {
		console.log(HELP);
		return;
	}

	let devices;
	let scopeLabel;
	if (options.app) {
		const app = await resolveApplication(options.app);
		scopeLabel = `application "${app.name}" (${app.id})`;
		devices = await getApplicationDevices(app.id);
	} else {
		scopeLabel = `customer ${config.tektelic.customerId}`;
		devices = await getCustomerDevices(config.tektelic.customerId);
	}
	if (devices.length === 0) {
		logger.warn(`No devices found for ${scopeLabel}`);
		return;
	}

	// Vendor and model type come from the device model referenced by each device
	const models = await getCustomerDeviceModels();
	const modelsById = new Map(models.map(m => [m.id?.id, m]));
	for (const device of devices) {
		const model = modelsById.get(device.deviceModelId?.id);
		device.manufacturer = model?.manufacturer || '';
		device.modelType = model?.type || '';
	}

	const filters = buildFilters(options);
	const records = [];
	const matched = [];
	for (const device of devices) {
		if (options.active && !device.active) continue;
		if (options.inactive && device.active) continue;

		const results = Object.fromEntries(filters.map(f => [f.key, f.test(device)]));
		const outcomes = Object.values(results);
		const isMatch = outcomes.length === 0
			|| (options.match === 'all' ? outcomes.every(Boolean) : outcomes.some(Boolean));
		if (isMatch) {
			matched.push(device);
			records.push(toRecord(device, results, options['with-keys']));
		}
	}

	matched.sort((a, b) => String(a.name).localeCompare(String(b.name)));
	records.sort((a, b) => String(a.name).localeCompare(String(b.name)));

	printSummary({ scopeLabel, total: devices.length, matched, options, filters });

	if (matched.length === 0) {
		logger.warn('No devices matched, nothing was written');
		return;
	}

	const outName = options.out || defaultOutName();
	const csvPath = path.join(config.paths.dataDir, `${outName}.csv`);
	const jsonPath = path.join(config.paths.dataDir, `${outName}.json`);
	const columns = [...new Set(records.flatMap(r => Object.keys(r)))];
	fs.mkdirSync(config.paths.dataDir, { recursive: true });
	writeCsv(csvPath, columns, records, { escape: true });
	fs.writeFileSync(jsonPath, JSON.stringify(records, null, 2));

	logger.info(`Saved ${records.length} devices to ${csvPath} and ${jsonPath}`);
	if (options['with-keys']) {
		logger.warn('Output includes device keys (appKey, appSKey, nwkSKey); do not share these files');
	}
};

main().catch((error) => {
	logger.error(error.message);
	process.exitCode = 1;
});

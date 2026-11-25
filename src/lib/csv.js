const fs = require('fs');

// Simple CSV reader: supports quoted values, but not escaped quotes ("") or empty fields
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

// Quotes a value when it contains a comma, quote or line break (RFC 4180)
const escapeValue = (value) => {
	const text = value === null || value === undefined ? '' : String(value);
	return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

// Writes records as CSV using the given columns.
// Values are written as-is unless `escape` is set, which quotes them when needed.
const writeCsv = (filePath, columns, records, { escape = false } = {}) => {
	const format = escape ? escapeValue : (value) => value;
	const header = columns.map(format).join(',');
	const rows = records.map(r => columns.map(c => format(r[c])).join(','));
	fs.writeFileSync(filePath, [header, ...rows].join('\n'));
};

module.exports = {
	parseCsv,
	writeCsv,
};

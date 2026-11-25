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

// Writes records as CSV using the given columns (values are not escaped)
const writeCsv = (filePath, columns, records) => {
	const header = columns.join(',');
	const rows = records.map(r => columns.map(c => r[c]).join(','));
	fs.writeFileSync(filePath, [header, ...rows].join('\n'));
};

module.exports = {
	parseCsv,
	writeCsv,
};

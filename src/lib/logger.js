const pino = require('pino');
const pretty = require('pino-pretty');

// Synchronous pretty output keeps logs in order with console output and interactive prompts
const logger = pino(pretty({
	colorize: true,
	sync: true,
}));

module.exports = logger;

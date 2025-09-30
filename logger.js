// logger.js
import winston from 'winston';

const { createLogger, format, transports } = winston;

const emoji = {
  info: 'ℹ️',
  warn: '⚠️',
  error: '❌',
  success: '✅',
  event: '📢',
  debug: '🐞',
};

const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.printf(({ level, message }) => {
    const icon = emoji[level] || '';
    return `${icon} ${message}`;
  }),
  transports: [new transports.Console()],
});

// Tambahkan metode custom manual
logger.success = (msg) => logger.log({ level: 'success', message: msg });
logger.event = (msg) => logger.log({ level: 'event', message: msg });

export default logger;

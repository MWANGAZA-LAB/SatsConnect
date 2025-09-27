import winston from 'winston';
import config from '../config/index';
import { redactSensitiveData } from './encryption';

const { combine, timestamp, errors, json, printf, colorize } = winston.format;

// Custom format for console output with sensitive data redaction
const consoleFormat = printf(({ level, message, timestamp, ...meta }) => {
  const redactedMeta = redactSensitiveData(meta);
  return `${timestamp} [${level}]: ${message} ${Object.keys(redactedMeta).length ? JSON.stringify(redactedMeta, null, 2) : ''}`;
});

// Custom format for file output with sensitive data redaction
const fileFormat = winston.format((info) => {
  // Redact sensitive data before logging
  if (info.meta) {
    info.meta = redactSensitiveData(info.meta);
  }
  if (info.error) {
    info.error = redactSensitiveData(info.error);
  }
  return info;
});

// Create logger instance
const logger = winston.createLogger({
  level: config.logging.level,
  format: combine(
    fileFormat(),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }),
    json()
  ),
  defaultMeta: { service: 'satsconnect-orchestrator' },
  transports: [
    // Write all logs with importance level of `error` or less to `error.log`
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Write all logs to `combined.log`
    new winston.transports.File({ 
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
});

// If we're not in production, log to the console as well
if (config.server.nodeEnv !== 'production') {
  logger.add(new winston.transports.Console({
    format: combine(
      colorize(),
      timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      consoleFormat
    )
  }));
}

// Create logs directory if it doesn't exist
import { mkdirSync } from 'fs';
try {
  mkdirSync('logs', { recursive: true });
} catch (error) {
  // Directory might already exist
}

export default logger;

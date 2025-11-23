/**
 * Logger Utility
 * Provides a shared logger instance for services that don't have direct access to Fastify logger
 * For Fastify context, use fastify.log directly instead
 */

import pino from 'pino';

const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * Global logger instance for use outside of Fastify context
 * In services with Fastify context, prefer using the injected fastify.log
 */
export const globalLogger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: isDevelopment
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
});

export default globalLogger;

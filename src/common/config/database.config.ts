import { Logger } from '@nestjs/common';

const logger = new Logger('DatabaseConfig');

export function getDatabaseUrl(): string {
  const nodeEnv = process.env.NODE_ENV || 'development';

  if (nodeEnv === 'production') {
    const productionUrl = process.env.DATABASE_URL_PRODUCTION;
    if (!productionUrl) {
      logger.warn('DATABASE_URL_PRODUCTION not set, falling back to local database');
      return process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/library_db?schema=public';
    }
    logger.log('Using Neon PostgreSQL (Production)');
    return productionUrl;
  }

  const localUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/library_db?schema=public';
  logger.log('Using local PostgreSQL (Development)');
  return localUrl;
}

import { readFileSync } from 'fs';
import { resolve } from 'path';

if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'development';
}

const envFile = process.env.NODE_ENV === 'production' ? '.env.prod' : '.env';
const envPath = resolve(__dirname, '..', envFile);

try {
  const envContent = readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valParts] = trimmed.split('=');
      const value = valParts.join('=').replace(/^["']|["']$/g, '');
      if (key && !process.env[key]) {
        process.env[key] = value;
      }
    }
  });
} catch (e) {
  // env file not found, use existing env vars
}

import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AllExceptionsFilter } from './src/common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  // Log environment and configuration
  const nodeEnv = process.env.NODE_ENV || 'development';
  const dbUrl = process.env.DATABASE_URL || '';
  const redisHost = process.env.REDIS_HOST || '';
  const redisPort = process.env.REDIS_PORT || '';
  const redisUrlProd = process.env.REDIS_URL_PRODUCTION || '';
  const isProduction = nodeEnv === 'production';

  logger.log(`🚀 Environment: ${nodeEnv.toUpperCase()}`);

  if (isProduction) {
    logger.log(`📊 Database: Neon PostgreSQL (Cloud)`);
    logger.log(`   URL: ${dbUrl.substring(0, 50)}...`);
  } else {
    logger.log(`📊 Database: Local PostgreSQL`);
    logger.log(`   URL: ${dbUrl}`);
  }

  if (isProduction) {
    logger.log(`💾 Redis: Redis Cloud`);
    logger.log(`   URL: ${redisUrlProd.substring(0, 50)}...`);
  } else {
    logger.log(`💾 Redis: Local`);
    logger.log(`   Host: ${redisHost}:${redisPort}`);
  }

  // Security & CORS
  app.enableCors({
    origin: process.env.CORS_ORIGINS?.split(','),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
  app.use(helmet({
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  }));

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Exception Filter
  app.useGlobalFilters(new AllExceptionsFilter());

  // Swagger Documentation
  const config = new DocumentBuilder()
    .setTitle('Library RAG API')
    .setDescription('API for Smart Library Management System with AI RAG Assistant')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
    
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Prefix
  app.setGlobalPrefix('api/v1');

  const port = process.env.PORT || 4000;
  await app.listen(port);
  logger.log(`Server is listening on port ${port}`);
}
bootstrap();


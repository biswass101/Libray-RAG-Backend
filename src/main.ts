import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  // Log environment and configuration
  const nodeEnv = process.env.NODE_ENV || 'development';
  const dbUrl = process.env.DATABASE_URL || '';
  const isProduction = nodeEnv === 'production';

  logger.log(`Environment: ${nodeEnv}`);
  logger.log(`Database: ${isProduction ? 'Neon PostgreSQL (Cloud)' : 'Local PostgreSQL'}`);
  logger.log(`Redis: ${isProduction ? 'Redis Cloud' : 'Local Redis'}`);
  if (dbUrl.includes('neon')) {
    logger.log('✓ Connected to Neon PostgreSQL');
  }

  // Security
  app.use(helmet());
  app.enableCors();

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


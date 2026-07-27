import { Global, Module, Logger } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import KeyvRedis from '@keyv/redis';

@Global()
@Module({
  imports: [
    CacheModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const nodeEnv = config.get<string>('NODE_ENV', 'development');
        const logger = new Logger('RedisCacheModule');

        let redisUrl: string;

        if (nodeEnv === 'production') {
          // Production: Use Redis Cloud URL
          const productionUrl = config.get<string>('REDIS_URL_PRODUCTION');
          if (!productionUrl) {
            logger.warn('REDIS_URL_PRODUCTION not configured, falling back to local Redis');
            redisUrl = 'redis://localhost:6379';
          } else {
            logger.log('Using Redis Cloud for production');
            redisUrl = productionUrl;
          }
        } else {
          // Development: Use local Redis
          const host = config.get<string>('REDIS_HOST', 'localhost');
          const port = config.get<number>('REDIS_PORT', 6379);
          redisUrl = `redis://${host}:${port}`;
          logger.log(`Using local Redis at ${host}:${port}`);
        }

        return {
          stores: [new KeyvRedis(redisUrl)],
          ttl: 30_000, // default 30s
        };
      },
      isGlobal: true,
    }),
  ],
  exports: [CacheModule],
})
export class RedisCacheModule {}

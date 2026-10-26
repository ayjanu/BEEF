import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { loadConfig } from './config.ts';
import { createPool, migrate } from './infra/db.ts';
import { createRedis } from './infra/redis.ts';
import { TokenService } from './auth/jwt.ts';
import { AppModule } from './app.module.ts';

async function bootstrap() {
  const log = new Logger('bootstrap');
  const cfg = loadConfig();
  const db = createPool(cfg);
  await migrate(db, (m) => log.log(m));
  const redis = createRedis(cfg);
  const tokens = await TokenService.create(cfg.JWT_PRIVATE_KEY, cfg.JWT_PUBLIC_KEY);

  const app = await NestFactory.create(AppModule.register({ cfg, db, redis, tokens }), {
    logger: ['log', 'warn', 'error'],
  });
  app.enableShutdownHooks();
  app.getHttpAdapter().getInstance().disable('x-powered-by');
  await app.listen(cfg.PORT, '0.0.0.0');
  log.log(`core-api listening on :${cfg.PORT} (${cfg.APP_ENV})`);

  const shutdown = async () => {
    await app.close();
    await db.end();
    redis.disconnect();
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});

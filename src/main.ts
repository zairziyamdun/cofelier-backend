import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';

import { AppModule } from './app.module';
import { configureApp, setupSwagger } from './app.setup';
import type { Env } from './config/env';
import { SocketIoAdapter } from './socket-io.adapter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService<Env, true>);
  const frontendUrl = config.get('FRONTEND_URL', { infer: true });

  configureApp(app);
  setupSwagger(app);
  // credentials — чтобы браузер отправлял httpOnly-cookie с JWT (этап 3).
  app.enableCors({ origin: frontendUrl, credentials: true });
  // WebSocket панели заказов — с тем же CORS и cookie.
  app.useWebSocketAdapter(new SocketIoAdapter(app, frontendUrl));
  app.enableShutdownHooks();

  await app.listen(config.get('PORT', { infer: true }));
}
void bootstrap();

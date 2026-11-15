import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';

import { ACCESS_TOKEN_COOKIE } from './auth/auth-cookie';

// Общая настройка приложения: её используют main.ts, e2e-тесты и экспорт OpenAPI.
export function configureApp(app: INestApplication) {
  app.setGlobalPrefix('api');
  // JWT приходит в httpOnly-cookie (этап 3), JwtStrategy читает его из req.cookies.
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
}

export function createOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Cofelier API')
    .setDescription('API кофейни Cofelier: меню, вход, заказы')
    .setVersion('1.0')
    .addCookieAuth(ACCESS_TOKEN_COOKIE)
    .build();
  return SwaggerModule.createDocument(app, config);
}

// Swagger UI — /api/docs, JSON для генерации типов фронта — /api/docs-json.
export function setupSwagger(app: INestApplication) {
  SwaggerModule.setup('api/docs', app, () => createOpenApiDocument(app));
}

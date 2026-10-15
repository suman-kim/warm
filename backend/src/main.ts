import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';
import { setupSwagger } from './config/swagger.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const isProduction = config.get<string>('NODE_ENV') === 'production';

  app.use(helmet());
  // 브라우저에서 부르는 오리진(관리자 웹 등)만 허용한다. 네이티브 앱은 Origin을 보내지 않아 무관하다.
  // 개발에서는 CORS_ORIGINS를 비워 두면 전부 허용한다.
  const corsOrigins = config
    .getOrThrow<string>('CORS_ORIGINS')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({
    origin: corsOrigins.length > 0 ? corsOrigins : !isProduction,
    credentials: true,
  });
  configureApp(app);
  // 종료 신호를 받으면 처리 중인 요청을 마치고 DB 연결을 닫는다.
  app.enableShutdownHooks();
  if (!isProduction) {
    setupSwagger(app);
  }

  const port = config.getOrThrow<number>('PORT');
  await app.listen(port);
  new Logger('Bootstrap').log(
    `http://localhost:${port}/api` +
      (isProduction ? '' : ` (문서: http://localhost:${port}/api/docs)`),
  );
}
await bootstrap();

import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/** Swagger UI를 /api/docs에 연다. 요청·응답 스키마는 빌드 때 Swagger 플러그인이 채운다. */
export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('MOVO API')
    .setDescription('개인 사용자와 퀵배송·화물 기사를 연결하는 서비스의 API')
    .setVersion('0.0.1')
    .addBearerAuth()
    .build();
  SwaggerModule.setup(
    'api/docs',
    app,
    SwaggerModule.createDocument(app, config),
  );
}

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { HttpExceptionFilter } from './common/presentation/filters/http-exception.filter.js';

/**
 * 요청 처리 방식에 영향을 주는 전역 설정. main.ts와 e2e 테스트가 함께 쓴다 —
 * 테스트가 운영과 같은 경로·검증·오류 형식으로 돌게 하기 위해서다.
 */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      // DTO에 없는 속성이 오면 400. 요청 본문의 타입은 DTO에 맞게 바꾼다.
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
}

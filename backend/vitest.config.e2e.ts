import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig } from 'vitest/config';

// e2e 테스트는 실제 PostgreSQL에 붙는다. 시작할 때 테이블을 모두 지우고 다시 만들기 때문에
// 개발 DB와 분리된 movo_test만 쓴다 (이름이 _test로 끝나지 않으면 테스트가 중단된다).
export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    // 파일들이 같은 DB를 지우고 다시 만들기 때문에 한 번에 한 파일만 돌린다.
    fileParallelism: false,
    env: {
      APP_ENV: 'test',
      NODE_ENV: 'test',
      DB_HOST: process.env.DB_HOST ?? 'localhost',
      DB_PORT: process.env.DB_PORT ?? '5432',
      DB_USERNAME: process.env.DB_USERNAME ?? 'movo',
      DB_PASSWORD: process.env.DB_PASSWORD ?? 'movo',
      DB_DATABASE: 'movo_test',
      JWT_SECRET: 'e2e-test-secret-0123456789abcdef0123456789abcdef',
      // 카카오 로컬 API를 부르지 않고 견본 주소에서 찾는다.
      KAKAO_REST_API_KEY: '',
      // 올린 서류는 테스트가 끝나면 지운다.
      UPLOAD_DIR: join(tmpdir(), 'movo-e2e-uploads'),
      // test/drivers.e2e-spec.ts의 SETTLEMENT_POLICY와 같은 값이어야 한다.
      COMMISSION_RATE_PERCENT: '10',
      SETTLEMENT_PAYOUT_WEEKDAY: '2',
      SUPPORT_PHONE: '1588-0000',
      SUPPORT_HOURS: '평일 09:00~18:00',
    },
  },
});

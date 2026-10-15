import { defineConfig } from 'vitest/config';

// 단위 테스트. DB 없이 돈다 — 도메인과 유스케이스를 src 안의 *.spec.ts로 검증한다.
export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['src/**/*.spec.ts'],
  },
});

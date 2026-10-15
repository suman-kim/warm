import { defineConfig } from "@playwright/test";

// 실제 서버에 붙어 화면을 돌려 본다. 견본 데이터가 든 서버가 떠 있어야 한다:
//   (backend) npm run start:local  →  node tool/seed-demo.mjs
//   (admin-web) npm run test:e2e
// 다른 주소의 서버를 쓰려면 ADMIN_E2E_API=http://localhost:4010/api 처럼 준다.
const api = process.env.ADMIN_E2E_API ?? "http://localhost:4000/api";

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./test-results",
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:5174",
    // 설치돼 있는 Chrome을 쓴다 (브라우저를 따로 내려받지 않는다).
    channel: "chrome",
    viewport: { width: 1440, height: 900 },
    locale: "ko-KR",
    timezoneId: "Asia/Seoul",
  },
  webServer: {
    command: "npx vite",
    url: "http://localhost:5174",
    reuseExistingServer: true,
    env: { VITE_API_BASE_URL: api },
  },
});

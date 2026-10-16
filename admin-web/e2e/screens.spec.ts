import { expect, type Page, test } from "@playwright/test";

// 견본 데이터(backend/tool/seed-demo.mjs)가 든 서버에 붙어, 메뉴를 돌며 화면이 뜨는지 본다.
// 화면 사진은 test-results/screens/에 남는다 — 디자인과 눈으로 견줄 때 쓴다.
// 데이터를 바꾸지 않는다 (대화상자는 열어 보기만 하고 닫는다).

const ADMIN = { email: "haeun.jung@movo.kr", password: "movo1234" };

async function shot(page: Page, name: string) {
  // 대화상자나 서랍이 떠 있으면 보이는 만큼만, 아니면 화면 전체를 찍는다.
  const overlay = (await page.getByRole("dialog").count()) > 0;
  await page.screenshot({
    path: `test-results/screens/${name}.png`,
    fullPage: !overlay,
  });
}

async function login(page: Page, account = ADMIN) {
  await page.goto("/login");
  await page.getByLabel("이메일").fill(account.email);
  await page.getByLabel("비밀번호").fill(account.password);
  await page.getByRole("button", { name: "로그인" }).click();
}

test("로그인 화면", async ({ page }) => {
  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: "관리자 로그인" }),
  ).toBeVisible();
  await shot(page, "01-login");

  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "이메일과 비밀번호를 입력해 주세요",
  );
  await login(page, { ...ADMIN, password: "wrong-password1" });
  await expect(page.getByRole("alert")).toHaveText(
    "이메일 또는 비밀번호가 맞지 않아요",
  );
  // 비활성화된 관리자는 들어올 수 없다.
  await login(page, { email: "junki.lee@movo.kr", password: "movo1234" });
  await expect(page.getByRole("alert")).toContainText("비활성화된 계정이에요");
});

test.describe("최고 관리자", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await expect(
      page.getByRole("heading", { name: "가게 심사" }),
    ).toBeVisible();
  });

  test("가게 심사 — 심사 대기와 반려된 가게", async ({ page }) => {
    await expect(page.getByText("상암 수제버거")).toBeVisible();
    await shot(page, "02-stores");
    await page.getByText("상암 수제버거").click();
    await expect(
      page.getByRole("heading", { name: "상암 수제버거" }),
    ).toBeVisible();
    await shot(page, "03-store-detail");
  });

  test("라이더 심사 — 목록, 상세, 서류 보기, 반려", async ({ page }) => {
    await page.getByRole("link", { name: "라이더 심사" }).click();
    await expect(
      page.getByRole("heading", { name: "라이더 심사" }),
    ).toBeVisible();
    await expect(page.getByRole("tab", { name: /심사 대기/ })).toBeVisible();
    await shot(page, "04-review-list");

    // 검색
    await page.getByPlaceholder("이름, 휴대폰, 차량번호").fill("김도현");
    await expect(
      page.getByRole("row").filter({ hasText: "김도현" }),
    ).toBeVisible();
    await expect(
      page.getByRole("row").filter({ hasText: "박지훈" }),
    ).toHaveCount(0);
    await page.getByPlaceholder("이름, 휴대폰, 차량번호").fill("");

    // 재신청한 라이더의 상세
    await page.getByRole("row").filter({ hasText: "이서준" }).click();
    await expect(page.getByRole("heading", { name: "이서준" })).toBeVisible();
    await expect(page.getByText("오토바이")).toBeVisible();
    await shot(page, "05-review-detail");

    await page.getByRole("button", { name: /운전면허증/ }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await shot(page, "06-review-document");
    await page.keyboard.press("Escape");
  });

  test("배달 관제 — 진행 중 배달과 배차 지연", async ({ page }) => {
    await page.getByRole("link", { name: "배달 관제" }).click();
    await expect(
      page.getByRole("heading", { name: "배달 관제" }),
    ).toBeVisible();
    // 견본에는 요청하고 12분째 라이더를 못 찾은 배달이 있다.
    await expect(page.getByText(/배차 지연/).first()).toBeVisible();
    await shot(page, "07-deliveries");
  });

  test("가게 충전금 — 잔액이 적은 가게와 내역", async ({ page }) => {
    await page.getByRole("link", { name: "가게 충전금" }).click();
    await expect(
      page.getByRole("heading", { name: "가게 충전금" }),
    ).toBeVisible();
    await expect(page.getByText("여의도 돈까스")).toBeVisible();
    await shot(page, "08-wallets");
    await page.getByText("모보치킨 역삼점").first().click();
    await expect(
      page.getByRole("heading", { name: "모보치킨 역삼점" }),
    ).toBeVisible();
    await shot(page, "09-wallet-detail");
  });

  test("라이더 현금 수금", async ({ page }) => {
    await page.getByRole("link", { name: "라이더 현금 수금" }).click();
    await expect(
      page.getByRole("heading", { name: "라이더 현금 수금" }),
    ).toBeVisible();
    await shot(page, "10-rider-cash");
  });

  test("회원 — 목록, 상세, 정지", async ({ page }) => {
    await page.getByRole("link", { name: "회원" }).click();
    await expect(page.getByRole("heading", { name: "회원" })).toBeVisible();
    await shot(page, "11-members");

    await page.getByRole("tab", { name: /라이더/ }).click();
    await page.getByRole("row").filter({ hasText: "문지성" }).click();
    const drawer = page.getByRole("dialog", { name: "회원 상세" });
    await expect(drawer).toContainText("문지성");
    await expect(drawer).toContainText("진행 중 배달");
    await shot(page, "12-member-drawer");
    await drawer.getByRole("button", { name: /계정 정지|정지 해제/ }).click();
    await shot(page, "13-member-suspend");
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await expect(drawer).toHaveCount(0);
  });

  test("정산 — 라이더별 정산, 지급 처리, 지급 내역", async ({ page }) => {
    await page.getByRole("link", { name: "정산" }).click();
    await expect(page.getByRole("heading", { name: "정산" })).toBeVisible();
    await expect(page.getByText("수수료 10%")).toBeVisible();
    await expect(page.getByText("계좌 없음")).toBeVisible();
    await expect(page.getByText("계좌 인증 실패")).toBeVisible();
    await shot(page, "14-settle");

    await page.getByRole("tab", { name: "지급 내역" }).click();
    await expect(
      page.getByRole("row").filter({ hasText: "최현우" }).first(),
    ).toBeVisible();
    await shot(page, "15-settle-history");
  });

  test("공지사항", async ({ page }) => {
    await page.getByRole("link", { name: "공지사항" }).click();
    await expect(page.getByRole("heading", { name: "공지사항" })).toBeVisible();
    await expect(page.getByText("추석 연휴 배달 운영 안내")).toBeVisible();
    await shot(page, "16-notices");

    await page.getByRole("row").filter({ hasText: "추석 연휴" }).click();
    await expect(page.getByRole("dialog")).toContainText(
      "조리 완료 시간을 넉넉히",
    );
    await page.keyboard.press("Escape");

    await page.getByRole("tab", { name: /내린 공지/ }).click();
    await expect(page.getByText("MOVO 배달대행을 시작해요")).toBeVisible();
  });

  test("약관·정책", async ({ page }) => {
    await page.getByRole("link", { name: "약관·정책" }).click();
    await expect(
      page.getByRole("heading", { name: "약관·정책" }),
    ).toBeVisible();
    await expect(page.getByText("라이더 이용약관").first()).toBeVisible();
    await shot(page, "17-terms");
  });

  test("관리자 계정", async ({ page }) => {
    await page.getByRole("link", { name: "관리자 계정" }).click();
    await expect(
      page.getByRole("heading", { name: "관리자 계정" }),
    ).toBeVisible();
    await expect(
      page.getByRole("row").filter({ hasText: "정하은" }),
    ).toContainText("나");
    await shot(page, "18-admins");
  });
});

test("정산 담당은 배달 관제·충전금·현금 수금·정산만 본다", async ({ page }) => {
  await login(page, { email: "hyunwoo.choi@movo.kr", password: "movo1234" });
  await expect(page.getByRole("heading", { name: "배달 관제" })).toBeVisible();

  const menu = page.getByRole("navigation", { name: "메뉴" });
  await expect(menu.getByRole("link")).toHaveText([
    "배달 관제",
    "가게 충전금",
    "라이더 현금 수금",
    "정산",
  ]);
  // 주소를 직접 쳐도 권한이 없는 화면은 열리지 않는다.
  await page.goto("/admins");
  await expect(page.getByRole("heading", { name: "배달 관제" })).toBeVisible();
});

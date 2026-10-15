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
      page.getByRole("heading", { name: "기사 심사" }),
    ).toBeVisible();
  });

  test("기사 심사 — 목록, 상세, 서류 보기, 반려", async ({ page }) => {
    await expect(page.getByRole("tab", { name: /심사 대기/ })).toContainText(
      "5",
    );
    await expect(page.getByText("재신청")).toBeVisible();
    await shot(page, "02-review-list");

    // 검색
    await page.getByPlaceholder("이름, 휴대폰, 차량번호").fill("김도현");
    await expect(
      page.getByRole("row").filter({ hasText: "김도현" }),
    ).toBeVisible();
    await expect(
      page.getByRole("row").filter({ hasText: "박지훈" }),
    ).toHaveCount(0);
    await page.getByPlaceholder("이름, 휴대폰, 차량번호").fill("");

    // 재신청한 기사의 상세
    await page.getByRole("row").filter({ hasText: "이서준" }).click();
    await expect(page.getByRole("heading", { name: "이서준" })).toBeVisible();
    await expect(
      page.getByText("반려 후 서류를 다시 올려 신청했어요"),
    ).toBeVisible();
    await expect(page.getByText("다시 제출")).toBeVisible();
    await shot(page, "03-review-detail");

    await page.getByRole("button", { name: /운전면허증/ }).click();
    await expect(page.getByRole("dialog", { name: /크게 보기/ })).toBeVisible();
    await shot(page, "04-review-document");
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("dialog")).toContainText("2 / 3");
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: "반려", exact: true }).click();
    await page.getByRole("button", { name: "반려하기" }).click();
    await expect(page.getByRole("alert")).toHaveText(
      "반려할 서류를 하나 이상 골라 주세요",
    );
    await page.getByRole("checkbox", { name: /자동차등록증/ }).click();
    await page.getByRole("button", { name: "서류 일부가 잘려 있어요" }).click();
    await shot(page, "05-review-reject");
    await page.getByRole("button", { name: "취소" }).click();

    await page.getByRole("button", { name: "승인", exact: true }).click();
    await expect(page.getByText("이서준 님을 승인할까요?")).toBeVisible();
    await page.getByRole("button", { name: "취소" }).click();

    // 반려 탭
    await page.getByRole("link", { name: "기사 심사" }).first().click();
    await page.getByRole("tab", { name: /반려/ }).click();
    await page.getByRole("row").filter({ hasText: "장하늘" }).click();
    await expect(page.getByText("반려 사유", { exact: true })).toBeVisible();
    await shot(page, "06-review-rejected");
  });

  test("주문 현황 — 상태·결제별 목록, 주문 상세, 환불", async ({ page }) => {
    await page.getByRole("link", { name: "주문 현황" }).click();
    await expect(
      page.getByRole("heading", { name: "주문 현황" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /전체/ }).first(),
    ).toContainText("28");
    await shot(page, "07-orders");

    await page.getByRole("button", { name: /배송 중/ }).click();
    await expect(page.getByText("배송 중 주문 5건")).toBeVisible();
    await page.getByRole("button", { name: /노쇼/ }).click();
    await expect(page.getByText("노쇼 주문 1건")).toBeVisible();

    // 결제 실패 탭
    await page.getByRole("button", { name: /^전체/ }).first().click();
    await page.getByRole("button", { name: /결제 실패/ }).click();
    await expect(
      page.getByRole("row").filter({ hasText: "결제 실패" }),
    ).toHaveCount(1);
    await page.getByRole("button", { name: /^전체/ }).nth(1).click();

    // 완료된 주문의 상세: 요금 내역, 결제·환불 이력, 진행 시각
    await page.getByRole("button", { name: /^완료/ }).click();
    await page
      .getByRole("row")
      .filter({ hasText: "결제 완료" })
      .first()
      .click();
    await expect(
      page.getByRole("heading", { name: "요금 내역" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "결제·환불 이력" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "진행 시각" }),
    ).toBeVisible();
    await shot(page, "07b-order-detail");

    await page.getByRole("button", { name: "환불 처리" }).click();
    const modal = page.getByRole("dialog", { name: "환불 처리" });
    await expect(modal).toContainText("환불할 수 있는 금액");
    await modal.getByRole("radio", { name: "부분 환불" }).click();
    await modal.getByRole("button", { name: "배송 지연" }).click();
    await shot(page, "07c-refund");
    await modal.getByRole("button", { name: /환불하기/ }).click();
    await expect(modal.getByRole("alert")).toContainText("환불 금액은 1원부터");
    await modal.getByRole("button", { name: "취소" }).click();

    await page.getByRole("link", { name: "주문 현황" }).first().click();
    await page.getByRole("button", { name: "이전 날" }).click();
    await page.getByRole("button", { name: /^전체/ }).first().click();
    await expect(page.getByText("전체 주문 34건")).toBeVisible();
  });

  test("회원 — 목록, 상세, 정지", async ({ page }) => {
    await page.getByRole("link", { name: "회원" }).click();
    await expect(page.getByRole("heading", { name: "회원" })).toBeVisible();
    await expect(page.getByRole("tab", { name: /고객/ })).toContainText("10");
    await shot(page, "08-members");

    await page.getByRole("tab", { name: /기사/ }).click();
    await page.getByRole("row").filter({ hasText: "문지성" }).click();
    const drawer = page.getByRole("dialog", { name: "회원 상세" });
    await expect(drawer).toContainText("문지성");
    await shot(page, "09-member-drawer");
    await drawer.getByRole("button", { name: /계정 정지|정지 해제/ }).click();
    await shot(page, "10-member-suspend");
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await expect(drawer).toHaveCount(0);
  });

  test("정산 — 기사별 정산, 지급 처리, 지급 내역", async ({ page }) => {
    await page.getByRole("link", { name: "정산" }).click();
    await expect(page.getByRole("heading", { name: "정산" })).toBeVisible();
    await expect(page.getByText("수수료 10%")).toBeVisible();
    await expect(page.getByText("계좌 없음")).toBeVisible();
    await expect(page.getByText("계좌 인증 실패")).toBeVisible();
    await expect(page.getByText("취소 보상")).toBeVisible();
    await shot(page, "11-settle");

    await page.getByRole("checkbox", { name: "지급 대기 모두 고르기" }).click();
    await page.getByRole("button", { name: "지급 처리" }).click();
    await expect(page.getByText("지급 처리할까요?")).toBeVisible();
    await shot(page, "12-settle-pay");
    await page.getByRole("button", { name: "취소" }).click();

    await page.getByRole("tab", { name: "지급 내역" }).click();
    await expect(
      page.getByRole("row").filter({ hasText: "최현우" }).first(),
    ).toBeVisible();
    await shot(page, "13-settle-history");
  });

  test("공지사항", async ({ page }) => {
    await page.getByRole("link", { name: "공지사항" }).click();
    await expect(page.getByRole("heading", { name: "공지사항" })).toBeVisible();
    await expect(page.getByText("추석 연휴 배송 운영 안내")).toBeVisible();
    await shot(page, "14-notices");

    await page.getByRole("row").filter({ hasText: "추석 연휴" }).click();
    await expect(page.getByRole("dialog")).toContainText("퀵 배송은 연휴에도");
    await shot(page, "15-notice-view");
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: "공지 올리기" }).click();
    await page.getByRole("button", { name: "올리기", exact: true }).click();
    await expect(page.getByRole("alert")).toHaveText("제목을 적어 주세요");
    await shot(page, "16-notice-new");
    await page.keyboard.press("Escape");

    await page.getByRole("tab", { name: /내린 공지/ }).click();
    await expect(page.getByText("MOVO 서비스를 시작해요")).toBeVisible();
  });

  test("약관·정책", async ({ page }) => {
    await page.getByRole("link", { name: "약관·정책" }).click();
    await expect(
      page.getByRole("heading", { name: "약관·정책" }),
    ).toBeVisible();
    await expect(page.getByText("v2 본문")).toBeVisible();
    await expect(
      page.getByRole("tab", { name: /^서비스 이용약관/ }),
    ).toContainText("v2 시행 중 · v3");
    await shot(page, "17-terms");

    await page.getByRole("button", { name: "새 판 올리기" }).click();
    await expect(page.getByText("지금 마지막 판은 v3이에요.")).toBeVisible();
    await page.getByRole("button", { name: "v3 본문 불러오기" }).click();
    await shot(page, "18-terms-new");
    await page.keyboard.press("Escape");
  });

  test("관리자 계정", async ({ page }) => {
    await page.getByRole("link", { name: "관리자 계정" }).click();
    await expect(
      page.getByRole("heading", { name: "관리자 계정" }),
    ).toBeVisible();
    await expect(
      page.getByRole("row").filter({ hasText: "정하은" }),
    ).toContainText("나");
    await shot(page, "19-admins");

    await page.getByRole("button", { name: "관리자 추가" }).click();
    await shot(page, "20-admin-new");
    await page.getByRole("button", { name: "초대 메일 보내기" }).click();
    await expect(page.getByRole("alert")).toHaveText("이름을 적어 주세요");
    await page.keyboard.press("Escape");
  });
});

test("정산 담당은 주문 현황과 정산만 본다", async ({ page }) => {
  await login(page, { email: "hyunwoo.choi@movo.kr", password: "movo1234" });
  await expect(page.getByRole("heading", { name: "주문 현황" })).toBeVisible();

  const menu = page.getByRole("navigation", { name: "메뉴" });
  await expect(menu.getByRole("link")).toHaveText(["주문 현황", "정산"]);
  // 주소를 직접 쳐도 권한이 없는 화면은 열리지 않는다.
  await page.goto("/admins");
  await expect(page.getByRole("heading", { name: "주문 현황" })).toBeVisible();
});

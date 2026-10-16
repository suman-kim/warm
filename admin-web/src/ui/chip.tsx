// 상태를 보여 주는 작은 표. 색은 디자인의 CHIP 표를 그대로 옮겼다.

type Tone = "lime" | "green" | "red" | "gray" | "plain" | "inkOnGray" | "dark";

const TONES: Record<Tone, { box: string; dot: string }> = {
  lime: { box: "bg-lime text-ink", dot: "bg-ink" },
  green: { box: "bg-ok-soft text-ok", dot: "bg-ok-dot" },
  red: { box: "bg-danger-soft text-danger", dot: "bg-danger" },
  gray: { box: "bg-well text-tab", dot: "bg-faint" },
  plain: { box: "bg-well text-body", dot: "bg-muted" },
  inkOnGray: { box: "bg-well text-ink", dot: "bg-ink" },
  dark: { box: "bg-ink text-white", dot: "bg-lime" },
};

const KINDS = {
  // 가게·라이더 심사
  PENDING: ["심사 대기", "lime"],
  APPROVED: ["승인", "green"],
  REJECTED: ["반려", "red"],
  // 서류
  DOC_SUBMITTED: ["제출됨", "plain"],
  DOC_RESUBMITTED: ["다시 제출", "lime"],
  DOC_APPROVED: ["확인", "green"],
  DOC_REJECTED: ["반려", "red"],
  DOC_MISSING: ["미제출", "gray"],
  // 공지
  LIVE: ["게시 중", "green"],
  REMOVED: ["내림", "gray"],
  // 약관
  CURRENT: ["시행 중", "green"],
  SCHEDULED: ["시행 예정", "lime"],
  PAST: ["이전 판", "gray"],
  // 회원
  MEMBER_ACTIVE: ["정상", "green"],
  MEMBER_SUSPENDED: ["정지", "red"],
  // 정산
  WAITING: ["지급 대기", "lime"],
  PAYING: ["지급 중", "lime"],
  PAID: ["지급 완료", "green"],
  FAILED: ["지급 실패", "red"],
  HOLD: ["보류", "red"],
  // 지급 결과
  PAYOUT_REQUESTED: ["진행 중", "lime"],
  PAYOUT_PAID: ["성공", "green"],
  PAYOUT_FAILED: ["실패", "red"],
  // 가게 충전금
  WALLET_OK: ["정상", "green"],
  WALLET_LOW: ["잔액 부족", "red"],
  // 배달 관제 (가게 배달의 단계)
  DLV_REQUESTED: ["라이더 찾는 중", "lime"],
  DLV_TO_STORE: ["가게로 오는 중", "dark"],
  DLV_AT_STORE: ["라이더 가게 도착", "plain"],
  DLV_PICKED_UP: ["배달 중", "green"],
  // 라이더 현금 수금
  CASH_PENDING: ["아직 안 넘김", "lime"],
  CASH_HANDED: ["가게에 넘김", "green"],
  // 관리자
  ADMIN_ACTIVE: ["활성", "green"],
  ADMIN_INVITED: ["초대됨", "lime"],
  ADMIN_INACTIVE: ["비활성", "gray"],
} as const satisfies Record<string, readonly [string, Tone]>;

export type ChipKind = keyof typeof KINDS;

export function chipLabel(kind: ChipKind): string {
  return KINDS[kind][0];
}

export function Chip({ kind, large }: { kind: ChipKind; large?: boolean }) {
  const [label, tone] = KINDS[kind];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg font-extrabold whitespace-nowrap ${TONES[tone].box} ${
        large ? "h-[26px] px-2.5 text-[13px]" : "h-6 px-[9px] text-[12px]"
      }`}
    >
      <span className={`size-1.5 rounded-full ${TONES[tone].dot}`} />
      {label}
    </span>
  );
}

const AUDIENCES = {
  ALL: { label: "전체", apps: "가게 앱 · 라이더 앱", box: "bg-well text-ink" },
  CUSTOMER: {
    label: "가게",
    apps: "가게 앱",
    box: "bg-white text-ink shadow-[inset_0_0_0_1.5px_#DAD8D1]",
  },
  DRIVER: { label: "라이더", apps: "라이더 앱", box: "bg-ink text-white" },
} as const;

export type Audience = keyof typeof AUDIENCES;

/** 공지를 보는 앱 — 가게 앱 · 라이더 앱 */
export function audienceApps(audience: Audience): string {
  return AUDIENCES[audience].apps;
}

export function audienceLabel(audience: Audience): string {
  return AUDIENCES[audience].label;
}

/** 공지 대상 표. */
export function AudienceTag({ audience }: { audience: Audience }) {
  const { label, box } = AUDIENCES[audience];
  return (
    <span
      className={`inline-flex h-6 items-center rounded-lg px-[9px] text-[12px] font-extrabold ${box}`}
    >
      {label}
    </span>
  );
}

/** 정산 받는 기사 조회 DI 토큰. */
export const PAYEE_DIRECTORY = Symbol('PAYEE_DIRECTORY');

/** 정산 화면에 보일 기사. 계좌를 등록하지 않았으면 계좌 칸이 null이다. */
export interface Payee {
  driverId: string;
  name: string;
  bankName: string | null;
  /** 예: ••••1024 */
  maskedAccountNumber: string | null;
  /** 계좌가 본인 명의로 확인됐는지. 아니면 정산을 보류한다. */
  accountVerified: boolean;
  /** 본인 확인이 안 된 사유 (확인에 실패했을 때) */
  verificationFailureReason: string | null;
}

/** 정산 받는 기사의 이름과 계좌를 기사·회원 컨텍스트에서 읽어 오는 포트. */
export interface PayeeDirectory {
  findByDriverIds(driverIds: string[]): Promise<Payee[]>;
}

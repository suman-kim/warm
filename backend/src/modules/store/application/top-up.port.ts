/** 충전 방식 DI 토큰. */
export const TOP_UP_POLICY = Symbol('TOP_UP_POLICY');

/**
 * 충전을 어떻게 받는지. 실제 충전(포트원 가상계좌·카드)을 붙이기 전에는 개발 서버에서만 바로 충전된다.
 */
export interface TopUpPolicy {
  /** 요청하면 돈을 받지 않고 바로 충전한다 (개발 서버 전용). */
  readonly instant: boolean;
}

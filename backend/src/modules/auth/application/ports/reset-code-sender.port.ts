/** 인증 코드 발송 포트 DI 토큰. */
export const RESET_CODE_SENDER = Symbol('RESET_CODE_SENDER');

/** 비밀번호 재설정 인증 코드를 회원에게 보내는 포트 (이메일 등). */
export interface ResetCodeSender {
  send(email: string, code: string): Promise<void>;
}

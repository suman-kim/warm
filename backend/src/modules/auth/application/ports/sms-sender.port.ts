/** 문자 발송 포트 DI 토큰. */
export const SMS_SENDER = Symbol('SMS_SENDER');

/** 휴대폰 인증 코드를 문자로 보내는 포트. */
export interface SmsSender {
  /** [phone]은 숫자만. */
  sendVerificationCode(phone: string, code: string): Promise<void>;
}

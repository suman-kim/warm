/** 약관 동의 기록 포트 DI 토큰. */
export const LEGAL_CONSENT_RECORDER = Symbol('LEGAL_CONSENT_RECORDER');

/** 회원이 동의하는 약관의 종류 (가입 화면에서 받는 것). */
export type ConsentKind = 'TERMS' | 'PRIVACY' | 'MARKETING';

/**
 * 회원이 약관에 동의했다는 기록을 남기는 포트. 동의한 그 시각에 시행 중인 판 번호를 함께 남긴다 —
 * 약관을 고친 뒤 누가 어느 판에 동의했는지 알아야 다시 동의를 받을 수 있다.
 * 가입(인증 컨텍스트)이 부르고, 약관을 가진 콘텐츠 컨텍스트가 구현한다.
 */
export interface LegalConsentRecorder {
  record(userId: string, kinds: ConsentKind[], agreedAt: Date): Promise<void>;
}

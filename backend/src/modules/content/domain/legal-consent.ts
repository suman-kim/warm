import { LegalDocumentType } from './legal-document.js';

/** 약관 동의 기록 저장소 DI 토큰. */
export const LEGAL_CONSENT_REPOSITORY = Symbol('LEGAL_CONSENT_REPOSITORY');

/**
 * 회원이 약관 하나에 동의한 기록. 지우거나 고치지 않고 쌓는다.
 * [version]은 동의한 시각에 시행 중이던 판 — 올린 판이 없을 때 동의했으면 null.
 */
export interface LegalConsent {
  id: string;
  userId: string;
  type: LegalDocumentType;
  version: string | null;
  agreedAt: Date;
}

/** 약관 동의 기록 저장소 계약. */
export interface LegalConsentRepository {
  saveAll(consents: LegalConsent[]): Promise<void>;
  /** 동의한 순서대로. */
  findByUser(userId: string): Promise<LegalConsent[]>;
}

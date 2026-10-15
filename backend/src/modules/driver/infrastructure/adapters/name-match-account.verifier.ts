import { Injectable } from '@nestjs/common';
import {
  AccountVerificationOutcome,
  AccountVerifier,
} from '../../application/ports/account-verifier.port.js';

/**
 * 개발용 계좌 본인 확인. 은행에 묻지 않고, 기사가 적은 예금주 이름이 가입자 이름과 같은지만 본다.
 * 실제 계좌 실명 조회는 PG사 지급대행을 붙일 때 바꾼다 (작업 27).
 */
@Injectable()
export class NameMatchAccountVerifier implements AccountVerifier {
  verify(input: {
    accountHolder: string;
    ownerName: string;
  }): Promise<AccountVerificationOutcome> {
    const normalize = (name: string) => name.replace(/\s/g, '');
    return Promise.resolve(
      normalize(input.accountHolder) === normalize(input.ownerName)
        ? { ok: true }
        : { ok: false, reason: '예금주 이름이 가입자 이름과 달라요.' },
    );
  }
}

import { Injectable } from '@nestjs/common';
import {
  PayoutGateway,
  PayoutOutcome,
} from '../../application/ports/payout-gateway.port.js';

/**
 * 수동 지급. 서버는 돈을 보내지 않는다 — 운영자가 은행에서 직접 이체하고 관리자 웹에서 '지급 처리'로 기록한다.
 * 그래서 늘 지급 완료로 답한다. PG사 지급대행을 붙이면 그 구현으로 바꾼다.
 */
@Injectable()
export class ManualPayoutGateway implements PayoutGateway {
  transfer(): Promise<PayoutOutcome> {
    return Promise.resolve({ status: 'PAID' });
  }
}

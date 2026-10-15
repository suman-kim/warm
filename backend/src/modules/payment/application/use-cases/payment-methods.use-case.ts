import { createHash, randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import {
  ConflictError,
  NotFoundError,
} from '../../../../common/domain/domain-error.js';
import { PaymentMethod } from '../../domain/entities/payment-method.entity.js';
import {
  PAYMENT_METHOD_REPOSITORY,
  type PaymentMethodRepository,
} from '../../domain/repositories/payment.repositories.js';
import {
  CardRegistrationResult,
  PaymentMethodResult,
  toPaymentMethodResult,
} from '../dto/payment.result.js';
import {
  PAYMENT_GATEWAY,
  type PaymentGateway,
} from '../ports/payment-gateway.port.js';

/** 한 사람이 등록할 수 있는 카드 수 */
const MAX_CARDS = 10;

/** PG사에 넘기는 고객 키. 회원 ID를 그대로 내보내지 않으려고 해시한다. */
export function customerKeyOf(userId: string): string {
  return `movo_${createHash('sha256').update(userId).digest('hex').slice(0, 32)}`;
}

/**
 * 결제 수단(카드) 관리 유스케이스 (고객).
 * 카드 번호는 받지 않는다 — 앱이 PG사 화면에서 받은 인증 키로 서버가 빌링키를 발급받는다.
 * 처음 등록한 카드가 기본 카드가 되고, 기본 카드를 지우면 남은 카드 중 가장 먼저 등록한 카드가 기본이 된다.
 */
@Injectable()
export class PaymentMethodsUseCase {
  constructor(
    @Inject(PAYMENT_METHOD_REPOSITORY)
    private readonly repository: PaymentMethodRepository,
    @Inject(PAYMENT_GATEWAY)
    private readonly gateway: PaymentGateway,
  ) {}

  async list(userId: string): Promise<PaymentMethodResult[]> {
    const methods = await this.repository.findUsableByUser(userId);
    return methods.map(toPaymentMethodResult);
  }

  registration(userId: string): CardRegistrationResult {
    return {
      ...this.gateway.registrationSetup(),
      customerKey: customerKeyOf(userId),
    };
  }

  async register(
    userId: string,
    authKey: string,
    makeDefault = false,
  ): Promise<PaymentMethodResult> {
    const methods = await this.repository.findUsableByUser(userId);
    if (methods.length >= MAX_CARDS) {
      throw new ConflictError(
        'TOO_MANY_CARDS',
        `카드는 ${MAX_CARDS}장까지 등록할 수 있어요.`,
      );
    }
    const issued = await this.gateway.issueBillingKey({
      customerKey: customerKeyOf(userId),
      authKey,
    });
    const method = new PaymentMethod(
      randomUUID(),
      userId,
      issued.billingKey,
      issued.cardBrand,
      issued.cardLast4,
      issued.cardType,
      methods.length === 0 || makeDefault,
      new Date(),
      null,
    );
    if (method.isDefault) {
      await this.clearDefault(methods);
    }
    await this.repository.save(method);
    return toPaymentMethodResult(method);
  }

  async setDefault(userId: string, id: string): Promise<PaymentMethodResult> {
    const methods = await this.repository.findUsableByUser(userId);
    const target = methods.find((method) => method.id === id);
    if (!target) {
      throw notFound();
    }
    await this.clearDefault(methods.filter((method) => method !== target));
    target.markDefault(true);
    await this.repository.save(target);
    return toPaymentMethodResult(target);
  }

  async remove(userId: string, id: string): Promise<void> {
    const methods = await this.repository.findUsableByUser(userId);
    const target = methods.find((method) => method.id === id);
    if (!target) {
      throw notFound();
    }
    const wasDefault = target.isDefault;
    target.remove(new Date());
    await this.repository.save(target);
    await this.gateway.removeBillingKey(target.billingKey);
    const next = methods.find((method) => method !== target);
    if (wasDefault && next) {
      next.markDefault(true);
      await this.repository.save(next);
    }
  }

  private async clearDefault(methods: PaymentMethod[]): Promise<void> {
    for (const method of methods.filter((m) => m.isDefault)) {
      method.markDefault(false);
      await this.repository.save(method);
    }
  }
}

function notFound(): NotFoundError {
  return new NotFoundError(
    'PAYMENT_METHOD_NOT_FOUND',
    '카드를 찾을 수 없어요.',
  );
}

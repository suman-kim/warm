import type { PaymentClient } from '@portone/server-sdk';
import { DomainError } from '../../../../common/domain/domain-error.js';
import { CardType } from '../../domain/entities/payment-method.entity.js';
import { PaymentFailureCode } from '../../domain/payment-failure.js';
import {
  failureCodeOf,
  PortOnePaymentGateway,
} from './portone-payment.gateway.js';

const CUSTOMER = 'movo_customer';

/** 포트원 SDK가 던지는 오류 (종류는 data.type에 있다) */
function portOneError(data: Record<string, string>): Error {
  return Object.assign(new Error(data.type), { data });
}

function issued(card: Record<string, string>, customerId = CUSTOMER) {
  return {
    status: 'ISSUED',
    billingKey: 'billing-key-1',
    customer: { id: customerId },
    methods: [{ type: 'BillingKeyPaymentMethodCard', card }],
  };
}

function setup() {
  const client = {
    payWithBillingKey: vi.fn(),
    getPayment: vi.fn(),
    cancelPayment: vi.fn(),
    billingKey: {
      getBillingKeyInfo: vi.fn(),
      deleteBillingKey: vi.fn().mockResolvedValue({}),
    },
  };
  const gateway = new PortOnePaymentGateway(
    client as unknown as PaymentClient,
    'store-1',
    'channel-key-nice',
  );
  return { client, gateway };
}

const CHARGE = {
  billingKey: 'billing-key-1',
  customerKey: CUSTOMER,
  chargeId: 'charge-1',
  amount: 18000,
  orderName: 'MOVO 배송 성수동 → 역삼동',
};

describe('PortOnePaymentGateway', () => {
  it('앱에 포트원 상점과 채널을 알려 준다', () => {
    expect(setup().gateway.registrationSetup()).toEqual({
      provider: 'PORTONE',
      storeId: 'store-1',
      channelKey: 'channel-key-nice',
    });
  });

  describe('카드 등록', () => {
    it('빌링키의 카드사·끝 4자리·종류를 읽는다', async () => {
      const { client, gateway } = setup();
      client.billingKey.getBillingKeyInfo.mockResolvedValue(
        issued({
          issuer: 'SHINHAN_CARD',
          number: '536510******1234',
          type: 'CREDIT',
        }),
      );

      await expect(
        gateway.issueBillingKey({
          customerKey: CUSTOMER,
          authKey: 'billing-key-1',
        }),
      ).resolves.toEqual({
        billingKey: 'billing-key-1',
        cardBrand: '신한카드',
        cardLast4: '1234',
        cardType: CardType.CREDIT,
      });
      expect(client.billingKey.getBillingKeyInfo).toHaveBeenCalledWith({
        billingKey: 'billing-key-1',
        storeId: 'store-1',
      });
    });

    it('모르는 카드사는 상품명을, 체크·기프트 카드는 체크카드로 둔다', async () => {
      const { client, gateway } = setup();
      client.billingKey.getBillingKeyInfo.mockResolvedValue(
        issued({
          issuer: 'NEW_CARD',
          name: '모보 체크카드',
          number: '9410-61**-****-5678',
          type: 'DEBIT',
        }),
      );

      const card = await gateway.issueBillingKey({
        customerKey: CUSTOMER,
        authKey: 'billing-key-1',
      });
      expect(card.cardBrand).toBe('모보 체크카드');
      expect(card.cardLast4).toBe('5678');
      expect(card.cardType).toBe(CardType.CHECK);
    });

    it('다른 고객의 빌링키나 없는 빌링키는 등록하지 않는다', async () => {
      const { client, gateway } = setup();
      client.billingKey.getBillingKeyInfo.mockResolvedValueOnce(
        issued(
          { issuer: 'SHINHAN_CARD', number: '****1234', type: 'CREDIT' },
          'movo_other',
        ),
      );
      await expect(
        gateway.issueBillingKey({
          customerKey: CUSTOMER,
          authKey: 'billing-key-1',
        }),
      ).rejects.toMatchObject({ code: 'CARD_REGISTRATION_FAILED' });

      client.billingKey.getBillingKeyInfo.mockRejectedValueOnce(
        portOneError({ type: 'BILLING_KEY_NOT_FOUND' }),
      );
      await expect(
        gateway.issueBillingKey({ customerKey: CUSTOMER, authKey: 'made-up' }),
      ).rejects.toMatchObject({ code: 'CARD_REGISTRATION_FAILED' });
    });

    it('카드 번호를 알 수 없으면 빌링키를 지우고 등록하지 않는다', async () => {
      const { client, gateway } = setup();
      client.billingKey.getBillingKeyInfo.mockResolvedValue(
        issued({ issuer: 'SHINHAN_CARD', type: 'CREDIT' }),
      );

      await expect(
        gateway.issueBillingKey({
          customerKey: CUSTOMER,
          authKey: 'billing-key-1',
        }),
      ).rejects.toMatchObject({ code: 'CARD_REGISTRATION_FAILED' });
      expect(client.billingKey.deleteBillingKey).toHaveBeenCalledWith({
        billingKey: 'billing-key-1',
        storeId: 'store-1',
      });
    });

    it('포트원에 닿지 못하면 잠시 뒤 다시 하라고 한다', async () => {
      const { client, gateway } = setup();
      client.billingKey.getBillingKeyInfo.mockRejectedValue(
        new TypeError('fetch failed'),
      );

      const error = await gateway
        .issueBillingKey({ customerKey: CUSTOMER, authKey: 'billing-key-1' })
        .catch((e: unknown) => e);
      expect(error).toBeInstanceOf(DomainError);
      expect(error).toMatchObject({ kind: 'UNAVAILABLE' });
    });
  });

  describe('결제', () => {
    it('결제 ID를 포트원 결제 건 아이디로 써서 빌링키로 결제하고 승인번호를 읽는다', async () => {
      const { client, gateway } = setup();
      client.payWithBillingKey.mockResolvedValue({
        payment: { pgTxId: 'nice-tx-1', paidAt: '2026-10-15T01:02:03Z' },
      });
      client.getPayment.mockResolvedValue({
        status: 'PAID',
        method: { type: 'PaymentMethodCard', approvalNumber: '30012345' },
      });

      await expect(gateway.charge(CHARGE)).resolves.toEqual({
        ok: true,
        paymentKey: 'charge-1',
        approvalNumber: '30012345',
        approvedAt: new Date('2026-10-15T01:02:03Z'),
      });
      expect(client.payWithBillingKey).toHaveBeenCalledWith({
        paymentId: 'charge-1',
        storeId: 'store-1',
        billingKey: 'billing-key-1',
        orderName: 'MOVO 배송 성수동 → 역삼동',
        customer: { id: CUSTOMER },
        amount: { total: 18000 },
        currency: 'KRW',
      });
    });

    it('카드사가 거절하면 사유를 고객 안내용으로 묶는다', async () => {
      const { client, gateway } = setup();
      client.payWithBillingKey.mockRejectedValue(
        portOneError({
          type: 'PG_PROVIDER',
          pgCode: '3011',
          pgMessage: '한도초과',
        }),
      );

      await expect(gateway.charge(CHARGE)).resolves.toMatchObject({
        ok: false,
        failureCode: PaymentFailureCode.LIMIT_EXCEEDED,
      });
    });

    it('지워진 빌링키는 카드를 쓸 수 없는 것으로 본다', async () => {
      const { client, gateway } = setup();
      client.payWithBillingKey.mockRejectedValue(
        portOneError({ type: 'BILLING_KEY_ALREADY_DELETED' }),
      );

      await expect(gateway.charge(CHARGE)).resolves.toMatchObject({
        ok: false,
        failureCode: PaymentFailureCode.CARD_SUSPENDED_OR_EXPIRED,
      });
    });

    it('응답을 못 받으면 결제 건을 조회해 결제됐는지 확인한다', async () => {
      const { client, gateway } = setup();
      client.payWithBillingKey.mockRejectedValue(new TypeError('fetch failed'));
      client.getPayment.mockResolvedValue({
        status: 'PAID',
        pgTxId: 'nice-tx-1',
        paidAt: '2026-10-15T01:02:03Z',
      });
      await expect(gateway.charge(CHARGE)).resolves.toMatchObject({
        ok: true,
        paymentKey: 'charge-1',
        approvalNumber: 'nice-tx-1',
      });

      client.getPayment.mockResolvedValue({
        status: 'FAILED',
        failure: { pgMessage: '잔액부족' },
      });
      await expect(gateway.charge(CHARGE)).resolves.toMatchObject({
        ok: false,
        failureCode: PaymentFailureCode.INSUFFICIENT_BALANCE,
      });

      client.getPayment.mockRejectedValue(new TypeError('fetch failed'));
      await expect(gateway.charge(CHARGE)).resolves.toMatchObject({
        ok: false,
        failureCode: PaymentFailureCode.UNKNOWN,
      });
    });
  });

  describe('취소와 카드 삭제', () => {
    it('결제 건을 금액만큼 취소하고, 안 되면 오류를 낸다', async () => {
      const { client, gateway } = setup();
      client.cancelPayment.mockResolvedValueOnce({});
      await gateway.cancel({
        paymentKey: 'charge-1',
        amount: 2700,
        reason: '픽업 전 취소',
      });
      expect(client.cancelPayment).toHaveBeenCalledWith({
        paymentId: 'charge-1',
        storeId: 'store-1',
        amount: 2700,
        reason: '픽업 전 취소',
      });

      client.cancelPayment.mockRejectedValueOnce(
        portOneError({ type: 'PG_PROVIDER', pgMessage: '취소 불가' }),
      );
      await expect(
        gateway.cancel({
          paymentKey: 'charge-1',
          amount: 2700,
          reason: '픽업 전 취소',
        }),
      ).rejects.toMatchObject({ code: 'REFUND_FAILED' });
    });

    it('빌링키를 지우지 못해도 카드 삭제를 막지 않는다', async () => {
      const { client, gateway } = setup();
      client.billingKey.deleteBillingKey.mockRejectedValueOnce(
        portOneError({ type: 'BILLING_KEY_ALREADY_DELETED' }),
      );
      await expect(
        gateway.removeBillingKey('billing-key-1'),
      ).resolves.toBeUndefined();

      client.billingKey.deleteBillingKey.mockRejectedValueOnce(
        new TypeError('fetch failed'),
      );
      await expect(
        gateway.removeBillingKey('billing-key-1'),
      ).resolves.toBeUndefined();
    });
  });

  it('PG사 거절 메시지를 안내 사유로 묶는다', () => {
    expect(failureCodeOf('한도초과')).toBe(PaymentFailureCode.LIMIT_EXCEEDED);
    expect(failureCodeOf('잔액이 부족합니다')).toBe(
      PaymentFailureCode.INSUFFICIENT_BALANCE,
    );
    expect(failureCodeOf('거래정지카드')).toBe(
      PaymentFailureCode.CARD_SUSPENDED_OR_EXPIRED,
    );
    expect(failureCodeOf('유효기간 오류')).toBe(
      PaymentFailureCode.CARD_SUSPENDED_OR_EXPIRED,
    );
    expect(failureCodeOf('카드사 시스템 점검중')).toBe(
      PaymentFailureCode.ISSUER_MAINTENANCE,
    );
    expect(failureCodeOf('본인인증 필요')).toBe(
      PaymentFailureCode.AUTHENTICATION_REQUIRED,
    );
    expect(failureCodeOf('기타 오류')).toBe(PaymentFailureCode.UNKNOWN);
  });
});

import {
  createHarness,
  DAMAS_FARE,
  DAMAS_ORDER,
  Harness,
} from './support/harness.js';

// 결제는 개발용 PG 연동(DevPaymentGateway)으로 한다 — 끝 4자리 0001은 한도 초과로 결제가 안 되는 시험용 카드다.
describe('결제와 진행 단계 (e2e)', () => {
  let h: Harness;

  beforeAll(async () => {
    h = await createHarness();
  });

  afterAll(async () => {
    await h?.close();
  });

  const cards = (token: string) =>
    h.api().get('/api/payment-methods').set(h.bearer(token));
  const order = (token: string, id: string) =>
    h.api().get(`/api/orders/${id}`).set(h.bearer(token));
  const minutesAgo = (minutes: number) =>
    new Date(Date.now() - minutes * 60_000);
  /** 기사가 도착한 시각을 앞당겨, 그만큼 기다린 것으로 만든다. */
  const arrivedMinutesAgo = (orderId: string, minutes: number) =>
    h.dataSource.query(`UPDATE orders SET arrived_at = $2 WHERE id = $1`, [
      orderId,
      minutesAgo(minutes),
    ]);

  describe('결제 수단', () => {
    it('처음 등록한 카드가 기본 카드가 되고, 기본 카드를 지우면 다음 카드가 기본이 된다', async () => {
      const customer = await h.register('CUSTOMER');
      expect((await cards(customer.accessToken).expect(200)).body).toEqual([]);

      const { body: setup } = await h
        .api()
        .get('/api/payment-methods/registration')
        .set(h.bearer(customer.accessToken))
        .expect(200);
      expect(setup).toEqual({
        provider: 'DEV',
        storeId: null,
        channelKey: null,
        customerKey: expect.stringMatching(/^movo_[0-9a-f]{32}$/),
      });

      const first = await h.registerCard(customer.accessToken, '4821');
      const second = await h.registerCard(customer.accessToken, '3310', {
        brand: '국민카드',
        type: 'CHECK',
      });
      expect(first.isDefault).toBe(true);
      expect(second.isDefault).toBe(false);
      const { body: listed } = await cards(customer.accessToken).expect(200);
      expect(listed).toMatchObject([
        { cardBrand: '신한카드', cardLast4: '4821', cardType: 'CREDIT' },
        { cardBrand: '국민카드', cardLast4: '3310', cardType: 'CHECK' },
      ]);
      // 빌링키는 밖으로 나가지 않는다.
      expect(JSON.stringify(listed)).not.toContain('dev_');

      await h
        .api()
        .post(`/api/payment-methods/${second.id}/default`)
        .set(h.bearer(customer.accessToken))
        .expect(200);
      await h
        .api()
        .delete(`/api/payment-methods/${second.id}`)
        .set(h.bearer(customer.accessToken))
        .expect(204);
      expect(
        (await cards(customer.accessToken).expect(200)).body,
      ).toMatchObject([{ id: first.id, isDefault: true }]);

      // 잘못된 인증 키, 남의 카드, 기사는 안 된다.
      await h
        .api()
        .post('/api/payment-methods')
        .set(h.bearer(customer.accessToken))
        .send({ authKey: 'not-a-key' })
        .expect(400);
      const stranger = await h.register('CUSTOMER');
      await h
        .api()
        .delete(`/api/payment-methods/${first.id}`)
        .set(h.bearer(stranger.accessToken))
        .expect(404);
      const driver = await h.onlineDriver('DAMAS');
      await cards(driver.token).expect(403);
    });

    it('등록한 카드가 없으면 배송을 요청할 수 없다', async () => {
      const customer = await h.register('CUSTOMER');

      const { body } = await h
        .api()
        .post('/api/orders')
        .set(h.bearer(customer.accessToken))
        .send(DAMAS_ORDER)
        .expect(409);
      expect(body.code).toBe('PAYMENT_METHOD_REQUIRED');
    });
  });

  it('운반 도움과 계단 요금을 요금에 더하고, 규칙은 따로 받아 본다', async () => {
    const customer = await h.register('CUSTOMER');
    const created = await h.createOrder(customer.accessToken, {
      ...DAMAS_ORDER,
      loadingHelp: 'TOGETHER',
      pickupAccess: { floor: 1, elevator: true },
      dropoffAccess: { floor: 3, elevator: false },
    });

    expect(created).toMatchObject({
      status: 'REQUESTED',
      baseFare: DAMAS_FARE,
      loadingHelp: 'TOGETHER',
      helpFee: 10000,
      dropoffAccess: { floor: 3, elevator: false },
      stairFee: 6000,
      fare: DAMAS_FARE + 16000,
      totalFare: DAMAS_FARE + 16000,
      cancellationFeeNow: 0,
      code: expect.stringMatching(/^MV\d{6}-[0-9A-F]{4}$/),
    });
    const { body: detail } = await order(customer.accessToken, created.id);
    expect(detail.payment).toMatchObject({
      status: 'UNPAID',
      card: { brand: '신한카드', last4: '4821' },
      paidAmount: 0,
    });

    const { body: rules } = await h
      .api()
      .get('/api/orders/charge-policy')
      .set(h.bearer(customer.accessToken))
      .expect(200);
    expect(rules).toEqual({
      helpFees: { NONE: 0, TOGETHER: 10000, DRIVER_ONLY: 20000 },
      stairFeePerFloor: 3000,
      extraUnitPrices: { overload: 10000, bulky: 10000, stairs: 3000 },
      freeWaitingMinutes: 10,
      waitingFeePerMinute: 500,
      cancellationFeePercent: 15,
      noShowWaitMinutes: 30,
    });
  });

  it('배차 때 결제가 안 되면 배차되지 않고, 고객이 다른 카드로 다시 요청할 수 있다', async () => {
    const customer = await h.register('CUSTOMER');
    const driver = await h.onlineDriver('DAMAS');
    await h.registerDevice(customer.accessToken, 'declined-customer-phone');
    const declining = await h.registerCard(customer.accessToken, '0001');
    const created = await h.createOrder(customer.accessToken);
    expect(created.status).toBe('REQUESTED');

    const declined = await h.dispatch(driver.token, created.id, 'accept');
    expect(declined.status).toBe(409);
    expect(declined.body.code).toBe('PAYMENT_DECLINED');

    const { body: failed } = await order(customer.accessToken, created.id);
    expect(failed).toMatchObject({
      status: 'PAYMENT_FAILED',
      driverId: null,
      paymentFailure: {
        code: 'LIMIT_EXCEEDED',
        title: '한도 초과',
        guidance: expect.stringContaining('다른 카드'),
      },
      payment: {
        status: 'FAILED',
        paidAmount: 0,
        charges: [
          {
            kind: 'DISPATCH',
            status: 'FAILED',
            card: { last4: '0001' },
            failure: { code: 'LIMIT_EXCEEDED' },
          },
        ],
      },
    });
    expect(declining.isDefault).toBe(true);
    // 결제 실패한 주문은 대기 목록에서 내려가고, 고객에게 알림이 간다.
    const { body: open } = await h
      .api()
      .get('/api/dispatch/open-orders')
      .set(h.bearer(driver.token))
      .expect(200);
    expect(open.items.map((each: { id: string }) => each.id)).not.toContain(
      created.id,
    );
    const failedPush = await h.waitForPush(created.id, 'ORDER_PAYMENT_FAILED');
    expect(failedPush.message.body).toContain('한도 초과');

    // 다시 요청할 때 새 카드를 등록해 고른다.
    const working = await h.registerCard(customer.accessToken, '4821');
    const { body: retried } = await h
      .api()
      .post(`/api/orders/${created.id}/retry-payment`)
      .set(h.bearer(customer.accessToken))
      .send({ paymentMethodId: working.id })
      .expect(200);
    expect(retried).toMatchObject({
      status: 'REQUESTED',
      paymentFailure: null,
    });

    const { body: accepted } = await h
      .dispatch(driver.token, created.id, 'accept')
      .expect(200);
    expect(accepted).toMatchObject({
      status: 'ASSIGNED',
      driverId: driver.driverId,
    });
    const { body: paid } = await order(customer.accessToken, created.id);
    expect(paid.payment).toMatchObject({
      status: 'PAID',
      card: { last4: '4821' },
      paidAmount: DAMAS_FARE,
      paidAt: expect.any(String),
    });
  });

  it('출발 → 도착 → 픽업(추가 요금·대기료 결제) → 완료하고, 영수증에 부가세를 나눠 보여 준다', async () => {
    const customer = await h.register('CUSTOMER');
    const driver = await h.onlineDriver('DAMAS');
    await h.registerDevice(customer.accessToken, 'stages-customer-phone');
    const created = await h.orderAt(
      customer.accessToken,
      driver.token,
      'accept',
    );

    const { body: departed } = await h
      .dispatch(driver.token, created.id, 'depart')
      .expect(200);
    expect(departed).toMatchObject({
      status: 'DEPARTED',
      departedAt: expect.any(String),
      cancellationFeeNow: 5000, // 33,200원의 15% = 4,980원 → 100원 단위
    });
    await h.dispatch(driver.token, created.id, 'depart').expect(409);

    const { body: arrived } = await h
      .dispatch(driver.token, created.id, 'arrive')
      .expect(200);
    expect(arrived).toMatchObject({
      status: 'ARRIVED',
      noShowAvailableAt: expect.any(String),
    });
    await arrivedMinutesAgo(created.id, 14);

    const { body: pickedUp } = await h
      .dispatch(driver.token, created.id, 'pickup')
      .send({ overload: 1 })
      .expect(200);
    expect(pickedUp).toMatchObject({
      status: 'PICKED_UP',
      extraItems: { overload: 1, bulky: 0, stairs: 0 },
      extraFee: 10000,
      waitingMinutes: 14,
      waitingFee: 2000,
      totalFare: DAMAS_FARE + 12000,
    });
    await h.dispatch(driver.token, created.id, 'complete').expect(200);

    const { body: detail } = await order(customer.accessToken, created.id);
    expect(detail.payment).toMatchObject({
      status: 'PAID',
      paidAmount: DAMAS_FARE + 12000,
      unpaidAmount: 0,
      additionalPaidAt: expect.any(String),
      charges: [
        { kind: 'DISPATCH', amount: DAMAS_FARE, status: 'PAID' },
        { kind: 'ADDITIONAL', amount: 12000, status: 'PAID' },
      ],
    });
    const total = DAMAS_FARE + 12000;
    const { body: receipt } = await h
      .api()
      .get(`/api/orders/${created.id}/receipt`)
      .set(h.bearer(customer.accessToken))
      .expect(200);
    expect(receipt).toMatchObject({
      code: detail.code,
      paidAmount: total,
      vat: Math.round(total / 11),
      supplyAmount: total - Math.round(total / 11),
      finalAmount: total,
      approvalNumbers: [expect.any(String), expect.any(String)],
    });
    // 기사는 카드 정보를 보지 못하고 영수증도 없다.
    const { body: asDriver } = await order(driver.token, created.id);
    expect(asDriver.payment).toBeNull();
    await h
      .api()
      .get(`/api/orders/${created.id}/receipt`)
      .set(h.bearer(driver.token))
      .expect(403);
    await h.waitForPush(created.id, 'PAYMENT_ADDITIONAL_PAID');
  });

  describe('취소 수수료와 노쇼', () => {
    it('기사가 출발하기 전에 취소하면 모두, 출발한 뒤에는 15%를 빼고 자동으로 돌려준다', async () => {
      const customer = await h.register('CUSTOMER');
      const driver = await h.onlineDriver('DAMAS');
      await h.registerDevice(customer.accessToken, 'cancel-customer-phone');
      const cancel = (id: string) =>
        h
          .api()
          .post(`/api/orders/${id}/cancel`)
          .set(h.bearer(customer.accessToken))
          .send({ reason: '일정 변경' })
          .expect(200);

      const early = await h.orderAt(
        customer.accessToken,
        driver.token,
        'accept',
      );
      expect((await cancel(early.id)).body).toMatchObject({
        status: 'CANCELLED',
        cancellationFee: 0,
      });
      const { body: earlyDetail } = await order(customer.accessToken, early.id);
      expect(earlyDetail.payment).toMatchObject({
        status: 'REFUNDED',
        refundedAmount: DAMAS_FARE,
        refunds: [{ amount: DAMAS_FARE, automatic: true }],
      });

      const late = await h.orderAt(
        customer.accessToken,
        driver.token,
        'accept',
      );
      await h.dispatch(driver.token, late.id, 'depart').expect(200);
      expect((await cancel(late.id)).body).toMatchObject({
        status: 'CANCELLED',
        cancellationFee: 5000,
      });
      const { body: lateDetail } = await order(customer.accessToken, late.id);
      expect(lateDetail.payment).toMatchObject({
        status: 'PARTIALLY_REFUNDED',
        refundedAmount: DAMAS_FARE - 5000,
      });
      const refunded = await h.waitForPush(late.id, 'PAYMENT_REFUNDED');
      expect(refunded.message.body).toContain('취소 수수료 5,000원');

      // 이용 내역에도 수수료와 환불이 보인다.
      const { body: history } = await h
        .api()
        .get('/api/orders')
        .set(h.bearer(customer.accessToken))
        .expect(200);
      expect(
        history.items.find((each: { id: string }) => each.id === late.id),
      ).toMatchObject({
        cancellationFee: 5000,
        payment: { refundedAmount: DAMAS_FARE - 5000 },
      });

      // 기사가 받는 취소 보상은 지금 정책으로 0원이다.
      const { body: deliveries } = await h
        .api()
        .get('/api/dispatch/my-orders?status=CANCELLED')
        .set(h.bearer(driver.token))
        .expect(200);
      expect(
        deliveries.items.find((each: { id: string }) => each.id === late.id),
      ).toMatchObject({ earning: 0 });
    });

    it('도착하고 30분이 지나야 노쇼를 신고할 수 있고, 요금은 돌려주지 않는다', async () => {
      const customer = await h.register('CUSTOMER');
      const driver = await h.onlineDriver('DAMAS');
      await h.registerDevice(customer.accessToken, 'noshow-customer-phone');
      const created = await h.orderAt(
        customer.accessToken,
        driver.token,
        'accept',
      );
      await h.dispatch(driver.token, created.id, 'no-show').expect(409);
      await h.dispatch(driver.token, created.id, 'arrive').expect(200);

      const early = await h.dispatch(driver.token, created.id, 'no-show');
      expect(early.status).toBe(409);
      expect(early.body.code).toBe('NO_SHOW_TOO_EARLY');

      await arrivedMinutesAgo(created.id, 31);
      const { body: noShow } = await h
        .dispatch(driver.token, created.id, 'no-show')
        .expect(200);
      expect(noShow).toMatchObject({
        status: 'NO_SHOW',
        noShowAt: expect.any(String),
        cancellationFee: DAMAS_FARE,
      });
      const { body: detail } = await order(customer.accessToken, created.id);
      expect(detail.payment).toMatchObject({
        status: 'PAID',
        paidAmount: DAMAS_FARE,
        refundedAmount: 0,
      });
      // 노쇼로 끝난 주문은 고객이 취소할 수 없다.
      await h
        .api()
        .post(`/api/orders/${created.id}/cancel`)
        .set(h.bearer(customer.accessToken))
        .send({})
        .expect(409);
      await h.waitForPush(created.id, 'ORDER_NO_SHOW');
    });
  });

  it('기사의 정산 내역: 이번 주 수입이 쌓이고, 계좌 본인 확인 전에는 보류다', async () => {
    const customer = await h.register('CUSTOMER');
    const driver = await h.onlineDriver('DAMAS');
    await h.orderAt(customer.accessToken, driver.token, 'complete');
    const settlements = () =>
      h
        .api()
        .get('/api/dispatch/settlements')
        .set(h.bearer(driver.token))
        .expect(200);

    const { body: held } = await settlements();
    expect(held).toMatchObject({
      commissionPercent: 10,
      account: null,
      onHold: true,
      current: {
        status: 'IN_PROGRESS',
        trips: 1,
        gross: DAMAS_FARE,
        net: DAMAS_FARE - Math.round(DAMAS_FARE / 100) * 10,
      },
      upcoming: [],
      paid: [],
    });

    await h
      .api()
      .put('/api/drivers/me/settlement-account')
      .set(h.bearer(driver.token))
      .send({
        bankName: '국민',
        accountNumber: '123456789012',
        accountHolder: driver.account.user.name,
      })
      .expect(200);
    const { body: ready } = await settlements();
    expect(ready).toMatchObject({
      onHold: false,
      account: {
        bankName: '국민',
        maskedAccountNumber: '••••9012',
        verified: true,
      },
    });
  });

  it('사업자 정보는 로그인 없이 본다 (적지 않은 칸은 null)', async () => {
    const { body } = await h.api().get('/api/support/business').expect(200);
    expect(Object.keys(body).sort()).toEqual([
      'address',
      'email',
      'hours',
      'mailOrderNumber',
      'name',
      'phone',
      'registrationNumber',
      'representative',
    ]);
  });
});

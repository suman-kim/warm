import {
  createHarness,
  Harness,
  STORE as STORE_INFO,
} from './support/harness.js';

// 음식점 배달대행: 사장님(고객 앱 계정)이 가게를 등록하고, 운영자가 심사하고, 충전금을 쌓고 쓴다.
describe('가게 · 충전금 (e2e)', () => {
  let h: Harness;

  beforeAll(async () => {
    h = await createHarness();
  });
  afterAll(() => h.close());

  const STORE = { ...STORE_INFO, businessNumber: '220-81-62517' };

  it('가게를 등록하면 심사를 기다리고, 운영자가 반려·승인한다', async () => {
    const owner = await h.register('CUSTOMER');
    const mine = () =>
      h.api().get('/api/stores/me').set(h.bearer(owner.accessToken));

    expect((await mine().expect(404)).body.code).toBe('STORE_NOT_REGISTERED');
    const invalid = await h
      .api()
      .post('/api/stores')
      .set(h.bearer(owner.accessToken))
      .send({ ...STORE, businessNumber: '123-45-67890' })
      .expect(400);
    expect(invalid.body.code).toBe('INVALID_BUSINESS_NUMBER');

    const { body: store } = await h
      .api()
      .post('/api/stores')
      .set(h.bearer(owner.accessToken))
      .send(STORE)
      .expect(201);
    expect(store).toMatchObject({
      name: '모보치킨 역삼점',
      businessNumber: '2208162517',
      phone: '025551234',
      status: 'PENDING',
      walletBalance: 0,
      address: { dong: '역삼동', detailAddress: '1층' },
    });
    // 한 계정에 가게 하나.
    await h
      .api()
      .post('/api/stores')
      .set(h.bearer(owner.accessToken))
      .send(STORE)
      .expect(409);
    // 라이더는 가게를 등록할 수 없다.
    const driver = await h.onlineDriver();
    await h
      .api()
      .post('/api/stores')
      .set(h.bearer(driver.token))
      .send(STORE)
      .expect(403);

    const admin = (path: string) =>
      h
        .api()
        .patch(`/api/admin/stores/${store.id}/${path}`)
        .set(h.bearer(h.adminToken));
    const pending = await h
      .api()
      .get('/api/admin/stores?status=PENDING')
      .set(h.bearer(h.adminToken))
      .expect(200);
    expect(pending.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: store.id, ownerEmail: owner.user.email }),
      ]),
    );

    await admin('reject')
      .send({ reason: '사업자등록증의 상호와 달라요' })
      .expect(200);
    expect((await mine().expect(200)).body).toMatchObject({
      status: 'REJECTED',
      rejectionReason: '사업자등록증의 상호와 달라요',
    });
    // 고치면 다시 심사를 받는다.
    await h
      .api()
      .put('/api/stores/me')
      .set(h.bearer(owner.accessToken))
      .send({ ...STORE, name: '모보치킨' })
      .expect(200);
    expect((await mine().expect(200)).body.status).toBe('PENDING');

    await admin('approve').expect(200);
    expect((await mine().expect(200)).body).toMatchObject({
      status: 'APPROVED',
      name: '모보치킨',
      rejectionReason: null,
    });
    await admin('approve').expect(409);
  });

  it('충전하면 잔액과 내역이 쌓이고, 운영자가 사유와 함께 조정한다', async () => {
    const owner = await h.register('CUSTOMER');
    const { body: store } = await h
      .api()
      .post('/api/stores')
      .set(h.bearer(owner.accessToken))
      .send({ ...STORE, businessNumber: '124-81-00998' })
      .expect(201);
    const topUp = (amount: number) =>
      h
        .api()
        .post('/api/stores/me/wallet/top-ups')
        .set(h.bearer(owner.accessToken))
        .send({ amount });

    expect((await topUp(5_000).expect(400)).body.code).toBe(
      'INVALID_TOP_UP_AMOUNT',
    );
    await topUp(50_000).expect(201);
    await topUp(30_000).expect(201);

    const adjust = (amount: number, memo: string) =>
      h
        .api()
        .post(`/api/admin/stores/${store.id}/wallet/adjustments`)
        .set(h.bearer(h.adminToken))
        .send({ amount, memo });
    expect((await adjust(-100_000, '잘못 충전').expect(409)).body.code).toBe(
      'INSUFFICIENT_WALLET_BALANCE',
    );
    await adjust(-5_000, '테스트 충전 회수').expect(201);

    const wallet = await h
      .api()
      .get('/api/stores/me/wallet')
      .set(h.bearer(owner.accessToken))
      .expect(200);
    expect(wallet.body).toMatchObject({ balance: 75_000, total: 3 });
    expect(
      wallet.body.items.map(
        (e: { kind: string; amount: number; balanceAfter: number }) => [
          e.kind,
          e.amount,
          e.balanceAfter,
        ],
      ),
    ).toEqual([
      ['ADJUSTMENT', -5_000, 75_000],
      ['TOP_UP', 30_000, 80_000],
      ['TOP_UP', 50_000, 50_000],
    ]);
    expect(wallet.body.items[0].memo).toBe('테스트 충전 회수');
    // 사장님은 운영자 화면을 볼 수 없다.
    await h
      .api()
      .get(`/api/admin/stores/${store.id}/wallet`)
      .set(h.bearer(owner.accessToken))
      .expect(403);
  });

  describe('가게 배달', () => {
    // 역삼동 가게에서 약 1.3km 떨어진 손님.
    const CUSTOMER_HOME = {
      address: '서울 강남구 역삼로 180',
      detailAddress: '101동 1203호',
      sigungu: '강남구',
      dong: '역삼동',
      latitude: 37.4955,
      longitude: 127.0495,
      phone: '050-1234-5678',
    };

    /** 승인받고 충전한 가게의 사장님 토큰과 가게 ID */
    async function readyStore(businessNumber: string, topUp: number) {
      const owner = await h.register('CUSTOMER');
      const { body: store } = await h
        .api()
        .post('/api/stores')
        .set(h.bearer(owner.accessToken))
        .send({ ...STORE, businessNumber })
        .expect(201);
      await h
        .api()
        .patch(`/api/admin/stores/${store.id}/approve`)
        .set(h.bearer(h.adminToken))
        .expect(200);
      if (topUp > 0) {
        await h
          .api()
          .post('/api/stores/me/wallet/top-ups')
          .set(h.bearer(owner.accessToken))
          .send({ amount: topUp })
          .expect(201);
      }
      return { token: owner.accessToken, storeId: store.id as string };
    }

    const balanceOf = async (token: string) =>
      (
        await h
          .api()
          .get('/api/stores/me/wallet')
          .set(h.bearer(token))
          .expect(200)
      ).body.balance as number;

    const requestDelivery = (token: string, extra: object = {}) =>
      h
        .api()
        .post('/api/deliveries')
        .set(h.bearer(token))
        .send({
          dropoff: CUSTOMER_HOME,
          foodAmount: 23_000,
          doorPayment: 'CASH',
          readyInMinutes: 15,
          memo: '문 앞에 두고 벨 눌러 주세요',
          ...extra,
        });

    it('요청하면 대행료가 충전금에서 빠지고, 라이더가 수락하면 바로 배차된다 — 완료 때 받은 현금을 남긴다', async () => {
      const store = await readyStore('101-81-00016', 20_000);
      const rider = await h.onlineDriver();

      const { body: quote } = await h
        .api()
        .post('/api/deliveries/quotes')
        .set(h.bearer(store.token))
        .send({ dropoff: { ...CUSTOMER_HOME, phone: undefined } })
        .expect(200);
      expect(quote.walletBalance).toBe(20_000);
      expect(quote.fee).toBeGreaterThanOrEqual(3_500);

      const { body: order } = await requestDelivery(store.token).expect(201);
      expect(order).toMatchObject({
        status: 'REQUESTED',
        fare: quote.fee,
        pickup: { dong: '역삼동' },
        storeDelivery: {
          storeId: store.storeId,
          foodAmount: 23_000,
          doorPayment: 'CASH',
          collectedMethod: null,
        },
      });
      expect(order.storeDelivery.readyAt).not.toBeNull();
      expect(await balanceOf(store.token)).toBe(20_000 - quote.fee);

      // 라이더는 대기 목록에서 가게 이름과 받을 음식값을 미리 본다.
      const open = await h
        .api()
        .get('/api/dispatch/open-orders')
        .set(h.bearer(rider.token))
        .expect(200);
      expect(
        open.body.items.find((item: { id: string }) => item.id === order.id),
      ).toMatchObject({
        storeDelivery: {
          storeName: '모보치킨 역삼점',
          foodAmount: 23_000,
          doorPayment: 'CASH',
        },
        // 라이더 몫: 대행료에서 수수료 10%를 뺀 금액 (3,500원 → 3,150원)
        earning: quote.fee - Math.round(quote.fee / 100) * 10,
      });

      const accepted = await h
        .dispatch(rider.token, order.id, 'accept')
        .expect(200);
      expect(accepted.body.status).toBe('ASSIGNED');
      await h.dispatch(rider.token, order.id, 'pickup').expect(200);

      // 만나서 결제는 받은 방식과 금액이 있어야 완료된다.
      const missing = await h
        .dispatch(rider.token, order.id, 'complete')
        .expect(400);
      expect(missing.body.code).toBe('COLLECTION_REQUIRED');
      const done = await h
        .api()
        .post(`/api/dispatch/orders/${order.id}/complete`)
        .set(h.bearer(rider.token))
        .send({ collectedMethod: 'CASH', collectedAmount: 23_000 })
        .expect(200);
      expect(done.body).toMatchObject({
        status: 'DELIVERED',
        storeDelivery: { collectedMethod: 'CASH', collectedAmount: 23_000 },
      });
    });

    it('픽업 전에 취소하면 대행료를 충전금으로 돌려준다', async () => {
      const store = await readyStore('101-81-00020', 20_000);
      // 배달앱 안심번호(12자리)도 손님 연락처로 받는다.
      const { body: order } = await requestDelivery(store.token, {
        dropoff: { ...CUSTOMER_HOME, phone: '0504-1234-5678' },
        doorPayment: 'PREPAID',
        foodAmount: 0,
      }).expect(201);
      expect(order.dropoff.contactPhone).toBe('050412345678');
      expect(await balanceOf(store.token)).toBe(20_000 - order.fare);

      await h
        .api()
        .post(`/api/orders/${order.id}/cancel`)
        .set(h.bearer(store.token))
        .send({ reason: '손님 주문 취소' })
        .expect(200);
      expect(await balanceOf(store.token)).toBe(20_000);
      const wallet = await h
        .api()
        .get('/api/stores/me/wallet')
        .set(h.bearer(store.token))
        .expect(200);
      const short = (order.code as string).slice(-4);
      // 내역에서 어느 배달인지 알아보게 손님 동과 주문번호 끝자리를 남긴다.
      expect(wallet.body.items[0]).toMatchObject({
        kind: 'REFUND',
        amount: order.fare,
        orderId: order.id,
        memo: `${CUSTOMER_HOME.dong} · ${short} · 라이더 출발 전 취소라 모두 돌려받았어요`,
      });
      expect(wallet.body.items[1]).toMatchObject({
        kind: 'DELIVERY_FEE',
        memo: `${CUSTOMER_HOME.dong} · ${short}`,
      });
    });

    it('충전금이 모자라거나 승인 전이면 요청할 수 없고, 만나서 결제는 음식값이 있어야 한다', async () => {
      const poor = await readyStore('101-81-00035', 0);
      expect((await requestDelivery(poor.token).expect(409)).body.code).toBe(
        'INSUFFICIENT_WALLET_BALANCE',
      );

      const store = await readyStore('101-81-00049', 20_000);
      expect(
        (await requestDelivery(store.token, { foodAmount: 0 }).expect(400)).body
          .code,
      ).toBe('FOOD_AMOUNT_REQUIRED');
      // 막힌 요청은 충전금을 건드리지 않는다.
      expect(await balanceOf(store.token)).toBe(20_000);

      const pending = await h.register('CUSTOMER');
      await h
        .api()
        .post('/api/stores')
        .set(h.bearer(pending.accessToken))
        .send({ ...STORE, businessNumber: '101-81-00054' })
        .expect(201);
      expect(
        (await requestDelivery(pending.accessToken).expect(409)).body.code,
      ).toBe('STORE_NOT_APPROVED');
    });

    it('라이더 한 명은 동시에 세 건까지만 맡는다 (묶음배송)', async () => {
      const store = await readyStore('101-81-00068', 50_000);
      const rider = await h.onlineDriver();
      const ids: string[] = [];
      for (let i = 0; i < 4; i++) {
        const { body } = await requestDelivery(store.token, {
          doorPayment: 'PREPAID',
          foodAmount: 0,
        }).expect(201);
        ids.push(body.id);
      }
      for (const id of ids.slice(0, 3)) {
        await h.dispatch(rider.token, id, 'accept').expect(200);
      }
      const fourth = await h
        .dispatch(rider.token, ids[3], 'accept')
        .expect(409);
      expect(fourth.body.code).toBe('TOO_MANY_ACTIVE_DELIVERIES');

      // 하나를 끝내면 다시 받을 수 있다.
      await h.dispatch(rider.token, ids[0], 'pickup').expect(200);
      await h.dispatch(rider.token, ids[0], 'complete').expect(200);
      await h.dispatch(rider.token, ids[3], 'accept').expect(200);
    });

    it('운영자는 진행 중 배달(지연 표시)과 라이더 현금 수금, 가게 충전금 현황을 본다', async () => {
      const store = await readyStore('101-81-00073', 50_000);
      const rider = await h.onlineDriver();
      const admin = (path: string) =>
        h.api().get(`/api/admin/${path}`).set(h.bearer(h.adminToken));

      // 현금으로 받은 배달 하나와, 아직 라이더를 찾는 배달 하나
      const { body: cash } = await requestDelivery(store.token).expect(201);
      await h.dispatch(rider.token, cash.id, 'accept').expect(200);
      await h.dispatch(rider.token, cash.id, 'pickup').expect(200);
      await h
        .api()
        .post(`/api/dispatch/orders/${cash.id}/complete`)
        .set(h.bearer(rider.token))
        .send({ collectedMethod: 'CASH', collectedAmount: 23_000 })
        .expect(200);
      const { body: waiting } = await requestDelivery(store.token, {
        doorPayment: 'PREPAID',
        foodAmount: 0,
      }).expect(201);
      // 요청하고 15분이 지난 것으로 — 배차 지연(10분)이다.
      await h.dataSource.query(
        `UPDATE orders SET requested_at = now() - interval '15 minutes' WHERE id = $1`,
        [waiting.id],
      );

      const { body: monitor } = await admin('deliveries').expect(200);
      expect(monitor.summary.dispatchLate).toBeGreaterThanOrEqual(1);
      const late = monitor.items.find(
        (item: { id: string }) => item.id === waiting.id,
      );
      expect(late).toMatchObject({
        status: 'REQUESTED',
        storeName: '모보치킨 역삼점',
        customerArea: '역삼동',
        flag: 'DISPATCH_LATE',
        riderName: null,
      });
      expect(late.elapsedMinutes).toBeGreaterThanOrEqual(15);
      // 지연된 건이 위로 온다.
      expect(monitor.items[0].flag).not.toBeNull();
      const { body: pickupLate } = await admin(
        'deliveries?flag=PICKUP_LATE',
      ).expect(200);
      expect(
        pickupLate.items.some((item: { id: string }) => item.id === waiting.id),
      ).toBe(false);

      // 라이더 현금 수금: 아직 가게에 넘기지 않았다 → 넘김 표시
      const today = new Date(Date.now() + 9 * 3_600_000)
        .toISOString()
        .slice(0, 10);
      const { body: before } = await admin(
        `rider-cash?date=${today}&handed=false`,
      ).expect(200);
      expect(
        before.items.find(
          (item: { orderId: string }) => item.orderId === cash.id,
        ),
      ).toMatchObject({
        storeName: '모보치킨 역삼점',
        collectedAmount: 23_000,
        foodAmount: 23_000,
        handedAt: null,
      });
      expect(before.summary.pending).toBeGreaterThanOrEqual(23_000);
      const marked = await h
        .api()
        .patch(`/api/admin/rider-cash/${cash.id}`)
        .set(h.bearer(h.adminToken))
        .send({ handed: true })
        .expect(200);
      expect(marked.body.handedAt).not.toBeNull();
      const { body: after } = await admin(
        `rider-cash?date=${today}&handed=false`,
      ).expect(200);
      expect(
        after.items.some(
          (item: { orderId: string }) => item.orderId === cash.id,
        ),
      ).toBe(false);
      // 현금을 받지 않은 배달은 표시할 수 없다.
      const wrong = await h
        .api()
        .patch(`/api/admin/rider-cash/${waiting.id}`)
        .set(h.bearer(h.adminToken))
        .send({ handed: true })
        .expect(409);
      expect(wrong.body.code).toBe('NO_CASH_COLLECTED');

      // 가게 PC의 배달 내역은 요청한 날짜(한국)로 거른다.
      const listed = async (from: string, to: string) =>
        (
          await h
            .api()
            .get(`/api/orders?from=${from}&to=${to}`)
            .set(h.bearer(store.token))
            .expect(200)
        ).body.items.map((item: { id: string }) => item.id);
      expect(await listed(today, today)).toEqual(
        expect.arrayContaining([cash.id, waiting.id]),
      );
      expect(await listed('2026-01-01', '2026-01-02')).toEqual([]);

      // 가게 충전금 현황: 오늘 충전과 대행료
      const { body: wallets } = await admin('stores/wallets').expect(200);
      const mine = wallets.items.find(
        (item: { storeId: string }) => item.storeId === store.storeId,
      );
      expect(mine).toMatchObject({
        name: '모보치킨 역삼점',
        todayTopUps: 50_000,
        todayFees: cash.fare + waiting.fare,
        balance: 50_000 - cash.fare - waiting.fare,
        lastEntryKind: 'DELIVERY_FEE',
        low: false,
      });
      expect(wallets.totalBalance).toBeGreaterThanOrEqual(mine.balance);
    });
  });
});

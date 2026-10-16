import {
  createHarness,
  CUSTOMER_HOME,
  Harness,
  JPEG,
} from './support/harness.js';

// 주문앱(따끈): 손님이 가게를 찾아 결제하면 가게가 받고, 받으면 배달이 자동으로 요청된다.
// 배달이 끝나면 가게 정산 내역이 쌓이고, 운영자가 정책(수수료율·정산 주기)을 바꾸고 정산을 지급한다.
// 결제는 개발용 PG(결제창 없이 결제된다)로 돈다.
describe('주문앱 따끈 (e2e)', () => {
  let h: Harness;
  let owner: { token: string; storeId: string };
  let consumerToken: string;
  let menu: { chicken: string; cola: string };

  const { phone: _phone, ...dropoff } = CUSTOMER_HOME;
  const OPEN_ALL_DAY = Array.from({ length: 7 }, () => ({
    open: '00:00',
    close: '24:00',
  }));
  const cart = () => [
    {
      menuItemId: menu.chicken,
      quantity: 1,
      options: [{ groupId: 'part', optionIds: ['boneless'] }],
    },
    { menuItemId: menu.cola, quantity: 2 },
  ];
  // 치킨 18,000 + 순살 2,000 + 콜라 2,000 × 2
  const MENU_AMOUNT = 24_000;
  // 기본 배달팁 3,000 + 1km 넘어 500 (가게에서 1.3km)
  const DELIVERY_TIP = 3_500;
  const PAYMENT = MENU_AMOUNT + DELIVERY_TIP;

  const asOwner = () => h.bearer(owner.token);
  const asConsumer = () => h.bearer(consumerToken);
  const asAdmin = () => h.bearer(h.adminToken);

  /** 주문하고 결제까지 마친 주문 ID. */
  async function paidOrder(): Promise<string> {
    const { body } = await h
      .api()
      .post('/api/food-orders')
      .set(asConsumer())
      .send({ storeId: owner.storeId, lines: cart(), dropoff })
      .expect(201);
    await h
      .api()
      .post(`/api/food-orders/${body.order.id}/payment/complete`)
      .set(asConsumer())
      .expect(200);
    return body.order.id as string;
  }

  const accept = (orderId: string, cookMinutes = 15) =>
    h
      .api()
      .post(`/api/stores/me/food-orders/${orderId}/accept`)
      .set(asOwner())
      .send({ cookMinutes });

  const consumerOrder = async (orderId: string) =>
    (
      await h
        .api()
        .get(`/api/food-orders/${orderId}`)
        .set(asConsumer())
        .expect(200)
    ).body;

  beforeAll(async () => {
    h = await createHarness();
    // 충전금이 없는 가게 — 주문앱 배달은 충전금에서 빠지지 않는다.
    owner = await h.readyStore(0);
    consumerToken = (await h.register('CONSUMER')).accessToken;
  });
  afterAll(() => h.close());

  it('정책: 운영자가 수수료율·정산 주기를 바꾸고 기록이 남는다', async () => {
    const { body: initial } = await h
      .api()
      .get('/api/admin/marketplace-policy')
      .set(asAdmin())
      .expect(200);
    expect(initial).toMatchObject({
      commissionRatePercent: 2,
      consumerPhoneVerificationRequired: true,
      storeSettlementCycle: 'WEEKLY',
      updatedAt: null,
    });

    await h
      .api()
      .put('/api/admin/marketplace-policy')
      .set(asAdmin())
      .send({ commissionRatePercent: 31 })
      .expect(400);
    const { body: updated } = await h
      .api()
      .put('/api/admin/marketplace-policy')
      .set(asAdmin())
      .send({
        commissionRatePercent: 1.5,
        paymentFeeRatePercent: 3,
        storeSettlementCycle: 'DAILY',
        storeSettlementDelayDays: 1,
      })
      .expect(200);
    expect(updated).toMatchObject({
      commissionRatePercent: 1.5,
      paymentFeeRatePercent: 3,
      storeSettlementCycle: 'DAILY',
      reviewWindowDays: 7,
    });
    expect(updated.updatedAt).not.toBeNull();
    const { body: history } = await h
      .api()
      .get('/api/admin/marketplace-policy/history')
      .set(asAdmin())
      .expect(200);
    expect(history).toHaveLength(1);

    // 사장님은 정책을 바꿀 수 없다.
    await h
      .api()
      .put('/api/admin/marketplace-policy')
      .set(asOwner())
      .send({ commissionRatePercent: 0 })
      .expect(403);
  });

  it('손님 가입은 휴대폰 인증이 필요하고, 정책으로 끌 수 있다', async () => {
    const withoutToken = await h
      .api()
      .post('/api/auth/register')
      .send({
        email: 'consumer-x@test.dev',
        password: 'password123',
        name: '손님',
        phone: '01077778888',
        role: 'CONSUMER',
        agreements: { terms: true, privacy: true, marketing: false },
      })
      .expect(400);
    expect(withoutToken.body.code).toBe('PHONE_VERIFICATION_REQUIRED');

    await h
      .api()
      .put('/api/admin/marketplace-policy')
      .set(asAdmin())
      .send({ consumerPhoneVerificationRequired: false })
      .expect(200);
    await h.register('CONSUMER', { phoneVerificationToken: undefined });
    await h
      .api()
      .put('/api/admin/marketplace-policy')
      .set(asAdmin())
      .send({ consumerPhoneVerificationRequired: true })
      .expect(200);
  });

  it('사장님이 운영 설정과 메뉴를 만들고 주문 받기를 켠다', async () => {
    const { body: initial } = await h
      .api()
      .get('/api/stores/me/storefront')
      .set(asOwner())
      .expect(200);
    expect(initial).toMatchObject({
      approved: true,
      open: false,
      closedReason: 'NOT_OPENED',
      visibleMenuCount: 0,
    });

    await h
      .api()
      .put('/api/stores/me/storefront')
      .set(asOwner())
      .send({
        category: 'CHICKEN',
        description: '바삭한 치킨',
        originNotice: '닭고기: 국내산',
        minOrderAmount: 15000,
        maxDeliveryKm: 3,
        deliveryTipRules: [
          { minOrderAmount: 0, tip: 3000 },
          { minOrderAmount: 30000, tip: 1000 },
        ],
        distanceTipRules: [{ overKm: 1, extra: 500 }],
        businessHours: OPEN_ALL_DAY,
      })
      .expect(200);

    // 보이는 메뉴가 없으면 켤 수 없다.
    const empty = await h
      .api()
      .put('/api/stores/me/storefront/open')
      .set(asOwner())
      .send({ open: true })
      .expect(409);
    expect(empty.body.code).toBe('NO_VISIBLE_MENU');

    const { body: categories } = await h
      .api()
      .post('/api/stores/me/menu/categories')
      .set(asOwner())
      .send({ name: '대표 메뉴' })
      .expect(201);
    const categoryId = categories[0].id as string;
    const { body: chicken } = await h
      .api()
      .post('/api/stores/me/menu/items')
      .set(asOwner())
      .send({
        categoryId,
        name: '후라이드 치킨',
        price: 18000,
        optionGroups: [
          {
            id: 'part',
            name: '부위',
            minSelect: 1,
            maxSelect: 1,
            options: [
              { id: 'whole', name: '한 마리', price: 0 },
              { id: 'boneless', name: '순살', price: 2000 },
            ],
          },
        ],
      })
      .expect(201);
    const { body: cola } = await h
      .api()
      .post('/api/stores/me/menu/items')
      .set(asOwner())
      .send({ categoryId, name: '콜라', price: 2000, sortOrder: 1 })
      .expect(201);
    menu = { chicken: chicken.id, cola: cola.id };

    // 메뉴가 남은 카테고리는 지울 수 없다.
    await h
      .api()
      .delete(`/api/stores/me/menu/categories/${categoryId}`)
      .set(asOwner())
      .expect(409);

    const { body: photo } = await h
      .api()
      .put(`/api/stores/me/menu/items/${menu.chicken}/photo`)
      .set(asOwner())
      .attach('file', JPEG, 'chicken.jpg')
      .expect(200);
    expect(photo.photoUrl).toMatch(/^\/api\/storefronts\/.+\/images\/.+\.jpg$/);
    const image = await h.api().get(photo.photoUrl).expect(200);
    expect(image.headers['content-type']).toBe('image/jpeg');
    // 사진이 아닌 파일은 받지 않는다.
    await h
      .api()
      .put('/api/stores/me/storefront/logo')
      .set(asOwner())
      .attach('file', Buffer.from('%PDF-1.7'), 'logo.pdf')
      .expect(400);

    const { body: opened } = await h
      .api()
      .put('/api/stores/me/storefront/open')
      .set(asOwner())
      .send({ open: true })
      .expect(200);
    expect(opened).toMatchObject({
      open: true,
      closedReason: null,
      visibleMenuCount: 2,
    });
  });

  it('손님이 근처 가게를 찾고 장바구니 금액을 확인한다', async () => {
    const { body: list } = await h
      .api()
      .get('/api/storefronts')
      .query({ latitude: dropoff.latitude, longitude: dropoff.longitude })
      .expect(200);
    expect(list.total).toBe(1);
    expect(list.items[0]).toMatchObject({
      storeId: owner.storeId,
      category: 'CHICKEN',
      distanceKm: 1.3,
      minOrderAmount: 15000,
      deliveryTipMin: 1500,
      deliveryTipMax: 3500,
      closedReason: null,
      rating: null,
    });
    // 배달 거리 밖이면 보이지 않는다.
    const far = await h
      .api()
      .get('/api/storefronts')
      .query({ latitude: 37.6, longitude: 127.0 })
      .expect(200);
    expect(far.body.total).toBe(0);
    // 메뉴 이름으로 찾는다.
    const search = await h
      .api()
      .get('/api/storefronts')
      .query({
        latitude: dropoff.latitude,
        longitude: dropoff.longitude,
        q: '콜라',
      })
      .expect(200);
    expect(search.body.total).toBe(1);

    const { body: detail } = await h
      .api()
      .get(`/api/storefronts/${owner.storeId}`)
      .query({ latitude: dropoff.latitude, longitude: dropoff.longitude })
      .expect(200);
    expect(detail.delivery).toMatchObject({
      deliverable: true,
      deliveryTip: 3500,
    });
    expect(
      detail.menu[0].items.map((item: { name: string }) => item.name),
    ).toEqual(['후라이드 치킨', '콜라']);

    const { body: quote } = await h
      .api()
      .post(`/api/storefronts/${owner.storeId}/quote`)
      .send({ lines: cart(), dropoff })
      .expect(200);
    expect(quote).toMatchObject({
      menuAmount: MENU_AMOUNT,
      deliveryTip: DELIVERY_TIP,
      paymentAmount: PAYMENT,
      blocker: null,
    });
    const { body: small } = await h
      .api()
      .post(`/api/storefronts/${owner.storeId}/quote`)
      .send({ lines: [{ menuItemId: menu.cola, quantity: 1 }], dropoff })
      .expect(200);
    expect(small).toMatchObject({
      blocker: 'BELOW_MIN_ORDER',
      shortOfMinOrder: 13000,
    });
    const missingOption = await h
      .api()
      .post(`/api/storefronts/${owner.storeId}/quote`)
      .send({ lines: [{ menuItemId: menu.chicken, quantity: 1 }], dropoff })
      .expect(400);
    expect(missingOption.body.code).toBe('INVALID_OPTION_SELECTION');
  });

  it('손님이 배달 주소를 저장한다', async () => {
    const { body: saved } = await h
      .api()
      .post('/api/consumer/addresses')
      .set(asConsumer())
      .send({ label: '집', ...dropoff })
      .expect(201);
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ label: '집', isDefault: true });
    const { body: both } = await h
      .api()
      .post('/api/consumer/addresses')
      .set(asConsumer())
      .send({ label: '회사', ...dropoff, isDefault: true })
      .expect(201);
    expect(both.map((a: { label: string }) => a.label)).toEqual(['회사', '집']);
    expect(
      both.filter((a: { isDefault: boolean }) => a.isDefault),
    ).toHaveLength(1);
    // 사장님은 손님 주소를 쓸 수 없다.
    await h.api().get('/api/consumer/addresses').set(asOwner()).expect(403);
  });

  it('주문 → 결제 → 접수(배달 자동 요청) → 라이더 배달 → 완료 → 정산·리뷰', async () => {
    await h.registerDevice(owner.token, 'owner-device');
    await h.registerDevice(consumerToken, 'consumer-device');

    const { body: placed } = await h
      .api()
      .post('/api/food-orders')
      .set(asConsumer())
      .send({
        storeId: owner.storeId,
        lines: cart(),
        dropoff,
        storeRequest: '덜 맵게',
        riderRequest: '문 앞에 두세요',
      })
      .expect(201);
    expect(placed.order).toMatchObject({
      status: 'PENDING_PAYMENT',
      paymentAmount: PAYMENT,
      settlement: null,
    });
    expect(placed.checkout).toMatchObject({
      provider: 'DEV',
      amount: PAYMENT,
      paymentId: `food-${placed.order.id}`,
    });
    const orderId = placed.order.id as string;

    // 결제 전에는 가게에 보이지 않는다.
    const before = await h
      .api()
      .get('/api/stores/me/food-orders')
      .set(asOwner())
      .expect(200);
    expect(before.body.total).toBe(0);

    const { body: paid } = await h
      .api()
      .post(`/api/food-orders/${orderId}/payment/complete`)
      .set(asConsumer())
      .expect(200);
    expect(paid.status).toBe('PLACED');
    await h.waitForPushTo('owner-device', 'FOOD_ORDER_PLACED');

    const { body: newOrders } = await h
      .api()
      .get('/api/stores/me/food-orders')
      .query({ tab: 'NEW' })
      .set(asOwner())
      .expect(200);
    expect(newOrders.total).toBe(1);
    expect(newOrders.counts).toMatchObject({ NEW: 1, COOKING: 0 });

    const { body: accepted } = await accept(orderId).expect(200);
    expect(accepted).toMatchObject({
      status: 'ACCEPTED',
      cookMinutes: 15,
      delivery: { status: 'REQUESTED' },
      settlement: { commissionRatePercent: 1.5, paymentFeeRatePercent: 3 },
    });
    await h.waitForPushTo('consumer-device', 'FOOD_ORDER_ACCEPTED');
    const deliveryId = accepted.delivery.deliveryId as string;

    // 주문앱 배달은 충전금에서 빠지지 않고, 가게의 배달 화면에서 따로 취소할 수 없다.
    const { body: store } = await h
      .api()
      .get('/api/stores/me')
      .set(asOwner())
      .expect(200);
    expect(store.walletBalance).toBe(0);
    const { body: delivery } = await h
      .api()
      .get(`/api/orders/${deliveryId}`)
      .set(asOwner())
      .expect(200);
    expect(delivery.storeDelivery).toMatchObject({
      source: 'FOOD_ORDER',
      sourceOrderId: orderId,
    });
    expect(delivery.memo).toContain('[따끈');
    const linked = await h
      .api()
      .post(`/api/orders/${deliveryId}/cancel`)
      .set(asOwner())
      .send({ reason: '' })
      .expect(409);
    expect(linked.body.code).toBe('LINKED_TO_FOOD_ORDER');
    // 가게가 받은 뒤에는 손님이 취소할 수 없다.
    const late = await h
      .api()
      .post(`/api/food-orders/${orderId}/cancel`)
      .set(asConsumer())
      .send({})
      .expect(409);
    expect(late.body.code).toBe('FOOD_ORDER_NOT_CANCELLABLE');

    const driver = await h.onlineDriver();
    await h.dispatch(driver.token, deliveryId, 'accept').expect(200);
    const { body: tracking } = await h
      .api()
      .get(`/api/food-orders/${orderId}/tracking`)
      .set(asConsumer())
      .expect(200);
    expect(tracking.status).toBe('ASSIGNED');

    await h.dispatch(driver.token, deliveryId, 'pickup').expect(200);
    expect((await consumerOrder(orderId)).status).toBe('PICKED_UP');
    await h.dispatch(driver.token, deliveryId, 'complete').expect(200);
    const done = await consumerOrder(orderId);
    expect(done).toMatchObject({ status: 'DELIVERED', reviewed: false });
    await h.waitForPushTo('consumer-device', 'FOOD_ORDER_DELIVERED');

    // 정산: 메뉴 + 배달팁 − 중개수수료(1.5%) − 결제수수료(3%) − 배달대행료
    const fare = delivery.fare as number;
    const commission = Math.round(MENU_AMOUNT * 0.015);
    const paymentFee = Math.round(PAYMENT * 0.03);
    const { body: entries } = await h
      .api()
      .get('/api/stores/me/settlements/entries')
      .set(asOwner())
      .expect(200);
    expect(entries.items).toHaveLength(1);
    expect(entries.items[0]).toMatchObject({
      kind: 'SALE',
      foodOrderId: orderId,
      menuAmount: MENU_AMOUNT,
      deliveryTip: DELIVERY_TIP,
      commission,
      paymentFee,
      deliveryFee: fare,
      amount: MENU_AMOUNT + DELIVERY_TIP - commission - paymentFee - fare,
      paid: false,
    });
    const { body: summary } = await h
      .api()
      .get('/api/stores/me/settlements')
      .set(asOwner())
      .expect(200);
    expect(summary).toMatchObject({
      cycle: 'DAILY',
      upcomingTotal: entries.items[0].amount,
      holdReason: null,
    });

    // 리뷰
    const { body: review } = await h
      .api()
      .post(`/api/food-orders/${orderId}/review`)
      .set(asConsumer())
      .send({ rating: 5, content: '바삭해요' })
      .expect(201);
    expect(review).toMatchObject({
      rating: 5,
      orderSummary: '후라이드 치킨 외 1개',
    });
    expect(review.authorName).toContain('*');
    const twice = await h
      .api()
      .post(`/api/food-orders/${orderId}/review`)
      .set(asConsumer())
      .send({ rating: 1 })
      .expect(409);
    expect(twice.body.code).toBe('ALREADY_REVIEWED');
    const { body: reviews } = await h
      .api()
      .get(`/api/storefronts/${owner.storeId}/reviews`)
      .expect(200);
    expect(reviews.total).toBe(1);
    expect((await consumerOrder(orderId)).reviewed).toBe(true);

    // 운영자 부분 환불 (가게 부담) → 가게 정산에서 뺀다.
    const { body: refunded } = await h
      .api()
      .post(`/api/admin/food-orders/${orderId}/refunds`)
      .set(asAdmin())
      .send({ amount: 2000, reason: '콜라 누락', borneBy: 'STORE' })
      .expect(200);
    expect(refunded.refunds).toEqual([
      expect.objectContaining({
        amount: 2000,
        status: 'DONE',
        borneBy: 'STORE',
      }),
    ]);
    expect(refunded.refundableAmount).toBe(PAYMENT - 2000);
    const tooMuch = await h
      .api()
      .post(`/api/admin/food-orders/${orderId}/refunds`)
      .set(asAdmin())
      .send({ amount: PAYMENT, reason: '전액', borneBy: 'PLATFORM' })
      .expect(409);
    expect(tooMuch.body.code).toBe('REFUND_EXCEEDS_PAID');
    const { body: afterRefund } = await h
      .api()
      .get('/api/stores/me/settlements/entries')
      .set(asOwner())
      .expect(200);
    expect(
      afterRefund.items.map((e: { kind: string; amount: number }) => [
        e.kind,
        e.amount,
      ]),
    ).toContainEqual(['REFUND', -2000]);
  });

  it('가게 거절·손님 취소는 결제한 금액을 모두 돌려준다', async () => {
    const rejectedId = await paidOrder();
    const { body: rejected } = await h
      .api()
      .post(`/api/stores/me/food-orders/${rejectedId}/reject`)
      .set(asOwner())
      .send({ reason: '재료 소진' })
      .expect(200);
    expect(rejected).toMatchObject({
      status: 'REJECTED',
      rejectReason: '재료 소진',
      refundableAmount: 0,
    });
    expect(rejected.refunds).toEqual([
      expect.objectContaining({
        amount: PAYMENT,
        status: 'DONE',
        borneBy: null,
      }),
    ]);
    await h.waitForPushTo('consumer-device', 'FOOD_ORDER_REJECTED');

    const cancelledId = await paidOrder();
    const { body: cancelled } = await h
      .api()
      .post(`/api/food-orders/${cancelledId}/cancel`)
      .set(asConsumer())
      .send({ reason: '주소를 잘못 골랐어요' })
      .expect(200);
    expect(cancelled).toMatchObject({
      status: 'CANCELLED',
      cancelledBy: 'CONSUMER',
    });
    expect(cancelled.refunds[0]).toMatchObject({
      amount: PAYMENT,
      status: 'DONE',
    });
    await h.waitForPushTo('owner-device', 'FOOD_ORDER_CANCELLED');

    // 결제 전에 그만둔 주문은 돌려줄 것이 없고 가게에 보이지 않는다.
    const { body: unpaid } = await h
      .api()
      .post('/api/food-orders')
      .set(asConsumer())
      .send({ storeId: owner.storeId, lines: cart(), dropoff })
      .expect(201);
    const { body: dropped } = await h
      .api()
      .post(`/api/food-orders/${unpaid.order.id}/cancel`)
      .set(asConsumer())
      .send({})
      .expect(200);
    expect(dropped.refunds).toEqual([]);
    await h
      .api()
      .get(`/api/stores/me/food-orders/${unpaid.order.id}`)
      .set(asOwner())
      .expect(404);
  });

  it('라이더가 출발한 뒤 가게가 취소하면 배달 취소 수수료를 가게 정산에서 뺀다', async () => {
    const orderId = await paidOrder();
    const { body: accepted } = await accept(orderId).expect(200);
    const deliveryId = accepted.delivery.deliveryId as string;
    const driver = await h.onlineDriver();
    await h.dispatch(driver.token, deliveryId, 'accept').expect(200);
    await h.dispatch(driver.token, deliveryId, 'depart').expect(200);

    const { body: cancelled } = await h
      .api()
      .post(`/api/stores/me/food-orders/${orderId}/cancel`)
      .set(asOwner())
      .send({ reason: '재료 소진' })
      .expect(200);
    expect(cancelled).toMatchObject({
      status: 'CANCELLED',
      cancelledBy: 'STORE',
      delivery: { status: 'CANCELLED' },
    });
    expect(cancelled.refunds[0]).toMatchObject({
      amount: PAYMENT,
      status: 'DONE',
    });
    await h.waitForPushTo('consumer-device', 'FOOD_ORDER_CANCELLED');

    const { body: entries } = await h
      .api()
      .get('/api/stores/me/settlements/entries')
      .set(asOwner())
      .expect(200);
    const fee = entries.items.find(
      (entry: { kind: string; foodOrderId: string }) =>
        entry.kind === 'CANCELLATION_FEE' && entry.foodOrderId === orderId,
    );
    expect(fee.amount).toBeLessThan(0);

    // 픽업한 뒤에는 가게도 취소할 수 없다.
    const pickedId = await paidOrder();
    const { body: picked } = await accept(pickedId).expect(200);
    await h
      .dispatch(driver.token, picked.delivery.deliveryId, 'accept')
      .expect(200);
    await h
      .dispatch(driver.token, picked.delivery.deliveryId, 'pickup')
      .expect(200);
    await h
      .api()
      .post(`/api/stores/me/food-orders/${pickedId}/cancel`)
      .set(asOwner())
      .send({})
      .expect(409);
    await h
      .dispatch(driver.token, picked.delivery.deliveryId, 'complete')
      .expect(200);
  });

  it('운영자: 접수 지연 주문을 찾아 취소하고, 가게를 손님 앱에서 내린다', async () => {
    const lateId = await paidOrder();
    await h.dataSource.query(
      `UPDATE food_orders SET paid_at = now() - interval '10 minutes' WHERE id = $1`,
      [lateId],
    );
    const { body: late } = await h
      .api()
      .get('/api/admin/food-orders')
      .query({ late: true })
      .set(asAdmin())
      .expect(200);
    expect(late).toMatchObject({
      total: 1,
      lateCount: 1,
      acceptLateMinutes: 5,
    });
    expect(late.items[0].id).toBe(lateId);

    const { body: cancelled } = await h
      .api()
      .post(`/api/admin/food-orders/${lateId}/cancel`)
      .set(asAdmin())
      .send({ reason: '가게 연락 안 됨' })
      .expect(200);
    expect(cancelled).toMatchObject({
      status: 'CANCELLED',
      cancelledBy: 'ADMIN',
    });

    const { body: hidden } = await h
      .api()
      .put(`/api/admin/storefronts/${owner.storeId}/visibility`)
      .set(asAdmin())
      .send({ hidden: true, reason: '원산지 표시 확인' })
      .expect(200);
    expect(hidden).toMatchObject({ hidden: true, closedReason: 'HIDDEN' });
    expect(hidden.menu[0].items).toHaveLength(2);
    await h.api().get(`/api/storefronts/${owner.storeId}`).expect(404);
    const blocked = await h
      .api()
      .post('/api/food-orders')
      .set(asConsumer())
      .send({ storeId: owner.storeId, lines: cart(), dropoff })
      .expect(404);
    expect(blocked.body.code).toBe('STOREFRONT_NOT_FOUND');
    await h
      .api()
      .put(`/api/admin/storefronts/${owner.storeId}/visibility`)
      .set(asAdmin())
      .send({ hidden: false })
      .expect(200);
    await h.api().get(`/api/storefronts/${owner.storeId}`).expect(200);

    const { body: members } = await h
      .api()
      .get('/api/admin/users')
      .query({ role: 'CONSUMER' })
      .set(asAdmin())
      .expect(200);
    expect(members.counts.CONSUMER).toBeGreaterThanOrEqual(2);
  });

  it('운영자: 계좌를 확인하고 보류를 풀어 가게 정산을 지급한다', async () => {
    const asOf = '2099-12-31';
    const due = async () =>
      (
        await h
          .api()
          .get('/api/admin/store-settlements')
          .query({ asOf })
          .set(asAdmin())
          .expect(200)
      ).body.items.find(
        (item: { storeId: string }) => item.storeId === owner.storeId,
      );

    expect(await due()).toMatchObject({ account: null, payable: false });
    const noAccount = await h
      .api()
      .post(`/api/admin/store-settlements/${owner.storeId}/pay`)
      .set(asAdmin())
      .send({ asOf })
      .expect(409);
    expect(noAccount.body.code).toBe('SETTLEMENT_ACCOUNT_NOT_VERIFIED');

    const { body: account } = await h
      .api()
      .put('/api/stores/me/settlement-account')
      .set(asOwner())
      .send({
        bankName: '국민은행',
        accountNumber: '123456-01-234567',
        accountHolder: '모보치킨',
      })
      .expect(200);
    expect(account).toMatchObject({
      maskedAccountNumber: '••••4567',
      verified: false,
    });
    await h
      .api()
      .post(`/api/admin/store-settlements/${owner.storeId}/account/verify`)
      .set(asAdmin())
      .expect(200);

    await h
      .api()
      .put(`/api/admin/store-settlements/${owner.storeId}/hold`)
      .set(asAdmin())
      .send({ reason: '서류 확인 중' })
      .expect(204);
    expect(await due()).toMatchObject({
      holdReason: '서류 확인 중',
      payable: false,
    });
    await h
      .api()
      .put(`/api/admin/store-settlements/${owner.storeId}/hold`)
      .set(asAdmin())
      .send({})
      .expect(204);
    const payable = await due();
    expect(payable).toMatchObject({
      payable: true,
      account: { verified: true },
    });

    const { body: payout } = await h
      .api()
      .post(`/api/admin/store-settlements/${owner.storeId}/pay`)
      .set(asAdmin())
      .send({ asOf })
      .expect(201);
    expect(payout).toMatchObject({
      amount: payable.amount,
      entryCount: payable.entryCount,
      maskedAccountNumber: '••••4567',
    });
    expect(await due()).toBeUndefined();
    const again = await h
      .api()
      .post(`/api/admin/store-settlements/${owner.storeId}/pay`)
      .set(asAdmin())
      .send({ asOf })
      .expect(409);
    expect(again.body.code).toBe('NOTHING_TO_PAY');

    const { body: payouts } = await h
      .api()
      .get('/api/stores/me/settlements/payouts')
      .set(asOwner())
      .expect(200);
    expect(payouts.total).toBe(1);
    const { body: entries } = await h
      .api()
      .get('/api/stores/me/settlements/entries')
      .set(asOwner())
      .expect(200);
    expect(entries.items.every((entry: { paid: boolean }) => entry.paid)).toBe(
      true,
    );
  });

  it('PG 웹훅은 서명이 틀리면 거절하고, 개발용 PG는 결제 ID로 결제를 확인한다', async () => {
    const { body: placed } = await h
      .api()
      .post('/api/food-orders')
      .set(asConsumer())
      .send({ storeId: owner.storeId, lines: cart(), dropoff })
      .expect(201);
    const invalid = await h
      .api()
      .post('/api/webhooks/payments')
      .set('Content-Type', 'text/plain')
      .send('not-json')
      .expect(400);
    expect(invalid.body.code).toBe('INVALID_WEBHOOK');
    await h
      .api()
      .post('/api/webhooks/payments')
      .send({ paymentId: placed.checkout.paymentId })
      .expect(200);
    expect((await consumerOrder(placed.order.id)).status).toBe('PLACED');
  });
});

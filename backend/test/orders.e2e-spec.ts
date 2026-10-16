import { ConflictError } from '../src/common/domain/domain-error.js';
import {
  ORDER_REPOSITORY,
  OrderRepository,
} from '../src/modules/order/domain/repositories/order.repository.js';
import {
  createHarness,
  CUSTOMER_HOME,
  DELIVERY,
  Harness,
  NEAR_PICKUP,
  STORE,
  STORE_ADDRESS,
} from './support/harness.js';

describe('배달과 배차 (e2e)', () => {
  let h: Harness;

  beforeAll(async () => {
    h = await createHarness();
  });
  afterAll(() => h.close());

  it('요청 → 배차 → 출발 → 가게 도착 → 픽업 → 배달 완료', async () => {
    const store = await h.readyStore();
    // 위치를 보내지 않은 라이더 — 대기 목록에 모든 콜이 보이고 거리는 없다.
    const driver = await h.onlineDriver(null);

    const order = await h.createDelivery(store.token);
    expect(order).toMatchObject({
      status: 'REQUESTED',
      driverId: null,
      pickup: {
        address: STORE_ADDRESS.address,
        dong: '역삼동',
        contactName: STORE.name,
        contactPhone: '025551234',
      },
      dropoff: { contactName: '손님', contactPhone: '05012345678' },
      estimatedPickupAt: null,
      estimatedDeliveryAt: null,
    });

    // 수락 전 라이더에게는 동 단위 위치만 보여주고 주소·연락처·요청 사항은 감춘다.
    const open = await h
      .api()
      .get('/api/dispatch/open-orders')
      .set(h.bearer(driver.token))
      .expect(200);
    const listed = open.body.items.find(
      (item: { id: string }) => item.id === order.id,
    );
    expect(listed).toMatchObject({
      pickupArea: '강남구 역삼동',
      dropoffArea: '강남구 역삼동',
      // 좌표도 약 1km 단위로 흐려진다.
      pickupLatitude: 37.5,
      pickupLongitude: 127.04,
      fare: order.fare,
      distanceFromMeKm: null,
      storeDelivery: { storeName: STORE.name, doorPayment: 'PREPAID' },
    });
    const visible = JSON.stringify(listed);
    for (const hidden of [
      '테헤란로',
      '역삼로',
      CUSTOMER_HOME.detailAddress,
      '05012345678',
      DELIVERY.memo,
      '127.0364',
    ]) {
      expect(visible).not.toContain(hidden);
    }

    const accepted = await h
      .dispatch(driver.token, order.id, 'accept')
      .expect(200);
    expect(accepted.body).toMatchObject({
      status: 'ASSIGNED',
      driverId: driver.driverId,
      memo: DELIVERY.memo,
      dropoff: {
        address: CUSTOMER_HOME.address,
        detailAddress: CUSTOMER_HOME.detailAddress,
      },
    });
    // 픽업 전에는 완료할 수 없다.
    const early = await h
      .dispatch(driver.token, order.id, 'complete')
      .expect(409);
    expect(early.body.code).toBe('ORDER_NOT_IN_TRANSIT');
    await h.dispatch(driver.token, order.id, 'depart').expect(200);
    const arrived = await h
      .dispatch(driver.token, order.id, 'arrive')
      .expect(200);
    expect(arrived.body.arrivedAt).toEqual(expect.any(String));
    await h.dispatch(driver.token, order.id, 'pickup').expect(200);
    // 픽업 뒤에는 가게가 취소할 수 없다.
    const late = await h
      .api()
      .post(`/api/orders/${order.id}/cancel`)
      .set(h.bearer(store.token))
      .send({ reason: '손님 변심' })
      .expect(409);
    expect(late.body.code).toBe('ORDER_NOT_CANCELLABLE');
    await h.dispatch(driver.token, order.id, 'complete').expect(200);

    const detail = await h
      .api()
      .get(`/api/orders/${order.id}`)
      .set(h.bearer(store.token))
      .expect(200);
    expect(detail.body).toMatchObject({
      status: 'DELIVERED',
      driver: {
        id: driver.driverId,
        name: driver.account.user.name,
        vehicleType: 'MOTORCYCLE',
      },
    });
    expect(detail.body.deliveredAt).toEqual(expect.any(String));

    // 목록에는 배차된 라이더 이름이 붙는다.
    const mine = await h
      .api()
      .get('/api/orders')
      .set(h.bearer(store.token))
      .expect(200);
    expect(mine.body.items).toMatchObject([
      { id: order.id, driverName: driver.account.user.name },
    ]);
  });

  it('여러 라이더가 동시에 수락해도 한 명에게만 배차된다', async () => {
    const store = await h.readyStore();
    const drivers = await Promise.all(
      Array.from({ length: 5 }, () => h.onlineDriver()),
    );
    const order = await h.createDelivery(store.token);

    const responses = await Promise.all(
      drivers.map((driver) => h.dispatch(driver.token, order.id, 'accept')),
    );

    const statuses = responses.map((response) => response.status).sort();
    expect(statuses).toEqual([200, 409, 409, 409, 409]);
    const winner = drivers[responses.findIndex((r) => r.status === 200)];
    const detail = await h
      .api()
      .get(`/api/orders/${order.id}`)
      .set(h.bearer(store.token))
      .expect(200);
    expect(detail.body.driverId).toBe(winner.driverId);
  });

  it('같은 배달을 읽은 두 요청 중 늦게 저장한 쪽은 충돌한다 (낙관적 잠금)', async () => {
    const store = await h.readyStore();
    const [first, second] = await Promise.all([
      h.onlineDriver(),
      h.onlineDriver(),
    ]);
    const { id } = await h.createDelivery(store.token);
    const orders = h.app.get<OrderRepository>(ORDER_REPOSITORY);

    // 둘 다 배차 대기 상태를 읽고 각자 잡는다.
    const [a, b] = await Promise.all([
      orders.findById(id),
      orders.findById(id),
    ]);
    a!.assign(first.driverId, new Date());
    b!.assign(second.driverId, new Date());

    await orders.save(a!);
    await expect(orders.save(b!)).rejects.toThrow(ConflictError);
    expect((await orders.findById(id))!.driverId).toBe(first.driverId);
  });

  it('새 콜 하나를 따로 볼 수 있고, 이미 배차됐으면 알려준다', async () => {
    const store = await h.readyStore();
    const [first, late] = await Promise.all([
      h.onlineDriver(),
      h.onlineDriver(),
    ]);
    const order = await h.createDelivery(store.token, {
      doorPayment: 'CASH',
      foodAmount: 23_000,
    });
    const one = (token: string) =>
      h.api().get(`/api/dispatch/open-orders/${order.id}`).set(h.bearer(token));

    const call = await one(late.token).expect(200);
    expect(call.body).toMatchObject({
      id: order.id,
      pickupArea: '강남구 역삼동',
      storeDelivery: { foodAmount: 23_000, doorPayment: 'CASH' },
    });
    expect(JSON.stringify(call.body)).not.toContain('테헤란로');

    await h.dispatch(first.token, order.id, 'accept').expect(200);
    const taken = await one(late.token).expect(409);
    expect(taken.body.code).toBe('ORDER_NOT_OPEN');
  });

  it('남의 배달은 볼 수도 취소할 수도 없다', async () => {
    const owner = await h.readyStore();
    const stranger = await h.readyStore();
    const order = await h.createDelivery(owner.token);

    for (const path of ['', '/tracking']) {
      await h
        .api()
        .get(`/api/orders/${order.id}${path}`)
        .set(h.bearer(stranger.token))
        .expect(404);
    }
    await h
      .api()
      .post(`/api/orders/${order.id}/cancel`)
      .set(h.bearer(stranger.token))
      .send({})
      .expect(404);

    const cancelled = await h
      .api()
      .post(`/api/orders/${order.id}/cancel`)
      .set(h.bearer(owner.token))
      .send({ reason: '손님 주문 취소' })
      .expect(200);
    expect(cancelled.body).toMatchObject({
      status: 'CANCELLED',
      cancelReason: '손님 주문 취소',
      cancellationFee: 0,
    });
    const mine = await h
      .api()
      .get('/api/orders?status=CANCELLED')
      .set(h.bearer(owner.token))
      .expect(200);
    expect(mine.body).toMatchObject({ total: 1, page: 1, size: 20 });
  });

  it('라이더가 가게로 출발한 뒤 취소하면 대행료의 15%를 빼고 돌려준다', async () => {
    const store = await h.readyStore(20_000);
    const driver = await h.onlineDriver();
    const order = await h.deliveryAt(store.token, driver.token, 'accept');
    await h.dispatch(driver.token, order.id, 'depart').expect(200);

    const before = await h
      .api()
      .get(`/api/orders/${order.id}`)
      .set(h.bearer(store.token))
      .expect(200);
    const fee = Math.round((order.fare * 15) / 100);
    expect(before.body.cancellationFeeNow).toBe(fee);

    const cancelled = await h
      .api()
      .post(`/api/orders/${order.id}/cancel`)
      .set(h.bearer(store.token))
      .send({ reason: '음식을 준비할 수 없어요' })
      .expect(200);
    expect(cancelled.body).toMatchObject({
      status: 'CANCELLED',
      cancellationFee: fee,
    });
    const wallet = await h
      .api()
      .get('/api/stores/me/wallet')
      .set(h.bearer(store.token))
      .expect(200);
    expect(wallet.body.balance).toBe(20_000 - fee);
    expect(wallet.body.items[0]).toMatchObject({
      kind: 'REFUND',
      amount: order.fare - fee,
    });
  });

  it('잘못된 요청은 어떤 항목이 틀렸는지 알려준다', async () => {
    const store = await h.readyStore();

    const invalid = await h
      .requestDelivery(store.token, { unknown: true })
      .expect(400);
    expect(invalid.body.code).toBe('VALIDATION_FAILED');
    expect(invalid.body.message).toEqual(
      expect.arrayContaining(['property unknown should not exist']),
    );
    await h.requestDelivery(store.token, { doorPayment: 'COUPON' }).expect(400);
    await h.requestDelivery(store.token, { readyInMinutes: 181 }).expect(400);
    // 손님 주소가 통째로 빠지거나 모양이 틀려도 서버 오류가 아니라 잘못된 요청이다.
    await h.requestDelivery(store.token, { dropoff: undefined }).expect(400);
    await h.requestDelivery(store.token, { dropoff: 'somewhere' }).expect(400);
    const { phone: _phone, ...noPhone } = CUSTOMER_HOME;
    await h.requestDelivery(store.token, { dropoff: noPhone }).expect(400);

    // DTO는 통과하지만 도메인 규칙을 어긴 경우 (가게에서 10km 넘게 떨어진 손님)
    const tooFar = await h
      .requestDelivery(store.token, {
        dropoff: { ...CUSTOMER_HOME, latitude: 37.75, longitude: 127.1 },
      })
      .expect(400);
    expect(tooFar.body.code).toBe('DELIVERY_TOO_FAR');
  });

  it('구·동을 받지 못한 손님 주소는 수락 전 라이더에게 주소의 앞부분만 보여준다', async () => {
    const store = await h.readyStore();
    const driver = await h.onlineDriver();
    const { sigungu: _s, dong: _d, ...homeWithoutArea } = CUSTOMER_HOME;
    const order = await h.createDelivery(store.token, {
      dropoff: homeWithoutArea,
    });

    const call = await h
      .api()
      .get(`/api/dispatch/open-orders/${order.id}`)
      .set(h.bearer(driver.token))
      .expect(200);

    expect(call.body.dropoffArea).toBe('서울 강남구');
    expect(JSON.stringify(call.body)).not.toContain('역삼로');
  });

  describe('배차 반경', () => {
    it('위치를 보낸 라이더에게는 반경 안의 콜만 가까운 순으로 보이고, 새 콜 알림도 반경 안의 라이더에게만 간다', async () => {
      const store = await h.readyStore();
      const near = await h.onlineDriver();
      // 역삼동 가게에서 약 30km — 배차 반경(5km) 밖이다.
      const far = await h.onlineDriver({ latitude: 37.75, longitude: 127.1 });
      const unknown = await h.onlineDriver(null);
      await h.registerDevice(near.token, 'near-phone');
      await h.registerDevice(far.token, 'far-phone');
      await h.registerDevice(unknown.token, 'unknown-phone');

      const order = await h.createDelivery(store.token);

      const push = await h.waitForPush(order.id, 'ORDER_REQUESTED');
      expect(push.tokens).toEqual(['near-phone']);

      const listOf = async (token: string) =>
        (
          await h
            .api()
            .get('/api/dispatch/open-orders')
            .set(h.bearer(token))
            .expect(200)
        ).body as { items: { id: string }[]; radiusKm: number | null };
      const nearList = await listOf(near.token);
      expect(nearList.radiusKm).toBe(5);
      expect(nearList.items.map((item) => item.id)).toContain(order.id);
      const farList = await listOf(far.token);
      expect(farList.radiusKm).toBe(5);
      expect(farList.items.map((item) => item.id)).not.toContain(order.id);
      // 위치를 모르면 대기 콜을 모두 보여 준다.
      const unknownList = await listOf(unknown.token);
      expect(unknownList.radiusKm).toBeNull();
      expect(unknownList.items.map((item) => item.id)).toContain(order.id);

      // 가까운 순: 라이더 바로 옆 가게의 콜이 역삼동 가게의 콜보다 앞에 온다.
      const nextDoor = await h.readyStore(50_000, {
        address: {
          ...STORE_ADDRESS,
          latitude: 37.5101,
          longitude: 127.0401,
        },
      });
      const closer = await h.createDelivery(nextDoor.token);
      const sorted = (await listOf(near.token)).items.map((item) => item.id);
      expect(sorted.indexOf(closer.id)).toBeLessThan(sorted.indexOf(order.id));
    });

    it('10분 넘게 위치를 보내지 않은 라이더에게는 새 콜 알림이 가지 않는다', async () => {
      const store = await h.readyStore();
      const stale = await h.onlineDriver();
      await h.registerDevice(stale.token, 'stale-phone');
      await h.dataSource.query(
        `UPDATE driver_locations SET updated_at = now() - interval '11 minutes' WHERE driver_id = $1`,
        [stale.driverId],
      );

      const order = await h.createDelivery(store.token);
      const push = await h
        .waitForPush(order.id, 'ORDER_REQUESTED')
        .catch(() => null);
      expect(push?.tokens ?? []).not.toContain('stale-phone');
    });
  });

  describe('위치 · 추적', () => {
    it('라이더 위치로 픽업·도착 예정 시각을 어림하고, 가게가 라이더 위치를 본다', async () => {
      const store = await h.readyStore();
      const driver = await h.onlineDriver();
      const order = await h.createDelivery(store.token);
      const tracking = () =>
        h
          .api()
          .get(`/api/orders/${order.id}/tracking`)
          .set(h.bearer(store.token))
          .expect(200);

      // 위치를 보내고 있으면 대기 콜에 가게까지의 거리가 붙는다.
      const call = await h
        .api()
        .get(`/api/dispatch/open-orders/${order.id}`)
        .set(h.bearer(driver.token))
        .expect(200);
      expect(call.body.distanceFromMeKm).toBeCloseTo(1.2, 1);

      // 배차 전: 라이더도 예정 시각도 없다.
      expect((await tracking()).body).toEqual({
        status: 'REQUESTED',
        driverLocation: null,
        estimatedPickupAt: null,
        estimatedDeliveryAt: null,
      });

      const accepted = await h
        .dispatch(driver.token, order.id, 'accept')
        .expect(200);
      const assignedAt = Date.parse(accepted.body.assignedAt);
      const pickupEta = Date.parse(accepted.body.estimatedPickupAt);
      // 1.2km × 1.3 → 1.5km → 8분 뒤 픽업, 거기서 배달 소요 시간 뒤 도착.
      expect(pickupEta - assignedAt).toBe(8 * 60_000);
      expect(Date.parse(accepted.body.estimatedDeliveryAt) - pickupEta).toBe(
        order.durationMinutes * 60_000,
      );

      const onTheWay = (await tracking()).body;
      expect(onTheWay).toMatchObject({
        status: 'ASSIGNED',
        driverLocation: NEAR_PICKUP,
      });
      expect(onTheWay.driverLocation.updatedAt).toEqual(expect.any(String));
      expect(Date.parse(onTheWay.estimatedDeliveryAt)).toBeGreaterThan(
        Date.parse(onTheWay.estimatedPickupAt),
      );

      // 픽업한 뒤에는 라이더의 지금 위치에서 손님까지 다시 어림한다.
      const pickedUp = await h
        .dispatch(driver.token, order.id, 'pickup')
        .expect(200);
      await h
        .api()
        .put('/api/drivers/me/location')
        .set(h.bearer(driver.token))
        .send({
          latitude: CUSTOMER_HOME.latitude,
          longitude: CUSTOMER_HOME.longitude,
        })
        .expect(204);
      const inTransit = (await tracking()).body;
      expect(inTransit.estimatedPickupAt).toBe(pickedUp.body.pickedUpAt);
      // 손님 집에 다 왔으니 2분(출발·도착 여유) 안에 도착한다.
      expect(
        Date.parse(inTransit.estimatedDeliveryAt) - Date.now(),
      ).toBeLessThanOrEqual(2 * 60_000);

      // 끝난 배달은 라이더 위치를 더 보여주지 않는다.
      await h.dispatch(driver.token, order.id, 'complete').expect(200);
      expect((await tracking()).body).toMatchObject({
        status: 'DELIVERED',
        driverLocation: null,
        estimatedDeliveryAt: null,
      });
    });
  });

  describe('최근 보낸 곳', () => {
    it('지난 배달의 손님 주소를 최근 순으로, 주소별로 한 번씩 준다', async () => {
      const store = await h.readyStore();
      const other = await h.readyStore();
      const seolleung = {
        ...CUSTOMER_HOME,
        address: '서울 강남구 선릉로 433',
        detailAddress: '3층',
      };
      await h.createDelivery(store.token);
      await h.createDelivery(store.token, { dropoff: seolleung });
      await h.createDelivery(store.token);
      await h.createDelivery(other.token, {
        dropoff: { ...CUSTOMER_HOME, address: '서울 강남구 논현로 85' },
      });
      const recent = (query = '') =>
        h
          .api()
          .get(`/api/orders/recent-destinations${query}`)
          .set(h.bearer(store.token));

      const { body } = await recent().expect(200);
      expect(
        body.map((destination: { address: string }) => destination.address),
      ).toEqual([CUSTOMER_HOME.address, seolleung.address]);
      expect(body[0]).toMatchObject({
        sigungu: '강남구',
        detailAddress: CUSTOMER_HOME.detailAddress,
        contactPhone: '05012345678',
        latitude: CUSTOMER_HOME.latitude,
      });
      expect(body[0].lastUsedAt).toEqual(expect.any(String));

      expect((await recent('?limit=1').expect(200)).body).toHaveLength(1);
      await recent('?limit=0').expect(400);
    });
  });
});

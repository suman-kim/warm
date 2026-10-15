import { ConflictError } from '../src/common/domain/domain-error.js';
import { VehicleType } from '../src/common/domain/vehicle-type.js';
import {
  ORDER_REPOSITORY,
  OrderRepository,
} from '../src/modules/order/domain/repositories/order.repository.js';
import {
  createHarness,
  DAMAS_FARE,
  DAMAS_ORDER,
  DROPOFF,
  Harness,
  PICKUP,
} from './support/harness.js';

describe('주문과 배차 (e2e)', () => {
  let h: Harness;

  beforeAll(async () => {
    h = await createHarness();
  });
  afterAll(() => h.close());

  it('주문 → 배차 → 픽업 → 배송 완료', async () => {
    const customer = await h.register('CUSTOMER');
    // 위치를 보내지 않은 기사 — 대기 목록에 내 차종의 주문이 모두 보이고 거리는 없다.
    const driver = await h.onlineDriver('DAMAS', null);

    const order = await h.createOrder(customer.accessToken);
    expect(order).toMatchObject({
      status: 'REQUESTED',
      serviceType: 'QUICK',
      distanceKm: 15.8,
      durationMinutes: 58,
      fare: DAMAS_FARE,
      driverId: null,
      cargo: { category: 'BOX', weightKg: 45, quantity: 3, description: null },
      pickup: { sigungu: '강남구', dong: '역삼동' },
      estimatedPickupAt: null,
      estimatedDeliveryAt: null,
    });

    // 수락 전 기사에게는 동 단위 위치만 보여주고 주소·연락처·요청 사항은 감춘다.
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
      dropoffArea: '마포구 서교동',
      // 좌표도 약 1km 단위로 흐려진다.
      pickupLatitude: 37.5,
      pickupLongitude: 127.04,
      dropoffLatitude: 37.55,
      dropoffLongitude: 126.91,
      cargo: { category: 'BOX', weightKg: 45, quantity: 3 },
      distanceKm: 15.8,
      durationMinutes: 58,
      fare: DAMAS_FARE,
      distanceFromMeKm: null,
    });
    const visible = JSON.stringify(listed);
    for (const hidden of [
      '테헤란로',
      '양화로',
      PICKUP.detailAddress,
      '01011112222',
      PICKUP.contactName,
      DAMAS_ORDER.memo,
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
      memo: DAMAS_ORDER.memo,
      pickup: {
        address: PICKUP.address,
        contactPhone: '01011112222',
        detailAddress: '10층',
      },
    });
    // 픽업 전에는 완료할 수 없다.
    const early = await h
      .dispatch(driver.token, order.id, 'complete')
      .expect(409);
    expect(early.body.code).toBe('ORDER_NOT_IN_TRANSIT');
    await h.dispatch(driver.token, order.id, 'pickup').expect(200);
    // 픽업 뒤에는 고객이 취소할 수 없다.
    await h
      .api()
      .post(`/api/orders/${order.id}/cancel`)
      .set(h.bearer(customer.accessToken))
      .send({ reason: '변심' })
      .expect(409);
    await h.dispatch(driver.token, order.id, 'complete').expect(200);

    const detail = await h
      .api()
      .get(`/api/orders/${order.id}`)
      .set(h.bearer(customer.accessToken))
      .expect(200);
    expect(detail.body).toMatchObject({
      status: 'DELIVERED',
      driver: {
        id: driver.driverId,
        name: driver.account.user.name,
        vehicleType: 'DAMAS',
        rating: null,
        reviewCount: 0,
      },
      review: null,
    });
    expect(detail.body.deliveredAt).toEqual(expect.any(String));

    // 목록에는 배차된 기사 이름이 붙는다.
    const mine = await h
      .api()
      .get('/api/orders?serviceType=QUICK')
      .set(h.bearer(customer.accessToken))
      .expect(200);
    expect(mine.body.items).toMatchObject([
      { id: order.id, driverName: driver.account.user.name },
    ]);
    const freight = await h
      .api()
      .get('/api/orders?serviceType=FREIGHT')
      .set(h.bearer(customer.accessToken))
      .expect(200);
    expect(freight.body.total).toBe(0);
  });

  it('여러 기사가 동시에 수락해도 한 명에게만 배차된다', async () => {
    const customer = await h.register('CUSTOMER');
    const drivers = await Promise.all(
      Array.from({ length: 5 }, () => h.onlineDriver('LABO')),
    );
    const order = await h.createOrder(customer.accessToken, {
      ...DAMAS_ORDER,
      vehicleType: 'LABO',
    });

    const responses = await Promise.all(
      drivers.map((driver) => h.dispatch(driver.token, order.id, 'accept')),
    );

    const statuses = responses.map((response) => response.status).sort();
    expect(statuses).toEqual([200, 409, 409, 409, 409]);
    const winner = drivers[responses.findIndex((r) => r.status === 200)];
    const detail = await h
      .api()
      .get(`/api/orders/${order.id}`)
      .set(h.bearer(customer.accessToken))
      .expect(200);
    expect(detail.body.driverId).toBe(winner.driverId);
  });

  it('같은 주문을 읽은 두 요청 중 늦게 저장한 쪽은 충돌한다 (낙관적 잠금)', async () => {
    const customer = await h.register('CUSTOMER');
    const [first, second] = await Promise.all([
      h.onlineDriver('DAMAS'),
      h.onlineDriver('DAMAS'),
    ]);
    const { id } = await h.createOrder(customer.accessToken);
    const orders = h.app.get<OrderRepository>(ORDER_REPOSITORY);

    // 둘 다 배차 대기 상태를 읽고 각자 잡아 둔다 (결제하기 전 단계).
    const [a, b] = await Promise.all([
      orders.findById(id),
      orders.findById(id),
    ]);
    const vehicleType = VehicleType.DAMAS;
    a!.reserveForPayment({ id: first.driverId, vehicleType });
    b!.reserveForPayment({ id: second.driverId, vehicleType });

    await orders.save(a!);
    await expect(orders.save(b!)).rejects.toThrow(ConflictError);
    expect((await orders.findById(id))!.driverId).toBe(first.driverId);
  });

  it('차종이 다른 기사에게는 주문이 보이지 않고 수락도 안 된다', async () => {
    const customer = await h.register('CUSTOMER');
    const truck = await h.onlineDriver('TRUCK_2_5T');
    const order = await h.createOrder(customer.accessToken);

    const open = await h
      .api()
      .get('/api/dispatch/open-orders')
      .set(h.bearer(truck.token))
      .expect(200);
    expect(open.body.items).toEqual([]);
    await h
      .api()
      .get(`/api/dispatch/open-orders/${order.id}`)
      .set(h.bearer(truck.token))
      .expect(404);
    const accept = await h
      .dispatch(truck.token, order.id, 'accept')
      .expect(409);
    expect(accept.body.code).toBe('VEHICLE_TYPE_MISMATCH');
  });

  it('새 콜 하나를 따로 볼 수 있고, 이미 배차됐으면 알려준다', async () => {
    const customer = await h.register('CUSTOMER');
    const [first, late] = await Promise.all([
      h.onlineDriver('MOTORCYCLE'),
      h.onlineDriver('MOTORCYCLE'),
    ]);
    const order = await h.createOrder(customer.accessToken, {
      ...DAMAS_ORDER,
      vehicleType: 'MOTORCYCLE',
      cargo: { category: 'DOCUMENT', weightKg: 1 },
    });
    const one = (token: string) =>
      h.api().get(`/api/dispatch/open-orders/${order.id}`).set(h.bearer(token));

    const call = await one(late.token).expect(200);
    expect(call.body).toMatchObject({
      id: order.id,
      pickupArea: '강남구 역삼동',
      cargo: { category: 'DOCUMENT' },
    });
    expect(JSON.stringify(call.body)).not.toContain('테헤란로');

    await h.dispatch(first.token, order.id, 'accept').expect(200);
    const taken = await one(late.token).expect(409);
    expect(taken.body.code).toBe('ORDER_NOT_OPEN');
  });

  it('남의 주문은 볼 수도 취소할 수도 없다', async () => {
    const owner = await h.register('CUSTOMER');
    const stranger = await h.register('CUSTOMER');
    const order = await h.createOrder(owner.accessToken);

    for (const path of ['', '/tracking', '/messages']) {
      await h
        .api()
        .get(`/api/orders/${order.id}${path}`)
        .set(h.bearer(stranger.accessToken))
        .expect(404);
    }
    await h
      .api()
      .post(`/api/orders/${order.id}/cancel`)
      .set(h.bearer(stranger.accessToken))
      .send({})
      .expect(404);

    const cancelled = await h
      .api()
      .post(`/api/orders/${order.id}/cancel`)
      .set(h.bearer(owner.accessToken))
      .send({ reason: '일정 변경' })
      .expect(200);
    expect(cancelled.body).toMatchObject({
      status: 'CANCELLED',
      cancelReason: '일정 변경',
    });
    const mine = await h
      .api()
      .get('/api/orders?status=CANCELLED')
      .set(h.bearer(owner.accessToken))
      .expect(200);
    expect(mine.body).toMatchObject({ total: 1, page: 1, size: 20 });
  });

  it('잘못된 요청은 어떤 항목이 틀렸는지 알려준다', async () => {
    const customer = await h.register('CUSTOMER');
    const send = (body: object) =>
      h
        .api()
        .post('/api/orders')
        .set(h.bearer(customer.accessToken))
        .send(body);

    const invalid = await send({
      ...DAMAS_ORDER,
      vehicleType: 'BICYCLE',
      unknown: true,
    }).expect(400);
    expect(invalid.body.code).toBe('VALIDATION_FAILED');
    expect(invalid.body.message).toEqual(
      expect.arrayContaining(['property unknown should not exist']),
    );
    // 5톤 트럭은 더 이상 받지 않는다.
    await send({ ...DAMAS_ORDER, vehicleType: 'TRUCK_11T' }).expect(400);
    // 물품 종류는 꼭 골라야 한다.
    await send({ ...DAMAS_ORDER, cargo: { weightKg: 45 } }).expect(400);
    // 픽업지·화물이 통째로 빠져도 서버 오류가 아니라 잘못된 요청이다.
    await send({ ...DAMAS_ORDER, pickup: undefined }).expect(400);
    await send({ ...DAMAS_ORDER, cargo: null }).expect(400);
    await send({ ...DAMAS_ORDER, dropoff: 'somewhere' }).expect(400);

    // DTO는 통과하지만 도메인 규칙을 어긴 경우 (오토바이 최대 20kg)
    const tooHeavy = await send({
      ...DAMAS_ORDER,
      vehicleType: 'MOTORCYCLE',
    }).expect(400);
    expect(tooHeavy.body.code).toBe('CARGO_TOO_HEAVY');
  });

  it('구·동을 받지 못한 주문은 수락 전 기사에게 주소의 앞부분만 보여준다', async () => {
    const customer = await h.register('CUSTOMER');
    const driver = await h.onlineDriver('TRUCK_1T');
    const { sigungu: _s, dong: _d, ...pickupWithoutArea } = PICKUP;
    const order = await h.createOrder(customer.accessToken, {
      ...DAMAS_ORDER,
      vehicleType: 'TRUCK_1T',
      pickup: pickupWithoutArea,
    });

    const call = await h
      .api()
      .get(`/api/dispatch/open-orders/${order.id}`)
      .set(h.bearer(driver.token))
      .expect(200);

    expect(call.body.pickupArea).toBe('서울 강남구');
    expect(JSON.stringify(call.body)).not.toContain('테헤란로');
  });

  describe('요금 견적과 차종', () => {
    it('차종별 요금과 거리·시간·경로를 한 번에 준다', async () => {
      const customer = await h.register('CUSTOMER');
      const estimate = (body: object) =>
        h
          .api()
          .post('/api/orders/estimates')
          .set(h.bearer(customer.accessToken))
          .send(body);
      const points = {
        pickup: { latitude: PICKUP.latitude, longitude: PICKUP.longitude },
        dropoff: { latitude: DROPOFF.latitude, longitude: DROPOFF.longitude },
      };

      const all = await estimate(points).expect(200);
      expect(all.body).toMatchObject({
        distanceKm: 15.8,
        durationMinutes: 58,
        route: [points.pickup, points.dropoff],
      });
      expect(
        all.body.options.map((o: { vehicleType: string }) => o.vehicleType),
      ).toEqual([
        'MOTORCYCLE',
        'DAMAS',
        'LABO',
        'TRUCK_1T',
        'TRUCK_2_5T',
        'TRUCK_5T',
      ]);
      // 견적과 실제 주문의 요금이 같다.
      expect(all.body.options[1]).toMatchObject({
        vehicleType: 'DAMAS',
        label: '다마스',
        capacityHint: '박스 10개',
        maxLoadKg: 400,
        fare: DAMAS_FARE,
      });

      const quick = await estimate({ ...points, serviceType: 'QUICK' }).expect(
        200,
      );
      expect(quick.body.options).toHaveLength(3);
      await estimate({ pickup: points.pickup }).expect(400);
    });

    it('차종 안내는 로그인 없이 볼 수 있다', async () => {
      const { body } = await h.api().get('/api/vehicle-types').expect(200);

      expect(body).toHaveLength(6);
      expect(body[0]).toEqual({
        type: 'MOTORCYCLE',
        label: '오토바이',
        serviceType: 'QUICK',
        capacityHint: '서류 · 소형 박스',
        maxLoadKg: 20,
      });
      expect(body[5]).toEqual({
        type: 'TRUCK_5T',
        label: '5톤 트럭',
        serviceType: 'FREIGHT',
        capacityHint: '대형 이사 · 대량 화물',
        maxLoadKg: 5000,
      });
    });
  });

  describe('배차 반경', () => {
    it('위치를 보낸 기사에게는 반경 안의 주문만 가까운 순으로 보이고, 새 주문 알림도 반경 안의 기사에게만 간다', async () => {
      const customer = await h.register('CUSTOMER');
      const near = await h.onlineDriver('DAMAS');
      // 역삼동 출발지에서 약 30km — 다마스 반경(10km) 밖이다.
      const far = await h.onlineDriver('DAMAS', {
        latitude: 37.75,
        longitude: 127.1,
      });
      const unknown = await h.onlineDriver('DAMAS', null);
      await h.registerDevice(near.token, 'near-phone');
      await h.registerDevice(far.token, 'far-phone');
      await h.registerDevice(unknown.token, 'unknown-phone');

      const order = await h.createOrder(customer.accessToken);

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
      expect(nearList.radiusKm).toBe(10);
      expect(nearList.items.map((item) => item.id)).toContain(order.id);
      const farList = await listOf(far.token);
      expect(farList.radiusKm).toBe(10);
      expect(farList.items.map((item) => item.id)).not.toContain(order.id);
      // 위치를 모르면 내 차종의 대기 주문을 모두 보여 준다.
      const unknownList = await listOf(unknown.token);
      expect(unknownList.radiusKm).toBeNull();
      expect(unknownList.items.map((item) => item.id)).toContain(order.id);

      // 가까운 순: 기사 바로 옆에서 낸 주문이 역삼동 주문보다 앞에 온다.
      const closer = await h.createOrder(customer.accessToken, {
        ...DAMAS_ORDER,
        pickup: { ...PICKUP, latitude: 37.5101, longitude: 127.0401 },
      });
      const sorted = (await listOf(near.token)).items.map((item) => item.id);
      expect(sorted.indexOf(closer.id)).toBeLessThan(sorted.indexOf(order.id));
    });

    it('10분 넘게 위치를 보내지 않은 기사에게는 새 주문 알림이 가지 않는다', async () => {
      const customer = await h.register('CUSTOMER');
      const stale = await h.onlineDriver('DAMAS');
      await h.registerDevice(stale.token, 'stale-phone');
      await h.dataSource.query(
        `UPDATE driver_locations SET updated_at = now() - interval '11 minutes' WHERE driver_id = $1`,
        [stale.driverId],
      );

      const order = await h.createOrder(customer.accessToken);
      const push = await h
        .waitForPush(order.id, 'ORDER_REQUESTED')
        .catch(() => null);
      expect(push?.tokens ?? []).not.toContain('stale-phone');
    });
  });

  describe('위치 · 추적 · 길안내', () => {
    const NEAR_PICKUP = { latitude: 37.51, longitude: 127.04 };

    it('기사 위치로 픽업·도착 예정 시각을 어림하고, 고객이 기사 위치를 본다', async () => {
      const customer = await h.register('CUSTOMER');
      const driver = await h.onlineDriver('DAMAS');
      await h
        .api()
        .put('/api/drivers/me/location')
        .set(h.bearer(driver.token))
        .send(NEAR_PICKUP)
        .expect(204);
      const order = await h.createOrder(customer.accessToken);
      const tracking = () =>
        h
          .api()
          .get(`/api/orders/${order.id}/tracking`)
          .set(h.bearer(customer.accessToken))
          .expect(200);

      // 위치를 보내고 있으면 대기 콜에 픽업지까지의 거리가 붙는다.
      const call = await h
        .api()
        .get(`/api/dispatch/open-orders/${order.id}`)
        .set(h.bearer(driver.token))
        .expect(200);
      expect(call.body.distanceFromMeKm).toBeCloseTo(1.2, 1);

      // 배차 전: 기사도 예정 시각도 없다.
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
      // 1.2km × 1.3 → 1.5km → 8분 뒤 픽업, 거기서 58분 뒤 도착.
      expect(pickupEta - assignedAt).toBe(8 * 60_000);
      expect(Date.parse(accepted.body.estimatedDeliveryAt) - pickupEta).toBe(
        58 * 60_000,
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

      // 픽업한 뒤에는 기사의 지금 위치에서 도착지까지 다시 어림한다.
      const pickedUp = await h
        .dispatch(driver.token, order.id, 'pickup')
        .expect(200);
      await h
        .api()
        .put('/api/drivers/me/location')
        .set(h.bearer(driver.token))
        .send({ latitude: DROPOFF.latitude, longitude: DROPOFF.longitude })
        .expect(204);
      const inTransit = (await tracking()).body;
      expect(inTransit.estimatedPickupAt).toBe(pickedUp.body.pickedUpAt);
      // 도착지에 다 왔으니 2분(출발·도착 여유) 안에 도착한다.
      expect(
        Date.parse(inTransit.estimatedDeliveryAt) - Date.now(),
      ).toBeLessThanOrEqual(2 * 60_000);

      // 끝난 주문은 기사 위치를 더 보여주지 않는다.
      await h.dispatch(driver.token, order.id, 'complete').expect(200);
      expect((await tracking()).body).toMatchObject({
        status: 'DELIVERED',
        driverLocation: null,
        estimatedDeliveryAt: null,
      });
    });

    it('길안내는 픽업 전에는 픽업지, 픽업한 뒤에는 도착지를 향한다', async () => {
      const customer = await h.register('CUSTOMER');
      const driver = await h.onlineDriver('DAMAS', null);
      const other = await h.onlineDriver('DAMAS');
      const order = await h.orderAt(
        customer.accessToken,
        driver.token,
        'accept',
      );
      const navigation = (token: string, query = '') =>
        h
          .api()
          .get(`/api/dispatch/orders/${order.id}/navigation${query}`)
          .set(h.bearer(token));

      // 위치를 보낸 적도, 함께 보내지도 않으면 길을 알 수 없다.
      const unknown = await navigation(driver.token).expect(409);
      expect(unknown.body.code).toBe('LOCATION_REQUIRED');
      await navigation(driver.token, '?latitude=37.51').expect(400);
      // 배차받지 않은 기사와 고객은 볼 수 없다.
      await navigation(other.token, '?latitude=37.51&longitude=127.04').expect(
        404,
      );
      await navigation(customer.accessToken).expect(403);

      const toPickup = await navigation(
        driver.token,
        '?latitude=37.51&longitude=127.04',
      ).expect(200);
      expect(toPickup.body).toMatchObject({
        target: 'PICKUP',
        address: PICKUP.address,
        latitude: PICKUP.latitude,
        longitude: PICKUP.longitude,
        distanceKm: 1.5,
        durationMinutes: 8,
        route: [NEAR_PICKUP, { latitude: 37.5, longitude: 127.0364 }],
      });

      // 위치를 보내 두면 쿼리 없이도 된다.
      await h.dispatch(driver.token, order.id, 'pickup').expect(200);
      await h
        .api()
        .put('/api/drivers/me/location')
        .set(h.bearer(driver.token))
        .send({ latitude: PICKUP.latitude, longitude: PICKUP.longitude })
        .expect(204);
      const toDropoff = await navigation(driver.token).expect(200);
      expect(toDropoff.body).toMatchObject({
        target: 'DROPOFF',
        address: DROPOFF.address,
        distanceKm: 15.8,
        durationMinutes: 58,
      });

      await h.dispatch(driver.token, order.id, 'complete').expect(200);
      const done = await navigation(driver.token).expect(409);
      expect(done.body.code).toBe('ORDER_NOT_IN_PROGRESS');
    });
  });

  describe('기사 평가', () => {
    it('배송이 끝난 주문에 한 번 남기고, 기사의 평점에 반영된다', async () => {
      const customer = await h.register('CUSTOMER');
      const another = await h.register('CUSTOMER');
      const driver = await h.onlineDriver('DAMAS');
      const review = (token: string, orderId: string, body: object) =>
        h
          .api()
          .post(`/api/orders/${orderId}/review`)
          .set(h.bearer(token))
          .send(body);

      const first = await h.orderAt(
        customer.accessToken,
        driver.token,
        'pickup',
      );
      const early = await review(customer.accessToken, first.id, {
        rating: 5,
      }).expect(409);
      expect(early.body.code).toBe('ORDER_NOT_DELIVERED');
      await h.dispatch(driver.token, first.id, 'complete').expect(200);

      await review(customer.accessToken, first.id, { rating: 6 }).expect(400);
      await review(customer.accessToken, first.id, {
        rating: 5,
        tags: ['SLOW'],
      }).expect(400);
      // 남의 주문은 평가할 수 없다.
      await review(another.accessToken, first.id, { rating: 1 }).expect(404);

      const written = await review(customer.accessToken, first.id, {
        rating: 5,
        tags: ['KIND', 'FAST'],
        comment: ' 조심히 옮겨 주셨어요 ',
      }).expect(201);
      expect(written.body).toMatchObject({
        rating: 5,
        tags: ['KIND', 'FAST'],
        comment: '조심히 옮겨 주셨어요',
      });
      const again = await review(customer.accessToken, first.id, {
        rating: 1,
      }).expect(409);
      expect(again.body.code).toBe('REVIEW_ALREADY_WRITTEN');

      // 다른 고객이 4점을 주면 평균 4.5점.
      const second = await h.orderAt(
        another.accessToken,
        driver.token,
        'complete',
      );
      await review(another.accessToken, second.id, { rating: 4 }).expect(201);

      const detail = await h
        .api()
        .get(`/api/orders/${first.id}`)
        .set(h.bearer(customer.accessToken))
        .expect(200);
      expect(detail.body.review).toMatchObject({ rating: 5 });
      expect(detail.body.driver).toMatchObject({ rating: 4.5, reviewCount: 2 });
    });
  });

  describe('주문 메시지', () => {
    it('고객과 배차된 기사가 배송 중에 주고받는다', async () => {
      const customer = await h.register('CUSTOMER');
      const driver = await h.onlineDriver('DAMAS');
      const outsider = await h.onlineDriver('DAMAS');
      await h.registerDevice(customer.accessToken, 'chat-customer-phone');
      await h.registerDevice(driver.token, 'chat-driver-phone');
      const order = await h.createOrder(customer.accessToken);
      const send = (token: string, text: string) =>
        h
          .api()
          .post(`/api/orders/${order.id}/messages`)
          .set(h.bearer(token))
          .send({ text });
      const list = (token: string, query = '') =>
        h
          .api()
          .get(`/api/orders/${order.id}/messages${query}`)
          .set(h.bearer(token));

      // 배차 전에는 받을 사람이 없다.
      const tooEarly = await send(customer.accessToken, '안녕하세요').expect(
        409,
      );
      expect(tooEarly.body.code).toBe('ORDER_NOT_IN_PROGRESS');
      await h.dispatch(driver.token, order.id, 'accept').expect(200);

      const fromCustomer = await send(
        customer.accessToken,
        ' 1층 로비에서 기다릴게요 ',
      ).expect(201);
      expect(fromCustomer.body).toMatchObject({
        mine: true,
        text: '1층 로비에서 기다릴게요',
      });
      const toDriver = await h.waitForPushTo(
        'chat-driver-phone',
        'ORDER_MESSAGE',
      );
      expect(toDriver.message).toMatchObject({
        title: '고객님',
        body: '1층 로비에서 기다릴게요',
        data: { orderId: order.id },
      });
      expect(toDriver.tokens).toEqual(['chat-driver-phone']);

      await send(driver.token, '5분 뒤 도착해요').expect(201);
      const toCustomer = await h.waitForPushTo(
        'chat-customer-phone',
        'ORDER_MESSAGE',
      );
      expect(toCustomer.message.title).toBe(
        `${driver.account.user.name} 기사님`,
      );

      // 같은 대화가 보는 사람에 따라 mine만 다르게 온다.
      const seenByDriver = await list(driver.token).expect(200);
      expect(
        seenByDriver.body.map((m: { mine: boolean; text: string }) => [
          m.mine,
          m.text,
        ]),
      ).toEqual([
        [false, '1층 로비에서 기다릴게요'],
        [true, '5분 뒤 도착해요'],
      ]);
      // after를 주면 그 뒤에 온 것만 준다.
      const newer = await list(
        customer.accessToken,
        `?after=${encodeURIComponent(seenByDriver.body[0].createdAt)}`,
      ).expect(200);
      expect(newer.body).toMatchObject([
        { mine: false, text: '5분 뒤 도착해요' },
      ]);

      // 배차받지 않은 기사는 읽지도 보내지도 못한다.
      await list(outsider.token).expect(404);
      await send(outsider.token, '저요').expect(404);
      await send(customer.accessToken, '   ').expect(400);

      // 배송이 끝나면 읽을 수만 있다.
      await h.dispatch(driver.token, order.id, 'pickup').expect(200);
      await h.dispatch(driver.token, order.id, 'complete').expect(200);
      await send(driver.token, '감사합니다').expect(409);
      expect((await list(customer.accessToken).expect(200)).body).toHaveLength(
        2,
      );
    });
  });

  describe('최근 보낸 곳', () => {
    it('지난 주문의 도착지를 최근 순으로, 주소별로 한 번씩 준다', async () => {
      const customer = await h.register('CUSTOMER');
      const other = await h.register('CUSTOMER');
      const seongsu = {
        ...DROPOFF,
        address: '서울 성동구 성수이로 113',
        sigungu: '성동구',
        dong: '성수동2가',
      };
      await h.createOrder(customer.accessToken);
      await h.createOrder(customer.accessToken, {
        ...DAMAS_ORDER,
        dropoff: seongsu,
      });
      await h.createOrder(customer.accessToken);
      await h.createOrder(other.accessToken, {
        ...DAMAS_ORDER,
        dropoff: { ...DROPOFF, address: '부산 해운대구 센텀로 1' },
      });
      const recent = (query = '') =>
        h
          .api()
          .get(`/api/orders/recent-destinations${query}`)
          .set(h.bearer(customer.accessToken));

      const { body } = await recent().expect(200);
      expect(
        body.map((destination: { address: string }) => destination.address),
      ).toEqual([DROPOFF.address, seongsu.address]);
      expect(body[0]).toMatchObject({
        sigungu: '마포구',
        contactName: DROPOFF.contactName,
        contactPhone: '023334444',
        latitude: DROPOFF.latitude,
      });
      expect(body[0].lastUsedAt).toEqual(expect.any(String));

      expect((await recent('?limit=1').expect(200)).body).toHaveLength(1);
      await recent('?limit=0').expect(400);
    });
  });
});

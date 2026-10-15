import {
  createHarness,
  DAMAS_FARE,
  DAMAS_ORDER,
  Harness,
  PICKUP,
} from './support/harness.js';

describe('알림 (e2e)', () => {
  let h: Harness;

  beforeAll(async () => {
    h = await createHarness();
  });
  afterAll(() => h.close());

  const deviceOwners = (token: string) =>
    h.dataSource.query<{ user_id: string }[]>(
      'SELECT user_id FROM push_devices WHERE token = $1',
      [token],
    );

  describe('푸시', () => {
    it('새 주문은 그 차종의 운행 중인 기사에게, 진행 상황은 고객에게 알린다', async () => {
      const customer = await h.register('CUSTOMER');
      const damas = await h.onlineDriver('DAMAS');
      const resting = await h.onlineDriver('DAMAS');
      const labo = await h.onlineDriver('LABO');
      await h.setAvailability(resting.token, false).expect(200);
      await h.registerDevice(customer.accessToken, 'customer-phone');
      await h.registerDevice(damas.token, 'damas-phone');
      await h.registerDevice(resting.token, 'resting-damas-phone');
      await h.registerDevice(labo.token, 'labo-phone');

      const order = await h.createOrder(customer.accessToken);

      const requested = await h.waitForPush(order.id, 'ORDER_REQUESTED');
      expect(requested.tokens).toEqual(['damas-phone']);
      expect(requested.message).toMatchObject({
        title: '새 주문이 들어왔어요',
        body: '강남구 역삼동 → 마포구 서교동 · 33,200원',
      });
      // 수락 전 기사에게 가는 알림에는 주소와 연락처가 없다.
      const sent = JSON.stringify(requested.message);
      for (const hidden of ['테헤란로', PICKUP.detailAddress, '01011112222']) {
        expect(sent).not.toContain(hidden);
      }

      for (const [action, type] of [
        ['accept', 'ORDER_ASSIGNED'],
        ['pickup', 'ORDER_PICKED_UP'],
        ['complete', 'ORDER_DELIVERED'],
      ]) {
        await h.dispatch(damas.token, order.id, action).expect(200);
        const push = await h.waitForPush(order.id, type);
        expect(push.tokens).toEqual(['customer-phone']);
      }
    });

    it('배차된 주문을 고객이 취소하면 그 기사에게 알린다', async () => {
      const customer = await h.register('CUSTOMER');
      const driver = await h.onlineDriver('TRUCK_1T');
      await h.registerDevice(driver.token, 'truck-phone');
      const order = await h.orderAt(
        customer.accessToken,
        driver.token,
        'accept',
        { ...DAMAS_ORDER, vehicleType: 'TRUCK_1T' },
      );

      await h
        .api()
        .post(`/api/orders/${order.id}/cancel`)
        .set(h.bearer(customer.accessToken))
        .send({ reason: '일정 변경' })
        .expect(200);

      const cancelled = await h.waitForPush(order.id, 'ORDER_CANCELLED');
      expect(cancelled.tokens).toEqual(['truck-phone']);
    });

    it('한 휴대폰에서 계정을 바꾸면 알림이 새 계정으로 간다', async () => {
      const before = await h.register('CUSTOMER');
      const after = await h.register('CUSTOMER');

      await h.registerDevice(before.accessToken, 'shared-phone');
      await h.registerDevice(before.accessToken, 'shared-phone');
      expect(await deviceOwners('shared-phone')).toEqual([
        { user_id: before.user.id },
      ]);

      await h.registerDevice(after.accessToken, 'shared-phone');
      expect(await deviceOwners('shared-phone')).toEqual([
        { user_id: after.user.id },
      ]);

      // 남의 기기는 해제할 수 없다.
      await h
        .api()
        .delete('/api/push-devices/shared-phone')
        .set(h.bearer(before.accessToken))
        .expect(204);
      expect(await deviceOwners('shared-phone')).toHaveLength(1);
      await h
        .api()
        .delete('/api/push-devices/shared-phone')
        .set(h.bearer(after.accessToken))
        .expect(204);
      expect(await deviceOwners('shared-phone')).toEqual([]);
    });

    it('앱을 지운 기기의 토큰은 발송 뒤에 정리한다', async () => {
      const customer = await h.register('CUSTOMER');
      const driver = await h.onlineDriver('TRUCK_2_5T');
      await h.registerDevice(customer.accessToken, 'uninstalled-phone');
      await h.registerDevice(customer.accessToken, 'current-phone');
      h.deadTokens.add('uninstalled-phone');

      const order = await h.orderAt(
        customer.accessToken,
        driver.token,
        'accept',
        { ...DAMAS_ORDER, vehicleType: 'TRUCK_2_5T' },
      );

      // 배차 때 처음 나가는 알림(결제 완료)은 두 기기로 가고, 그 뒤 지운 앱의 토큰이 정리된다.
      const paid = await h.waitForPush(order.id, 'PAYMENT_PAID');
      expect([...paid.tokens].sort()).toEqual([
        'current-phone',
        'uninstalled-phone',
      ]);
      await vi.waitFor(async () => {
        expect(await deviceOwners('uninstalled-phone')).toEqual([]);
      });
      expect(await deviceOwners('current-phone')).toHaveLength(1);
    });

    it('기기 등록은 로그인이 필요하고 기기 종류를 확인한다', async () => {
      const customer = await h.register('CUSTOMER');
      const put = (body: object) => h.api().put('/api/push-devices').send(body);

      await put({ token: 'anonymous-phone', platform: 'IOS' }).expect(401);
      await put({ token: 'web-browser', platform: 'WEB' })
        .set(h.bearer(customer.accessToken))
        .expect(400);
      await put({ token: 'iphone', platform: 'IOS' })
        .set(h.bearer(customer.accessToken))
        .expect(204);
    });
  });

  describe('알림함', () => {
    const inbox = (token: string, query = '') =>
      h.api().get(`/api/notifications${query}`).set(h.bearer(token));
    const unread = async (token: string) =>
      (
        await h
          .api()
          .get('/api/notifications/unread-count')
          .set(h.bearer(token))
          .expect(200)
      ).body.unreadCount as number;

    it('배송 진행 알림이 쌓이고, 읽음으로 표시한다', async () => {
      const customer = await h.register('CUSTOMER');
      const stranger = await h.register('CUSTOMER');
      const driver = await h.onlineDriver('DAMAS');
      await h.registerDevice(driver.token, 'inbox-driver-phone');

      expect((await inbox(customer.accessToken).expect(200)).body).toEqual({
        items: [],
        total: 0,
        page: 1,
        size: 20,
        unreadCount: 0,
      });

      const order = await h.orderAt(
        customer.accessToken,
        driver.token,
        'complete',
      );
      // 등록한 기기가 없어 푸시는 못 받았어도 알림함에는 남는다.
      await vi.waitFor(async () => {
        expect(await unread(customer.accessToken)).toBe(4);
      });

      const { body } = await inbox(customer.accessToken).expect(200);
      expect(body).toMatchObject({ total: 4, unreadCount: 4 });
      // 최근 것부터 온다. 배차 때의 결제 완료와 배차 알림은 거의 같은 때라 순서를 따지지 않는다.
      const types = body.items.map((item: { type: string }) => item.type);
      expect(types.slice(0, 2)).toEqual(['ORDER_DELIVERED', 'ORDER_PICKED_UP']);
      expect(types.slice(2).sort()).toEqual(['ORDER_ASSIGNED', 'PAYMENT_PAID']);
      expect(
        body.items.find(
          (item: { type: string }) => item.type === 'PAYMENT_PAID',
        ),
      ).toMatchObject({
        title: `${DAMAS_FARE.toLocaleString('ko-KR')}원을 결제했어요`,
        body: '역삼동 → 서교동 · 신한카드 ••4821',
      });
      expect(body.items[0]).toMatchObject({
        title: '배송이 완료됐어요',
        data: { orderId: order.id },
        readAt: null,
      });
      const paged = await inbox(customer.accessToken, '?page=2&size=2').expect(
        200,
      );
      expect(paged.body.items).toHaveLength(2);
      expect(paged.body.unreadCount).toBe(4);

      // 금방 낡는 새 콜 알림은 기사의 알림함에 쌓지 않는다 (가입 승인 알림만 있다).
      await h.waitForPush(order.id, 'ORDER_REQUESTED');
      const driverInbox = await inbox(driver.token).expect(200);
      expect(
        driverInbox.body.items.map((item: { type: string }) => item.type),
      ).toEqual(['DRIVER_APPROVED']);

      // 남의 알림은 읽음으로 바꿀 수 없다.
      const first = body.items[0].id as string;
      await h
        .api()
        .post(`/api/notifications/${first}/read`)
        .set(h.bearer(stranger.accessToken))
        .expect(204);
      expect(await unread(customer.accessToken)).toBe(4);

      await h
        .api()
        .post(`/api/notifications/${first}/read`)
        .set(h.bearer(customer.accessToken))
        .expect(204);
      expect(await unread(customer.accessToken)).toBe(3);
      const afterRead = await inbox(customer.accessToken).expect(200);
      expect(afterRead.body.items[0].readAt).toEqual(expect.any(String));
      expect(afterRead.body.items[1].readAt).toBeNull();

      await h
        .api()
        .post('/api/notifications/read-all')
        .set(h.bearer(customer.accessToken))
        .expect(204);
      expect(await unread(customer.accessToken)).toBe(0);
      await h.api().get('/api/notifications').expect(401);
    });

    it('푸시를 꺼도 알림함에는 쌓인다', async () => {
      const customer = await h.register('CUSTOMER');
      const driver = await h.onlineDriver('LABO');
      await h.registerDevice(customer.accessToken, 'muted-phone');
      const settings = () =>
        h
          .api()
          .get('/api/notifications/settings')
          .set(h.bearer(customer.accessToken));
      const update = (body: object) =>
        h
          .api()
          .patch('/api/notifications/settings')
          .set(h.bearer(customer.accessToken))
          .send(body);

      // 설정한 적이 없으면 받는 것으로 본다.
      expect((await settings().expect(200)).body).toEqual({
        pushEnabled: true,
      });
      expect((await update({ pushEnabled: false }).expect(200)).body).toEqual({
        pushEnabled: false,
      });
      expect((await settings().expect(200)).body.pushEnabled).toBe(false);
      await update({}).expect(400);

      const order = await h.orderAt(
        customer.accessToken,
        driver.token,
        'accept',
        { ...DAMAS_ORDER, vehicleType: 'LABO' },
      );
      // 배차 알림과 결제 완료 알림이 알림함에만 쌓인다.
      await vi.waitFor(async () => {
        expect(await unread(customer.accessToken)).toBe(2);
      });
      expect(h.pushesOf('ORDER_ASSIGNED', order.id)).toEqual([]);
      expect(h.pushesOf('PAYMENT_PAID', order.id)).toEqual([]);

      // 다시 켜면 다음 알림부터 푸시로 온다.
      await update({ pushEnabled: true }).expect(200);
      await h.dispatch(driver.token, order.id, 'pickup').expect(200);
      const push = await h.waitForPush(order.id, 'ORDER_PICKED_UP');
      expect(push.tokens).toEqual(['muted-phone']);
    });
  });
});

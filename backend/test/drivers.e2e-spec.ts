import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import {
  addDays,
  kstDateString,
  kstStartOfDay,
} from '../src/common/domain/kst.js';
import { SettlementPolicy } from '../src/modules/order/domain/services/settlement-policy.js';
import {
  createHarness,
  DOCUMENT_TYPES,
  Harness,
  PDF,
} from './support/harness.js';

/** 테스트 서버의 정산 정책 (vitest.config.e2e.ts): 수수료 10%, 화요일 지급. */
const SETTLEMENT_POLICY = new SettlementPolicy(10, 2);

describe('라이더 (e2e)', () => {
  let h: Harness;

  beforeAll(async () => {
    h = await createHarness();
  });
  afterAll(() => h.close());

  const VEHICLE = { vehicleNumber: '경기 수원 가 1234' };

  describe('서류와 등록 심사', () => {
    it('서류를 모두 올려야 신청할 수 있고, 반려된 서류만 다시 올리면 된다', async () => {
      const account = await h.register('DRIVER');
      const token = account.accessToken;
      await h.registerDevice(token, 'applicant-phone');
      const apply = () =>
        h.api().post('/api/drivers').set(h.bearer(token)).send(VEHICLE);
      const documents = async () =>
        (
          await h
            .api()
            .get('/api/drivers/me/documents')
            .set(h.bearer(token))
            .expect(200)
        ).body as { type: string; status: string }[];
      const statuses = async () =>
        Object.fromEntries(
          (await documents()).map(({ type, status }) => [type, status]),
        );

      // 아직 아무것도 안 올렸어도 필요한 서류 전부가 순서대로 온다.
      expect(await documents()).toEqual(
        DOCUMENT_TYPES.map((type) => ({
          type,
          status: 'NOT_SUBMITTED',
          rejectionReason: null,
          uploadedAt: null,
        })),
      );
      const withoutDocuments = await apply().expect(409);
      expect(withoutDocuments.body.code).toBe('DOCUMENTS_REQUIRED');
      await h.api().get('/api/drivers/me').set(h.bearer(token)).expect(404);

      // 사진과 PDF만 받는다. 형식은 파일 내용으로 판단한다 — 이름이나 헤더로 속일 수 없다.
      const disguised = await h
        .api()
        .put('/api/drivers/me/documents/DRIVER_LICENSE')
        .set(h.bearer(token))
        .attach('file', Buffer.from('<html>not an image</html>'), {
          filename: 'license.jpg',
          contentType: 'image/jpeg',
        })
        .expect(400);
      expect(disguised.body.code).toBe('UNSUPPORTED_DOCUMENT_TYPE');
      await h
        .api()
        .put('/api/drivers/me/documents/DRIVER_LICENSE')
        .set(h.bearer(token))
        .expect(400);
      await h.uploadDocument(token, 'PASSPORT').expect(400);

      await h.uploadDocument(token, 'DRIVER_LICENSE').expect(200);
      await h.uploadDocument(token, 'VEHICLE_REGISTRATION', PDF).expect(200);
      expect((await apply().expect(409)).body.code).toBe('DOCUMENTS_REQUIRED');
      const uploaded = await h
        .uploadDocument(token, 'DELIVERY_INSURANCE')
        .expect(200);
      expect(uploaded.body.map((d: { status: string }) => d.status)).toEqual([
        'SUBMITTED',
        'SUBMITTED',
        'SUBMITTED',
      ]);

      // 올린 파일을 그대로 돌려받는다.
      const file = await h
        .api()
        .get('/api/drivers/me/documents/VEHICLE_REGISTRATION/file')
        .set(h.bearer(token))
        .buffer(true)
        .parse((response, callback) => {
          const chunks: Buffer[] = [];
          response.on('data', (chunk: Buffer) => chunks.push(chunk));
          response.on('end', () => callback(null, Buffer.concat(chunks)));
        })
        .expect(200);
      expect(file.headers['content-type']).toBe('application/pdf');
      expect(Buffer.compare(file.body as Buffer, PDF)).toBe(0);

      const { body: driver } = await apply().expect(201);
      expect(driver).toMatchObject({
        status: 'PENDING',
        vehicleType: 'MOTORCYCLE',
        vehicleNumber: '경기수원가1234',
        available: false,
        onlineSince: null,
        todayOnlineSeconds: 0,
      });
      expect((await apply().expect(409)).body.code).toBe(
        'DRIVER_ALREADY_REGISTERED',
      );

      // 심사 전에는 운행을 시작할 수도 콜을 볼 수도 없다.
      await h.setAvailability(token, true).expect(409);
      await h
        .api()
        .get('/api/dispatch/open-orders')
        .set(h.bearer(token))
        .expect(403);

      // 운영자는 신청한 사람과 서류를 함께 보고, 파일을 열어 본다.
      const detail = await h
        .api()
        .get(`/api/admin/drivers/${driver.id}`)
        .set(h.bearer(h.adminToken))
        .expect(200);
      expect(detail.body).toMatchObject({
        id: driver.id,
        status: 'PENDING',
        applicant: {
          name: account.user.name,
          email: account.user.email,
          phone: expect.stringMatching(/^010\d{8}$/),
        },
      });
      expect(detail.body.documents).toHaveLength(3);
      const adminFile = await h
        .api()
        .get(`/api/admin/drivers/${driver.id}/documents/DRIVER_LICENSE/file`)
        .set(h.bearer(h.adminToken))
        .expect(200);
      expect(adminFile.headers['content-type']).toBe('image/jpeg');
      // 남의 서류는 라이더끼리도 볼 수 없다.
      await h
        .api()
        .get(`/api/admin/drivers/${driver.id}/documents/DRIVER_LICENSE/file`)
        .set(h.bearer(token))
        .expect(403);

      // 반려: 문제가 된 서류만 반려로, 나머지는 확인된 것으로 표시된다.
      const rejected = await h
        .api()
        .patch(`/api/admin/drivers/${driver.id}/reject`)
        .set(h.bearer(h.adminToken))
        .send({
          reason: '면허증 사진이 흐려요',
          rejectedDocuments: ['DRIVER_LICENSE'],
        })
        .expect(200);
      expect(rejected.body).toMatchObject({
        status: 'REJECTED',
        rejectionReason: '면허증 사진이 흐려요',
      });
      expect(await statuses()).toEqual({
        DRIVER_LICENSE: 'REJECTED',
        VEHICLE_REGISTRATION: 'APPROVED',
        DELIVERY_INSURANCE: 'APPROVED',
      });
      const rejectedPush = await h.waitForPushTo(
        'applicant-phone',
        'DRIVER_REJECTED',
      );
      expect(rejectedPush.message).toMatchObject({
        title: '서류를 다시 확인해 주세요',
        body: '면허증 사진이 흐려요',
      });

      // 반려된 서류를 다시 올리기 전에는 재신청할 수 없다.
      expect((await apply().expect(409)).body.code).toBe('DOCUMENTS_REQUIRED');
      await h.uploadDocument(token, 'DRIVER_LICENSE').expect(200);
      const reapplied = await apply().expect(201);
      expect(reapplied.body).toMatchObject({
        id: driver.id,
        status: 'PENDING',
        rejectionReason: null,
      });

      const approved = await h
        .api()
        .patch(`/api/admin/drivers/${driver.id}/approve`)
        .set(h.bearer(h.adminToken))
        .expect(200);
      expect(approved.body.status).toBe('APPROVED');
      expect(Object.values(await statuses())).toEqual([
        'APPROVED',
        'APPROVED',
        'APPROVED',
      ]);
      const approvedPush = await h.waitForPushTo(
        'applicant-phone',
        'DRIVER_APPROVED',
      );
      expect(approvedPush.message.title).toBe('가입이 승인됐어요');
      await h.setAvailability(token, true).expect(200);

      // 심사 결과는 알림함에도 남는다.
      const inbox = await h
        .api()
        .get('/api/notifications')
        .set(h.bearer(token))
        .expect(200);
      expect(
        inbox.body.items.map((item: { type: string }) => item.type),
      ).toEqual(['DRIVER_APPROVED', 'DRIVER_REJECTED']);
    });

    it('같은 서류를 다시 올리면 앞의 파일은 지운다', async () => {
      const { accessToken, user } = await h.register('DRIVER');
      const stored = () =>
        readdir(join(process.env.UPLOAD_DIR!, 'driver-documents', user.id));

      await h.uploadDocument(accessToken, 'DRIVER_LICENSE').expect(200);
      const [first] = await stored();
      await h.uploadDocument(accessToken, 'DRIVER_LICENSE', PDF).expect(200);

      const files = await stored();
      expect(files).toHaveLength(1);
      expect(files[0]).not.toBe(first);
      expect(files[0]).toMatch(/^DRIVER_LICENSE-.+\.pdf$/);
    });

    it('운영자만 심사할 수 있고, 반려에는 사유가 필요하다', async () => {
      const driver = await h.pendingDriver();
      const customer = await h.register('CUSTOMER');
      const review = (token: string, action: string, body?: object) =>
        h
          .api()
          .patch(`/api/admin/drivers/${driver.driverId}/${action}`)
          .set(h.bearer(token))
          .send(body);

      await review(driver.token, 'approve').expect(403);
      await review(customer.accessToken, 'approve').expect(403);
      await review(h.adminToken, 'reject', {}).expect(400);
      await review(h.adminToken, 'reject', {
        reason: '확인 불가',
        rejectedDocuments: ['PASSPORT'],
      }).expect(400);

      const pending = await h
        .api()
        .get('/api/admin/drivers?status=PENDING')
        .set(h.bearer(h.adminToken))
        .expect(200);
      expect(
        pending.body.items.map((item: { id: string }) => item.id),
      ).toContain(driver.driverId);

      await review(h.adminToken, 'approve').expect(200);
      // 심사는 한 번만 한다.
      expect(
        (await review(h.adminToken, 'approve').expect(409)).body.code,
      ).toBe('DRIVER_NOT_PENDING');
    });
  });

  describe('오토바이 변경', () => {
    it('운행을 끈 뒤에 신청하고, 다시 승인받기 전까지 운행할 수 없다', async () => {
      const driver = await h.onlineDriver();
      const change = () =>
        h
          .api()
          .post('/api/drivers/me/vehicle-change')
          .set(h.bearer(driver.token))
          .send(VEHICLE);

      expect((await change().expect(409)).body.code).toBe('DRIVER_IS_ONLINE');
      await h.setAvailability(driver.token, false).expect(200);

      const changed = await change().expect(200);
      expect(changed.body).toMatchObject({
        id: driver.driverId,
        status: 'PENDING',
        vehicleType: 'MOTORCYCLE',
        vehicleNumber: '경기수원가1234',
      });
      expect(
        (await h.setAvailability(driver.token, true).expect(409)).body.code,
      ).toBe('DRIVER_NOT_APPROVED');

      await h
        .api()
        .patch(`/api/admin/drivers/${driver.driverId}/approve`)
        .set(h.bearer(h.adminToken))
        .expect(200);
      await h.setAvailability(driver.token, true).expect(200);
    });
  });

  describe('운행 시간', () => {
    it('운행을 켠 시각과 오늘 운행한 시간을 준다', async () => {
      const driver = await h.onlineDriver();
      const me = async () =>
        (
          await h
            .api()
            .get('/api/drivers/me')
            .set(h.bearer(driver.token))
            .expect(200)
        ).body as {
          available: boolean;
          onlineSince: string | null;
          todayOnlineSeconds: number;
        };
      const sinceMidnight = () =>
        (Date.now() - kstStartOfDay(new Date()).getTime()) / 1000;
      // 10분 전에 운행을 켠 것으로 만든다.
      await h.dataSource.query(
        `UPDATE driver_shifts SET started_at = now() - interval '10 minutes' WHERE driver_id = $1`,
        [driver.driverId],
      );

      const online = await me();
      expect(online.available).toBe(true);
      expect(Date.now() - Date.parse(online.onlineSince!)).toBeGreaterThan(
        9 * 60_000,
      );
      // 자정을 막 넘겼다면 오늘 몫은 자정부터만 센다.
      const expected = Math.min(600, sinceMidnight());
      expect(online.todayOnlineSeconds).toBeGreaterThanOrEqual(
        Math.floor(expected) - 2,
      );
      expect(online.todayOnlineSeconds).toBeLessThanOrEqual(600 + 5);

      // 켜져 있는데 또 켜도 운행 기록이 겹치지 않는다.
      await h.setAvailability(driver.token, true).expect(200);
      const off = await h.setAvailability(driver.token, false).expect(200);
      expect(off.body).toMatchObject({ available: false, onlineSince: null });
      expect(off.body.todayOnlineSeconds).toBeGreaterThanOrEqual(
        Math.floor(expected) - 2,
      );
      const shifts = await h.dataSource.query<unknown[]>(
        'SELECT 1 FROM driver_shifts WHERE driver_id = $1',
        [driver.driverId],
      );
      expect(shifts).toHaveLength(1);

      // 꺼 둔 동안에는 시간이 늘지 않는다.
      const before = (await me()).todayOnlineSeconds;
      await new Promise((resolve) => setTimeout(resolve, 1100));
      expect((await me()).todayOnlineSeconds).toBe(before);
    });
  });

  describe('수입과 정산', () => {
    it('완료한 배달의 대행료가 오늘 수입으로 잡힌다', async () => {
      const store = await h.readyStore();
      const driver = await h.onlineDriver();
      const today = kstDateString(new Date());
      const weekAgo = kstDateString(addDays(new Date(), -6));
      const earnings = (query: string) =>
        h
          .api()
          .get(`/api/dispatch/earnings${query}`)
          .set(h.bearer(driver.token));

      const empty = await earnings(`?from=${weekAgo}&to=${today}`).expect(200);
      expect(empty.body).toMatchObject({
        from: weekAgo,
        to: today,
        totalEarnings: 0,
        completedCount: 0,
        cancelledCount: 0,
        nextSettlement: { amount: 0 },
      });
      // 수입이 없는 날도 빠짐없이 온다 (주간 막대 그래프).
      expect(empty.body.daily).toHaveLength(7);
      expect(empty.body.daily.at(-1)).toEqual({
        date: today,
        earnings: 0,
        sales: 0,
        completedCount: 0,
      });

      const delivered = await h.deliveryAt(
        store.token,
        driver.token,
        'complete',
      );
      const second = await h.deliveryAt(store.token, driver.token, 'complete');
      const cancelled = await h.deliveryAt(store.token, driver.token, 'accept');
      await h
        .api()
        .post(`/api/orders/${cancelled.id}/cancel`)
        .set(h.bearer(store.token))
        .send({})
        .expect(200);
      // 아직 끝나지 않은 배달은 수입이 아니다.
      await h.deliveryAt(store.token, driver.token, 'pickup');

      const sales = delivered.fare + second.fare;
      const earned =
        SETTLEMENT_POLICY.earningOf(delivered.fare) +
        SETTLEMENT_POLICY.earningOf(second.fare);
      const { body } = await earnings(`?from=${today}&to=${today}`).expect(200);
      expect(body).toMatchObject({
        totalEarnings: earned,
        totalSales: sales,
        completedCount: 2,
        cancelledCount: 1,
        daily: [
          {
            date: today,
            earnings: earned,
            sales,
            completedCount: 2,
          },
        ],
      });
      // 다음 정산은 돌아오는 지급 요일이고, 그때 정산되는 주에 완료한 배달이 대상이다.
      const settlement = SETTLEMENT_POLICY.upcoming(new Date());
      const deliveredAt = new Date();
      const includedInNext =
        deliveredAt >= settlement.period.from &&
        deliveredAt < settlement.period.to;
      expect(body.nextSettlement).toEqual({
        date: kstDateString(settlement.payoutDate),
        amount: includedInNext ? earned : 0,
      });

      // 배달 내역도 기간과 상태로 거른다.
      const deliveries = (query: string) =>
        h
          .api()
          .get(`/api/dispatch/my-orders${query}`)
          .set(h.bearer(driver.token));
      const done = await deliveries(
        `?from=${today}&to=${today}&status=DELIVERED`,
      ).expect(200);
      expect(done.body.total).toBe(2);
      expect(done.body.items.map((item: { id: string }) => item.id)).toContain(
        delivered.id,
      );
      expect((await deliveries('').expect(200)).body.total).toBe(4);
      const yesterday = kstDateString(addDays(new Date(), -1));
      expect(
        (await deliveries(`?from=${yesterday}&to=${yesterday}`).expect(200))
          .body.total,
      ).toBe(0);

      // 기간은 양 끝을 함께, 올바른 순서로, 92일까지.
      await deliveries(`?from=${today}`).expect(400);
      await earnings(`?from=${today}`).expect(400);
      await earnings(`?from=${today}&to=${weekAgo}`).expect(400);
      await earnings('?from=2026-01-01&to=2026-12-31').expect(400);
      await earnings('?from=2026/01/01&to=2026-01-02').expect(400);
    });

    it('수입은 라이더 본인 것만 보인다', async () => {
      const store = await h.readyStore();
      const busy = await h.onlineDriver();
      const idle = await h.onlineDriver();
      const today = kstDateString(new Date());
      await h.deliveryAt(store.token, busy.token, 'complete');

      const { body } = await h
        .api()
        .get(`/api/dispatch/earnings?from=${today}&to=${today}`)
        .set(h.bearer(idle.token))
        .expect(200);

      expect(body).toMatchObject({ totalEarnings: 0, completedCount: 0 });
      await h
        .api()
        .get(`/api/dispatch/earnings?from=${today}&to=${today}`)
        .set(h.bearer(store.token))
        .expect(403);
    });

    it('정산 계좌를 등록하면 계좌번호는 끝 네 자리만 돌려준다', async () => {
      const driver = await h.onlineDriver();
      const account = () =>
        h
          .api()
          .get('/api/drivers/me/settlement-account')
          .set(h.bearer(driver.token));
      const save = (body: object) =>
        h
          .api()
          .put('/api/drivers/me/settlement-account')
          .set(h.bearer(driver.token))
          .send(body);

      // 등록 전에는 null (본문 없음).
      expect((await account().expect(200)).text).toBe('');

      const saved = await save({
        bankName: '국민',
        accountNumber: '123456-78-901024',
        accountHolder: '박라이더',
      }).expect(200);
      // 예금주가 가입자 이름과 다르면 본인 확인이 안 된 채로 저장된다 (정산 보류).
      expect(saved.body).toEqual({
        bankName: '국민',
        maskedAccountNumber: '••••1024',
        accountHolder: '박라이더',
        verificationStatus: 'FAILED',
        verificationFailureReason: '예금주 이름이 가입자 이름과 달라요.',
        verificationAttemptedAt: expect.any(String),
        verifiedAt: null,
      });
      expect(JSON.stringify(saved.body)).not.toContain('123456');

      await save({
        bankName: '신한',
        accountNumber: '110123456789',
        accountHolder: driver.account.user.name,
      }).expect(200);
      expect((await account().expect(200)).body).toMatchObject({
        bankName: '신한',
        maskedAccountNumber: '••••6789',
        verificationStatus: 'VERIFIED',
        verificationFailureReason: null,
        verifiedAt: expect.any(String),
      });
      const { body: again } = await h
        .api()
        .post('/api/drivers/me/settlement-account/verify')
        .set(h.bearer(driver.token))
        .expect(200);
      expect(again.verificationStatus).toBe('VERIFIED');

      await save({
        bankName: '국민',
        accountNumber: '12-34',
        accountHolder: '박라이더',
      }).expect(400);
    });
  });
});

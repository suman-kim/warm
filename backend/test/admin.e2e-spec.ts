import { addDays, kstDateString } from '../src/common/domain/kst.js';
import {
  SettlementPolicy,
  weekStartOf,
} from '../src/modules/order/domain/services/settlement-policy.js';
import { createHarness, Harness, PASSWORD, PDF } from './support/harness.js';

/** 테스트 서버의 정산 정책 (vitest.config.e2e.ts): 수수료 10%, 화요일 지급. */
const POLICY = new SettlementPolicy(10, 2);

describe('운영자 웹 API (e2e)', () => {
  let h: Harness;

  beforeAll(async () => {
    h = await createHarness();
  });
  afterAll(() => h.close());

  const as = (token: string) => ({
    get: (path: string) =>
      h.api().get(`/api/admin${path}`).set(h.bearer(token)),
    post: (path: string, body?: object) =>
      h.api().post(`/api/admin${path}`).set(h.bearer(token)).send(body),
    patch: (path: string, body?: object) =>
      h.api().patch(`/api/admin${path}`).set(h.bearer(token)).send(body),
    delete: (path: string) =>
      h.api().delete(`/api/admin${path}`).set(h.bearer(token)),
  });
  const login = (email: string, password = PASSWORD) =>
    h.api().post('/api/auth/login').send({ email, password });

  /** 운영자를 초대하고, 초대를 수락해 로그인한 토큰을 돌려준다. */
  async function invitedAdmin(role: string, email: string) {
    const { body: account } = await as(h.adminToken)
      .post('/admins', { name: `${role} 담당`, email, role })
      .expect(201);
    const { body: session } = await h
      .api()
      .post(
        `/api/auth/admin-invitations/${h.invitationTokens.get(email)}/accept`,
      )
      .send({ password: PASSWORD })
      .expect(200);
    return { id: account.id as string, token: session.accessToken as string };
  }

  describe('운영자 계정', () => {
    it('최고 관리자는 모든 메뉴를 쓴다', async () => {
      const { body } = await as(h.adminToken).get('/me').expect(200);

      expect(body).toMatchObject({ role: 'SUPER', status: 'ACTIVE' });
      expect(body.areas).toEqual([
        'REVIEW',
        'ORDERS',
        'MEMBERS',
        'SETTLEMENTS',
        'NOTICES',
        'TERMS',
        'ADMINS',
      ]);
    });

    it('회원은 운영자 API를 부를 수 없다', async () => {
      const customer = await h.register('CUSTOMER');

      await as(customer.accessToken).get('/me').expect(403);
      await as(customer.accessToken).get('/admins').expect(403);
      await h.api().get('/api/admin/me').expect(401);
    });

    it('초대받은 사람은 초대 링크에서 비밀번호를 정해야 로그인할 수 있다', async () => {
      const email = 'ops@movo.kr';
      const { body: invited } = await as(h.adminToken)
        .post('/admins', { name: '김운영', email, role: 'OPS' })
        .expect(201);
      expect(invited).toMatchObject({
        name: '김운영',
        email,
        role: 'OPS',
        status: 'INVITED',
        lastLoginAt: null,
      });
      // 같은 이메일로 두 번 초대할 수 없다.
      const again = await as(h.adminToken)
        .post('/admins', { name: '김운영', email, role: 'OPS' })
        .expect(409);
      expect(again.body.code).toBe('EMAIL_ALREADY_REGISTERED');

      // 비밀번호를 정하기 전에는 무엇을 해야 하는지 알려 준다.
      const pending = await login(email).expect(401);
      expect(pending.body.code).toBe('ADMIN_INVITATION_PENDING');

      const token = h.invitationTokens.get(email)!;
      const { body: invitation } = await h
        .api()
        .get(`/api/auth/admin-invitations/${token}`)
        .expect(200);
      expect(invitation).toMatchObject({ name: '김운영', email });
      await h.api().get('/api/auth/admin-invitations/wrong-token').expect(400);

      const accept = (password: string) =>
        h
          .api()
          .post(`/api/auth/admin-invitations/${token}/accept`)
          .send({ password });
      expect((await accept('short').expect(400)).body.code).toBe(
        'WEAK_PASSWORD',
      );
      const { body: session } = await accept(PASSWORD).expect(200);
      // 한 번 쓴 링크는 다시 쓸 수 없다.
      await accept(PASSWORD).expect(400);

      // 수락하면 바로 로그인된 상태이고, 그 뒤로는 비밀번호로 로그인한다.
      const { body: me } = await as(session.accessToken).get('/me').expect(200);
      expect(me).toMatchObject({ role: 'OPS', status: 'ACTIVE' });
      expect(me.areas).toEqual([
        'REVIEW',
        'ORDERS',
        'MEMBERS',
        'NOTICES',
        'TERMS',
      ]);
      await login(email).expect(200);
    });

    it('초대 메일을 다시 보내면 앞의 링크는 못 쓴다', async () => {
      const email = 'resend@movo.kr';
      const { body: invited } = await as(h.adminToken)
        .post('/admins', { name: '박재전송', email, role: 'FINANCE' })
        .expect(201);
      const first = h.invitationTokens.get(email)!;

      await as(h.adminToken)
        .post(`/admins/${invited.id}/invitations`)
        .expect(204);
      const second = h.invitationTokens.get(email)!;

      expect(second).not.toBe(first);
      await h.api().get(`/api/auth/admin-invitations/${first}`).expect(400);
      await h.api().get(`/api/auth/admin-invitations/${second}`).expect(200);
    });

    it('권한에 없는 메뉴의 API는 부를 수 없다', async () => {
      const ops = await invitedAdmin('OPS', 'ops2@movo.kr');
      const finance = await invitedAdmin('FINANCE', 'finance@movo.kr');

      await as(ops.token).get('/drivers').expect(200);
      await as(ops.token).get('/notices').expect(200);
      const denied = await as(ops.token).get('/settlements').expect(403);
      expect(denied.body.code).toBe('ADMIN_AREA_NOT_PERMITTED');
      await as(ops.token).get('/admins').expect(403);

      await as(finance.token).get('/settlements').expect(200);
      await as(finance.token).get('/deliveries').expect(200);
      await as(finance.token).get('/drivers').expect(403);
      await as(finance.token).get('/users?role=CUSTOMER').expect(403);
    });

    it('비활성화하면 바로 쓸 수 없고, 다시 활성화하면 쓸 수 있다', async () => {
      const email = 'off@movo.kr';
      const ops = await invitedAdmin('OPS', email);
      const update = (body: object) =>
        as(h.adminToken).patch(`/admins/${ops.id}`, body);

      expect((await update({ active: false }).expect(200)).body.status).toBe(
        'INACTIVE',
      );
      // 이미 받은 토큰으로도 운영자 API를 부를 수 없다.
      const blocked = await as(ops.token).get('/me').expect(403);
      expect(blocked.body.code).toBe('ADMIN_INACTIVE');
      expect((await login(email).expect(401)).body.code).toBe('ADMIN_INACTIVE');

      await update({ active: true }).expect(200);
      await as(ops.token).get('/me').expect(200);
      // 권한을 바꾸면 쓸 수 있는 메뉴가 바로 바뀐다.
      await update({ role: 'FINANCE' }).expect(200);
      await as(ops.token).get('/drivers').expect(403);
      await as(ops.token).get('/settlements').expect(200);

      const { body: list } = await as(h.adminToken).get('/admins').expect(200);
      expect(
        list.find((each: { id: string }) => each.id === ops.id),
      ).toMatchObject({
        role: 'FINANCE',
        status: 'ACTIVE',
        lastLoginAt: expect.any(String),
      });
    });

    it('내 계정은 바꿀 수 없다', async () => {
      const { body: me } = await as(h.adminToken).get('/me').expect(200);

      const response = await as(h.adminToken)
        .patch(`/admins/${me.id}`, { active: false })
        .expect(409);

      expect(response.body.code).toBe('CANNOT_CHANGE_OWN_ADMIN_ACCOUNT');
    });

    it('마지막 최고 관리자는 없앨 수 없다', async () => {
      const second = await invitedAdmin('SUPER', 'super2@movo.kr');
      const { body: me } = await as(h.adminToken).get('/me').expect(200);

      // 최고 관리자가 둘이면 하나는 내릴 수 있다.
      await as(second.token)
        .patch(`/admins/${me.id}`, { role: 'OPS' })
        .expect(200);
      // 이제 혼자 남은 최고 관리자는 내릴 수 없다 (자기 자신은 애초에 못 바꾼다).
      await as(second.token)
        .patch(`/admins/${second.id}`, { active: false })
        .expect(409);
      await as(h.adminToken).get('/admins').expect(403);

      // 다음 테스트를 위해 되돌린다.
      await as(second.token)
        .patch(`/admins/${me.id}`, { role: 'SUPER' })
        .expect(200);
      await as(h.adminToken)
        .patch(`/admins/${second.id}`, { active: false })
        .expect(200);
    });
  });

  describe('라이더 심사', () => {
    it('신청한 사람과 서류를 함께 보고, 이름·휴대폰·번호판으로 찾는다', async () => {
      const driver = await h.pendingDriver();
      const { name, email } = driver.account.user;

      const { body } = await as(h.adminToken)
        .get('/drivers?status=PENDING')
        .expect(200);

      expect(body.counts.PENDING).toBeGreaterThanOrEqual(1);
      const row = body.items.find(
        (each: { id: string }) => each.id === driver.driverId,
      );
      expect(row).toMatchObject({
        status: 'PENDING',
        vehicleType: 'MOTORCYCLE',
        applicant: { name, email },
        appliedAt: expect.any(String),
        reviewedAt: null,
        reviewerName: null,
        resubmitted: false,
      });
      expect(row.documents).toHaveLength(3);
      expect(row.documents[0]).toMatchObject({
        type: 'DRIVER_LICENSE',
        status: 'SUBMITTED',
        contentType: 'image/jpeg',
        size: expect.any(Number),
        resubmitted: false,
      });

      const found = async (q: string) =>
        (
          await as(h.adminToken)
            .get(`/drivers?q=${encodeURIComponent(q)}`)
            .expect(200)
        ).body.items.map((each: { id: string }) => each.id) as string[];
      expect(await found(name)).toEqual([driver.driverId]);
      expect(await found(email.toUpperCase())).toEqual([driver.driverId]);
      expect(await found(row.vehicleNumber.slice(-4))).toContain(
        driver.driverId,
      );
      expect(await found('없는사람')).toEqual([]);
      // 검색어의 %는 글자 그대로 찾는다 — 전부 나오지 않는다.
      expect(await found('%')).toEqual([]);
    });

    it('반려하면 처리한 사람이 남고, 다시 신청하면 재신청으로 보인다', async () => {
      const driver = await h.pendingDriver();
      const detail = () =>
        as(h.adminToken).get(`/drivers/${driver.driverId}`).expect(200);

      const { body: rejected } = await as(h.adminToken)
        .patch(`/drivers/${driver.driverId}/reject`, {
          reason: '자동차등록증 사진이 흐려요.',
          rejectedDocuments: ['VEHICLE_REGISTRATION'],
        })
        .expect(200);
      expect(rejected).toMatchObject({
        status: 'REJECTED',
        rejectionReason: '자동차등록증 사진이 흐려요.',
        reviewedAt: expect.any(String),
        reviewerName: expect.any(String),
        resubmitted: false,
      });
      expect(
        rejected.documents.map((each: { status: string }) => each.status),
      ).toEqual(['APPROVED', 'REJECTED', 'APPROVED']);

      // 라이더가 반려된 서류만 다시 올리고 재신청한다.
      await h
        .uploadDocument(driver.token, 'VEHICLE_REGISTRATION', PDF)
        .expect(200);
      await h
        .api()
        .post('/api/drivers')
        .set(h.bearer(driver.token))
        .send({ vehicleNumber: '서울강남나5678' })
        .expect(201);

      const { body: reapplied } = await detail();
      expect(reapplied).toMatchObject({
        status: 'PENDING',
        resubmitted: true,
        previousRejectionReason: '자동차등록증 사진이 흐려요.',
        rejectionReason: null,
      });
      expect(
        reapplied.documents.map(
          (each: { status: string; resubmitted: boolean }) => [
            each.status,
            each.resubmitted,
          ],
        ),
      ).toEqual([
        ['APPROVED', false],
        ['SUBMITTED', true],
        ['APPROVED', false],
      ]);
      expect(reapplied.documents[1].contentType).toBe('application/pdf');
      expect(new Date(reapplied.appliedAt).getTime()).toBeGreaterThan(
        new Date(rejected.appliedAt).getTime(),
      );

      const { body: approved } = await as(h.adminToken)
        .patch(`/drivers/${driver.driverId}/approve`)
        .expect(200);
      expect(approved).toMatchObject({
        status: 'APPROVED',
        resubmitted: false,
        previousRejectionReason: null,
      });
    });

    it('승인·반려 목록은 최근에 처리한 것부터 온다', async () => {
      const first = await h.onlineDriver();
      const second = await h.onlineDriver();

      const { body } = await as(h.adminToken)
        .get('/drivers?status=APPROVED&size=2')
        .expect(200);

      expect(body.items.map((each: { id: string }) => each.id)).toEqual([
        second.driverId,
        first.driverId,
      ]);
    });
  });

  describe('공지사항', () => {
    it('내린 공지는 앱에서 사라지고 기록으로 남는다', async () => {
      const customer = await h.register('CUSTOMER');
      const appTitles = async () =>
        (
          await h
            .api()
            .get('/api/notices')
            .set(h.bearer(customer.accessToken))
            .expect(200)
        ).body.items.map((each: { title: string }) => each.title) as string[];

      const { body: notice } = await as(h.adminToken)
        .post('/notices', {
          title: '서비스 점검 안내',
          body: '새벽 2시부터 4시까지 점검해요.',
          audience: 'ALL',
        })
        .expect(201);
      expect(notice).toMatchObject({
        authorName: expect.any(String),
        removedAt: null,
      });
      expect(await appTitles()).toContain('서비스 점검 안내');

      await as(h.adminToken).delete(`/notices/${notice.id}`).expect(204);
      // 두 번 내려도 처음 내린 시각이 남는다.
      await as(h.adminToken).delete(`/notices/${notice.id}`).expect(204);

      expect(await appTitles()).not.toContain('서비스 점검 안내');
      await h
        .api()
        .get(`/api/notices/${notice.id}`)
        .set(h.bearer(customer.accessToken))
        .expect(404);
      const { body: removed } = await as(h.adminToken)
        .get('/notices?state=REMOVED')
        .expect(200);
      expect(removed.items).toMatchObject([
        {
          id: notice.id,
          title: '서비스 점검 안내',
          body: '새벽 2시부터 4시까지 점검해요.',
          removedAt: expect.any(String),
        },
      ]);
      expect(removed.counts.removed).toBe(1);
      const { body: live } = await as(h.adminToken).get('/notices').expect(200);
      expect(live.items.map((each: { id: string }) => each.id)).not.toContain(
        notice.id,
      );
      await as(h.adminToken)
        .delete('/notices/00000000-0000-4000-8000-000000000000')
        .expect(404);
    });
  });

  describe('회원', () => {
    const suspend = (userId: string, body: object) =>
      as(h.adminToken).post(`/users/${userId}/suspensions`, body);

    it('사장님과 라이더를 나눠 찾아본다', async () => {
      const store = await h.readyStore();
      const customer = store.account;
      const driver = await h.onlineDriver();
      await h.deliveryAt(store.token, driver.token, 'complete');

      const { body: customers } = await as(h.adminToken)
        .get(`/users?role=CUSTOMER&q=${customer.user.email}`)
        .expect(200);
      expect(customers.items).toMatchObject([
        {
          id: customer.user.id,
          role: 'CUSTOMER',
          name: customer.user.name,
          suspended: false,
          useCount: 1,
          lastUsedAt: expect.any(String),
        },
      ]);
      expect(customers.counts.CUSTOMER).toBeGreaterThanOrEqual(1);
      expect(customers.counts.DRIVER).toBeGreaterThanOrEqual(1);

      const { body: drivers } = await as(h.adminToken)
        .get(`/users?role=DRIVER&q=${driver.account.user.email}`)
        .expect(200);
      expect(drivers.items).toMatchObject([
        { id: driver.account.user.id, role: 'DRIVER', useCount: 1 },
      ]);
      // 운영자는 회원 목록에 나오지 않는다.
      const { body: me } = await as(h.adminToken).get('/me').expect(200);
      await as(h.adminToken).get(`/users/${me.id}`).expect(404);
      await as(h.adminToken).get('/users').expect(400);
    });

    it('정지하면 바로 쓸 수 없고, 로그인하려 하면 사유가 보인다', async () => {
      const customer = await h.register('CUSTOMER');
      const { id, email } = customer.user;
      const me = () =>
        h.api().get('/api/users/me').set(h.bearer(customer.accessToken));
      await me().expect(200);

      expect(
        (await suspend(id, { days: 7, reason: '짧음' }).expect(400)).body,
      ).toBeDefined();
      await suspend(id, { days: 3, reason: '기간이 맞지 않는 정지' }).expect(
        400,
      );
      const { body: detail } = await suspend(id, {
        days: 7,
        reason: '손님 주소를 거짓으로 적어 배달을 반복해서 요청했어요.',
      }).expect(201);

      expect(detail).toMatchObject({
        suspended: true,
        suspendedUntil: expect.any(String),
        suspensions: [
          {
            days: 7,
            reason: '손님 주소를 거짓으로 적어 배달을 반복해서 요청했어요.',
            inEffect: true,
            liftedAt: null,
            suspendedByName: expect.any(String),
          },
        ],
      });
      // 이미 받은 토큰도 막히고, 토큰을 새로 받을 수도 없다.
      await me().expect(401);
      await h
        .api()
        .post('/api/auth/refresh')
        .send({ refreshToken: customer.refreshToken })
        .expect(401);
      const blocked = await login(email).expect(401);
      expect(blocked.body.code).toBe('ACCOUNT_SUSPENDED');
      expect(blocked.body.message).toContain(
        '손님 주소를 거짓으로 적어 배달을 반복해서 요청했어요.',
      );
      expect(
        (await suspend(id, { days: 30, reason: '한 번 더 정지' })).status,
      ).toBe(409);

      const { body: listed } = await as(h.adminToken)
        .get(`/users?role=CUSTOMER&status=SUSPENDED`)
        .expect(200);
      expect(listed.items.map((each: { id: string }) => each.id)).toContain(id);
      const { body: actives } = await as(h.adminToken)
        .get(`/users?role=CUSTOMER&status=ACTIVE&size=100`)
        .expect(200);
      expect(
        actives.items.map((each: { id: string }) => each.id),
      ).not.toContain(id);

      const { body: lifted } = await as(h.adminToken)
        .delete(`/users/${id}/suspensions/current`)
        .expect(200);
      expect(lifted).toMatchObject({
        suspended: false,
        suspendedUntil: null,
        suspensions: [{ inEffect: false, liftedAt: expect.any(String) }],
      });
      await login(email).expect(200);
      await as(h.adminToken)
        .delete(`/users/${id}/suspensions/current`)
        .expect(409);
    });

    it('기간이 끝난 정지는 풀린 것으로 본다', async () => {
      const customer = await h.register('CUSTOMER');
      await suspend(customer.user.id, {
        days: 7,
        reason: '기간이 끝나는 정지를 확인해요.',
      }).expect(201);
      await h.dataSource.query(
        `UPDATE users SET suspended_until = now() - interval '1 minute' WHERE id = $1`,
        [customer.user.id],
      );
      await h.dataSource.query(
        `UPDATE user_suspensions SET ends_at = now() - interval '1 minute' WHERE user_id = $1`,
        [customer.user.id],
      );

      await login(customer.user.email).expect(200);
      const { body } = await as(h.adminToken)
        .get(`/users/${customer.user.id}`)
        .expect(200);
      expect(body).toMatchObject({
        suspended: false,
        suspensions: [{ inEffect: false, liftedAt: null }],
      });
    });

    it('진행 중인 배달이 있으면 정지할 수 없고, 운행 중이던 라이더는 운행이 꺼진다', async () => {
      const store = await h.readyStore();
      const driver = await h.onlineDriver();
      const order = await h.deliveryAt(store.token, driver.token, 'accept');
      const reason = { days: null, reason: '진행 중인 배달을 확인해요.' };

      for (const userId of [store.account.user.id, driver.account.user.id]) {
        const response = await suspend(userId, reason).expect(409);
        expect(response.body.code).toBe('ORDER_IN_PROGRESS');
      }
      const { body: busy } = await as(h.adminToken)
        .get(`/users/${driver.account.user.id}`)
        .expect(200);
      expect(busy.activeDeliveries).toBe(1);

      await h.dispatch(driver.token, order.id, 'pickup').expect(200);
      await h.dispatch(driver.token, order.id, 'complete').expect(200);
      const { body: suspended } = await suspend(
        driver.account.user.id,
        reason,
      ).expect(201);
      expect(suspended).toMatchObject({
        suspended: true,
        suspendedUntil: null,
        suspensions: [{ days: null, inEffect: true }],
      });
      const [row] = await h.dataSource.query<{ available: boolean }[]>(
        `SELECT available FROM drivers WHERE id = $1`,
        [driver.driverId],
      );
      expect(row.available).toBe(false);
    });
  });

  describe('정산', () => {
    const lastWeek = addDays(weekStartOf(new Date()), -7);
    const weekStart = kstDateString(lastWeek);

    /** 지난주에 배달 [count]건을 끝낸 라이더를 만든다. 대행료 합(gross)도 준다. */
    async function driverWithDeliveriesLastWeek(count: number) {
      const store = await h.readyStore();
      const driver = await h.onlineDriver();
      const fares: number[] = [];
      for (let n = 0; n < count; n += 1) {
        const order = await h.deliveryAt(store.token, driver.token, 'complete');
        fares.push(order.fare);
        await h.dataSource.query(
          `UPDATE orders SET delivered_at = $2 WHERE id = $1`,
          [order.id, addDays(lastWeek, 2)],
        );
      }
      const net = fares.reduce((sum, fare) => sum + POLICY.earningOf(fare), 0);
      const fee = fares.reduce((sum, fare) => sum + POLICY.feeOf(fare), 0);
      const gross = fares.reduce((sum, fare) => sum + fare, 0);
      return { ...driver, gross, fee, net };
    }
    /** 정산 계좌를 등록한다. 예금주를 가입자 이름으로 적으면 본인 확인이 된다. */
    const saveAccount = (
      driver: { token: string; account: { user: { name: string } } },
      accountHolder = driver.account.user.name,
    ) =>
      h
        .api()
        .put('/api/drivers/me/settlement-account')
        .set(h.bearer(driver.token))
        .send({
          bankName: '국민',
          accountNumber: '123456-78-901024',
          accountHolder,
        })
        .expect(200);
    const itemOf = (
      week: { items: { driverId: string }[] },
      driverId: string,
    ) => week.items.find((each) => each.driverId === driverId);

    it('지난주에 끝낸 배달을 라이더별로 모아, 수수료를 뺀 정산액을 준다', async () => {
      const driver = await driverWithDeliveriesLastWeek(2);

      const { body: week } = await as(h.adminToken)
        .get('/settlements')
        .expect(200);

      expect(week).toMatchObject({
        weekStart,
        weekEnd: kstDateString(addDays(lastWeek, 6)),
        payoutDate: kstDateString(POLICY.payoutDateOf(lastWeek)),
        commissionPercent: 10,
        latest: true,
      });
      // 계좌를 등록하지 않은 라이더는 보류다.
      expect(itemOf(week, driver.driverId)).toMatchObject({
        driverName: driver.account.user.name,
        bankName: null,
        trips: 2,
        gross: driver.gross,
        fee: driver.fee,
        net: driver.net,
        status: 'HOLD',
        paidAt: null,
      });
      expect(week.totals.unpaidNet).toBeGreaterThanOrEqual(driver.net);

      // 예금주가 가입자가 아니면 본인 확인이 안 돼 여전히 보류다.
      await saveAccount(driver, '다른사람');
      const { body: unverified } = await as(h.adminToken)
        .get(`/settlements?weekStart=${weekStart}`)
        .expect(200);
      expect(itemOf(unverified, driver.driverId)).toMatchObject({
        bankName: '국민',
        status: 'HOLD',
        reason: '예금주 이름이 가입자 이름과 달라요.',
      });

      await saveAccount(driver);
      const { body: ready } = await as(h.adminToken)
        .get(`/settlements?weekStart=${weekStart}`)
        .expect(200);
      expect(itemOf(ready, driver.driverId)).toMatchObject({
        bankName: '국민',
        maskedAccountNumber: '••••1024',
        status: 'WAITING',
        reason: null,
        compensation: 0,
      });
    });

    it('지급 처리하면 지급 완료가 되고, 두 번 지급할 수 없다', async () => {
      const driver = await driverWithDeliveriesLastWeek(1);
      const pay = (driverIds: string[]) =>
        as(h.adminToken).post('/settlements/payouts', { weekStart, driverIds });

      // 계좌가 없으면(보류) 지급할 수 없다.
      const held = await pay([driver.driverId]).expect(409);
      expect(held.body.code).toBe('SETTLEMENT_NOT_PAYABLE');

      await saveAccount(driver);
      const { body: batch } = await pay([driver.driverId]).expect(201);
      expect(batch).toMatchObject({
        requested: 1,
        paid: 1,
        processing: 0,
        failures: [],
      });
      expect(itemOf(batch.week, driver.driverId)).toMatchObject({
        status: 'PAID',
        net: driver.net,
        paidAt: expect.any(String),
      });
      expect((await pay([driver.driverId]).expect(409)).body.code).toBe(
        'SETTLEMENT_NOT_PAYABLE',
      );

      const { body: history } = await as(h.adminToken)
        .get('/payouts')
        .expect(200);
      expect(history.items[0]).toMatchObject({
        driverName: driver.account.user.name,
        weekStart,
        bankName: '국민',
        maskedAccountNumber: '••••1024',
        amount: driver.net,
        status: 'PAID',
        failureReason: null,
        paidByName: expect.any(String),
      });

      // 라이더 앱의 정산 내역에도 지급 완료로 보인다.
      const { body: mine } = await h
        .api()
        .get('/api/dispatch/settlements')
        .set(h.bearer(driver.token))
        .expect(200);
      expect(mine).toMatchObject({
        onHold: false,
        account: { bankName: '국민', verified: true },
        upcoming: [],
        paid: [
          {
            weekStart,
            status: 'PAID',
            trips: 1,
            net: driver.net,
          },
        ],
      });
    });

    it('끝나지 않은 주와 월요일이 아닌 날짜는 받지 않는다', async () => {
      const thisWeek = kstDateString(weekStartOf(new Date()));
      const notMonday = kstDateString(addDays(lastWeek, 1));

      expect(
        (
          await as(h.adminToken)
            .get(`/settlements?weekStart=${thisWeek}`)
            .expect(400)
        ).body.code,
      ).toBe('WEEK_NOT_FINISHED');
      expect(
        (
          await as(h.adminToken)
            .get(`/settlements?weekStart=${notMonday}`)
            .expect(400)
        ).body.code,
      ).toBe('INVALID_WEEK');
      const { body: older } = await as(h.adminToken)
        .get(`/settlements?weekStart=${kstDateString(addDays(lastWeek, -7))}`)
        .expect(200);
      expect(older).toMatchObject({ latest: false, items: [] });
    });
  });
});

import {
  AGREEMENTS,
  createHarness,
  DAMAS_ORDER,
  Harness,
  PASSWORD,
} from './support/harness.js';

describe('계정 (e2e)', () => {
  let h: Harness;

  beforeAll(async () => {
    h = await createHarness();
  });
  afterAll(() => h.close());

  const login = (email: string, password: string) =>
    h.api().post('/api/auth/login').send({ email, password });
  const me = (token: string) =>
    h.api().get('/api/users/me').set(h.bearer(token));

  describe('가입과 인증', () => {
    it('인증과 역할을 확인한다', async () => {
      const customer = await h.register('CUSTOMER');

      await h.api().get('/api/health').expect(200, { status: 'ok' });
      const anonymous = await h.api().get('/api/users/me').expect(401);
      expect(anonymous.body).toMatchObject({
        statusCode: 401,
        code: 'INVALID_ACCESS_TOKEN',
        path: '/api/users/me',
      });
      // 고객은 기사·운영자 라우트를 부를 수 없다.
      for (const path of [
        '/api/dispatch/open-orders',
        '/api/drivers/me',
        '/api/admin/drivers',
      ]) {
        await h.api().get(path).set(h.bearer(customer.accessToken)).expect(403);
      }
    });

    it('필수 약관에 동의해야 가입된다', async () => {
      const body = {
        email: 'terms@test.dev',
        password: PASSWORD,
        name: '약관',
        phone: '01077770001',
        role: 'CUSTOMER',
      };
      const register = (extra: object) =>
        h
          .api()
          .post('/api/auth/register')
          .send({ ...body, ...extra });

      await register({}).expect(400);
      const refused = await register({
        agreements: { ...AGREEMENTS, privacy: false },
      }).expect(400);
      expect(refused.body.code).toBe('AGREEMENT_REQUIRED');
      // 운영자로는 가입할 수 없다.
      await register({ agreements: AGREEMENTS, role: 'ADMIN' }).expect(400);
      // 비밀번호는 영문과 숫자를 섞어야 한다.
      const weak = await register({
        agreements: AGREEMENTS,
        password: 'abcdefgh',
      }).expect(400);
      expect(weak.body.code).toBe('WEAK_PASSWORD');

      const joined = await register({
        agreements: { ...AGREEMENTS, marketing: true },
      }).expect(201);
      expect(joined.body.user).toMatchObject({
        email: 'terms@test.dev',
        role: 'CUSTOMER',
        marketingAgreed: true,
      });
      // 동의한 시각을 남긴다.
      const [row] = await h.dataSource.query<Record<string, Date | null>[]>(
        'SELECT terms_agreed_at, privacy_agreed_at, marketing_agreed_at FROM users WHERE id = $1',
        [joined.body.user.id],
      );
      expect(Object.values(row).every((at) => at instanceof Date)).toBe(true);
      // 어느 판에 동의했는지도 남긴다 — 아직 올린 약관이 없어 판 번호는 비어 있다.
      const consents = await h.dataSource.query<
        { type: string; version: string | null }[]
      >(
        'SELECT type, version FROM legal_consents WHERE user_id = $1 ORDER BY type',
        [joined.body.user.id],
      );
      expect(consents).toEqual([
        { type: 'MARKETING', version: null },
        { type: 'PRIVACY', version: null },
        { type: 'TERMS', version: null },
      ]);

      const duplicate = await register({ agreements: AGREEMENTS }).expect(409);
      expect(duplicate.body.code).toBe('EMAIL_ALREADY_REGISTERED');
    });

    it('한 이메일로 다섯 번 틀리면 맞는 비밀번호도 잠시 받지 않는다 — 가입하지 않은 이메일도 같다', async () => {
      const customer = await h.register('CUSTOMER');
      const { email } = customer.user;
      for (let i = 0; i < 4; i++) {
        const wrong = await login(email, 'wrongpass1').expect(401);
        expect(wrong.body.code).toBe('INVALID_CREDENTIALS');
      }
      const fifth = await login(email, 'wrongpass1').expect(429);
      expect(fifth.body.code).toBe('LOGIN_LOCKED');
      expect(fifth.body.message).toContain('15분 뒤');
      expect((await login(email, PASSWORD).expect(429)).body.code).toBe(
        'LOGIN_LOCKED',
      );

      // 막힌 시간이 지나면 다시 로그인할 수 있고, 성공하면 실패 기록이 지워진다.
      await h.dataSource.query(
        `UPDATE login_attempts SET locked_until = now() - interval '1 second' WHERE email = $1`,
        [email],
      );
      await login(email, PASSWORD).expect(200);
      expect(
        await h.dataSource.query(
          'SELECT 1 FROM login_attempts WHERE email = $1',
          [email],
        ),
      ).toEqual([]);

      // 가입하지 않은 이메일도 똑같이 막는다 (막히는지로 가입 여부를 알 수 없다).
      for (let i = 0; i < 4; i++) {
        await login('nobody@test.dev', 'wrongpass1').expect(401);
      }
      await login('nobody@test.dev', 'wrongpass1').expect(429);
    });

    it('리프레시 토큰은 한 번 쓰면 폐기된다', async () => {
      const customer = await h.register('CUSTOMER');
      const refresh = (refreshToken: string) =>
        h.api().post('/api/auth/refresh').send({ refreshToken });

      const rotated = await refresh(customer.refreshToken).expect(200);
      expect(rotated.body.refreshToken).not.toBe(customer.refreshToken);
      await me(rotated.body.accessToken).expect(200);

      await refresh(customer.refreshToken).expect(401);
      await h
        .api()
        .post('/api/auth/logout')
        .send({ refreshToken: rotated.body.refreshToken })
        .expect(204);
      await refresh(rotated.body.refreshToken).expect(401);
    });
  });

  describe('비밀번호 찾기', () => {
    const request = (email: string) =>
      h.api().post('/api/auth/password-reset/request').send({ email });
    const confirm = (email: string, code: string, newPassword: string) =>
      h
        .api()
        .post('/api/auth/password-reset/confirm')
        .send({ email, code, newPassword });
    const wrongCodeFor = (code: string) =>
      code === '000000' ? '000001' : '000000';

    it('이메일로 받은 코드로 비밀번호를 바꾸면 모든 기기에서 로그아웃된다', async () => {
      const customer = await h.register('CUSTOMER');
      const { email } = customer.user;

      await request(email).expect(204);
      const code = h.resetCodes.get(email)!;
      expect(code).toMatch(/^\d{6}$/);
      // 코드 원문은 DB에 없다.
      const [stored] = await h.dataSource.query<{ code_hash: string }[]>(
        'SELECT code_hash FROM password_reset_codes WHERE user_id = $1',
        [customer.user.id],
      );
      expect(stored.code_hash).toHaveLength(64);
      expect(stored.code_hash).not.toContain(code);

      const wrong = await confirm(
        email,
        wrongCodeFor(code),
        'newpass456',
      ).expect(400);
      expect(wrong.body.code).toBe('INVALID_RESET_CODE');
      await confirm(email, code, 'short1').expect(400);
      expect(
        (await confirm(email, code, 'onlyletters').expect(400)).body.code,
      ).toBe('WEAK_PASSWORD');
      await login(email, PASSWORD).expect(200);

      await confirm(email, code, 'newpass456').expect(204);

      await login(email, PASSWORD).expect(401);
      await login(email, 'newpass456').expect(200);
      // 바꾸기 전에 로그인해 있던 기기는 토큰을 갱신할 수 없다.
      await h
        .api()
        .post('/api/auth/refresh')
        .send({ refreshToken: customer.refreshToken })
        .expect(401);
      // 한 번 쓴 코드는 다시 쓸 수 없다.
      await confirm(email, code, 'another789').expect(400);
    });

    it('가입하지 않은 이메일에도 똑같이 답한다 (가입 여부를 알려주지 않는다)', async () => {
      await request('nobody@test.dev').expect(204);

      expect(h.resetCodes.has('nobody@test.dev')).toBe(false);
      const refused = await confirm(
        'nobody@test.dev',
        '123456',
        'newpass456',
      ).expect(400);
      expect(refused.body.code).toBe('INVALID_RESET_CODE');
      await request('not-an-email').expect(400);
    });

    it('다섯 번 틀리면 맞는 코드도 받지 않고, 1분 안에는 코드를 다시 보내지 않는다', async () => {
      const { user } = await h.register('CUSTOMER');
      await request(user.email).expect(204);
      const code = h.resetCodes.get(user.email)!;

      // 바로 다시 요청해도 새 코드를 보내지 않는다.
      h.resetCodes.delete(user.email);
      await request(user.email).expect(204);
      expect(h.resetCodes.has(user.email)).toBe(false);

      for (let attempt = 0; attempt < 5; attempt += 1) {
        await confirm(user.email, wrongCodeFor(code), 'newpass456').expect(400);
      }
      await confirm(user.email, code, 'newpass456').expect(400);
      await login(user.email, PASSWORD).expect(200);

      // 1분이 지나면 새 코드를 받아 다시 시도할 수 있다.
      await h.dataSource.query(
        `UPDATE password_reset_codes SET created_at = created_at - interval '61 seconds' WHERE user_id = $1`,
        [user.id],
      );
      await request(user.email).expect(204);
      await confirm(
        user.email,
        h.resetCodes.get(user.email)!,
        'newpass456',
      ).expect(204);
    });
  });

  describe('내 정보', () => {
    it('이름·휴대폰 번호·마케팅 수신 동의를 바꾼다', async () => {
      const customer = await h.register('CUSTOMER');
      const patch = (body: object) =>
        h
          .api()
          .patch('/api/users/me')
          .set(h.bearer(customer.accessToken))
          .send(body);

      expect((await me(customer.accessToken).expect(200)).body).toMatchObject({
        id: customer.user.id,
        marketingAgreed: false,
      });

      const updated = await patch({
        name: ' 김지은 ',
        phone: '010-9999-8888',
        marketingAgreed: true,
      }).expect(200);
      expect(updated.body).toMatchObject({
        name: '김지은',
        phone: '01099998888',
        marketingAgreed: true,
        email: customer.user.email,
      });

      // 보낸 항목만 바뀐다.
      const partial = await patch({ marketingAgreed: false }).expect(200);
      expect(partial.body).toMatchObject({
        name: '김지은',
        marketingAgreed: false,
      });

      await patch({ phone: '02-123-4567' }).expect(400);
      await patch({ email: 'other@test.dev' }).expect(400);
      await patch({ role: 'ADMIN' }).expect(400);
    });
  });

  describe('회원 탈퇴', () => {
    const withdraw = (token: string, password: string) =>
      h
        .api()
        .post('/api/users/me/withdraw')
        .set(h.bearer(token))
        .send({ password });

    it('비밀번호를 확인하고, 끝나지 않은 주문이 없을 때만 탈퇴한다', async () => {
      const customer = await h.register('CUSTOMER');
      const { email, id } = customer.user;
      await h.registerDevice(customer.accessToken, 'leaving-phone');
      const order = await h.createOrder(customer.accessToken);

      const wrong = await withdraw(customer.accessToken, 'wrongpass1').expect(
        400,
      );
      expect(wrong.body.code).toBe('PASSWORD_MISMATCH');
      const busy = await withdraw(customer.accessToken, PASSWORD).expect(409);
      expect(busy.body.code).toBe('ORDER_IN_PROGRESS');

      await h
        .api()
        .post(`/api/orders/${order.id}/cancel`)
        .set(h.bearer(customer.accessToken))
        .send({})
        .expect(200);
      // 탈퇴하면 바로 지우는 것들: 자주 쓰는 주소, 알림 설정.
      await h
        .api()
        .post('/api/saved-addresses')
        .set(h.bearer(customer.accessToken))
        .send({
          label: '집',
          address: '서울 강남구 테헤란로 152',
          sigungu: '강남구',
          dong: '역삼동',
          latitude: 37.5,
          longitude: 127.0364,
        })
        .expect(201);
      await h
        .api()
        .patch('/api/notifications/settings')
        .set(h.bearer(customer.accessToken))
        .send({ pushEnabled: false })
        .expect(200);
      await withdraw(customer.accessToken, PASSWORD).expect(204);
      for (const table of ['saved_addresses', 'notification_settings']) {
        const [{ count }] = await h.dataSource.query<{ count: string }[]>(
          `SELECT count(*) FROM ${table} WHERE user_id = $1`,
          [id],
        );
        expect(`${table}: ${count}`).toBe(`${table}: 0`);
      }

      // 쓰던 토큰은 바로 못 쓰고, 다시 로그인할 수도 없다.
      await me(customer.accessToken).expect(401);
      await login(email, PASSWORD).expect(401);
      await h
        .api()
        .post('/api/auth/refresh')
        .send({ refreshToken: customer.refreshToken })
        .expect(401);

      // 개인정보는 지우고 기기 등록도 없앤다. 지난 주문 기록은 남는다.
      const [row] = await h.dataSource.query<Record<string, string>[]>(
        'SELECT email, name, phone, status, password_hash FROM users WHERE id = $1',
        [id],
      );
      expect(row).toMatchObject({
        status: 'WITHDRAWN',
        name: '탈퇴한 회원',
        password_hash: '',
      });
      expect(row.email).not.toBe(email);
      expect(
        await h.dataSource.query(
          'SELECT 1 FROM push_devices WHERE user_id = $1',
          [id],
        ),
      ).toEqual([]);
      expect(
        await h.dataSource.query(
          'SELECT 1 FROM orders WHERE customer_id = $1',
          [id],
        ),
      ).toHaveLength(1);

      // 같은 이메일로 다시 가입할 수 있다 (새 계정이다).
      const rejoined = await h.register('CUSTOMER', { email });
      expect(rejoined.user.id).not.toBe(id);
    });

    it('운행 중이던 기사가 탈퇴하면 더는 콜이 가지 않는다', async () => {
      const customer = await h.register('CUSTOMER');
      const leaving = await h.onlineDriver('DAMAS');
      const staying = await h.onlineDriver('DAMAS');
      await h.registerDevice(leaving.token, 'leaving-driver-phone');
      await h.registerDevice(staying.token, 'staying-driver-phone');

      // 배송 중에는 탈퇴할 수 없다.
      const inProgress = await h.orderAt(
        customer.accessToken,
        leaving.token,
        'pickup',
      );
      expect(
        (await withdraw(leaving.token, PASSWORD).expect(409)).body.code,
      ).toBe('ORDER_IN_PROGRESS');
      await h.dispatch(leaving.token, inProgress.id, 'complete').expect(200);

      await withdraw(leaving.token, PASSWORD).expect(204);

      const order = await h.createOrder(customer.accessToken);
      const push = await h.waitForPush(order.id, 'ORDER_REQUESTED');
      expect(push.tokens).toEqual(['staying-driver-phone']);
      const [driver] = await h.dataSource.query<{ available: boolean }[]>(
        'SELECT available FROM drivers WHERE id = $1',
        [leaving.driverId],
      );
      expect(driver.available).toBe(false);
      // 마지막 위치도 지운다.
      expect(
        await h.dataSource.query(
          'SELECT 1 FROM driver_locations WHERE driver_id = $1',
          [leaving.driverId],
        ),
      ).toEqual([]);
      // 고객의 지난 주문에는 배송한 기사가 '탈퇴한 회원'으로 남는다.
      const past = await h
        .api()
        .get(`/api/orders/${inProgress.id}`)
        .set(h.bearer(customer.accessToken))
        .expect(200);
      expect(past.body).toMatchObject({
        status: 'DELIVERED',
        driver: { name: '탈퇴한 회원' },
      });
    });
  });

  describe('주소 검색', () => {
    // e2e에는 카카오 키가 없어 견본 주소에서 찾는다 (실제 카카오 응답은 단위 테스트에서 본다).
    const search = (token: string, query: string) =>
      h.api().get('/api/address-search').query({ query }).set(h.bearer(token));

    it('주소와 건물 이름으로 찾고, 좌표와 구·동이 함께 온다', async () => {
      const customer = await h.register('CUSTOMER');

      const { body } = await search(
        customer.accessToken,
        '테헤란로 152',
      ).expect(200);

      expect(body).toEqual([
        {
          address: '서울 강남구 테헤란로 152',
          detail: '강남파이낸스센터',
          sigungu: '강남구',
          dong: '역삼동',
          latitude: 37.5,
          longitude: 127.0364,
        },
      ]);
      expect(
        (await search(customer.accessToken, '롯데월드타워').expect(200)).body,
      ).toMatchObject([{ address: '서울 송파구 올림픽로 300' }]);
      expect(
        (await search(customer.accessToken, '   ').expect(200)).body,
      ).toEqual([]);
    });

    it('로그인해야 하고, 검색어는 100자까지다', async () => {
      const customer = await h.register('CUSTOMER');

      await h.api().get('/api/address-search?query=테헤란로').expect(401);
      await search(customer.accessToken, '가'.repeat(101)).expect(400);
      await h
        .api()
        .get('/api/address-search')
        .set(h.bearer(customer.accessToken))
        .expect(400);
    });
  });

  describe('자주 쓰는 주소', () => {
    const OFFICE = {
      label: '역삼 사무실',
      address: '서울 강남구 테헤란로 152',
      detailAddress: '10층',
      sigungu: '강남구',
      dong: '역삼동',
      latitude: 37.5,
      longitude: 127.0364,
    };

    it('저장·수정·삭제하고, 남의 주소는 건드릴 수 없다', async () => {
      const customer = await h.register('CUSTOMER');
      const stranger = await h.register('CUSTOMER');
      const addresses = (token: string) =>
        h.api().get('/api/saved-addresses').set(h.bearer(token));
      const add = (token: string, body: object) =>
        h.api().post('/api/saved-addresses').set(h.bearer(token)).send(body);

      expect((await addresses(customer.accessToken).expect(200)).body).toEqual(
        [],
      );
      const { body: office } = await add(customer.accessToken, OFFICE).expect(
        201,
      );
      expect(office).toMatchObject(OFFICE);
      await add(customer.accessToken, {
        label: '집',
        address: '서울 마포구 양화로 45',
        latitude: 37.5502,
        longitude: 126.9138,
      }).expect(201);

      // 저장한 순서대로 온다.
      const mine = await addresses(customer.accessToken).expect(200);
      expect(mine.body.map((a: { label: string }) => a.label)).toEqual([
        '역삼 사무실',
        '집',
      ]);
      expect(mine.body[1]).toMatchObject({ detailAddress: null, dong: null });
      expect((await addresses(stranger.accessToken).expect(200)).body).toEqual(
        [],
      );

      const renamed = await h
        .api()
        .put(`/api/saved-addresses/${office.id}`)
        .set(h.bearer(customer.accessToken))
        .send({ ...OFFICE, label: '본사', detailAddress: undefined })
        .expect(200);
      expect(renamed.body).toMatchObject({
        id: office.id,
        label: '본사',
        detailAddress: null,
        createdAt: office.createdAt,
      });

      // 남의 주소는 고칠 수도 지울 수도 없다.
      await h
        .api()
        .put(`/api/saved-addresses/${office.id}`)
        .set(h.bearer(stranger.accessToken))
        .send(OFFICE)
        .expect(404);
      await h
        .api()
        .delete(`/api/saved-addresses/${office.id}`)
        .set(h.bearer(stranger.accessToken))
        .expect(204);
      expect(
        (await addresses(customer.accessToken).expect(200)).body,
      ).toHaveLength(2);

      await h
        .api()
        .delete(`/api/saved-addresses/${office.id}`)
        .set(h.bearer(customer.accessToken))
        .expect(204);
      expect(
        (await addresses(customer.accessToken).expect(200)).body.map(
          (a: { label: string }) => a.label,
        ),
      ).toEqual(['집']);

      await add(customer.accessToken, { ...OFFICE, label: '' }).expect(400);
      await add(customer.accessToken, { ...OFFICE, latitude: 91 }).expect(400);
      await h.api().get('/api/saved-addresses').expect(401);
    });

    it('스무 곳까지만 저장한다', async () => {
      const customer = await h.register('CUSTOMER');
      const add = (n: number) =>
        h
          .api()
          .post('/api/saved-addresses')
          .set(h.bearer(customer.accessToken))
          .send({ ...OFFICE, label: `주소 ${n}` });
      for (let n = 1; n <= 20; n += 1) {
        await add(n).expect(201);
      }

      const full = await add(21).expect(409);

      expect(full.body.code).toBe('TOO_MANY_SAVED_ADDRESSES');
    });

    it('저장한 주소로 배송을 요청할 수 있다', async () => {
      const customer = await h.register('CUSTOMER');
      const { body: saved } = await h
        .api()
        .post('/api/saved-addresses')
        .set(h.bearer(customer.accessToken))
        .send(OFFICE)
        .expect(201);
      const { id: _id, label: _label, createdAt: _at, ...place } = saved;

      const order = await h.createOrder(customer.accessToken, {
        ...DAMAS_ORDER,
        pickup: {
          ...place,
          contactName: '김고객',
          contactPhone: '01011112222',
        },
      });

      expect(order.pickup).toMatchObject({
        address: OFFICE.address,
        sigungu: '강남구',
        dong: '역삼동',
      });
    });
  });
});

import { createHarness, Harness } from './support/harness.js';

describe('공지 · 약관 · 고객센터 (e2e)', () => {
  let h: Harness;

  beforeAll(async () => {
    h = await createHarness();
  });
  afterAll(() => h.close());

  describe('공지사항', () => {
    const publish = (token: string, body: object) =>
      h.api().post('/api/admin/notices').set(h.bearer(token)).send(body);
    const titles = async (token: string, query = '') =>
      (
        await h
          .api()
          .get(`/api/notices${query}`)
          .set(h.bearer(token))
          .expect(200)
      ).body.items.map((item: { title: string }) => item.title) as string[];

    it('회원은 자기 앱에 해당하는 공지만 본다', async () => {
      const customer = await h.register('CUSTOMER');
      const driver = await h.register('DRIVER');
      const { body: forAll } = await publish(h.adminToken, {
        title: ' 추석 연휴 배송 안내 ',
        body: '연휴 기간에는 배차가 늦어질 수 있어요.',
      }).expect(201);
      expect(forAll).toMatchObject({
        title: '추석 연휴 배송 안내',
        audience: 'ALL',
      });
      const { body: forCustomers } = await publish(h.adminToken, {
        title: '첫 주문 할인',
        body: '첫 주문은 3,000원 할인돼요.',
        audience: 'CUSTOMER',
      }).expect(201);
      const { body: forDrivers } = await publish(h.adminToken, {
        title: '정산일 변경 안내',
        body: '정산일이 금요일로 바뀌어요.',
        audience: 'DRIVER',
      }).expect(201);

      // 최근 것부터 온다. 목록에는 본문이 없다.
      expect(await titles(customer.accessToken)).toEqual([
        '첫 주문 할인',
        '추석 연휴 배송 안내',
      ]);
      expect(await titles(driver.accessToken)).toEqual([
        '정산일 변경 안내',
        '추석 연휴 배송 안내',
      ]);
      expect(await titles(h.adminToken)).toHaveLength(3);
      expect(await titles(customer.accessToken, '?size=1')).toEqual([
        '첫 주문 할인',
      ]);
      const list = await h
        .api()
        .get('/api/notices')
        .set(h.bearer(customer.accessToken))
        .expect(200);
      expect(list.body).toMatchObject({ total: 2, page: 1, size: 20 });
      expect(list.body.items[0]).not.toHaveProperty('body');

      const get = (token: string, id: string) =>
        h.api().get(`/api/notices/${id}`).set(h.bearer(token));
      expect(
        (await get(customer.accessToken, forCustomers.id).expect(200)).body,
      ).toMatchObject({
        title: '첫 주문 할인',
        body: '첫 주문은 3,000원 할인돼요.',
        publishedAt: expect.any(String),
      });
      // 다른 앱 대상 공지는 없는 것처럼 답한다.
      await get(customer.accessToken, forDrivers.id).expect(404);
      await get(driver.accessToken, forCustomers.id).expect(404);
      await get(driver.accessToken, forAll.id).expect(200);
      await h.api().get('/api/notices').expect(401);

      // 내린 공지는 사라진다.
      await h
        .api()
        .delete(`/api/admin/notices/${forAll.id}`)
        .set(h.bearer(h.adminToken))
        .expect(204);
      expect(await titles(driver.accessToken)).toEqual(['정산일 변경 안내']);
      await get(driver.accessToken, forAll.id).expect(404);
    });

    it('운영자만 공지를 올리고 내린다', async () => {
      const customer = await h.register('CUSTOMER');
      const { body: notice } = await publish(h.adminToken, {
        title: '점검 안내',
        body: '새벽 2시부터 30분간 점검해요.',
      }).expect(201);

      await publish(customer.accessToken, {
        title: '가짜 공지',
        body: '내용',
      }).expect(403);
      await h
        .api()
        .delete(`/api/admin/notices/${notice.id}`)
        .set(h.bearer(customer.accessToken))
        .expect(403);
      await publish(h.adminToken, { title: '', body: '내용' }).expect(400);
      await publish(h.adminToken, {
        title: '대상 오류',
        body: '내용',
        audience: 'EVERYONE',
      }).expect(400);
    });
  });

  describe('약관 · 정책', () => {
    const publish = (token: string, body: object) =>
      h
        .api()
        .post('/api/admin/legal-documents')
        .set(h.bearer(token))
        .send(body);
    const TERMS = {
      type: 'TERMS',
      version: '1',
      title: '서비스 이용약관',
      body: '제1조 (목적) 이 약관은 …',
    };

    it('가입 전에도 볼 수 있고, 시행 중인 판을 보여준다', async () => {
      const customer = await h.register('CUSTOMER');
      // 아직 아무것도 올리지 않았다.
      expect(
        (await h.api().get('/api/legal/documents').expect(200)).body,
      ).toEqual([]);
      await h.api().get('/api/legal/documents/TERMS').expect(404);
      await h.api().get('/api/legal/documents/COOKIES').expect(400);

      await publish(customer.accessToken, TERMS).expect(403);
      const { body: first } = await publish(h.adminToken, TERMS).expect(201);
      expect(first).toMatchObject({
        type: 'TERMS',
        version: '1',
        status: 'CURRENT',
      });
      await publish(h.adminToken, {
        type: 'PRIVACY',
        version: '1',
        title: '개인정보 처리방침',
        body: '1. 수집하는 항목 …',
      }).expect(201);
      // 이제 가입하면 시행 중인 판(1)에 동의한 것으로 남는다. 마케팅에 동의하지 않으면 남기지 않는다.
      const joined = await h.register('CUSTOMER');
      expect(
        await h.dataSource.query(
          'SELECT type, version FROM legal_consents WHERE user_id = $1 ORDER BY type',
          [joined.user.id],
        ),
      ).toEqual([
        { type: 'PRIVACY', version: '1' },
        { type: 'TERMS', version: '1' },
      ]);

      // 판 번호는 마지막 판보다 커야 한다 (지난 판은 덮어쓰지 않는다).
      const duplicate = await publish(h.adminToken, TERMS).expect(400);
      expect(duplicate.body.code).toBe('DOCUMENT_VERSION_NOT_NEWER');

      // 로그인 없이: 목록에는 본문이 없고, 상세에 본문이 있다.
      const list = await h.api().get('/api/legal/documents').expect(200);
      expect(list.body).toMatchObject([
        { type: 'TERMS', version: '1', title: '서비스 이용약관' },
        { type: 'PRIVACY', version: '1' },
      ]);
      expect(list.body[0]).not.toHaveProperty('body');
      const terms = () => h.api().get('/api/legal/documents/TERMS').expect(200);
      expect((await terms()).body).toMatchObject({
        version: '1',
        body: TERMS.body,
        effectiveAt: expect.any(String),
      });

      // 시행일이 아직 오지 않은 새 판은 보이지 않는다.
      await publish(h.adminToken, {
        ...TERMS,
        version: '2',
        body: '제1조 (목적) 고친 약관 …',
        effectiveAt: new Date(Date.now() + 86_400_000).toISOString(),
      }).expect(201);
      expect((await terms()).body.version).toBe('1');

      // 시행일이 지난 새 판을 올리면 그 판으로 바뀐다. 지난 판은 DB에 남는다.
      await publish(h.adminToken, {
        ...TERMS,
        version: '3',
        body: '제1조 (목적) 조금 고친 약관 …',
      }).expect(201);
      expect((await terms()).body).toMatchObject({
        version: '3',
        body: '제1조 (목적) 조금 고친 약관 …',
      });
      const versions = await h.dataSource.query<{ version: string }[]>(
        `SELECT version FROM legal_documents WHERE type = 'TERMS' ORDER BY version`,
      );
      expect(versions.map((row) => row.version)).toEqual(['1', '2', '3']);

      // 운영자 화면: 모든 판이 상태와 등록자와 함께 온다 (판 번호가 큰 것부터).
      const { body: all } = await h
        .api()
        .get('/api/admin/legal-documents')
        .set(h.bearer(h.adminToken))
        .expect(200);
      expect(
        all
          .filter((each: { type: string }) => each.type === 'TERMS')
          .map((each: { version: string; status: string }) => [
            each.version,
            each.status,
          ]),
      ).toEqual([
        ['3', 'CURRENT'],
        ['2', 'SCHEDULED'],
        ['1', 'PAST'],
      ]);
      expect(all[0]).toMatchObject({
        createdByName: expect.any(String),
        body: expect.any(String),
      });

      // 기사 운송 약관은 고객 앱에는 보이지 않는다.
      await publish(h.adminToken, {
        type: 'DRIVER',
        version: '1',
        title: '기사 운송 약관',
        body: '제1조 (목적) …',
      }).expect(201);
      const typesFor = async (audience: string) =>
        (
          await h.api().get(`/api/legal/documents?audience=${audience}`)
        ).body.map((each: { type: string }) => each.type);
      expect(await typesFor('DRIVER')).toContain('DRIVER');
      expect(await typesFor('CUSTOMER')).not.toContain('DRIVER');

      await publish(h.adminToken, { ...TERMS, type: 'COOKIES' }).expect(400);
      await publish(h.adminToken, { ...TERMS, version: '' }).expect(400);
      await publish(h.adminToken, { ...TERMS, version: '4.1' }).expect(400);
    });
  });

  describe('고객센터', () => {
    it('연락처는 로그인 없이 볼 수 있고, 설정하지 않은 값은 null이다', async () => {
      const { body } = await h.api().get('/api/support/contact').expect(200);

      expect(body).toEqual({
        phone: '1588-0000',
        email: null,
        hours: '평일 09:00~18:00',
        kakaoChannelUrl: null,
      });
    });
  });
});

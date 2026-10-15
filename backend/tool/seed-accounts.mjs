// 앱과 운영자 웹을 직접 써 볼 테스트 계정(고객 1, 기사 2, 운영자 1)을 만든다. 개발용 DB에서만 돈다.
//
//   1) 서버를 띄운다:   npm run start:local
//   2) 계정 만들기:     node tool/seed-accounts.mjs [서버 주소]
//
// 다시 돌려도 된다 — 이미 있는 계정은 비밀번호를 되돌리고 빠진 것(기사 승인, 카드 등)만 채운다.
// 견본 데이터(seed-demo)도 넣으려면 그것을 먼저 돌린다 — seed-demo는 비어 있는 DB에서만 돈다.
//
// 비밀번호 12341234는 가입 규칙(영문과 숫자 포함)에 맞지 않는다. 그래서 가입은 규칙에 맞는 임시
// 비밀번호로 실제 API를 타고, 비밀번호만 DB에 직접 넣는다. 로그인은 규칙을 보지 않는다.
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { config as loadEnv } from 'dotenv';
import pg from 'pg';
import { DRIVER_DOCUMENTS } from './sample-documents.mjs';

loadEnv({ path: `.env.${process.env.APP_ENV ?? 'local'}`, quiet: true });
loadEnv({ quiet: true });

const API = (process.argv[2] ?? 'http://localhost:4000/api').replace(/\/+$/, '');
const PASSWORD = '12341234';

const CUSTOMER = { email: 'zzsdsdsd@gmail.com', name: '테스트 고객', phone: '01000000001' };
// 둘 다 다마스 — 같은 콜을 두 기사가 함께 보고 먼저 수락하는 쪽이 가져가는 것까지 시험할 수 있다.
// 예금주는 가입한 이름과 같게 둔다 — 그래야 계좌 본인 확인이 되어 정산이 보류되지 않는다.
const DRIVERS = [
  {
    email: 'zzsdsdsd92@daum.net',
    name: '테스트 기사',
    phone: '01000000002',
    vehicleType: 'DAMAS',
    vehicleNumber: '서울80가1234',
    account: { bankName: '국민', accountNumber: '12340000012341' },
  },
  {
    email: 'driver1@naver.com',
    name: '테스트 기사2',
    phone: '01000000003',
    vehicleType: 'DAMAS',
    vehicleNumber: '서울80가5678',
    account: { bankName: '신한', accountNumber: '12340000056781' },
  },
];
const ADMIN = { email: 'gimsuman92@naver.com', name: '테스트 관리자', phone: '01000000000' };
// 개발용 PG 연동의 카드 — 앱의 개발용 카드 등록 화면과 같은 인증 키. 끝자리 0001~0005, 0009는 결제가 실패하는 카드다.
const CARD = 'dev:신한카드:4821:CREDIT';

if (process.env.NODE_ENV === 'production') {
  throw new Error('운영 환경에서는 테스트 계정을 만들지 않아요.');
}
const db = new pg.Client({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
});
await db.connect();
const sql = (text, params = []) => db.query(text, params).then((r) => r.rows);

async function call(method, path, { token, body, form, missingOk = false } = {}) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(token && { Authorization: `Bearer ${token}` }),
      ...(body && { 'Content-Type': 'application/json' }),
    },
    body: form ?? (body && JSON.stringify(body)),
  });
  const text = await response.text();
  if (missingOk && response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`${method} ${path} → ${response.status} ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

/** 계정이 없으면 가입시키고, 비밀번호를 PASSWORD로 맞춘 뒤 로그인한 토큰을 돌려준다. */
async function ensureAccount(role, { email, name, phone }) {
  let [user] = await sql(`SELECT id, role, status FROM users WHERE email = $1`, [email]);
  if (!user) {
    const session = await call('POST', '/auth/register', {
      body: {
        email,
        password: `Tmp${randomBytes(6).toString('hex')}1`,
        name,
        phone,
        role,
        agreements: { terms: true, privacy: true, marketing: false },
      },
    });
    user = { id: session.user.id, role, status: 'ACTIVE', created: true };
  }
  if (user.status !== 'ACTIVE') {
    throw new Error(`${email}은(는) ${user.status} 상태라 쓸 수 없어요.`);
  }
  await sql(`UPDATE users SET password_hash = $2, version = version + 1 WHERE id = $1`, [
    user.id,
    await bcrypt.hash(PASSWORD, 10),
  ]);
  return { ...user, email };
}

const login = async (email) =>
  (await call('POST', '/auth/login', { body: { email, password: PASSWORD } })).accessToken;

try {
  // ---- 운영자 — 가입시킨 뒤 최고 관리자로 올린다 (admin:promote와 같은 일) ----
  const admin = await ensureAccount('CUSTOMER', ADMIN);
  await sql(`UPDATE users SET role = 'ADMIN', version = version + 1 WHERE id = $1 AND role <> 'ADMIN'`, [
    admin.id,
  ]);
  await sql(
    `INSERT INTO admin_accounts (id, role, status, version) VALUES ($1, 'SUPER', 'ACTIVE', 1)
     ON CONFLICT (id) DO UPDATE
       SET role = 'SUPER', status = 'ACTIVE', invitation_token_hash = NULL,
           invitation_expires_at = NULL, version = admin_accounts.version + 1`,
    [admin.id],
  );
  const adminToken = await login(ADMIN.email);

  // ---- 기사 — 서류, 등록 신청, 승인, 정산 계좌 ----
  const driverUsers = [];
  for (const DRIVER of DRIVERS) {
    const driverUser = await ensureAccount('DRIVER', DRIVER);
    if (driverUser.role !== 'DRIVER') {
      throw new Error(`${DRIVER.email}은(는) 기사 계정이 아니에요 (${driverUser.role}).`);
    }
    const driverToken = await login(DRIVER.email);
    let driver = await call('GET', '/drivers/me', { token: driverToken, missingOk: true });
    if (!driver) {
      for (const [type, [bytes, contentType, filename]] of Object.entries(DRIVER_DOCUMENTS)) {
        const form = new FormData();
        form.append('file', new Blob([bytes], { type: contentType }), filename);
        await call('PUT', `/drivers/me/documents/${type}`, { token: driverToken, form });
      }
      driver = await call('POST', '/drivers', {
        token: driverToken,
        body: { vehicleType: DRIVER.vehicleType, vehicleNumber: DRIVER.vehicleNumber },
      });
    }
    if (driver.status === 'PENDING') {
      await call('PATCH', `/admin/drivers/${driver.id}/approve`, { token: adminToken });
    } else if (driver.status !== 'APPROVED') {
      throw new Error(`${DRIVER.email} 기사는 ${driver.status} 상태예요. 운영자 웹에서 확인해 주세요.`);
    }
    const account = await call('GET', '/drivers/me/settlement-account', {
      token: driverToken,
      missingOk: true,
    });
    if (account?.verificationStatus !== 'VERIFIED') {
      await call('PUT', '/drivers/me/settlement-account', {
        token: driverToken,
        body: { ...DRIVER.account, accountHolder: DRIVER.name },
      });
    }
    driverUsers.push(driverUser);
  }

  // ---- 고객 — 결제 카드 ----
  const customer = await ensureAccount('CUSTOMER', CUSTOMER);
  if (customer.role !== 'CUSTOMER') {
    throw new Error(`${CUSTOMER.email}은(는) 고객 계정이 아니에요 (${customer.role}).`);
  }
  const customerToken = await login(CUSTOMER.email);
  const cards = await call('GET', '/payment-methods', { token: customerToken });
  if (cards.length === 0) {
    await call('POST', '/payment-methods', { token: customerToken, body: { authKey: CARD } });
  }

  for (const [label, user] of [
    ['고객', customer],
    ...driverUsers.map((user) => ['기사', user]),
    ['운영자', admin],
  ]) {
    console.log(`${label}  ${user.email}  ${user.created ? '새로 만듦' : '이미 있음 — 비밀번호를 되돌림'}`);
  }
  console.log(`비밀번호는 모두 ${PASSWORD}`);
} finally {
  await db.end();
}

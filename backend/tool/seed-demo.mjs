// 운영자 웹을 채워 볼 견본 데이터를 넣는다. 비어 있는 개발용 DB에서만 돈다.
//
//   1) 서버를 띄운다:  npm run start:local
//   2) 견본 넣기:      node tool/seed-demo.mjs [서버 주소]
//
// 회원·기사·주문은 실제 API로 만들고(서버의 규칙을 그대로 탄다), 날짜를 과거로 옮기는 일과
// 운영자 계정 만들기만 DB에 직접 한다. 서버와 같은 .env.<APP_ENV>에서 DB 접속 정보를 읽는다.
// 모든 계정의 비밀번호는 movo1234, 최고 관리자는 haeun.jung@movo.kr이다.
import { config as loadEnv } from 'dotenv';
import pg from 'pg';
import { DRIVER_DOCUMENTS as FILES } from './sample-documents.mjs';

loadEnv({ path: `.env.${process.env.APP_ENV ?? 'local'}`, quiet: true });
loadEnv({ quiet: true });

const API = (process.argv[2] ?? 'http://localhost:4000/api').replace(/\/+$/, '');
const PASSWORD = 'movo1234';
const DAY = 86_400_000;

if (process.env.NODE_ENV === 'production') {
  throw new Error('운영 환경에서는 견본 데이터를 넣지 않아요.');
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

const [{ count: existing }] = await sql(
  `SELECT (SELECT COUNT(*) FROM orders) + (SELECT COUNT(*) FROM drivers) AS count`,
);
if (Number(existing) > 0) {
  await db.end();
  throw new Error(
    `이미 데이터가 있는 DB예요 (${process.env.DB_DATABASE}). 비어 있는 DB에서만 넣을 수 있어요.`,
  );
}

async function call(method, path, { token, body, form } = {}) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(token && { Authorization: `Bearer ${token}` }),
      ...(body && { 'Content-Type': 'application/json' }),
    },
    body: form ?? (body && JSON.stringify(body)),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${method} ${path} → ${response.status} ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

async function register(role, name, email, phone) {
  const session = await call('POST', '/auth/register', {
    body: {
      email,
      password: PASSWORD,
      name,
      phone,
      role,
      agreements: { terms: true, privacy: true, marketing: false },
    },
  });
  return { id: session.user.id, token: session.accessToken, name, email };
}

async function upload(token, type) {
  const [bytes, contentType, filename] = FILES[type];
  const form = new FormData();
  form.append('file', new Blob([bytes], { type: contentType }), filename);
  await call('PUT', `/drivers/me/documents/${type}`, { token, form });
}

async function applyAsDriver(name, email, phone, vehicleType, vehicleNumber) {
  const account = await register('DRIVER', name, email, phone);
  for (const type of Object.keys(FILES)) {
    await upload(account.token, type);
  }
  const driver = await call('POST', '/drivers', {
    token: account.token,
    body: { vehicleType, vehicleNumber },
  });
  return { ...account, driverId: driver.id, vehicleType };
}

// ---- 운영자 ----
// 운영자는 가입으로 만들 수 없어, 가입시킨 뒤 DB에서 역할을 올린다 (admin:promote와 같은 일).
const ADMINS = [
  ['정하은', 'haeun.jung@movo.kr', 'SUPER', 'ACTIVE'],
  ['김태윤', 'taeyoon.kim@movo.kr', 'OPS', 'ACTIVE'],
  ['박소라', 'sora.park@movo.kr', 'OPS', 'ACTIVE'],
  ['최현우', 'hyunwoo.choi@movo.kr', 'FINANCE', 'ACTIVE'],
  ['이준기', 'junki.lee@movo.kr', 'OPS', 'INACTIVE'],
];
const admins = {};
for (const [name, email, role, status] of ADMINS) {
  const account = await register('CUSTOMER', name, email, '01000000000');
  await sql(`UPDATE users SET role = 'ADMIN', version = version + 1 WHERE id = $1`, [account.id]);
  await sql(
    `INSERT INTO admin_accounts (id, role, status, version) VALUES ($1, $2, $3, 1)`,
    [account.id, role, status],
  );
  admins[name] = account;
}
const login = async (name) =>
  (await call('POST', '/auth/login', { body: { email: admins[name].email, password: PASSWORD } }))
    .accessToken;
const haeun = await login('정하은');
const taeyoon = await login('김태윤');
const hyunwoo = await login('최현우');
console.log('운영자 5명');

// ---- 기사 ----
const approve = (token, driver) =>
  call('PATCH', `/admin/drivers/${driver.driverId}/approve`, { token });
const reject = (token, driver, reason, rejectedDocuments) =>
  call('PATCH', `/admin/drivers/${driver.driverId}/reject`, {
    token,
    body: { reason, rejectedDocuments },
  });

// 이미 일하고 있는 기사들. 정산 계좌가 있고, 견본 주문을 나른다.
const WORKING = [
  ['문지성', 'jisung.moon@gmail.com', '01022017783', 'DAMAS', '서울85자3412', '국민', '10293847564821'],
  ['배수빈', 'subin.bae@naver.com', '01066391402', 'DAMAS', '경기82아5106', null, null],
  ['조은호', 'eunho.cho@daum.net', '01099273364', 'LABO', '인천86사7720', '신한', '11029384750372'],
  ['홍석진', 'seokjin.hong@gmail.com', '01011865520', 'TRUCK_1T', '서울80바2291', '카카오뱅크', '33330198769915'],
  ['류강현', 'kanghyun.ryu@gmail.com', '01044108857', 'MOTORCYCLE', '서울마포가4471', '기업', '00129384753058'],
  ['윤태경', 'taekyung.yoon@gmail.com', '01088203195', 'TRUCK_2_5T', '경기96아3390', '우리', '10029384756603'],
  ['오세영', 'seyoung.oh@gmail.com', '01044579902', 'DAMAS', '서울85사2048', '하나', '29384756102287'],
  ['한상우', 'sangwoo.han@naver.com', '01091834470', 'TRUCK_1T', '서울87자6634', '농협', '30129384757140'],
];
const drivers = [];
for (const [name, email, phone, vehicleType, plate, bankName, accountNumber] of WORKING) {
  const driver = await applyAsDriver(name, email, phone, vehicleType, plate);
  await approve(drivers.length % 2 ? taeyoon : haeun, driver);
  await call('PATCH', '/drivers/me/availability', { token: driver.token, body: { available: true } });
  if (bankName) {
    // 윤태경은 예금주를 잘못 적어 계좌 본인 확인이 안 된 기사다 (정산 보류).
    const accountHolder = name === '윤태경' ? '윤태겸' : name;
    await call('PUT', '/drivers/me/settlement-account', {
      token: driver.token,
      body: { bankName, accountNumber, accountHolder },
    });
  }
  drivers.push(driver);
}

// 심사 화면에 보일 신청들.
const pending = [
  ['김도현', 'dohyun.kim@gmail.com', '01048213307', 'DAMAS', '경기85자3412'],
  ['박지훈', 'jihoon.p@gmail.com', '01077310452', 'LABO', '인천86사7721'],
  ['최유진', 'yujin.choi@daum.net', '01050128836', 'TRUCK_1T', '경기82아5107'],
  ['정민호', 'minho.jung@gmail.com', '01033486620', 'TRUCK_2_5T', '경기89바1187'],
];
for (const each of pending) {
  await applyAsDriver(...each);
}
// 반려된 뒤 서류를 다시 올려 재신청한 기사.
const reapplied = await applyAsDriver('이서준', 'seojun.lee@naver.com', '01022901184', 'TRUCK_1T', '서울80바2292');
await reject(taeyoon, reapplied, '자동차등록증 사진이 흐려 차량번호를 확인할 수 없어요.', ['VEHICLE_REGISTRATION']);
await upload(reapplied.token, 'VEHICLE_REGISTRATION');
await call('POST', '/drivers', {
  token: reapplied.token,
  body: { vehicleType: 'TRUCK_1T', vehicleNumber: '서울80바2292' },
});
// 반려된 채로 있는 기사들.
await reject(
  taeyoon,
  await applyAsDriver('장하늘', 'haneul.j@gmail.com', '01066042219', 'LABO', '인천84자9012'),
  '자동차등록증 사진이 흐려 차량번호를 확인할 수 없어요. 밝은 곳에서 다시 찍어 올려 주세요.',
  ['VEHICLE_REGISTRATION'],
);
await reject(
  haeun,
  await applyAsDriver('서경민', 'kyungmin.seo@daum.net', '01027165583', 'TRUCK_1T', '경기81자4471'),
  '화물운송 종사 자격증의 유효기간이 지났어요. 갱신한 자격증을 올려 주세요.',
  ['FREIGHT_QUALIFICATION'],
);
console.log(`기사 ${drivers.length + pending.length + 3}명 (승인 ${drivers.length}, 심사 대기 ${pending.length + 1}, 반려 2)`);

// ---- 고객과 주문 ----
const CUSTOMERS = [
  ['김민지', 'minji.kim@gmail.com', '01033812047'],
  ['이수현', 'soohyun.lee@naver.com', '01077201935'],
  ['박준영', 'junyoung.park@gmail.com', '01028476610'],
  ['최서연', 'seoyeon.c@daum.net', '01090143378'],
  ['정우진', 'woojin.jung@gmail.com', '01055308812'],
  ['강하린', 'harin.kang@naver.com', '01061274409'],
  ['임채원', 'chaewon.lim@gmail.com', '01044982271'],
  ['한도윤', 'doyoon.han@gmail.com', '01088625104'],
  ['오예린', 'yerin.oh@naver.com', '01031057726'],
  ['신재민', 'jaemin.shin@gmail.com', '01072460918'],
];
const customers = [];
// 개발용 PG 연동의 카드 — 앱의 개발용 카드 등록 화면과 같은 인증 키를 보낸다.
const CARDS = [
  ['신한카드', 'CREDIT'],
  ['국민카드', 'CHECK'],
  ['현대카드', 'CREDIT'],
  ['삼성카드', 'CREDIT'],
  ['우리카드', 'CHECK'],
];
for (const [index, [name, email, phone]] of CUSTOMERS.entries()) {
  const customer = await register('CUSTOMER', name, email, phone);
  const [brand, type] = CARDS[index % CARDS.length];
  const last4 = String(4821 + index * 137).slice(-4);
  await call('POST', '/payment-methods', {
    token: customer.token,
    body: { authKey: `dev:${brand}:${last4}:${type}` },
  });
  customers.push(customer);
}
// 한도 초과로 결제가 안 되는 카드(끝 0001)를 기본 카드로 둔 고객 — 결제 실패 주문에 쓴다.
const declined = customers.find((customer) => customer.name === '오예린');
await call('POST', '/payment-methods', {
  token: declined.token,
  body: { authKey: 'dev:롯데카드:0001:CREDIT', makeDefault: true },
});

const PLACES = [
  ['서울 성동구 성수이로 113', '성동구', '성수동2가', 37.5446, 127.0559],
  ['서울 강남구 테헤란로 152', '강남구', '역삼동', 37.5, 127.0364],
  ['서울 마포구 양화로 45', '마포구', '합정동', 37.5502, 126.9138],
  ['서울 송파구 법원로 128', '송파구', '문정동', 37.4858, 127.1226],
  ['서울 금천구 가산디지털1로 168', '금천구', '가산동', 37.4792, 126.8826],
  ['서울 마포구 월드컵북로 396', '마포구', '상암동', 37.5796, 126.8897],
  ['서울 영등포구 여의대로 108', '영등포구', '여의도동', 37.5259, 126.9258],
  ['서울 강남구 학동로 402', '강남구', '논현동', 37.5172, 127.0412],
  ['서울 구로구 디지털로 300', '구로구', '구로동', 37.4849, 126.8966],
  ['서울 중구 을지로 100', '중구', '을지로2가', 37.5663, 126.9882],
];
const waypoint = ([address, sigungu, dong, latitude, longitude], contactName) => ({
  address,
  sigungu,
  dong,
  latitude,
  longitude,
  contactName,
  contactPhone: '01012345678',
});

/** 결정적인 난수 — 넣을 때마다 같은 견본이 나오게 한다. */
let seed = 20261013;
const random = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const pick = (list) => list[Math.floor(random() * list.length)];

const HELP = ['NONE', 'NONE', 'NONE', 'TOGETHER', 'DRIVER_ONLY'];
const floorAccess = () =>
  random() < 0.7 ? { floor: 1, elevator: true } : { floor: 2 + Math.floor(random() * 3), elevator: random() < 0.5 };

/**
 * 주문 하나를 만들고 [stage]까지 진행시킨다.
 * stage: requested | paymentFailed | assigned | departed | arrived | pickedUp | delivered
 *        | cancelled(배차 전) | cancelledAfterDeparture | noShow
 */
async function order(stage, driver = pick(drivers)) {
  const customer =
    stage === 'paymentFailed' ? declined : pick(customers.filter((each) => each !== declined));
  const from = pick(PLACES);
  let to = pick(PLACES);
  while (to === from) to = pick(PLACES);
  const created = await call('POST', '/orders', {
    token: customer.token,
    body: {
      vehicleType: driver.vehicleType,
      pickup: waypoint(from, customer.name),
      dropoff: waypoint(to, '받는 분'),
      cargo: { category: 'BOX', weightKg: 10, quantity: 2 },
      loadingHelp: pick(HELP),
      pickupAccess: floorAccess(),
      dropoffAccess: floorAccess(),
    },
  });
  const dispatch = (action, body) =>
    call('POST', `/dispatch/orders/${created.id}/${action}`, { token: driver.token, body });
  const cancel = () =>
    call('POST', `/orders/${created.id}/cancel`, {
      token: customer.token,
      body: { reason: '일정이 바뀌었어요' },
    });
  if (stage === 'cancelled') {
    await cancel();
  } else if (stage === 'paymentFailed') {
    await dispatch('accept').catch(() => {}); // 409 PAYMENT_DECLINED
  } else if (stage !== 'requested') {
    await dispatch('accept');
    if (stage === 'assigned') return created.id;
    await dispatch('depart');
    if (stage === 'cancelledAfterDeparture') {
      await cancel();
      return created.id;
    }
    if (stage === 'departed') return created.id;
    await dispatch('arrive');
    if (stage === 'noShow') {
      await sql(`UPDATE orders SET arrived_at = now() - interval '31 minutes' WHERE id = $1`, [created.id]);
      await dispatch('no-show');
      return created.id;
    }
    if (stage === 'arrived') return created.id;
    // 몇몇은 기다리게 했고(대기료), 몇몇은 실제 짐이 달라 추가 요금을 넣었다.
    if (random() < 0.25) {
      // 도착을 앞당기면 그 앞 단계(요청·배차·출발)도 함께 앞당긴다.
      await sql(
        `UPDATE orders SET arrived_at = now() - make_interval(mins => $2),
           departed_at = now() - make_interval(mins => $2 + 6),
           assigned_at = now() - make_interval(mins => $2 + 7),
           requested_at = now() - make_interval(mins => $2 + 8)
         WHERE id = $1`,
        [created.id, 11 + Math.floor(random() * 12)],
      );
    }
    await dispatch(
      'pickup',
      random() < 0.15 ? { overload: 1, bulky: random() < 0.5 ? 1 : 0, stairs: 0 } : {},
    );
    if (stage === 'delivered') {
      await dispatch('complete');
      if (random() < 0.6) {
        await call('POST', `/orders/${created.id}/review`, {
          token: customer.token,
          body: { rating: random() < 0.75 ? 5 : 4, tags: ['KIND'] },
        });
      }
    }
  }
  return created.id;
}

/** 주문의 모든 시각을 [daysAgo]일 전의 [hour]시 무렵으로 옮긴다 (결제·환불 기록도 함께). */
async function backdate(orderId, daysAgo, hour) {
  const at = new Date(Date.now() - daysAgo * DAY);
  at.setUTCHours(hour - 9, Math.floor(random() * 60), 0, 0);
  const [{ requested_at: requestedAt }] = await sql(`SELECT requested_at FROM orders WHERE id = $1`, [orderId]);
  // 결제·환불 기록은 주문과 같은 만큼 옮긴다.
  const moved = (column) => `${column} + ($2::timestamptz - $3::timestamptz)`;
  await sql(
    `UPDATE order_charges SET approved_at = ${moved('approved_at')}, failed_at = ${moved('failed_at')},
       cancelled_at = ${moved('cancelled_at')}, created_at = ${moved('created_at')}
     WHERE order_id = $1`,
    [orderId, at, requestedAt],
  );
  await sql(`UPDATE order_refunds SET created_at = ${moved('created_at')} WHERE order_id = $1`, [
    orderId,
    at,
    requestedAt,
  ]);
  const shift = `$2::timestamptz + (COALESCE(%s, requested_at) - requested_at)`;
  await sql(
    `UPDATE orders SET
       assigned_at = ${shift.replace('%s', 'assigned_at')},
       departed_at = ${shift.replace('%s', 'departed_at')} + interval '1 minute',
       arrived_at = ${shift.replace('%s', 'arrived_at')} + interval '14 minutes',
       picked_up_at = ${shift.replace('%s', 'picked_up_at')} + interval '18 minutes',
       delivered_at = ${shift.replace('%s', 'delivered_at')} + interval '58 minutes',
       cancelled_at = ${shift.replace('%s', 'cancelled_at')},
       no_show_at = ${shift.replace('%s', 'no_show_at')} + interval '44 minutes',
       requested_at = $2
     WHERE id = $1`,
    [orderId, at],
  );
  await sql(
    `UPDATE orders SET departed_at = NULL WHERE id = $1 AND departed_at IS NOT NULL AND status IN ('ASSIGNED')`,
    [orderId],
  );
  await sql(
    `UPDATE orders SET assigned_at = NULL WHERE id = $1 AND status IN ('REQUESTED')`,
    [orderId],
  );
  // 기다린 시간을 넣은 주문은 도착이 출발보다 앞설 수 있다 — 출발 몇 분 뒤로 맞춘다.
  await sql(
    `UPDATE orders SET arrived_at = GREATEST(arrived_at, departed_at + interval '6 minutes'),
       picked_up_at = GREATEST(picked_up_at, GREATEST(arrived_at, departed_at + interval '6 minutes') + make_interval(mins => waiting_minutes))
     WHERE id = $1 AND arrived_at IS NOT NULL AND departed_at IS NOT NULL`,
    [orderId],
  );
  // 결제 시각을 단계에 맞춘다: 배차 결제는 배차 때, 추가 결제는 픽업 때.
  await sql(
    `UPDATE order_charges c SET
       approved_at = CASE WHEN c.approved_at IS NULL THEN NULL WHEN c.kind = 'DISPATCH' THEN o.assigned_at ELSE o.picked_up_at END,
       created_at = CASE WHEN c.kind = 'DISPATCH' THEN COALESCE(o.assigned_at, c.created_at) ELSE COALESCE(o.picked_up_at, c.created_at) END
     FROM orders o WHERE o.id = c.order_id AND o.id = $1`,
    [orderId],
  );
  // COALESCE로 채워진, 아직 일어나지 않은 단계의 시각을 다시 비운다.
  await sql(
    `UPDATE orders o SET
       departed_at = CASE WHEN x.departed THEN o.departed_at END,
       arrived_at = CASE WHEN x.arrived THEN o.arrived_at END,
       picked_up_at = CASE WHEN x.picked THEN o.picked_up_at END,
       delivered_at = CASE WHEN o.status = 'DELIVERED' THEN o.delivered_at END,
       cancelled_at = CASE WHEN o.status = 'CANCELLED' THEN o.cancelled_at END,
       no_show_at = CASE WHEN o.status = 'NO_SHOW' THEN o.no_show_at END
     FROM (SELECT id,
             status IN ('DEPARTED', 'ARRIVED', 'PICKED_UP', 'DELIVERED', 'NO_SHOW') OR (status = 'CANCELLED' AND cancellation_fee > 0) AS departed,
             status IN ('ARRIVED', 'PICKED_UP', 'DELIVERED', 'NO_SHOW') AS arrived,
             status IN ('PICKED_UP', 'DELIVERED') AS picked
           FROM orders WHERE id = $1) x
     WHERE o.id = x.id`,
    [orderId],
  );
}

// 지난 두 주의 배송 — 정산에 쓰인다. 최근에 승인된 세 명은 지난주에만 달렸다.
const kstNow = new Date(Date.now() + 9 * 3_600_000);
const daysSinceMonday = (kstNow.getUTCDay() + 6) % 7;
for (const weeksAgo of [2, 1]) {
  for (const [index, driver] of drivers.entries()) {
    if (weeksAgo === 2 && index >= 5) continue;
    if (weeksAgo === 1 && driver.name === '류강현') continue;
    const trips = index >= 5 ? 2 + Math.floor(random() * 3) : 6 + Math.floor(random() * 8);
    for (let n = 0; n < trips; n += 1) {
      const daysAgo = daysSinceMonday + weeksAgo * 7 - Math.floor(random() * 7);
      await backdate(await order('delivered', driver), daysAgo, 8 + Math.floor(random() * 11));
    }
  }
}
// 지지난 주는 이미 지급했다 (계좌가 있는 기사만).
const weekBefore = await call('GET', '/admin/settlements', { token: hyunwoo });
const older = new Date(Date.parse(`${weekBefore.weekStart}T00:00:00Z`) - 7 * DAY).toISOString().slice(0, 10);
const olderWeek = await call('GET', `/admin/settlements?weekStart=${older}`, { token: hyunwoo });
await call('POST', '/admin/settlements/payouts', {
  token: hyunwoo,
  body: {
    weekStart: older,
    driverIds: olderWeek.items.filter((item) => item.status === 'WAITING').map((item) => item.driverId),
  },
});
await sql(
  `UPDATE settlement_payouts SET paid_at = $1::date + interval '8 days 10 hours 12 minutes',
     completed_at = $1::date + interval '8 days 10 hours 12 minutes'`,
  [older],
);

// 어제와 오늘의 주문 — 주문 현황에 쓰인다.
for (let n = 0; n < 34; n += 1) {
  const roll = random();
  const stage =
    roll < 0.05 ? 'cancelled' : roll < 0.09 ? 'cancelledAfterDeparture' : roll < 0.11 ? 'noShow' : 'delivered';
  await backdate(await order(stage), 1, 7 + Math.floor(random() * 14));
}
const hourNow = kstNow.getUTCHours();
const TODAY = [
  ...Array(13).fill('delivered'),
  'cancelled',
  'cancelledAfterDeparture',
  'noShow',
  'paymentFailed',
  ...Array(3).fill('pickedUp'),
  'arrived',
  'departed',
  ...Array(2).fill('assigned'),
  ...Array(4).fill('requested'),
];
const FINISHED = ['delivered', 'cancelled', 'cancelledAfterDeparture', 'noShow', 'paymentFailed'];
for (const [index, stage] of TODAY.entries()) {
  const id = await order(stage);
  // 끝난 주문은 오늘 아침부터 지금까지 흩어 놓고, 진행 중인 주문은 방금 들어온 것으로 둔다.
  if (FINISHED.includes(stage)) {
    await backdate(id, 0, Math.max(0, hourNow - 1 - (index % Math.max(1, hourNow - 6))));
  }
}
console.log('고객 10명, 주문과 정산');

// ---- 회원 정지 ----
const suspend = (token, userId, days, reason) =>
  call('POST', `/admin/users/${userId}/suspensions`, { token, body: { days, reason } });
const quiet = customers.find((customer) => customer.name === '임채원');
const idleDriver = drivers.find((driver) => driver.name === '류강현');
// 지난 주문 하나는 운영자가 일부를 돌려줬다 (배송 지연).
const [late] = await sql(
  `SELECT id FROM orders WHERE status = 'DELIVERED' AND requested_at < now() - interval '20 hours' ORDER BY requested_at DESC LIMIT 1`,
);
if (late) {
  await call('POST', `/admin/orders/${late.id}/refunds`, {
    token: hyunwoo,
    body: { amount: 5000, reason: '배송 지연' },
  });
}
// 진행 중인 배송이 없는 회원만 정지할 수 있다 — 견본 주문이 걸려 있으면 건너뛴다.
await suspend(taeyoon, quiet.id, 7, '허위 물품 정보로 배송을 반복해서 요청했어요.').catch(() => {});
await suspend(haeun, idleDriver.id, null, '배송 완료 처리 후 물품을 전달하지 않은 사례가 확인됐어요.').catch(() => {});
const once = drivers.find((driver) => driver.name === '홍석진');
if (await suspend(taeyoon, once.id, 7, '배차를 수락한 뒤 연락 없이 픽업하지 않은 일이 반복됐어요.').catch(() => null)) {
  await call('DELETE', `/admin/users/${once.id}/suspensions/current`, { token: taeyoon });
  await sql(
    `UPDATE user_suspensions SET started_at = now() - interval '31 days',
       ends_at = now() - interval '24 days', lifted_at = now() - interval '24 days'
     WHERE user_id = $1`,
    [once.id],
  );
}

// ---- 공지 ----
const NOTICES = [
  ['MOVO 서비스를 시작해요', 'ALL', 73, haeun, true, '퀵 배송부터 화물 운송까지, 이제 MOVO에서 요청하세요.'],
  ['신규 기사님 서류 제출 안내', 'DRIVER', 47, taeyoon, false, '가입 심사에는 운전면허증, 자동차등록증, 화물운송 종사 자격증이 필요해요.\n사진은 글자가 잘 보이도록 밝은 곳에서 찍어 주세요.'],
  ['서비스 점검 안내 (9월 10일 02:00–04:00)', 'ALL', 35, taeyoon, true, '9월 10일 새벽 2시부터 4시까지 서버 점검으로 앱을 이용할 수 없어요.\n점검 중에는 배송 요청과 배차가 멈춰요.'],
  ['화물 운송 적재 기준이 바뀌었어요', 'CUSTOMER', 28, taeyoon, false, '1톤 트럭은 최대 1,000kg, 2.5톤 트럭은 최대 2,500kg까지 실을 수 있어요.\n기준을 넘으면 기사님이 운송을 거절할 수 있어요.'],
  ['기사님 정산일이 매주 화요일로 바뀌어요', 'DRIVER', 19, haeun, false, '10월부터 주간 정산금은 매주 화요일에 지급돼요.\n정산 기간은 월요일부터 일요일까지예요.'],
  ['추석 연휴 배송 운영 안내', 'ALL', 12, haeun, false, '추석 연휴 기간에는 화물 운송 예약이 평소보다 빨리 마감될 수 있어요.\n퀵 배송은 연휴에도 평소처럼 이용할 수 있어요.'],
];
for (const [title, audience, daysAgo, token, removed, body] of NOTICES) {
  const notice = await call('POST', '/admin/notices', { token, body: { title, audience, body } });
  if (removed) await call('DELETE', `/admin/notices/${notice.id}`, { token });
  await sql(
    `UPDATE notices SET published_at = now() - $2 * interval '1 day',
       removed_at = CASE WHEN removed_at IS NULL THEN NULL ELSE now() - ($2 - 2) * interval '1 day' END
     WHERE id = $1`,
    [notice.id, daysAgo],
  );
}

// ---- 약관 ----
const LEGAL = {
  TERMS: ['서비스 이용약관', '제1조 (목적)\n이 약관은 MOVO(이하 ‘회사’)가 제공하는 배송 중개 서비스의 이용 조건과 절차, 회사와 회원의 권리·의무를 정합니다.\n\n제2조 (서비스 내용)\n회사는 고객이 요청한 배송을 기사에게 연결하고, 배송 진행 상황을 관리합니다.\n\n제3조 (요금과 취소)\n요금은 차종과 거리에 따라 배송 요청 시점에 정해지며, 픽업 전까지는 취소할 수 있습니다.'],
  PRIVACY: ['개인정보 처리방침', '1. 수집하는 개인정보\n이름, 휴대폰 번호, 이메일, 출발·도착 주소를 수집합니다. 기사 회원은 차량 정보와 자격 서류를 추가로 수집합니다.\n\n2. 이용 목적\n배송 연결, 본인 확인, 고객 문의 응대, 정산에 이용합니다.'],
  LOCATION: ['위치기반서비스 이용약관', '제1조 (목적)\n이 약관은 회사가 제공하는 위치기반서비스의 이용 조건을 정합니다.\n\n제2조 (위치정보의 이용)\n기사 회원의 위치는 운행 중일 때만 수집하며, 배차와 배송 위치 안내에만 이용합니다.'],
  DRIVER: ['기사 운송 약관', '제1조 (목적)\n이 약관은 기사 회원이 MOVO를 통해 운송을 수행할 때의 조건을 정합니다.\n\n제2조 (가입 심사)\n기사 회원은 운전면허증, 자동차등록증, 화물운송 종사 자격증을 제출하고 회사의 심사를 받아야 합니다.\n\n제3조 (정산)\n운행 요금에서 수수료를 뺀 금액을 매주 정산하여 등록한 계좌로 지급합니다.'],
  MARKETING: ['마케팅 정보 수신 동의', 'MOVO는 할인 쿠폰, 이벤트, 새 서비스 소식을 앱 알림, 문자, 이메일로 보낼 수 있습니다.\n\n동의하지 않아도 서비스를 이용할 수 있으며, 앱 설정에서 언제든 수신을 철회할 수 있습니다.'],
};
// [종류, 판, 시행일까지 남은 날(음수면 과거), 등록한 사람]
const VERSIONS = [
  ['TERMS', 1, -73, haeun], ['TERMS', 2, -42, haeun], ['TERMS', 3, 19, taeyoon],
  ['PRIVACY', 1, -73, haeun], ['PRIVACY', 2, -12, haeun],
  ['LOCATION', 1, -73, haeun],
  ['DRIVER', 1, -73, haeun], ['DRIVER', 2, 1, taeyoon],
  ['MARKETING', 1, -73, haeun],
];
for (const [type, version, inDays, token] of VERSIONS) {
  const [title, body] = LEGAL[type];
  const effective = new Date(Date.now() + 9 * 3_600_000 + inDays * DAY).toISOString().slice(0, 10);
  const document = await call('POST', '/admin/legal-documents', {
    token,
    body: {
      type,
      version: String(version),
      title,
      body: `${body}\n\n부칙\n이 판은 ${effective.replaceAll('-', '.')}부터 시행합니다.`,
      effectiveAt: `${effective}T00:00:00+09:00`,
    },
  });
  await sql(`UPDATE legal_documents SET created_at = effective_at - interval '14 days' WHERE id = $1`, [document.id]);
}

await db.end();
console.log(`견본 데이터를 넣었어요. 운영자 웹에서 haeun.jung@movo.kr / ${PASSWORD} 로 로그인해 보세요.`);

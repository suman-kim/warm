// 운영자 웹을 채워 볼 견본 데이터를 넣는다. 비어 있는 개발용 DB에서만 돈다.
//
//   1) 서버를 띄운다:  npm run start:local
//   2) 견본 넣기:      node tool/seed-demo.mjs [서버 주소]
//
// 회원·라이더·가게·배달은 실제 API로 만들고(서버의 규칙을 그대로 탄다), 날짜를 과거로 옮기는 일과
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

async function applyAsDriver(name, email, phone, vehicleNumber) {
  const account = await register('DRIVER', name, email, phone);
  for (const type of Object.keys(FILES)) {
    await upload(account.token, type);
  }
  const driver = await call('POST', '/drivers', {
    token: account.token,
    body: { vehicleNumber },
  });
  return { ...account, driverId: driver.id };
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

// ---- 라이더 ----
const approve = (token, driver) =>
  call('PATCH', `/admin/drivers/${driver.driverId}/approve`, { token });
const reject = (token, driver, reason, rejectedDocuments) =>
  call('PATCH', `/admin/drivers/${driver.driverId}/reject`, {
    token,
    body: { reason, rejectedDocuments },
  });

// 이미 일하고 있는 라이더들. 정산 계좌가 있고, 견본 배달을 나른다. 위치는 담당 동네.
const WORKING = [
  ['문지성', 'jisung.moon@gmail.com', '01022017783', '서울강남가3412', '국민', '10293847564821', 37.501, 127.039],
  ['배수빈', 'subin.bae@naver.com', '01066391402', '서울성동나5106', null, null, 37.543, 127.054],
  ['조은호', 'eunho.cho@daum.net', '01099273364', '서울마포다7720', '신한', '11029384750372', 37.551, 126.916],
  ['홍석진', 'seokjin.hong@gmail.com', '01011865520', '서울송파라2291', '카카오뱅크', '33330198769915', 37.487, 127.12],
  ['류강현', 'kanghyun.ryu@gmail.com', '01044108857', '서울마포가4471', '기업', '00129384753058', 37.552, 126.913],
  ['윤태경', 'taekyung.yoon@gmail.com', '01088203195', '서울영등포마3390', '우리', '10029384756603', 37.526, 126.927],
  ['오세영', 'seyoung.oh@gmail.com', '01044579902', '서울강남바2048', '하나', '29384756102287', 37.516, 127.043],
  ['한상우', 'sangwoo.han@naver.com', '01091834470', '서울중구사6634', '농협', '30129384757140', 37.566, 126.99],
];
const drivers = [];
for (const [name, email, phone, plate, bankName, accountNumber, latitude, longitude] of WORKING) {
  const driver = await applyAsDriver(name, email, phone, plate);
  await approve(drivers.length % 2 ? taeyoon : haeun, driver);
  await call('PATCH', '/drivers/me/availability', { token: driver.token, body: { available: true } });
  await call('PUT', '/drivers/me/location', { token: driver.token, body: { latitude, longitude } });
  if (bankName) {
    // 윤태경은 예금주를 잘못 적어 계좌 본인 확인이 안 된 라이더다 (정산 보류).
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
  ['김도현', 'dohyun.kim@gmail.com', '01048213307', '서울관악가3412'],
  ['박지훈', 'jihoon.p@gmail.com', '01077310452', '인천남동나7721'],
  ['최유진', 'yujin.choi@daum.net', '01050128836', '경기성남다5107'],
  ['정민호', 'minho.jung@gmail.com', '01033486620', '서울은평라1187'],
];
for (const each of pending) {
  await applyAsDriver(...each);
}
// 반려된 뒤 서류를 다시 올려 재신청한 라이더.
const reapplied = await applyAsDriver('이서준', 'seojun.lee@naver.com', '01022901184', '서울동작마2292');
await reject(taeyoon, reapplied, '이륜자동차 사용신고필증 사진이 흐려 번호판을 확인할 수 없어요.', ['VEHICLE_REGISTRATION']);
await upload(reapplied.token, 'VEHICLE_REGISTRATION');
await call('POST', '/drivers', { token: reapplied.token, body: { vehicleNumber: '서울동작마2292' } });
// 반려된 채로 있는 라이더들.
await reject(
  taeyoon,
  await applyAsDriver('장하늘', 'haneul.j@gmail.com', '01066042219', '인천부평바9012'),
  '이륜자동차 사용신고필증 사진이 흐려 번호판을 확인할 수 없어요. 밝은 곳에서 다시 찍어 올려 주세요.',
  ['VEHICLE_REGISTRATION'],
);
await reject(
  haeun,
  await applyAsDriver('서경민', 'kyungmin.seo@daum.net', '01027165583', '경기수원사4471'),
  '유상운송 보험의 보험 기간이 지났어요. 갱신한 보험 증권을 올려 주세요.',
  ['DELIVERY_INSURANCE'],
);
console.log(`라이더 ${drivers.length + pending.length + 3}명 (승인 ${drivers.length}, 심사 대기 ${pending.length + 1}, 반려 2)`);

// ---- 가게 ----
/** 검증 숫자가 맞는 사업자등록번호를 [n]으로 만든다. */
function businessNumber(n) {
  const head = `21881${String(n).padStart(4, '0')}`;
  const d = [...head].map(Number);
  const weights = [1, 3, 7, 1, 3, 7, 1, 3, 5];
  const sum = weights.reduce((acc, w, i) => acc + w * d[i], 0) + Math.floor((d[8] * 5) / 10);
  return `${head}${(10 - (sum % 10)) % 10}`;
}

// [가게 이름, 사장님, 이메일, 휴대폰, 가게 전화, 주소, 구, 동, 위도, 경도, 근처 길 이름들]
const STORES = [
  ['모보치킨 역삼점', '김민지', 'minji.kim@gmail.com', '01033812047', '025551234', '서울 강남구 테헤란로 152', '강남구', '역삼동', 37.5, 127.0364, ['역삼로', '논현로', '언주로', '선릉로']],
  ['성수 족발상회', '이수현', 'soohyun.lee@naver.com', '01077201935', '024661820', '서울 성동구 성수이로 113', '성동구', '성수동2가', 37.5446, 127.0559, ['연무장길', '아차산로', '뚝섬로', '성수일로']],
  ['합정 화덕피자', '박준영', 'junyoung.park@gmail.com', '01028476610', '023220745', '서울 마포구 양화로 45', '마포구', '합정동', 37.5502, 126.9138, ['독막로', '잔다리로', '와우산로', '월드컵로']],
  ['문정 떡볶이', '최서연', 'seoyeon.c@daum.net', '01090143378', '024038812', '서울 송파구 법원로 128', '송파구', '문정동', 37.4858, 127.1226, ['송파대로', '동남로', '문정로', '새말로']],
  ['가산 김밥나라', '정우진', 'woojin.jung@gmail.com', '01055308812', '028631907', '서울 금천구 가산디지털1로 168', '금천구', '가산동', 37.4792, 126.8826, ['벚꽃로', '디지털로', '가산로', '서부샛길']],
  ['여의도 돈까스', '강하린', 'harin.kang@naver.com', '01061274409', '027826630', '서울 영등포구 여의대로 108', '영등포구', '여의도동', 37.5259, 126.9258, ['국제금융로', '의사당대로', '여의나루로', '63로']],
  ['논현 마라탕', '임채원', 'chaewon.lim@gmail.com', '01044982271', '025419083', '서울 강남구 학동로 402', '강남구', '논현동', 37.5172, 127.0412, ['논현로', '봉은사로', '언주로', '강남대로']],
  ['을지로 국수집', '한도윤', 'doyoon.han@gmail.com', '01088625104', '022741156', '서울 중구 을지로 100', '중구', '을지로2가', 37.5663, 126.9882, ['삼일대로', '수표로', '충무로', '퇴계로']],
];
const storeForm = ([name, , , , phone, address, sigungu, dong, latitude, longitude], n) => ({
  name,
  businessNumber: businessNumber(n),
  phone,
  address: { address, detailAddress: '1층', sigungu, dong, latitude, longitude },
});
const stores = [];
for (const [index, spec] of STORES.entries()) {
  const [, owner, email, phone] = spec;
  const account = await register('CUSTOMER', owner, email, phone);
  const store = await call('POST', '/stores', { token: account.token, body: storeForm(spec, index + 1) });
  await call('PATCH', `/admin/stores/${store.id}/approve`, { token: index % 2 ? taeyoon : haeun });
  // 여의도 돈까스는 충전금이 거의 바닥났다.
  const topUp = spec[0] === '여의도 돈까스' ? 100_000 : 400_000;
  await call('POST', '/stores/me/wallet/top-ups', { token: account.token, body: { amount: topUp } });
  stores.push({ ...account, storeId: store.id, spec });
}
// 심사를 기다리는 가게와, 반려된 가게.
const burger = await register('CUSTOMER', '오예린', 'yerin.oh@naver.com', '01031057726');
await call('POST', '/stores', {
  token: burger.token,
  body: storeForm(['상암 수제버거', null, null, null, '023078842', '서울 마포구 월드컵북로 396', '마포구', '상암동', 37.5796, 126.8897], 91),
});
const chinese = await register('CUSTOMER', '신재민', 'jaemin.shin@gmail.com', '01072460918');
const rejectedStore = await call('POST', '/stores', {
  token: chinese.token,
  body: storeForm(['구로 홍반점', null, null, null, '028561203', '서울 구로구 디지털로 300', '구로구', '구로동', 37.4849, 126.8966], 92),
});
await call('PATCH', `/admin/stores/${rejectedStore.id}/reject`, {
  token: taeyoon,
  body: { reason: '사업자등록증의 상호와 가게 이름이 달라요. 등록증과 같은 이름으로 다시 신청해 주세요.' },
});
// 가게 등록과 처음 충전은 견본 배달보다 앞선 날로 옮긴다 — 충전금 내역의 잔액이 차례대로 이어진다.
await sql(`UPDATE store_wallet_entries SET created_at = now() - interval '22 days'`);
await sql(
  `UPDATE stores SET created_at = now() - interval '24 days', applied_at = now() - interval '24 days',
     reviewed_at = CASE WHEN reviewed_at IS NULL THEN NULL ELSE now() - interval '23 days' END
   WHERE status = 'APPROVED'`,
);
console.log(`가게 ${stores.length + 2}곳 (승인 ${stores.length}, 심사 대기 1, 반려 1)`);

// ---- 배달 ----
/** 결정적인 난수 — 넣을 때마다 같은 견본이 나오게 한다. */
let seed = 20261015;
const random = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const pick = (list) => list[Math.floor(random() * list.length)];

/** 가게에서 0.5~2.5km 떨어진 손님 집. */
function customerHome(store) {
  const [, , , , , , sigungu, dong, latitude, longitude, roads] = store.spec;
  const angle = random() * 2 * Math.PI;
  const km = 0.5 + random() * 2;
  return {
    address: `서울 ${sigungu} ${pick(roads)} ${10 + Math.floor(random() * 300)}`,
    detailAddress: `${101 + Math.floor(random() * 8)}동 ${1 + Math.floor(random() * 15)}0${1 + Math.floor(random() * 4)}호`,
    sigungu,
    dong,
    latitude: Number((latitude + (km / 111) * Math.sin(angle)).toFixed(6)),
    longitude: Number((longitude + (km / 88) * Math.cos(angle)).toFixed(6)),
    phone: `0504${String(10_000_000 + Math.floor(random() * 89_999_999))}`,
  };
}
const MEMOS = [null, null, '문 앞에 두고 벨 눌러 주세요', '공동현관 비밀번호 1234#', '도착하면 전화 주세요', '아이가 자고 있어요. 노크만 해 주세요'];

/**
 * 배달 하나를 요청하고 [stage]까지 진행시킨다.
 * stage: requested | assigned | departed | arrived | pickedUp | delivered
 *        | cancelled(라이더 출발 전) | cancelledAfterDeparture
 */
async function delivery(stage, driver = pick(drivers), store = pick(stores)) {
  const roll = random();
  const doorPayment = roll < 0.6 ? 'PREPAID' : roll < 0.8 ? 'CASH' : 'CARD';
  const foodAmount = (14 + Math.floor(random() * 28)) * 1000;
  const memo = pick(MEMOS);
  const body = {
    foodAmount,
    doorPayment,
    readyInMinutes: pick([0, 10, 15, 20]),
    ...(memo && { memo }),
  };
  let created;
  // 실제 길(카카오 길찾기)로 10km가 넘는 곳(강 건너 등)이 나오면 다른 집으로 다시 요청한다.
  for (let attempt = 1; !created; attempt += 1) {
    created = await call('POST', '/deliveries', {
      token: store.token,
      body: { ...body, dropoff: customerHome(store) },
    }).catch((error) => {
      if (attempt < 5 && error.message.includes('DELIVERY_TOO_FAR')) return null;
      throw error;
    });
  }
  const dispatch = (action, body) =>
    call('POST', `/dispatch/orders/${created.id}/${action}`, { token: driver.token, body });
  const cancel = (reason) =>
    call('POST', `/orders/${created.id}/cancel`, { token: store.token, body: { reason } });
  if (stage === 'cancelled') {
    await cancel('손님이 주문을 취소했어요');
    return created;
  }
  if (stage === 'requested') return created;
  await dispatch('accept');
  if (stage === 'assigned') return created;
  await dispatch('depart');
  if (stage === 'cancelledAfterDeparture') {
    await cancel('재료가 떨어져 음식을 만들 수 없어요');
    return created;
  }
  if (stage === 'departed') return created;
  await dispatch('arrive');
  if (stage === 'arrived') return created;
  await dispatch('pickup');
  if (stage === 'pickedUp') return created;
  await dispatch(
    'complete',
    doorPayment === 'PREPAID' ? {} : { collectedMethod: doorPayment, collectedAmount: foodAmount },
  );
  return created;
}

/** 배달의 모든 시각을 요청 시각 [at] 기준으로 옮긴다 (충전금 내역도 함께). */
async function backdate(orderId, at) {
  const after = (column, minutes) =>
    `CASE WHEN ${column} IS NULL THEN NULL ELSE $2::timestamptz + interval '${minutes} minutes' END`;
  // 오른쪽의 열은 모두 바꾸기 전 값이다.
  await sql(
    `UPDATE orders SET
       requested_at = $2,
       ready_at = CASE WHEN ready_at IS NULL THEN NULL ELSE $2::timestamptz + (ready_at - requested_at) END,
       assigned_at = ${after('assigned_at', 2)},
       estimated_pickup_at = ${after('estimated_pickup_at', 14)},
       departed_at = ${after('departed_at', 3)},
       arrived_at = ${after('arrived_at', 12)},
       picked_up_at = ${after('picked_up_at', 16)},
       delivered_at = CASE WHEN delivered_at IS NULL THEN NULL
         ELSE $2::timestamptz + make_interval(mins => 20 + duration_minutes) END,
       cancelled_at = ${after('cancelled_at', 6)}
     WHERE id = $1`,
    [orderId, at],
  );
  await sql(
    `UPDATE store_wallet_entries SET created_at = $2::timestamptz
       + CASE WHEN kind = 'REFUND' THEN interval '6 minutes' ELSE interval '0' END
     WHERE order_id = $1`,
    [orderId, at],
  );
}

// 지난 두 주와 어제의 배달 — 정산과 내역에 쓰인다.
// 충전금 내역의 잔액이 차례대로 이어지도록, 시각을 먼저 정해 시각 순서대로 만들고
// 한 가게의 배달은 7분 넘게 띄운다 (취소하면 6분 뒤에 환불 내역이 생긴다).
const kstNow = new Date(Date.now() + 9 * 3_600_000);
const todayStart = Date.parse(`${kstNow.toISOString().slice(0, 10)}T00:00:00+09:00`);
const daysSinceMonday = (kstNow.getUTCDay() + 6) % 7;
/** [daysAgo]일 전 11시~22시 사이의 아무 때. */
const lunchToDinner = (daysAgo) =>
  todayStart - daysAgo * DAY + (11 * 60 + Math.floor(random() * 11 * 60)) * 60_000;
const planned = [];
for (const weeksAgo of [2, 1]) {
  for (const [index, driver] of drivers.entries()) {
    // 최근에 승인된 세 명은 지난주에만 달렸고, 류강현은 지난주에 쉬었다.
    if (weeksAgo === 2 && index >= 5) continue;
    if (weeksAgo === 1 && driver.name === '류강현') continue;
    const trips = index >= 5 ? 3 + Math.floor(random() * 4) : 8 + Math.floor(random() * 10);
    for (let n = 0; n < trips; n += 1) {
      const daysAgo = daysSinceMonday + weeksAgo * 7 - Math.floor(random() * 7);
      planned.push({ stage: 'delivered', driver, at: lunchToDinner(daysAgo) });
    }
  }
}
for (let n = 0; n < 30; n += 1) {
  const roll = random();
  const stage = roll < 0.06 ? 'cancelled' : roll < 0.1 ? 'cancelledAfterDeparture' : 'delivered';
  planned.push({ stage, driver: pick(drivers), at: lunchToDinner(1) });
}

/** 계획한 배달을 시각 순서대로 만들고 그 시각으로 옮긴다. 만나서 현금으로 받은 배달 ID를 준다. */
async function runPlanned(plans) {
  const lastAt = new Map();
  const cash = [];
  for (const plan of plans.sort((a, b) => a.at - b.at)) {
    const store = pick(stores);
    const at = Math.max(plan.at, (lastAt.get(store) ?? 0) + 7 * 60_000);
    lastAt.set(store, at);
    const created = await delivery(plan.stage, plan.driver, store);
    await backdate(created.id, new Date(at));
    if (plan.stage === 'delivered' && created.storeDelivery.doorPayment === 'CASH') {
      cash.push(created.id);
    }
  }
  return cash;
}
const cashDelivered = await runPlanned(planned);
// 지난 현금은 라이더가 가게에 넘겼다 — 어제 것 몇 건만 아직이다.
for (const id of cashDelivered.slice(0, -3)) {
  await call('PATCH', `/admin/rider-cash/${id}`, { token: hyunwoo, body: { handed: true } });
}
await sql(
  `UPDATE orders SET cash_handed_at = delivered_at + interval '3 hours' WHERE cash_handed_at IS NOT NULL`,
);

// 지지난 주는 이미 지급했다 (계좌가 있는 라이더만).
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

// 오늘 — 아침에 몇몇 가게가 충전했고, 끝난 배달은 그 뒤부터 지금까지, 진행 중인 배달은 방금 들어왔다.
// 충전은 아침 9시로 둔다 (새벽에 넣으면 지금보다 두 시간 앞으로).
const topUpAt = Math.min(Date.now() - 2 * 3_600_000, todayStart + 9 * 3_600_000);
for (const store of stores.filter((_, index) => index % 3 === 0)) {
  await call('POST', '/stores/me/wallet/top-ups', { token: store.token, body: { amount: 100_000 } });
}
await sql(
  `UPDATE store_wallet_entries SET created_at = $1
   WHERE kind = 'TOP_UP' AND created_at > now() - interval '1 minute'`,
  [new Date(topUpAt)],
);
const from = topUpAt + 30 * 60_000;
const until = Date.now() - 30 * 60_000;
if (until > from) {
  await runPlanned(
    [...Array(14).fill('delivered'), 'cancelled', 'cancelledAfterDeparture'].map((stage) => ({
      stage,
      driver: pick(drivers),
      at: from + Math.floor(random() * (until - from)),
    })),
  );
}
for (const stage of [
  ...Array(3).fill('pickedUp'),
  'arrived',
  'departed',
  ...Array(3).fill('assigned'),
  ...Array(4).fill('requested'),
]) {
  // 라이더 한 명은 동시에 세 건까지 — 진행 중 배달은 라이더를 돌려 가며 맡긴다.
  await delivery(stage, drivers[Math.floor(random() * drivers.length)]).catch(() => {});
}
// 하나는 요청하고 12분째 라이더를 못 찾았다 (배차 지연).
const [waiting] = await sql(`SELECT id FROM orders WHERE status = 'REQUESTED' ORDER BY requested_at LIMIT 1`);
if (waiting) {
  await sql(`UPDATE orders SET requested_at = now() - interval '12 minutes' WHERE id = $1`, [waiting.id]);
}
const [{ count: total }] = await sql(`SELECT COUNT(*) AS count FROM orders`);
console.log(`배달 ${total}건과 정산`);

// ---- 회원 정지 ----
const suspend = (token, userId, days, reason) =>
  call('POST', `/admin/users/${userId}/suspensions`, { token, body: { days, reason } });
const quiet = stores.find((store) => store.spec[0] === '논현 마라탕');
const idleDriver = drivers.find((driver) => driver.name === '류강현');
// 진행 중인 배달이 없는 회원만 정지할 수 있다 — 견본 배달이 걸려 있으면 건너뛴다.
await suspend(taeyoon, quiet.id, 7, '손님 주소를 거짓으로 적어 배달을 반복해서 요청했어요.').catch(() => {});
await suspend(haeun, idleDriver.id, null, '배달 완료 처리 후 음식을 전달하지 않은 사례가 확인됐어요.').catch(() => {});
const once = drivers.find((driver) => driver.name === '홍석진');
if (await suspend(taeyoon, once.id, 7, '배달을 수락한 뒤 연락 없이 픽업하지 않은 일이 반복됐어요.').catch(() => null)) {
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
  ['MOVO 배달대행을 시작해요', 'ALL', 73, haeun, true, '가게 사장님은 PC와 앱에서 배달을 요청하고, 라이더는 가까운 콜을 바로 잡을 수 있어요.'],
  ['신규 라이더 서류 제출 안내', 'DRIVER', 47, taeyoon, false, '가입 심사에는 운전면허증, 이륜자동차 사용신고필증, 유상운송 보험 증권이 필요해요.\n사진은 글자가 잘 보이도록 밝은 곳에서 찍어 주세요.'],
  ['서비스 점검 안내 (9월 10일 02:00–04:00)', 'ALL', 35, taeyoon, true, '9월 10일 새벽 2시부터 4시까지 서버 점검으로 앱을 이용할 수 없어요.\n점검 중에는 배달 요청과 배차가 멈춰요.'],
  ['충전금 자동 알림을 켜 두세요', 'CUSTOMER', 28, taeyoon, false, '충전금이 대행료보다 적으면 배달을 요청할 수 없어요.\n점심·저녁 피크 전에 잔액을 확인하고 넉넉히 충전해 두세요.'],
  ['라이더 정산일이 매주 화요일로 바뀌어요', 'DRIVER', 19, haeun, false, '10월부터 주간 정산금은 매주 화요일에 지급돼요.\n정산 기간은 월요일부터 일요일까지예요.'],
  ['추석 연휴 배달 운영 안내', 'ALL', 12, haeun, false, '추석 연휴에는 주문이 몰려 배차가 늦어질 수 있어요.\n조리 완료 시간을 넉넉히 잡아 요청해 주세요.'],
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
  TERMS: ['서비스 이용약관', '제1조 (목적)\n이 약관은 MOVO(이하 ‘회사’)가 제공하는 배달대행 중개 서비스의 이용 조건과 절차, 회사와 회원의 권리·의무를 정합니다.\n\n제2조 (서비스 내용)\n회사는 가게가 요청한 배달을 라이더에게 연결하고, 배달 진행 상황을 관리합니다.\n\n제3조 (대행료와 취소)\n대행료는 거리와 시간대에 따라 요청 시점에 정해지며 충전금에서 빠집니다. 라이더가 가게로 출발한 뒤 취소하면 대행료의 15%를 수수료로 뺀 뒤 돌려드립니다.'],
  PRIVACY: ['개인정보 처리방침', '1. 수집하는 개인정보\n이름, 휴대폰 번호, 이메일을 수집합니다. 가게 회원은 사업자 정보와 가게 주소를, 라이더 회원은 오토바이 정보와 자격 서류를 추가로 수집합니다. 배달을 위해 손님의 주소와 연락처(안심번호)를 받아 배달이 끝날 때까지 이용합니다.\n\n2. 이용 목적\n배달 연결, 본인 확인, 문의 응대, 정산에 이용합니다.'],
  LOCATION: ['위치기반서비스 이용약관', '제1조 (목적)\n이 약관은 회사가 제공하는 위치기반서비스의 이용 조건을 정합니다.\n\n제2조 (위치정보의 이용)\n라이더 회원의 위치는 운행 중일 때만 수집하며, 배차와 배달 위치 안내에만 이용합니다.'],
  DRIVER: ['라이더 이용약관', '제1조 (목적)\n이 약관은 라이더 회원이 MOVO를 통해 배달을 수행할 때의 조건을 정합니다.\n\n제2조 (가입 심사)\n라이더 회원은 운전면허증, 이륜자동차 사용신고필증, 유상운송 보험 증권을 제출하고 회사의 심사를 받아야 합니다.\n\n제3조 (정산)\n대행료에서 수수료를 뺀 금액을 매주 정산하여 등록한 계좌로 지급합니다.\n\n제4조 (현금 수금)\n만나서 결제로 받은 현금은 그날 안에 가게에 전달합니다.'],
  MARKETING: ['마케팅 정보 수신 동의', 'MOVO는 대행료 할인, 이벤트, 새 기능 소식을 앱 알림, 문자, 이메일로 보낼 수 있습니다.\n\n동의하지 않아도 서비스를 이용할 수 있으며, 설정에서 언제든 수신을 철회할 수 있습니다.'],
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

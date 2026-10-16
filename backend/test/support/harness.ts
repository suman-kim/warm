import { rm } from 'node:fs/promises';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/app.setup.js';
import { ADMIN_INVITATION_SENDER } from '../../src/modules/admin/application/ports/admin-invitation-sender.port.js';
import { RESET_CODE_SENDER } from '../../src/modules/auth/application/ports/reset-code-sender.port.js';
import { SMS_SENDER } from '../../src/modules/auth/application/ports/sms-sender.port.js';
import {
  PUSH_SENDER,
  PushSender,
} from '../../src/modules/notification/application/ports/push-sender.port.js';
import { PushMessage } from '../../src/modules/notification/domain/push-message.js';

// 실제 PostgreSQL(movo_test)에 붙어 HTTP부터 DB까지 통째로 검증한다.
// 접속 정보는 vitest.config.e2e.ts에 있다.

/** 가게(픽업지) 주소 — 역삼동. */
export const STORE_ADDRESS = {
  address: '서울 강남구 테헤란로 152',
  detailAddress: '1층',
  sigungu: '강남구',
  dong: '역삼동',
  latitude: 37.5,
  longitude: 127.0364,
};
export const STORE = {
  name: '모보치킨 역삼점',
  phone: '02-555-1234',
  address: STORE_ADDRESS,
};
/** 가게에서 약 1.3km 떨어진 손님. */
export const CUSTOMER_HOME = {
  address: '서울 강남구 역삼로 180',
  detailAddress: '101동 1203호',
  sigungu: '강남구',
  dong: '역삼동',
  latitude: 37.4955,
  longitude: 127.0495,
  phone: '050-1234-5678',
};
/** 선결제라 라이더가 받을 돈이 없는 배달. 만나서 결제는 doorPayment와 foodAmount를 바꿔 보낸다. */
export const DELIVERY = {
  dropoff: CUSTOMER_HOME,
  foodAmount: 0,
  doorPayment: 'PREPAID',
  readyInMinutes: 0,
  memo: '문 앞에 두고 벨 눌러 주세요',
};
/** 가게(역삼동)에서 약 1.2km 떨어진 곳. 운행을 켠 라이더는 기본으로 여기 있다. */
export const NEAR_PICKUP = { latitude: 37.51, longitude: 127.04 };
export const PASSWORD = 'password123';
export const AGREEMENTS = { terms: true, privacy: true, marketing: false };
export const DOCUMENT_TYPES = [
  'DRIVER_LICENSE',
  'VEHICLE_REGISTRATION',
  'DELIVERY_INSURANCE',
];
/** 내용으로 형식을 알아볼 수 있는 가장 작은 파일들. */
export const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a]);
export const PDF = Buffer.from('%PDF-1.7\n%%EOF\n');

export interface Account {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; name: string };
}

export interface OrderBody {
  id: string;
  status: string;
  fare: number;
  durationMinutes: number;
  [key: string]: unknown;
}

export type Harness = Awaited<ReturnType<typeof createHarness>>;

/** 검증 숫자가 맞는 사업자등록번호. 테스트마다 겹치지 않게 [n]으로 만든다. */
export function businessNumber(n: number): string {
  const head = `101${String(n).padStart(6, '0')}`;
  const d = [...head].map(Number);
  const weights = [1, 3, 7, 1, 3, 7, 1, 3, 5];
  const sum =
    weights.reduce((acc, w, i) => acc + w * d[i], 0) +
    Math.floor((d[8] * 5) / 10);
  return `${head}${(10 - (sum % 10)) % 10}`;
}

/** 앱을 띄우고 테스트 DB를 비운 뒤, 테스트가 쓰는 도구를 돌려준다. */
export async function createHarness() {
  // 실제 FCM 대신 끼우는 발송기. 무엇을 어느 기기로 보냈는지 기록한다.
  const pushes: { tokens: string[]; message: PushMessage }[] = [];
  const deadTokens = new Set<string>();
  const pushSender: PushSender = {
    send: async (tokens, message) => {
      pushes.push({ tokens, message });
      return { invalidTokens: tokens.filter((token) => deadTokens.has(token)) };
    },
  };
  // 실제 메일 대신, 이메일별로 마지막에 보낸 인증 코드를 기억한다.
  const resetCodes = new Map<string, string>();
  // 운영자 초대 메일 대신, 이메일별로 마지막에 보낸 초대 토큰을 기억한다.
  const invitationTokens = new Map<string, string>();
  // 실제 문자 대신, 번호(숫자만)별로 마지막에 보낸 휴대폰 인증 코드를 기억한다.
  const smsCodes = new Map<string, string>();

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PUSH_SENDER)
    .useValue(pushSender)
    .overrideProvider(RESET_CODE_SENDER)
    .useValue({
      send: async (email: string, code: string) =>
        void resetCodes.set(email, code),
    })
    .overrideProvider(ADMIN_INVITATION_SENDER)
    .useValue({
      send: async (invitation: { email: string; token: string }) =>
        void invitationTokens.set(invitation.email, invitation.token),
    })
    .overrideProvider(SMS_SENDER)
    .useValue({
      sendVerificationCode: async (phone: string, code: string) =>
        void smsCodes.set(phone, code),
    })
    .compile();
  // main.ts처럼 원래 본문을 남긴다 (PG 웹훅 서명 확인).
  const app: INestApplication = moduleRef.createNestApplication({
    rawBody: true,
  });
  configureApp(app);
  await app.init();

  const dataSource = app.get(DataSource);
  const database = String(dataSource.options.database);
  if (!database.endsWith('_test')) {
    throw new Error(`테스트 DB가 아니라서 중단해요: ${database}`);
  }
  // 테이블을 모두 지우고 엔티티대로 다시 만든다.
  await dataSource.synchronize(true);

  let sequence = 0;
  const api = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  /** 휴대폰 인증을 마치고 가입에 쓰는 인증 토큰을 받는다. */
  async function verifyPhone(phone: string): Promise<string> {
    await api()
      .post('/api/auth/phone-verifications')
      .send({ phone })
      .expect(201);
    const { body } = await api()
      .post('/api/auth/phone-verifications/confirm')
      .send({ phone, code: smsCodes.get(phone.replace(/\D/g, '')) })
      .expect(200);
    return body.verificationToken as string;
  }

  /** 가입한다. 손님(CONSUMER)은 휴대폰 인증을 먼저 한다 (정책이 끄지 않았으면). */
  async function register(
    role: 'CUSTOMER' | 'DRIVER' | 'CONSUMER',
    overrides: Record<string, unknown> = {},
  ): Promise<Account> {
    const n = ++sequence;
    const phone =
      (overrides.phone as string | undefined) ??
      `0101000${String(n).padStart(4, '0')}`;
    const verification =
      role === 'CONSUMER' && !('phoneVerificationToken' in overrides)
        ? { phoneVerificationToken: await verifyPhone(phone) }
        : {};
    const response = await api()
      .post('/api/auth/register')
      .send({
        email: `user${n}@test.dev`,
        password: PASSWORD,
        name: `회원${n}`,
        phone,
        role,
        agreements: AGREEMENTS,
        ...verification,
        ...overrides,
      })
      .expect(201);
    return response.body as Account;
  }

  // 운영자는 가입으로 만들 수 없어 DB에서 역할을 올린다 (admin:promote 스크립트와 같은 일).
  const admin = await register('CUSTOMER');
  await dataSource.query(`UPDATE users SET role = 'ADMIN' WHERE id = $1`, [
    admin.user.id,
  ]);
  await dataSource.query(
    `INSERT INTO admin_accounts (id, role, status, version) VALUES ($1, 'SUPER', 'ACTIVE', 1)`,
    [admin.user.id],
  );
  const adminToken = admin.accessToken;

  const uploadDocument = (token: string, type: string, file: Buffer = JPEG) =>
    api()
      .put(`/api/drivers/me/documents/${type}`)
      .set(bearer(token))
      .attach('file', file, 'document');

  async function uploadAllDocuments(token: string): Promise<void> {
    for (const type of DOCUMENT_TYPES) {
      await uploadDocument(token, type).expect(200);
    }
  }

  /** 서류를 올리고 라이더 등록을 신청한다 (심사 대기). */
  async function pendingDriver() {
    const account = await register('DRIVER');
    await uploadAllDocuments(account.accessToken);
    const { body: driver } = await api()
      .post('/api/drivers')
      .set(bearer(account.accessToken))
      .send({ vehicleNumber: `서울강남가${1000 + sequence}` })
      .expect(201);
    return {
      token: account.accessToken,
      driverId: driver.id as string,
      account,
    };
  }

  const setAvailability = (token: string, available: boolean) =>
    api()
      .patch('/api/drivers/me/availability')
      .set(bearer(token))
      .send({ available });

  /**
   * 승인받고 운행을 시작한 라이더를 만든다. 라이더 앱처럼 운행을 켜면서 위치를 보낸다 —
   * 새 콜 알림과 대기 목록은 배차 반경 안의 라이더에게만 간다. [location]이 null이면 위치를 보내지 않는다.
   */
  async function onlineDriver(
    location: { latitude: number; longitude: number } | null = NEAR_PICKUP,
  ) {
    const driver = await pendingDriver();
    await api()
      .patch(`/api/admin/drivers/${driver.driverId}/approve`)
      .set(bearer(adminToken))
      .expect(200);
    await setAvailability(driver.token, true).expect(200);
    if (location) {
      await api()
        .put('/api/drivers/me/location')
        .set(bearer(driver.token))
        .send(location)
        .expect(204);
    }
    return driver;
  }

  /** 가게를 등록한다 (심사 대기). */
  async function pendingStore(overrides: Record<string, unknown> = {}) {
    const account = await register('CUSTOMER');
    const { body: store } = await api()
      .post('/api/stores')
      .set(bearer(account.accessToken))
      .send({
        ...STORE,
        businessNumber: businessNumber(++sequence),
        ...overrides,
      })
      .expect(201);
    return { token: account.accessToken, storeId: store.id as string, account };
  }

  /** 승인받고 충전금을 넣은 가게. 사장님 토큰과 가게 ID를 준다. */
  async function readyStore(
    topUp = 50_000,
    overrides: Record<string, unknown> = {},
  ) {
    const store = await pendingStore(overrides);
    await api()
      .patch(`/api/admin/stores/${store.storeId}/approve`)
      .set(bearer(adminToken))
      .expect(200);
    if (topUp > 0) {
      await api()
        .post('/api/stores/me/wallet/top-ups')
        .set(bearer(store.token))
        .send({ amount: topUp })
        .expect(201);
    }
    return store;
  }

  /** 배달을 요청한다 (기본은 선결제). 응답을 확인하지 않은 요청을 돌려준다. */
  const requestDelivery = (storeToken: string, extra: object = {}) =>
    api()
      .post('/api/deliveries')
      .set(bearer(storeToken))
      .send({ ...DELIVERY, ...extra });

  /** 배달을 요청하고 만들어진 배달을 준다. */
  async function createDelivery(
    storeToken: string,
    extra: object = {},
  ): Promise<OrderBody> {
    const response = await requestDelivery(storeToken, extra).expect(201);
    return response.body as OrderBody;
  }

  const dispatch = (
    driverToken: string,
    orderId: string,
    action: string,
    body: object = {},
  ) =>
    api()
      .post(`/api/dispatch/orders/${orderId}/${action}`)
      .set(bearer(driverToken))
      .send(body);

  /** 선결제 배달을 만들고 주어진 단계까지 진행시킨다. */
  async function deliveryAt(
    storeToken: string,
    driverToken: string,
    stage: 'accept' | 'pickup' | 'complete',
    extra: object = {},
  ): Promise<OrderBody> {
    const order = await createDelivery(storeToken, extra);
    for (const action of ['accept', 'pickup', 'complete']) {
      await dispatch(driverToken, order.id, action).expect(200);
      if (action === stage) {
        break;
      }
    }
    return order;
  }

  async function registerDevice(accessToken: string, token: string) {
    await api()
      .put('/api/push-devices')
      .set(bearer(accessToken))
      .send({ token, platform: 'ANDROID' })
      .expect(204);
  }

  const pushesOf = (type: string, orderId?: string) =>
    pushes.filter(
      ({ message }) =>
        message.data.type === type &&
        (orderId === undefined || message.data.orderId === orderId),
    );

  /** 이 배달에 대해 이 종류로 나간 푸시가 정확히 한 건 생길 때까지 기다린다 (발송은 응답 뒤에 돈다). */
  const waitForPush = (orderId: string, type: string) =>
    vi.waitFor(() => {
      const found = pushesOf(type, orderId);
      expect(found).toHaveLength(1);
      return found[0];
    });

  /** 이 기기로 이 종류의 푸시가 갈 때까지 기다린다. */
  const waitForPushTo = (deviceToken: string, type: string) =>
    vi.waitFor(() => {
      const found = pushesOf(type).filter(({ tokens }) =>
        tokens.includes(deviceToken),
      );
      expect(found.length).toBeGreaterThan(0);
      return found.at(-1)!;
    });

  async function close(): Promise<void> {
    await app.close();
    await rm(process.env.UPLOAD_DIR!, { recursive: true, force: true });
  }

  return {
    app,
    dataSource,
    api,
    bearer,
    adminToken,
    pushes,
    deadTokens,
    resetCodes,
    invitationTokens,
    smsCodes,
    verifyPhone,
    register,
    uploadDocument,
    uploadAllDocuments,
    pendingDriver,
    onlineDriver,
    setAvailability,
    pendingStore,
    readyStore,
    requestDelivery,
    createDelivery,
    dispatch,
    deliveryAt,
    registerDevice,
    pushesOf,
    waitForPush,
    waitForPushTo,
    close,
  };
}

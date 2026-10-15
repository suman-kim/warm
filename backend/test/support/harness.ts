import { rm } from 'node:fs/promises';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/app.setup.js';
import { ADMIN_INVITATION_SENDER } from '../../src/modules/admin/application/ports/admin-invitation-sender.port.js';
import { RESET_CODE_SENDER } from '../../src/modules/auth/application/ports/reset-code-sender.port.js';
import {
  PUSH_SENDER,
  PushSender,
} from '../../src/modules/notification/application/ports/push-sender.port.js';
import { PushMessage } from '../../src/modules/notification/domain/push-message.js';

// 실제 PostgreSQL(movo_test)에 붙어 HTTP부터 DB까지 통째로 검증한다.
// 접속 정보는 vitest.config.e2e.ts에 있다.

export const PICKUP = {
  address: '서울 강남구 테헤란로 152',
  detailAddress: '10층',
  sigungu: '강남구',
  dong: '역삼동',
  latitude: 37.5,
  longitude: 127.0364,
  contactName: '김고객',
  contactPhone: '010-1111-2222',
};
export const DROPOFF = {
  address: '서울 마포구 양화로 45',
  sigungu: '마포구',
  dong: '서교동',
  latitude: 37.5502,
  longitude: 126.9138,
  contactName: '최수령',
  contactPhone: '02-333-4444',
};
/** 출발지(역삼동)에서 약 1.2km 떨어진 곳. 운행을 켠 기사는 기본으로 여기 있다. */
export const NEAR_PICKUP = { latitude: 37.51, longitude: 127.04 };
/** 다마스로 15.8km, 58분, 33,200원이 나오는 주문. */
export const DAMAS_ORDER = {
  vehicleType: 'DAMAS',
  pickup: PICKUP,
  dropoff: DROPOFF,
  cargo: { category: 'BOX', weightKg: 45, quantity: 3 },
  memo: '경비실에 맡겨 주세요',
};
export const DAMAS_FARE = 33200;
export const PASSWORD = 'password123';
export const AGREEMENTS = { terms: true, privacy: true, marketing: false };
export const DOCUMENT_TYPES = [
  'DRIVER_LICENSE',
  'VEHICLE_REGISTRATION',
  'FREIGHT_QUALIFICATION',
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
  [key: string]: unknown;
}

export type Harness = Awaited<ReturnType<typeof createHarness>>;

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
    .compile();
  const app: INestApplication = moduleRef.createNestApplication();
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

  async function register(
    role: 'CUSTOMER' | 'DRIVER',
    overrides: Record<string, unknown> = {},
  ): Promise<Account> {
    const n = ++sequence;
    const response = await api()
      .post('/api/auth/register')
      .send({
        email: `user${n}@test.dev`,
        password: PASSWORD,
        name: `회원${n}`,
        phone: `0101000${String(n).padStart(4, '0')}`,
        role,
        agreements: AGREEMENTS,
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

  /** 서류를 올리고 기사 등록을 신청한다 (심사 대기). */
  async function pendingDriver(vehicleType: string) {
    const account = await register('DRIVER');
    await uploadAllDocuments(account.accessToken);
    const { body: driver } = await api()
      .post('/api/drivers')
      .set(bearer(account.accessToken))
      .send({ vehicleType, vehicleNumber: `서울12가${1000 + sequence}` })
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
   * 승인받고 운행을 시작한 기사를 만든다. 기사 앱처럼 운행을 켜면서 위치를 보낸다 —
   * 새 주문 알림과 대기 목록은 배차 반경 안의 기사에게만 간다. [location]이 null이면 위치를 보내지 않는다.
   */
  async function onlineDriver(
    vehicleType: string,
    location: { latitude: number; longitude: number } | null = NEAR_PICKUP,
  ) {
    const driver = await pendingDriver(vehicleType);
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

  /** 개발용 PG 연동으로 카드를 등록한다. 끝 4자리가 0001~0009면 그 사유로 결제가 안 되는 시험용 카드다. */
  async function registerCard(
    customerToken: string,
    last4 = '4821',
    options: {
      brand?: string;
      type?: 'CREDIT' | 'CHECK';
      makeDefault?: boolean;
    } = {},
  ): Promise<{ id: string; isDefault: boolean }> {
    const response = await api()
      .post('/api/payment-methods')
      .set(bearer(customerToken))
      .send({
        authKey: `dev:${options.brand ?? '신한카드'}:${last4}:${options.type ?? 'CREDIT'}`,
        makeDefault: options.makeDefault,
      })
      .expect(201);
    customersWithCard.add(customerToken);
    return response.body as { id: string; isDefault: boolean };
  }
  const customersWithCard = new Set<string>();

  /** 배송을 요청한다. 카드를 등록하지 않은 고객이면 먼저 결제되는 카드를 등록한다. */
  async function createOrder(
    customerToken: string,
    body: object = DAMAS_ORDER,
  ): Promise<OrderBody> {
    if (!customersWithCard.has(customerToken)) {
      await registerCard(customerToken);
    }
    const response = await api()
      .post('/api/orders')
      .set(bearer(customerToken))
      .send(body)
      .expect(201);
    return response.body as OrderBody;
  }

  const dispatch = (driverToken: string, orderId: string, action: string) =>
    api()
      .post(`/api/dispatch/orders/${orderId}/${action}`)
      .set(bearer(driverToken));

  /** 주문을 만들고 주어진 단계까지 진행시킨다. */
  async function orderAt(
    customerToken: string,
    driverToken: string,
    stage: 'accept' | 'pickup' | 'complete',
    body: object = DAMAS_ORDER,
  ): Promise<OrderBody> {
    const order = await createOrder(customerToken, body);
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

  /** 이 주문에 대해 이 종류로 나간 푸시가 정확히 한 건 생길 때까지 기다린다 (발송은 응답 뒤에 돈다). */
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
    registerCard,
    bearer,
    adminToken,
    pushes,
    deadTokens,
    resetCodes,
    invitationTokens,
    register,
    uploadDocument,
    uploadAllDocuments,
    pendingDriver,
    onlineDriver,
    setAvailability,
    createOrder,
    dispatch,
    orderAt,
    registerDevice,
    pushesOf,
    waitForPush,
    waitForPushTo,
    close,
  };
}

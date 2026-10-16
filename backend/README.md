# MOVO Backend

음식점과 배달 라이더를 연결하는 배달대행 서비스의 백엔드.
가게 앱(사장님)·가게 PC 웹·라이더 앱·운영자 웹이 이 서버 하나를 함께 쓴다 — 로그인한 회원의 역할(`CUSTOMER` = 사장님 / `DRIVER` = 라이더)로 쓸 수 있는 API가 갈린다.

NestJS 12 · TypeScript(ESM) · TypeORM · PostgreSQL · DDD / 클린 아키텍처

## 시작하기

```bash
cp .env.local.example .env.local   # JWT_SECRET을 채운다: openssl rand -hex 32
docker compose up -d            # 로컬에 PostgreSQL이 없을 때만
npm install
npm run migration:run           # 테이블 생성
npm run start:local             # http://localhost:4000/api
```

- API 문서(Swagger): http://localhost:4000/api/docs
- Docker 없이 로컬 PostgreSQL을 쓰면 DB를 직접 만든다.

  ```sql
  CREATE ROLE movo LOGIN PASSWORD 'movo';
  CREATE DATABASE movo OWNER movo;
  CREATE DATABASE movo_test OWNER movo;  -- e2e 테스트용
  ```

- 첫 운영자(최고 관리자)는 가입한 뒤 역할을 올려 만든다. 그다음 운영자는 최고 관리자가 운영자 웹(`../admin-web`)에서 초대한다.

  ```bash
  npm run admin:promote -- someone@example.com
  ```

- 운영자 웹을 채워 볼 견본 데이터 (비어 있는 개발용 DB에서만 돈다. 서버가 떠 있어야 한다):

  ```bash
  node tool/seed-demo.mjs          # 운영자 5명, 라이더 15명, 가게 10곳, 배달·충전금·정산·공지·약관
  ```

  모든 계정의 비밀번호는 `movo1234`, 최고 관리자는 `haeun.jung@movo.kr`이다.

- 앱과 운영자 웹을 직접 써 볼 테스트 계정 (개발용 DB에서만 돈다. 서버가 떠 있어야 한다. 다시 돌리면 비밀번호를 되돌리고 빠진 것만 채운다):

  ```bash
  node tool/seed-accounts.mjs      # 사장님 1, 라이더 2, 운영자 1, 비밀번호는 모두 12341234
  ```

  | 역할   | 이메일                 | 상태                                              |
  | ------ | ---------------------- | ------------------------------------------------- |
  | 사장님 | `zzsdsdsd@gmail.com`   | 가게(모보치킨 역삼점) 승인됨, 충전금 10만 원 이상 |
  | 라이더 | `zzsdsdsd92@daum.net`  | 오토바이, 승인됨, 정산 계좌 본인 확인됨           |
  | 라이더 | `driver1@naver.com`    | 오토바이, 승인됨, 정산 계좌 본인 확인됨           |
  | 운영자 | `gimsuman92@naver.com` | 최고 관리자                                       |

  `12341234`는 가입 규칙(영문과 숫자 포함)에 맞지 않아 앱에서는 이 비밀번호로 가입할 수 없다 — 스크립트가 비밀번호만 DB에 직접 넣는다. 견본 데이터도 넣으려면 `seed-demo.mjs`를 먼저 돌린다.

- 라이더 심사는 운영자 웹에서 한다. 앱만 돌려 볼 때는 심사 대기 중인 라이더를 서류를 보지 않고 한 번에 승인하는 도구를 쓴다 (서버가 떠 있어야 한다).

  ```bash
  tool/approve-drivers.sh someone@example.com '비밀번호'
  ```

## 환경 (local · prod)

서버는 `APP_ENV`에 맞는 `.env.<APP_ENV>`를 읽는다 (없으면 local). 없는 값은 `.env`에서, 같은 이름의 플랫폼 환경변수가 있으면 그 값이 우선한다.

| 환경  | 파일         | 템플릿               | 실행                                                                          |
| ----- | ------------ | -------------------- | ----------------------------------------------------------------------------- |
| local | `.env.local` | `.env.local.example` | `npm run start:local`                                                         |
| prod  | `.env.prod`  | `.env.prod.example`  | `npm run build` → `APP_ENV=prod npm run migration:run` → `npm run start:prod` |

- `.env.local`과 `.env.prod`에는 비밀값이 들어 있어 커밋하지 않는다 (템플릿만 추적).
- 마이그레이션과 `tool/` 스크립트도 같은 규칙으로 파일을 고른다 — 운영 DB에 돌릴 때는 `APP_ENV=prod`를 붙인다. 견본 데이터·테스트 계정 스크립트는 운영(`NODE_ENV=production`)에서 돌지 않는다.
- 운영은 `NODE_ENV=production`이다. 포트원 키(`PORTONE_STORE_ID` · `PORTONE_CHANNEL_KEY` · `PORTONE_API_SECRET`)는 충전금 충전(작업 35.2)에 쓸 자리로 남겨 두었다 — 지금은 쓰는 곳이 없고, 운영에서는 충전 API가 503 `TOP_UP_NOT_READY`다.
- e2e 테스트는 `APP_ENV=test`로 `movo_test` DB를 쓴다 (`vitest.config.e2e.ts`).

## 구조

컨텍스트(모듈)마다 같은 네 계층을 둔다.

```
src/
├── main.ts · app.module.ts · app.setup.ts
├── config/                 환경변수 검증, TypeORM·Swagger 설정
├── database/               CLI용 DataSource, migrations/, scripts/
├── common/                 모든 컨텍스트가 쓰는 것
│   ├── domain/             AggregateRoot, DomainEvent, DomainError, 한국 시간 날짜 계산 + 공유 커널(VehicleType, UserRole, PhoneNumber, 배차 반경)
│   ├── application/        AuthenticatedUser, 이벤트 발행 포트, 파일 보관 포트, 페이지 입력
│   ├── infrastructure/     이벤트 발행기, persistAggregate(낙관적 잠금 저장), 디스크 파일 보관소
│   └── presentation/       예외 필터, 공통 요청 DTO
└── modules/
    ├── user/               회원, 내 정보 수정
    ├── auth/               가입(약관 동의)·로그인·토큰·비밀번호 찾기, 전역 인증·역할 가드
    ├── driver/             라이더 서류·등록·심사, 운행 상태·운행 시간, 위치, 정산 계좌
    ├── order/              배달 요청·견적, 배차·출발·도착·픽업·완료, 추적, 수입·정산, 운영자 배달 관제·현금 수금
    ├── notification/       푸시 기기 등록, 이벤트 → 푸시 알림 (FCM), 알림함, 알림 설정
    ├── admin/              운영자 계정(권한·초대·비활성화), 운영자 API의 권한 확인
    ├── account/            회원 탈퇴, 운영자의 회원 조회·정지 (여러 컨텍스트에 걸친 작업)
    ├── address/            주소·장소 검색 (카카오 로컬)
    ├── content/            공지사항, 약관·정책, 고객센터 연락처
    ├── store/              가게(음식점) 등록·심사, 충전금
    ├── platform-policy/    운영자가 배포 없이 바꾸는 정책 (주문앱 수수료율·정산 주기·가입 방식 등)
    ├── marketplace/        주문앱 '따끈': 가게 운영 설정·메뉴, 가게 찾기, 장바구니·주문·결제(PG)·환불, 주문 → 배달 연결, 가게 정산, 리뷰, 손님 주소
    └── health/
```

`account` `address` `content`는 작아서 계층 폴더 아래에 하위 폴더(`use-cases/` `dto/` 등) 없이 파일을 바로 둔다. 계층 규칙은 똑같이 적용된다.

```
modules/<컨텍스트>/
├── domain/                 순수 TypeScript. 프레임워크·DB를 모른다.
│   ├── entities/           애그리거트 (상태 전이와 불변식)
│   ├── value-objects/      값 객체 (생성 시 검증)
│   ├── services/           도메인 서비스 (예: SettlementPolicy)
│   ├── events/             도메인 이벤트
│   └── repositories/       저장소 인터페이스 + DI 토큰
├── application/            유스케이스. 도메인을 조합하고 포트를 부른다.
│   ├── use-cases/          유스케이스 하나에 클래스 하나 (execute)
│   ├── ports/              바깥 세계에 요구하는 인터페이스
│   └── dto/                응답 모델 (*.result.ts)
├── infrastructure/         포트·저장소 구현
│   ├── entities/           TypeORM 엔티티 (*.orm-entity.ts)
│   ├── mappers/            도메인 ↔ ORM 변환
│   ├── repositories/       저장소 구현 (*.typeorm.repository.ts)
│   └── adapters/           외부 서비스·다른 컨텍스트 연결
└── presentation/           HTTP
    ├── controllers/
    └── dto/                요청 모델과 입력 검증 (*.request.ts)
```

### 의존 규칙

```
presentation ──┐
               ├──▶ application ──▶ domain
infrastructure ┘
```

| 계층           | import할 수 있는 것                                          |
| -------------- | ------------------------------------------------------------ |
| domain         | domain, `node:` 내장 모듈                                    |
| application    | domain, application, `@nestjs/common`(DI 데코레이터)         |
| infrastructure | domain, application, infrastructure, 모든 패키지             |
| presentation   | domain, application, presentation (TypeORM·저장소 구현 금지) |

`src/architecture.spec.ts`가 import 문을 읽어 이 규칙을 검사한다. 어기면 `npm test`가 실패한다.

### 규칙을 지키는 방법

- **오류**: 도메인·유스케이스는 `DomainError`(InvalidArgument / Unauthenticated / Forbidden / NotFound / Conflict)를 던진다. HTTP 상태 코드로 옮기는 곳은 `HttpExceptionFilter` 하나다. 응답은 항상 `{ statusCode, code, message, timestamp, path }`.
- **저장**: 애그리거트는 `snapshot()`으로 상태를 내주고 `restore()`로 되살아난다. 매퍼가 그 사이를 옮긴다.
- **컨텍스트 사이**: 배달은 라이더·가게를 직접 import하지 않는다. `DriverDirectory` · `StoreWallet` 포트로 필요한 것만 요청하고, 어댑터가 라이더·회원·가게 저장소를 읽어 채운다.
- **인증**: 모든 라우트는 기본으로 로그인이 필요하다. 열어 둘 라우트에만 `@Public()`, 역할 제한은 `@Roles()`.
- **이벤트**: 애그리거트가 `raise()`로 쌓은 이벤트를 유스케이스가 저장 뒤 발행한다. 리스너는 `@OnEvent('order.*')`로 구독한다. 알림 모듈이 이렇게 배달 이벤트를 받아 푸시를 보낸다 — 배달 모듈은 알림 모듈을 모른다.

### ESM 주의

- 상대 경로 import에는 `.js` 확장자를 붙인다 (`./user.entity.js`).
- `@Inject(TOKEN)`으로 주입받는 인터페이스는 `type`으로 import한다. 안 그러면 TS1272 오류가 난다.

  ```ts
  import { USER_REPOSITORY, type UserRepository } from '...';
  ```

## 도메인

> 2026-10-15 퀵·화물 중개에서 **음식점 배달대행**으로 바꿨다. 화물 시절 코드와 데이터(카드 결제·환불, 차종별 요금, 평가, 메시지, 자주 쓰는 주소, 노쇼)는 지웠다 — 바꾸기 전 상태는 git 커밋 `04c959d`, DB는 마이그레이션 `RemoveFreight`.

**역할** — `CUSTOMER`(가게 사장님 — 배달 요청, 주문앱 주문 접수), `DRIVER`(라이더 — 배달 수행), `CONSUMER`(주문앱 '따끈' 손님 — 음식 주문), `ADMIN`(가게·라이더 심사, 배달·주문 관제, 정산, 공지·약관 관리)

**가게** — 사장님 계정 하나에 가게 하나(상호, 사업자등록번호 — 검증 숫자 확인, 전화, 주소 = 픽업지). 운영자가 승인해야 배달을 요청할 수 있고, 반려된 가게는 정보를 고치면 다시 심사를 받는다. 배달대행료는 **충전금**에서 빠진다 — 잔액은 가게에만 있고(낙관적 잠금), 바뀔 때마다 내역(`store_wallet_entries`: 충전·대행료 차감·환불·운영자 조정)을 같은 트랜잭션으로 남긴다. 충전은 1만~200만 원이고, 실제 충전(포트원 가상계좌, 작업 35.2)을 붙이기 전에는 개발 서버에서만 바로 충전된다.

**회원** — 가입할 때 이용약관·개인정보 동의가 필수이고 마케팅 수신은 선택이다. 동의한 시각과, 그때 시행 중이던 약관의 판 번호를 남긴다(`legal_consents` — 올린 판이 없었으면 비어 있다). 비밀번호는 영문과 숫자를 섞어 8자 이상. 한 이메일로 15분 안에 다섯 번 틀리면 15분 동안 로그인을 막는다(429 `LOGIN_LOCKED`, 맞는 비밀번호여도 — 가입하지 않은 이메일도 똑같이). 탈퇴하면 회원의 이름·이메일·휴대폰·비밀번호와 알림 설정·라이더의 마지막 위치를 지우고 모든 기기에서 로그아웃시키며, 같은 이메일로 다시 가입할 수 있다 (라이더 서류 파일·정산 계좌는 아직 남는다 — 보관 기간을 정해야 한다). 끝나지 않은 배달(라이더는 진행 중인 배달, 손님은 결제했고 끝나지 않은 주문)이 있으면 탈퇴할 수 없다. 손님이 탈퇴하면 저장한 배달 주소도 지운다.

**손님 가입** — `role: CONSUMER`는 휴대폰 인증을 먼저 한다: `POST /auth/phone-verifications`로 6자리 코드를 문자로 받고(5분 유효, 같은 번호는 1분에 한 번, 휴대폰 번호만), `POST /auth/phone-verifications/confirm`으로 맞히면 받은 `verificationToken`(30분, 한 번)을 가입에 함께 보낸다. 다섯 번 틀리면 코드를 다시 받아야 한다. 인증을 받을지는 정책(`consumerPhoneVerificationRequired`)으로 끌 수 있다.

**라이더**

```
서류 3종 올리기 ──▶ 등록 신청 PENDING ──심사──▶ APPROVED ──오토바이 변경 신청──▶ PENDING
                                          └──▶ REJECTED ──반려된 서류를 다시 올리고 재신청──▶ PENDING
```

- 이동 수단은 오토바이뿐이다(`VehicleType.MOTORCYCLE`). 등록할 때 번호판을 받는다.
- 서류(운전면허증·이륜자동차 사용신고필증·유상운송 보험 증권)를 모두 올려야 신청할 수 있다. 사진(JPG·PNG·WEBP·HEIC)이나 PDF, 10MB까지. 형식은 파일 내용으로 판단한다 (클라이언트가 보낸 Content-Type은 믿지 않는다).
- 반려할 때 문제가 된 서류를 짚으면 라이더는 그 서류만 다시 올리면 된다.
- 승인된 라이더만 운행을 시작(`available`)할 수 있고, 운행 중인 라이더만 콜을 받는다. 운행을 켜고 끈 시각을 기록해 오늘 운행 시간을 보여준다.
- **배차 반경** — 라이더 앱은 운행 중에 15초마다 위치를 보낸다(`PUT /drivers/me/location`). 최근 10분 안에 위치를 보낸 라이더의 콜 목록에는 가게가 **5km**(`common/domain/dispatch-area.ts`) 안인 배달만 가까운 순으로 보이고(`radiusKm`), 새 콜 알림도 그 라이더들에게만 간다. 최근 위치가 없으면 콜 목록은 대기 중인 배달 전부(`radiusKm: null`)를 보여 주지만 알림은 가지 않는다.
- **묶음배송** — 한 라이더는 동시에 3건까지 맡는다(`MAX_ACTIVE_DELIVERIES`). 넘으면 409 `TOO_MANY_ACTIVE_DELIVERIES`.
- 오토바이를 바꾸면 다시 심사를 받는다. 운행 중에는 바꿀 수 없다.
- 수입 = 완료한 배달의 대행료 − 수수료 + 취소 보상. 수수료는 배달마다 대행료의 `COMMISSION_RATE_PERCENT`%(기본 10)를 10원 단위로 반올림한 값이다(3,500원 → 3,150원). 취소 보상은 가게가 낸 취소 수수료 중 `DRIVER_CANCELLATION_SHARE_PERCENT`%(기본 0 — 플랫폼이 갖는다). 라이더가 보는 배달에는 받는 금액(`earning`)이 붙는다.
- 정산은 한 주(월~일)에 끝난 배달을 모아 그다음 주의 `SETTLEMENT_PAYOUT_WEEKDAY` 요일(기본 화요일)에 한다 (`order/domain/services/settlement-policy.ts`). 운영자가 라이더별 정산액을 보고 **지급 처리**하면 라이더마다 이체를 요청하고 결과(완료·진행 중·실패와 사유)를 남긴다. 실패한 지급은 다시 할 수 있다. 지금은 수동 지급(`ManualPayoutGateway`)이라 늘 완료다 — 운영자가 은행에서 직접 보낸 것을 기록한다. 날짜는 모두 한국 시간 기준이다.
- 정산 계좌는 저장할 때 본인 명의인지 확인한다 (`AccountVerifier` 포트, 지금은 예금주 이름 = 가입자 이름인지만 보는 개발용 `NameMatchAccountVerifier`). 계좌가 없거나 확인되지 않은 라이더의 정산은 **보류**되고, 라이더 앱의 정산 내역(`GET /dispatch/settlements`)에 이유가 보인다.

**배달**

```
REQUESTED ──accept──▶ ASSIGNED ──depart──▶ DEPARTED ──arrive──▶ ARRIVED ──pickup──▶ PICKED_UP ──complete──▶ DELIVERED
픽업 전까지는 가게가 취소할 수 있다 (CANCELLED).
```

- **요청** — 가게가 손님 주소·연락처(배달앱 안심번호 12자리도 받는다)·음식값·받는 방식·조리 완료까지 남은 분을 보낸다(`POST /deliveries`). 픽업지는 가게 주소다. 요청할 때 대행료가 충전금에서 빠지고(모자라면 409 `INSUFFICIENT_WALLET_BALANCE`), 승인 전 가게는 요청할 수 없다(409 `STORE_NOT_APPROVED`). `POST /deliveries/quotes`로 거리·대행료·잔액을 미리 본다.
- **대행료** — 2km까지 3,500원, 넘으면 1km(올림)마다 500원, 밤(22시~6시) 500원 더. 10km를 넘으면 받지 않는다(400 `DELIVERY_TOO_FAR`). 값은 `order/domain/value-objects/store-delivery.ts`의 `DeliveryFeePolicy` (**임시**).
- **받는 방식** — `PREPAID`(배달앱 선결제) · `CASH` · `CARD`(만나서 결제). 만나서 결제는 음식값이 있어야 하고(400 `FOOD_AMOUNT_REQUIRED`), 라이더가 완료할 때 받은 방식과 금액을 넣어야 한다(400 `COLLECTION_REQUIRED`). 라이더가 받은 현금을 가게에 넘겼는지는 운영자가 **라이더 현금 수금**에서 표시한다(`PATCH /admin/rider-cash/:id`).
- **배차** — 선착순이다. 먼저 수락한 라이더 한 명에게 배차되고, 동시에 수락하면 낙관적 잠금(`version`)으로 나머지는 409를 받는다. 결제는 없다 — 대행료는 요청할 때 이미 빠졌다. 수락할 때 라이더 위치와 조리 완료 시각으로 픽업 예정을 어림한다(둘 중 늦은 쪽).
- **취소 수수료** — 라이더가 출발하기 전 0원, 가게로 '출발'한 뒤(도착 포함) 대행료의 15%(원 단위 반올림, 3,500원 → 525원). 나머지는 충전금으로 돌려준다. 픽업한 뒤에는 취소할 수 없다. 출발을 누르지 않고 도착하거나 픽업하면 그때 출발·도착한 것으로 본다.
- 수락 전 라이더에게는 **동 단위 위치(구·동)와 약 1km로 흐린 좌표**, 가게 이름과 받을 음식값만 보여준다. 손님 주소·상세 주소·연락처·요청 사항은 수락한 뒤에 보인다.
- 라이더 앱이 위치를 보내면 콜에 가게까지의 거리가 붙고, 가게는 배달 추적(`GET /orders/:id/tracking`)에서 라이더 위치와 예정 시각을 본다.
- **배달 관제** — 운영자는 진행 중인 배달을 보고, 요청하고 10분 넘게 배차되지 않은 건(`DISPATCH_LATE`)과 픽업 예정을 20분 넘긴 건(`PICKUP_LATE`)을 위로 올려 본다.

**주문앱 '따끈'** (`modules/marketplace`)

```
PENDING_PAYMENT ──결제 확인──▶ PLACED ──가게 접수(조리 시간)──▶ ACCEPTED ──라이더 픽업──▶ PICKED_UP ──배달 완료──▶ DELIVERED
                                 └──가게 거절──▶ REJECTED (전액 환불)
손님 취소: 가게가 받기 전까지 · 가게 취소: 받은 뒤 픽업 전까지 · 운영자 취소: 픽업 전까지 → CANCELLED (결제했으면 전액 환불)
```

- **가게 운영 설정** — 가게(심사 승인) 하나에 주문앱 가게 하나. 처음 열면 기본값으로 만든다. 음식 종류, 소개·원산지, 최소 주문 금액, 배달 거리(직선 0.5~10km), **주문금액별 배달팁**(`[{minOrderAmount, tip}]`, 0원 기준부터)과 **거리별 추가 배달팁**(`[{overKm, extra}]`), 요일별 영업시간(닫는 시각이 여는 시각보다 이르면 다음 날 새벽까지, `24:00` 가능), 쉬는 날, 임시 휴업(24시간까지), 주문 받기 켜기·끄기. 켜려면 손님에게 보이는 메뉴가 있어야 한다. 지금 주문을 받는지는 한국 시간으로 계산하고, 받지 않으면 `closedReason`(NOT_OPENED·HIDDEN·PAUSED·HOLIDAY·OUTSIDE_HOURS)을 준다.
- **메뉴** — 카테고리(30개까지)와 메뉴(300개까지). 메뉴마다 옵션 묶음(필수·선택, 고를 수 있는 개수)과 옵션(추가 금액, 품절). 품절은 보이지만 담을 수 없고, 숨김은 보이지 않는다. 사진은 JPG·PNG·WEBP 5MB까지이고 `GET /storefronts/:storeId/images/:file`로 로그인 없이 받는다.
- **가게 찾기** — 손님 위치가 가게의 배달 거리 안이고, 승인됐고, 운영자가 내리지 않았고, 보이는 메뉴가 있는 가게만 보인다. 정렬: 거리·배달팁·최근 30일 주문 많은 순·별점 (어느 정렬이든 지금 받는 가게가 먼저). 가게 이름과 메뉴 이름으로 찾는다.
- **금액** — 손님 앱이 보낸 금액은 믿지 않는다. 서버가 메뉴·옵션 가격으로 메뉴 금액을 다시 계산하고 배달팁(가게 설정 × 직선 거리)을 더해 결제 금액을 정한다. `POST /storefronts/:storeId/quote`로 미리 보고(최소 주문 미달·배달 불가·영업 종료는 `blocker`), 주문하면 주문 당시의 메뉴 이름·가격과 **정책의 수수료율을 주문에 남긴다** — 나중에 정책을 바꿔도 지난 주문의 정산은 그대로다.
- **결제** — `POST /food-orders`가 주문(`PENDING_PAYMENT`)을 만들고 PG에 금액을 미리 등록한 뒤 결제창 값(`checkout`)을 준다. 결제창이 닫히면 앱이 `POST /food-orders/:id/payment/complete`를 부르고, 서버가 PG에 결제 상태와 금액을 물어 맞으면 가게에 주문이 들어간다(`PLACED`, 사장님에게 새 주문 푸시). PG 웹훅(`POST /webhooks/payments`, 서명 확인)으로도 같은 처리를 하며 먼저 온 쪽이 처리한다. 금액이 다르거나 이미 취소한 주문에 결제가 들어오면 PG 결제를 바로 취소한다. 결제하지 않은 주문은 가게·손님 목록에 보이지 않는다.
- **환불** — 취소·거절이면 남은 결제 금액 전부, 배달이 끝난 뒤에는 운영자가 일부를 돌려준다(누가 떠안는지 `borneBy`: STORE면 가게 정산에서 뺀다). 주문 상태를 먼저 저장해 동시에 들어온 접수와 겨룬 뒤 PG에 환불을 요청하고(`PENDING → DONE`), PG가 거절하면 `FAILED`로 남겨 운영자가 다시 시도한다(`POST /admin/food-orders/:id/refunds/retry`). PG에는 지금 돌려줄 수 있다고 아는 금액을 함께 보내 두 번 돌려주지 않는다.
- **배달 연결** — 가게가 조리 시간(0~120분)을 정해 받으면 배달 컨텍스트에 배달을 요청한다(`orders.source = FOOD_ORDER`, 선결제라 라이더가 받을 돈 없음, 메모에 `[따끈 주문번호] 메뉴 요약 · 총 N개`). 이 배달은 **충전금에서 빠지지 않고** 가게 정산에서 뺀다. 가게의 배달 화면에서는 취소할 수 없고(409 `LINKED_TO_FOOD_ORDER`) 주문 화면에서 취소한다. 라이더의 픽업·완료 이벤트로 주문 상태가 바뀐다. 손님은 `GET /food-orders/:id/tracking`으로 라이더 위치를 본다.
- **가게 정산** — 배달이 끝나면 정산 내역(`store_settlement_entries`)에 한 줄 쌓는다: **메뉴 금액 + 배달팁 − 중개수수료(메뉴 금액 × 주문 당시 요율) − 결제수수료(결제 금액 × 요율) − 배달대행료**. 라이더가 출발한 뒤 가게가 취소하면 배달 취소 수수료, 가게 부담 부분 환불은 음수로 쌓는다(운영자가 취소한 주문의 취소 수수료는 플랫폼이 낸다). 지급 예정일은 정책의 정산 주기로 정한다 — `DAILY`: 한국 날짜 + N일, `WEEKLY`: 그 주(월~일)의 다음 주 정한 요일. 운영자는 지급 예정 정산을 가게별로 보고 지급 처리한다 — 정산 계좌를 운영자가 확인했고(계좌를 바꾸면 다시 확인), 보류(사유)가 아니고, 합이 0원보다 커야 한다. 빼야 할 금액이 더 크면 다음 정산으로 넘어간다. 지금은 운영자가 직접 이체하고 기록한다.
- **리뷰** — 배달이 끝난 주문에 한 번, 정책의 기간(기본 7일) 안에. 별점 1~5와 글 500자. 이름은 가운데를 가린다(김*은).
- **운영자** — 주문 관제(결제하고 정책의 분(기본 5분)이 지나도록 가게가 받지 않은 **접수 지연**, 환불 실패), 주문 상세·취소·부분 환불, 입점 검수(가게 설정·메뉴·사진을 보고 손님 앱에서 내리기·다시 올리기), 가게 정산·계좌 확인·보류·지급.

**정책 — 정하지 않은 값은 운영자가 바꾼다** (`modules/platform-policy`, `GET·PUT /admin/marketplace-policy`, 바꾼 기록은 `…/history`). DB(`platform_policies`)에 두고 요청마다 읽어 배포 없이 바로 적용된다. 정산 권한(`SETTLEMENTS`)이 있는 운영자만 바꾼다.

| 정책                                | 기본값    | 쓰는 곳                                                |
| ----------------------------------- | --------- | ------------------------------------------------------ |
| `commissionRatePercent`             | 2         | 중개수수료율(%, 0~30, 소수 둘째 자리) — 주문에 남긴다  |
| `paymentFeeRatePercent`             | 0         | 결제수수료 중 가게가 내는 몫(%, 0~10) — 주문에 남긴다  |
| `consumerPhoneVerificationRequired` | true      | 손님 가입 때 휴대폰 인증                               |
| `storeSettlementCycle`              | WEEKLY    | 가게 정산 주기 DAILY · WEEKLY                          |
| `storeSettlementDelayDays`          | 1         | DAILY일 때 며칠 뒤에 지급 (0~30)                       |
| `storeSettlementPayoutWeekday`      | 3 (수)    | WEEKLY일 때 지급 요일 (0 = 일 … 6 = 토)                |
| `storeAcceptLateMinutes`            | 5         | 이 분 안에 가게가 받지 않으면 접수 지연                |
| `reviewWindowDays`                  | 7         | 배달 완료 뒤 리뷰를 쓸 수 있는 날 수                   |

배달팁 구조는 가게마다 운영 설정에서 정하고, PG사는 포트원 채널 키로 바꾼다 (아래 표).

## 임시 구현 — 출시 전에 바꿔 끼울 것

포트 뒤에 기본 구현을 뒀다. 구현체만 바꾸면 되고 유스케이스는 그대로다.

| 무엇                      | 지금                                                                                                                                                                                                        | 바꿀 곳                                                                        |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 경로·거리·소요 시간       | 카카오모빌리티 길찾기(`KakaoDirectionsRoutePlanner`, `KAKAO_REST_API_KEY`) — 승용차 경로. 같은 구간은 2분 동안 다시 묻지 않는다. 키가 없거나 길찾기가 안 되면 직선 거리 × 1.3 어림(`EstimatedRoutePlanner`) | 이륜차 경로, 무료 한도(하루 10,000건) 넘을 때의 요금 확인 (작업 29)            |
| 비밀번호 재설정 코드 발송 | 보내지 않고 개발 서버 로그에만 남긴다. **운영에서는 코드가 전달되지 않는다**                                                                                                                                | `ResetCodeSender` 포트 → 이메일·문자 구현 (`LoggingResetCodeSender` 대신)      |
| 서류 파일 보관            | 서버 디스크 (`UPLOAD_DIR`). 서버가 한 대일 때만 맞다                                                                                                                                                        | `FileStorage` 포트 → 객체 저장소 구현 (`LocalFileStorage` 대신)                |
| 운영자 초대 메일          | 보내지 않고 개발 서버 로그에 초대 링크를 남긴다. **운영에서는 전달되지 않는다**                                                                                                                             | `AdminInvitationSender` 포트 → 메일 구현 (`LoggingAdminInvitationSender` 대신) |
| 대행료표 · 필요 서류      | 코드에 `TODO`로 표시한 임시 정책 (2km 3,500원 + km당 500원, 밤 500원, 취소 15%)                                                                                                                             | `DeliveryFeePolicy` · `REQUIRED_DOCUMENTS`                                     |
| 수수료율 · 정산 지급 요일 | 환경변수의 기본값 (10%, 화요일)                                                                                                                                                                             | `COMMISSION_RATE_PERCENT` · `SETTLEMENT_PAYOUT_WEEKDAY`                        |
| 충전금 충전               | 개발 서버에서만 바로 충전된다 (운영은 503 `TOP_UP_NOT_READY`)                                                                                                                                               | 포트원 V2 가상계좌·카드 충전 (`PORTONE_*`, 작업 35.2)                          |
| 정산금 이체               | 수동 — 운영자가 직접 보내고 지급 처리로 기록한다                                                                                                                                                            | `PayoutGateway` 포트 → PG사 지급대행 (`ManualPayoutGateway` 대신)              |
| 정산 계좌 본인 확인       | 예금주 이름 = 가입자 이름인지만 본다                                                                                                                                                                        | `AccountVerifier` 포트 → 계좌 실명 조회 (`NameMatchAccountVerifier` 대신)      |
| 주문앱 손님 결제(PG)      | 포트원 키(`PORTONE_API_SECRET`·`STORE_ID`·`CHANNEL_KEY`)가 있으면 포트원 V2 — PG사는 채널 키로 정한다. 없으면 개발에서는 결제창 없이 결제되는 `DevPaymentGateway`, 운영에서는 결제를 받지 않는다(503)      | 포트원 콘솔에서 채널·웹훅(`PORTONE_WEBHOOK_SECRET`) 설정                       |
| 손님 휴대폰 인증 문자     | 보내지 않고 개발 서버 로그에 코드를 남긴다. **운영에서는 전달되지 않는다**                                                                                                                                  | `SmsSender` 포트 → 문자 발송 구현 (`LoggingSmsSender` 대신)                    |
| 가게 정산금 이체          | 수동 — 운영자가 직접 보내고 지급 처리로 기록한다. 계좌는 운영자가 통장 사본으로 확인한다                                                                                                                    | PG사 지급대행 (`AdminStoreSettlementsUseCase.pay`)                             |
| 주문앱 예상 도착 시간     | 조리 20분 + 픽업 5분 + 직선 거리 × 1.3 ÷ 시속 20km 어림                                                                                                                                                     | `storefront-views.ts`의 `estimatedMinutes`                                     |

아직 없는 것: 실제 충전금 충전, 충전금이 모자랄 때의 알림, 손님이 보는 배달 추적 페이지.

**주소 검색**은 카카오 로컬 API(`KakaoLocalAddressSearch`)로 한다 — 앱이 `GET /address-search`를 부르고 서버가 `KAKAO_REST_API_KEY`로 카카오를 부른다(키를 앱에 넣지 않는다). 주소 검색과 키워드(장소 이름) 검색을 합쳐 15곳까지 준다. 키가 없으면 견본 주소 몇 곳에서만 찾고(`SampleAddressSearch`, e2e도 이것), 운영에서는 키가 없으면 서버가 뜨지 않는다. 카카오가 응답하지 않으면 503 `ADDRESS_SEARCH_UNAVAILABLE`. **확인할 것**: 카카오는 API 응답(주소·좌표)을 저장하지 말라고 안내한다 — 배달에 손님 주소를 저장하는 우리 구조가 허용되는지 출시 전에 카카오에 물어야 한다 (작업 32).

## 푸시 알림

배달 상태가 바뀌거나 심사 결과가 나오면 FCM으로 알린다 (iOS는 FCM이 APNs로 넘긴다).

| 일어난 일         | 받는 사람                                                   | `data.type`                        | 알림함 |
| ----------------- | ----------------------------------------------------------- | ---------------------------------- | ------ |
| 배달 요청 (새 콜) | 승인됐고 운행 중이며 가게 반경 안에 최근 위치를 보낸 라이더 | `ORDER_REQUESTED`                  | ✕      |
| 라이더 배정       | 가게                                                        | `ORDER_ASSIGNED`                   | ○      |
| 라이더 출발·도착  | 가게 (출발 알림에 취소 수수료 안내)                         | `ORDER_DEPARTED` · `ORDER_ARRIVED` | ○      |
| 픽업 완료         | 가게                                                        | `ORDER_PICKED_UP`                  | ○      |
| 배달 완료         | 가게                                                        | `ORDER_DELIVERED`                  | ○      |
| 배달 취소         | 배차돼 있던 라이더 (배차 전이면 없음)                       | `ORDER_CANCELLED`                  | ○      |
| 라이더 승인       | 그 라이더                                                   | `DRIVER_APPROVED`                  | ○      |
| 라이더 반려       | 그 라이더 (본문에 반려 사유)                                | `DRIVER_REJECTED`                  | ○      |
| 주문앱 새 주문    | 사장님 (`new-orders` 채널 — 소리)                           | `FOOD_ORDER_PLACED`                | ○      |
| 주문 접수·거절    | 손님                                                        | `FOOD_ORDER_ACCEPTED` · `FOOD_ORDER_REJECTED` | ○ |
| 주문 픽업·배달 완료 | 손님                                                      | `FOOD_ORDER_PICKED_UP` · `FOOD_ORDER_DELIVERED` | ○ |
| 주문 취소         | 손님 취소 → 사장님(결제한 주문만), 가게 취소 → 손님, 운영자 취소 → 둘 다 | `FOOD_ORDER_CANCELLED`  | ○      |

모든 알림의 `data`에 `type`이 실리고, 배달에 관한 알림에는 `orderId`, 주문앱 주문에 관한 알림에는 `foodOrderId`가 실린다.

**알림함** — 표에서 ○인 알림은 `GET /notifications`로 다시 볼 수 있다. 푸시를 못 받았거나 꺼 둔(`PATCH /notifications/settings`) 회원에게도 알림함에는 쌓인다. 금방 낡는 알림(새 콜)은 쌓지 않는다.

**서버 설정** — 가게 앱과 라이더 앱을 **같은 Firebase 프로젝트**에 등록하고, 그 프로젝트의 서비스 계정 키를 `FIREBASE_SERVICE_ACCOUNT_BASE64`에 넣는다 (`.env.local.example` 참고). 서비스 계정 하나로 두 앱 모두에 보낸다. 비워 두면 발송이 꺼지고, 누구에게 무엇이 나갔을지만 서버 로그에 남는다.

**앱이 할 일** (두 앱 공통)

1. 로그인한 뒤, 그리고 FCM 토큰이 바뀔 때마다 `PUT /push-devices` `{ token, platform: "ANDROID" | "IOS" }`. iOS도 APNs 토큰이 아니라 FCM 토큰을 보낸다.
2. 로그아웃하기 전에 `DELETE /push-devices/:token`.
3. Android 알림 채널을 서버와 같은 ID로 만든다: `new-orders`(새 콜), `order-status`(배달 상태), `account`(계정·심사).
4. 알림을 누르면 `data.type`에 맞는 화면을 연다 (배달 알림이면 `data.orderId`의 배달).

**동작 방식**

- 발송은 API 응답을 기다리게 하지 않는다. 푸시가 실패해도 배달 처리는 성공으로 끝난다.
- 한 배달의 상태 알림은 기기에서 쌓이지 않고 최신 상태 하나로 갱신된다.
- 앱을 지운 기기의 토큰은 FCM이 알려주는 대로 지운다.
- 같은 휴대폰에서 다른 계정으로 로그인해 토큰을 다시 등록하면 알림은 새 계정으로 간다.
- 새 콜 알림에는 콜 목록과 같은 범위(동 단위 위치와 대행료)만 싣는다. 손님 주소와 연락처는 싣지 않는다.

## API

모든 경로 앞에 `/api`가 붙는다. 자세한 스키마는 Swagger에 있다.

| 누가   | 메서드 · 경로                                                                              | 설명                                                             |
| ------ | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| 누구나 | `POST /auth/register` `login` `refresh` `logout`                                           | 가입(약관 동의 포함), 로그인, 토큰 갱신(회전)                    |
| 누구나 | `POST /auth/password-reset/request` `confirm`                                              | 비밀번호 찾기: 이메일로 6자리 코드 → 코드와 새 비밀번호          |
| 누구나 | `GET /legal/documents` · `GET /legal/documents/:type`                                      | 약관·정책 (시행 중인 판)                                         |
| 누구나 | `GET /support/contact` · `GET /support/business`                                           | 고객센터 연락처, 사업자 정보                                     |
| 누구나 | `GET /health`                                                                              | 서버·DB 상태                                                     |
| 회원   | `GET /users/me` · `PATCH /users/me`                                                        | 내 정보, 수정 (이름·휴대폰·마케팅 수신)                          |
| 회원   | `POST /users/me/withdraw`                                                                  | 회원 탈퇴 (비밀번호 확인)                                        |
| 회원   | `PUT /push-devices` · `DELETE /push-devices/:token`                                        | 푸시 수신 기기 등록·해제                                         |
| 회원   | `GET /notifications` · `unread-count` · `POST read-all` · `POST :id/read`                  | 알림함                                                           |
| 회원   | `GET /notifications/settings` · `PATCH`                                                    | 푸시 받기 켜기·끄기                                              |
| 회원   | `GET /notices` · `GET /notices/:id`                                                        | 공지사항 (자기 앱 대상만)                                        |
| 회원   | `GET /address-search?query=`                                                               | 주소·장소 검색 (카카오 로컬 API, 15곳까지)                       |
| 회원   | `GET /orders/:id` · `GET /orders/:id/tracking`                                             | 배달 상세(배차된 라이더 포함), 배달 추적                         |
| 사장님 | `POST /stores` · `GET /stores/me` · `PUT /stores/me`                                       | 가게 등록(심사 신청), 내 가게, 수정(반려 뒤 다시 심사)           |
| 사장님 | `GET /stores/me/wallet` · `POST /stores/me/wallet/top-ups`                                 | 충전금 잔액과 내역, 충전 (지금은 개발 서버에서만)                |
| 사장님 | `POST /deliveries/quotes` · `POST /deliveries`                                             | 거리·대행료·잔액 견적, 배달 요청 (대행료가 충전금에서 빠진다)    |
| 사장님 | `GET /orders` · `GET /orders/recent-destinations`                                          | 우리 가게 배달 목록(`?status=&from=&to=`), 최근 배달한 손님 주소 |
| 사장님 | `POST /orders/:id/cancel`                                                                  | 배달 취소 (출발 뒤면 수수료 15%를 빼고 충전금으로 환불)          |
| 라이더 | `GET /drivers/me/documents` · `PUT /drivers/me/documents/:type` · `GET …/file`             | 서류 상태, 올리기(multipart `file`), 올린 파일 보기              |
| 라이더 | `POST /drivers` · `GET /drivers/me`                                                        | 라이더 등록 신청(번호판), 내 라이더 정보(운행 시간 포함)         |
| 라이더 | `PATCH /drivers/me/availability` · `PUT /drivers/me/location`                              | 운행 시작·종료, 현재 위치 보고                                   |
| 라이더 | `POST /drivers/me/vehicle-change`                                                          | 오토바이 변경 신청                                               |
| 라이더 | `GET /drivers/me/settlement-account` · `PUT` · `POST …/verify`                             | 정산 계좌(저장할 때 본인 확인), 다시 확인                        |
| 라이더 | `GET /dispatch/open-orders` · `open-orders/:id`                                            | 콜 목록, 콜 하나                                                 |
| 라이더 | `POST /dispatch/orders/:id/accept` `depart` `arrive` `pickup` `complete`                   | 수락, 출발, 가게 도착, 픽업, 배달 완료(만나서 결제면 받은 돈)    |
| 라이더 | `GET /dispatch/my-orders` · `GET /dispatch/earnings` · `GET /dispatch/settlements`         | 배달 내역(`?from=&to=`), 수입과 다음 정산, 정산 내역             |
| 누구나 | `GET /auth/admin-invitations/:token` · `POST …/accept`                                     | 운영자 초대 확인, 수락(비밀번호를 정하면 바로 로그인)            |
| 누구나 | `POST /auth/phone-verifications` · `POST …/confirm`                                        | 손님 가입 휴대폰 인증: 문자 코드 → 가입에 쓰는 인증 토큰         |
| 누구나 | `GET /storefronts?latitude=&longitude=&category=&q=&sort=&openOnly=&maxMinOrder=`          | 주문앱 가게 찾기 (배달 거리 안, 지금 받는 가게 먼저)             |
| 누구나 | `GET /storefronts/:storeId?latitude=&longitude=` · `…/reviews` · `…/images/:file`          | 가게 상세·메뉴(위치를 주면 배달 가능·배달팁), 리뷰, 사진         |
| 누구나 | `POST /storefronts/:storeId/quote`                                                         | 장바구니 금액 확인 (메뉴 금액·배달팁·최소주문·배달 가능)         |
| 손님   | `GET /consumer/addresses` · `POST` · `PUT …/:id` · `POST …/:id/default` · `DELETE …/:id`   | 배달 주소 (10개까지, 기본 주소 하나)                             |
| 손님   | `POST /food-orders` · `POST /food-orders/:id/payment/complete`                             | 주문(PG 결제창 값을 준다), 결제 확인                             |
| 손님   | `GET /food-orders` · `GET /food-orders/:id` · `GET …/tracking`                             | 주문 내역, 상세(환불·배달 상태), 라이더 위치                     |
| 손님   | `POST /food-orders/:id/cancel` · `POST …/review`                                           | 취소(가게가 받기 전, 전액 환불), 리뷰                            |
| 사장님 | `GET /stores/me/storefront` · `PUT` · `PUT …/logo` `open` `pause`                          | 주문앱 운영 설정, 대표 사진, 주문 받기, 임시 휴업                |
| 사장님 | `GET /stores/me/menu` · `POST/PUT/DELETE …/categories(/:id)` · `…/items(/:id)`             | 메뉴 카테고리·메뉴·옵션                                          |
| 사장님 | `PUT /stores/me/menu/items/:id/sold-out` · `PUT …/photo`                                   | 품절, 메뉴 사진                                                  |
| 사장님 | `GET /stores/me/food-orders?tab=&date=` · `GET …/:id`                                      | 주문 탭(NEW·COOKING·DELIVERING·DONE, 탭별 건수), 상세            |
| 사장님 | `POST /stores/me/food-orders/:id/accept` `reject` `cancel`                                 | 접수(조리 시간 → 배달 자동 요청), 거절, 받은 주문 취소           |
| 사장님 | `GET /stores/me/settlements` · `…/entries` · `…/payouts`                                   | 주문앱 정산 예정·주문별 내역·받은 정산금                         |
| 사장님 | `GET /stores/me/settlement-account` · `PUT`                                                | 주문앱 정산 계좌 (바꾸면 운영자가 다시 확인)                     |
| 누구나 | `POST /webhooks/payments`                                                                  | PG 웹훅 (서명 확인)                                              |
| 운영자 | `GET /admin/me`                                                                            | 나와 내가 쓸 수 있는 메뉴(`areas`)                               |
| 운영자 | `GET /admin/stores` · `GET /admin/stores/:id` · `PATCH …/approve` `reject`                 | 가게 신청 목록, 상세, 심사                                       |
| 운영자 | `GET /admin/stores/wallets` · `GET /admin/stores/:id/wallet` · `POST …/wallet/adjustments` | 가게 충전금 현황, 가게의 충전금 내역, 운영자 조정(사유)          |
| 운영자 | `GET /admin/drivers` · `GET /admin/drivers/:id` · `…/documents/:type/file`                 | 라이더 신청 목록(`?status=&q=`, 상태별 건수), 상세, 서류         |
| 운영자 | `PATCH /admin/drivers/:id/approve` `reject`                                                | 라이더 심사 (반려는 사유와 반려할 서류)                          |
| 운영자 | `GET /admin/deliveries` · `GET /admin/deliveries/summary`                                  | 배달 관제: 진행 중 배달(`?flag=`, 지연 표시), 요약               |
| 운영자 | `GET /admin/rider-cash?date=&handed=` · `PATCH /admin/rider-cash/:id`                      | 라이더가 받은 현금, 가게에 넘김 표시                             |
| 운영자 | `GET /admin/users?role=&q=&status=` · `GET /admin/users/:id`                               | 회원 찾기(사장님·라이더·손님), 상세와 정지 이력                  |
| 운영자 | `POST /admin/users/:id/suspensions` · `DELETE …/suspensions/current`                       | 정지(7일·30일·무기한, 사유), 정지 해제                           |
| 운영자 | `GET /admin/settlements?weekStart=` · `POST /admin/settlements/payouts`                    | 한 주의 라이더별 정산, 지급 처리(결과: 완료·진행 중·실패)        |
| 운영자 | `GET /admin/payouts`                                                                       | 지급 내역 (실패와 사유 포함)                                     |
| 운영자 | `GET /admin/notices?state=` · `POST` · `DELETE /admin/notices/:id`                         | 공지 목록(게시 중·내린 공지), 올리기, 내리기                     |
| 운영자 | `GET /admin/legal-documents` · `POST`                                                      | 약관의 모든 판(시행 중·예정·이전), 새 판 올리기                  |
| 운영자 | `GET /admin/admins` · `POST` · `PATCH /admin/admins/:id` · `POST …/invitations`            | 운영자 목록, 초대, 권한·활성 변경, 초대 다시 보내기              |
| 운영자 | `GET /admin/marketplace-policy` · `PUT` · `GET …/history`                                  | 주문앱 정책 (수수료율·정산 주기·가입 방식 등), 바꾼 기록         |
| 운영자 | `GET /admin/food-orders?status=&storeId=&consumerUserId=&late=&refundFailed=&from=&to=`    | 주문 관제 (접수 지연 건수 포함)                                  |
| 운영자 | `GET /admin/food-orders/:id` · `POST …/cancel` `refunds` `refunds/retry`                   | 주문 상세, 취소, 부분 환불(누가 떠안는지), 환불 다시 시도        |
| 운영자 | `GET /admin/storefronts/:storeId` · `PUT …/visibility`                                     | 입점 검수(설정·메뉴·사진), 손님 앱에서 내리기·다시 올리기        |
| 운영자 | `GET /admin/store-settlements?asOf=` · `POST …/:storeId/pay` · `GET …/:storeId/entries`    | 지급할 가게 정산, 지급 처리, 가게의 정산 내역                    |
| 운영자 | `GET /admin/store-settlements/:storeId/account` · `POST …/verify` · `PUT …/hold`           | 정산 계좌(전체 번호), 계좌 확인, 지급 보류·해제                  |
| 운영자 | `GET /admin/store-payouts?storeId=`                                                        | 가게 정산 지급 내역                                              |

운영자 API는 메뉴(영역)마다 권한이 다르다 — 최고 관리자는 전부, 운영 관리자는 가게·라이더 심사·배달 관제·회원·공지·약관, 정산 담당은 배달 관제·충전금·현금 수금·정산 (`admin/domain/admin-role.ts`). 요청마다 운영자 계정의 지금 상태를 확인하므로 비활성화와 권한 변경이 바로 적용된다.
날짜를 받는 쿼리(`from` `to`)는 한국 날짜 `YYYY-MM-DD`이고 양 끝을 포함한다.

## DB 마이그레이션

스키마는 마이그레이션으로만 바꾼다 (`synchronize`는 쓰지 않는다). CLI는 빌드된 `dist`에서 돌기 때문에 아래 스크립트가 먼저 빌드한다.

```bash
# ORM 엔티티를 고친 뒤 — 현재 DB와의 차이로 마이그레이션 파일을 만든다
npm run migration:generate -- src/database/migrations/AddSomething
npm run migration:run       # 적용
npm run migration:revert    # 마지막 하나 되돌리기
npm run migration:check     # 엔티티와 DB가 어긋나면 실패 (CI용)
```

- ORM 엔티티 파일은 `modules/<컨텍스트>/infrastructure/entities/*.orm-entity.ts`에 둔다. CLI는 이 이름 규칙으로 엔티티를 찾는다 — 다른 이름으로 두면 그 테이블이 마이그레이션에서 조용히 빠진다 (`test/schema.e2e-spec.ts`가 잡는다).
- NOT NULL 컬럼을 더하면 생성된 파일을 손봐야 한다: 컬럼 추가 → 기존 행 채우기 → `SET NOT NULL`. 생성기는 이미 있는 행을 고려하지 않는다.
- 모든 테이블과 컬럼에 설명(comment)을 단다 — `@Entity({ comment })`, `@Column(..., { comment })`. 값이 정해진 컬럼은 값 목록을 적는다 (예: `PENDING | APPROVED | REJECTED`). 빠지면 `test/schema.e2e-spec.ts`가 실패한다. DB 클라이언트에서 `\d+ 테이블`로 본다.

## 테스트

```bash
npm test            # 단위 테스트 — DB 없이 도메인·유스케이스·계층 규칙 검사
npm run test:e2e    # e2e — 실제 PostgreSQL(movo_test)에 붙어 HTTP부터 DB까지
npm run typecheck
npm run lint
```

e2e는 시작할 때 `movo_test`의 테이블을 모두 지우고 다시 만든다. DB 이름이 `_test`로 끝나지 않으면 중단한다. 푸시 발송기와 인증 코드 발송기는 기록만 하는 가짜로 바꿔 끼우고, 올린 서류는 임시 폴더에 두었다가 지운다 (`test/support/harness.ts`).

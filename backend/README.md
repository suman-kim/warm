# MOVO Backend

개인 사용자와 퀵배송·화물 기사를 연결하는 서비스의 백엔드.
고객 앱과 기사 앱, 두 앱이 이 서버 하나를 함께 쓴다 — 로그인한 회원의 역할(`CUSTOMER` / `DRIVER`)로 쓸 수 있는 API가 갈린다.

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
  node tool/seed-demo.mjs          # 운영자 5명, 기사 15명, 고객 10명, 주문·정산·공지·약관
  ```

  모든 계정의 비밀번호는 `movo1234`, 최고 관리자는 `haeun.jung@movo.kr`이다.

- 앱과 운영자 웹을 직접 써 볼 테스트 계정 (개발용 DB에서만 돈다. 서버가 떠 있어야 한다. 다시 돌리면 비밀번호를 되돌리고 빠진 것만 채운다):

  ```bash
  node tool/seed-accounts.mjs      # 고객 1, 기사 2, 운영자 1, 비밀번호는 모두 12341234
  ```

  | 역할   | 이메일                 | 상태                                   |
  | ------ | ---------------------- | -------------------------------------- |
  | 고객   | `zzsdsdsd@gmail.com`   | 결제 카드(개발용 신한카드 4821) 등록됨 |
  | 기사   | `zzsdsdsd92@daum.net`  | 다마스, 승인됨, 정산 계좌 본인 확인됨  |
  | 기사   | `driver1@naver.com`    | 다마스, 승인됨, 정산 계좌 본인 확인됨  |
  | 운영자 | `gimsuman92@naver.com` | 최고 관리자                            |

  `12341234`는 가입 규칙(영문과 숫자 포함)에 맞지 않아 앱에서는 이 비밀번호로 가입할 수 없다 — 스크립트가 비밀번호만 DB에 직접 넣는다. 견본 데이터도 넣으려면 `seed-demo.mjs`를 먼저 돌린다.

- 기사 심사는 운영자 웹에서 한다. 앱만 돌려 볼 때는 심사 대기 중인 기사를 서류를 보지 않고 한 번에 승인하는 도구를 쓴다 (서버가 떠 있어야 한다).

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
- 운영은 `NODE_ENV=production`이다. 포트원 키(`PORTONE_STORE_ID` · `PORTONE_CHANNEL_KEY` · `PORTONE_API_SECRET`)가 없으면 서버가 뜨지 않는다. 로컬은 키를 비우면 개발용 결제로 돈다.
- e2e 테스트는 `APP_ENV=test`로 `movo_test` DB를 쓴다 (`vitest.config.e2e.ts`).

## 구조

컨텍스트(모듈)마다 같은 네 계층을 둔다.

```
src/
├── main.ts · app.module.ts · app.setup.ts
├── config/                 환경변수 검증, TypeORM·Swagger 설정
├── database/               CLI용 DataSource, migrations/, scripts/
├── common/                 모든 컨텍스트가 쓰는 것
│   ├── domain/             AggregateRoot, DomainEvent, DomainError, 한국 시간 날짜 계산 + 공유 커널(VehicleType, UserRole, PhoneNumber)
│   ├── application/        AuthenticatedUser, 이벤트 발행 포트, 파일 보관 포트, 페이지 입력
│   ├── infrastructure/     이벤트 발행기, persistAggregate(낙관적 잠금 저장), 디스크 파일 보관소
│   └── presentation/       예외 필터, 공통 요청 DTO
└── modules/
    ├── user/               회원, 내 정보 수정
    ├── auth/               가입(약관 동의)·로그인·토큰·비밀번호 찾기, 전역 인증·역할 가드
    ├── driver/             기사 서류·등록·심사, 운행 상태·운행 시간, 위치, 정산 계좌
    ├── order/              배송 요청, 요금 견적, 배차·픽업·배송 완료, 추적·길안내, 평가, 메시지, 수입
    ├── notification/       푸시 기기 등록, 이벤트 → 푸시 알림 (FCM), 알림함, 알림 설정
    ├── admin/              운영자 계정(권한·초대·비활성화), 운영자 API의 권한 확인
    ├── account/            회원 탈퇴, 운영자의 회원 조회·정지 (여러 컨텍스트에 걸친 작업)
    ├── address/            자주 쓰는 주소
    ├── content/            공지사항, 약관·정책, 고객센터 연락처
    └── health/
```

`account` `address` `content`는 작아서 계층 폴더 아래에 하위 폴더(`use-cases/` `dto/` 등) 없이 파일을 바로 둔다. 계층 규칙은 똑같이 적용된다.

```
modules/<컨텍스트>/
├── domain/                 순수 TypeScript. 프레임워크·DB를 모른다.
│   ├── entities/           애그리거트 (상태 전이와 불변식)
│   ├── value-objects/      값 객체 (생성 시 검증)
│   ├── services/           도메인 서비스 (예: FarePolicy)
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
- **컨텍스트 사이**: 주문은 기사를 직접 import하지 않는다. `DriverDirectory` 포트로 필요한 것만 요청하고, `DriverDirectoryAdapter`가 기사·회원 저장소를 읽어 채운다.
- **인증**: 모든 라우트는 기본으로 로그인이 필요하다. 열어 둘 라우트에만 `@Public()`, 역할 제한은 `@Roles()`.
- **이벤트**: 애그리거트가 `raise()`로 쌓은 이벤트를 유스케이스가 저장 뒤 발행한다. 리스너는 `@OnEvent('order.*')`로 구독한다. 알림 모듈이 이렇게 주문 이벤트를 받아 푸시를 보낸다 — 주문 모듈은 알림 모듈을 모른다.

### ESM 주의

- 상대 경로 import에는 `.js` 확장자를 붙인다 (`./user.entity.js`).
- `@Inject(TOKEN)`으로 주입받는 인터페이스는 `type`으로 import한다. 안 그러면 TS1272 오류가 난다.

  ```ts
  import { USER_REPOSITORY, type UserRepository } from '...';
  ```

## 도메인

**역할** — `CUSTOMER`(배송 요청), `DRIVER`(배송 수행), `ADMIN`(기사 심사, 공지·약관 관리)

**회원** — 가입할 때 이용약관·개인정보 동의가 필수이고 마케팅 수신은 선택이다. 동의한 시각과, 그때 시행 중이던 약관의 판 번호를 남긴다(`legal_consents` — 올린 판이 없었으면 비어 있다). 비밀번호는 영문과 숫자를 섞어 8자 이상. 한 이메일로 15분 안에 다섯 번 틀리면 15분 동안 로그인을 막는다(429 `LOGIN_LOCKED`, 맞는 비밀번호여도 — 가입하지 않은 이메일도 똑같이). 탈퇴하면 회원의 이름·이메일·휴대폰·비밀번호와 자주 쓰는 주소·알림 설정·기사의 마지막 위치를 지우고 모든 기기에서 로그아웃시키며, 같은 이메일로 다시 가입할 수 있다 (기사 서류 파일·정산 계좌는 아직 남는다 — 보관 기간을 정해야 한다). 끝나지 않은 주문(기사는 진행 중인 배송)이 있으면 탈퇴할 수 없다.

**기사**

```
서류 3종 올리기 ──▶ 등록 신청 PENDING ──심사──▶ APPROVED ──차량 변경 신청──▶ PENDING
                                          └──▶ REJECTED ──반려된 서류를 다시 올리고 재신청──▶ PENDING
```

- 서류(운전면허증·자동차등록증·화물운송 종사 자격증)를 모두 올려야 신청할 수 있다. 사진(JPG·PNG·WEBP·HEIC)이나 PDF, 10MB까지. 형식은 파일 내용으로 판단한다 (클라이언트가 보낸 Content-Type은 믿지 않는다).
- 반려할 때 문제가 된 서류를 짚으면 기사는 그 서류만 다시 올리면 된다.
- 승인된 기사만 운행을 시작(`available`)할 수 있고, 운행 중인 기사만 배차를 받는다. 운행을 켜고 끈 시각을 기록해 오늘 운행 시간을 보여준다.
- **배차 반경** — 기사 앱은 운행 중에 15초마다 위치를 보낸다(`PUT /drivers/me/location`). 최근 10분 안에 위치를 보낸 기사의 대기 목록에는 픽업지가 차종별 반경(오토바이 5km, 다마스·라보 10km, 1톤 15km, 2.5톤 20km, 5톤 30km — **임시**, `common/domain/dispatch-area.ts`) 안인 주문만 가까운 순으로 보이고(`radiusKm`), 새 주문 알림도 그 기사들에게만 간다. 최근 위치가 없으면 대기 목록은 차종의 주문 전부(`radiusKm: null`)를 보여 주지만 알림은 가지 않는다.
- 차량을 바꾸면 다시 심사를 받는다. 운행 중에는 바꿀 수 없다.
- 수입 = 완료한 배송의 최종 요금(추가 요금·대기료 포함) − 수수료 + 취소 보상. 수수료는 배송마다 최종 요금의 `COMMISSION_RATE_PERCENT`%(기본 10)를 10원 단위로 반올림한 값이다. 취소 보상은 고객이 낸 취소 수수료·노쇼 요금 중 `DRIVER_CANCELLATION_SHARE_PERCENT`%(기본 0 — 플랫폼이 갖는다). 기사가 보는 주문에는 받는 금액(`earning`)이 붙는다.
- 정산은 한 주(월~일)에 끝난 배송을 모아 그다음 주의 `SETTLEMENT_PAYOUT_WEEKDAY` 요일(기본 화요일)에 한다 (`order/domain/services/settlement-policy.ts`). 운영자가 기사별 정산액을 보고 **지급 처리**하면 기사마다 이체를 요청하고 결과(완료·진행 중·실패와 사유)를 남긴다. 실패한 지급은 다시 할 수 있다. 지금은 수동 지급(`ManualPayoutGateway`)이라 늘 완료다 — 운영자가 은행에서 직접 보낸 것을 기록한다. 날짜는 모두 한국 시간 기준이다.
- 정산 계좌는 저장할 때 본인 명의인지 확인한다 (`AccountVerifier` 포트, 지금은 예금주 이름 = 가입자 이름인지만 보는 개발용 `NameMatchAccountVerifier`). 계좌가 없거나 확인되지 않은 기사의 정산은 **보류**되고, 기사 앱의 정산 내역(`GET /dispatch/settlements`)에 이유가 보인다.

**주문**

```
REQUESTED ──accept──▶ PAYING ──결제 성공──▶ ASSIGNED ──depart──▶ DEPARTED ──arrive──▶ ARRIVED ──pickup──▶ PICKED_UP ──complete──▶ DELIVERED
    ▲                   └──결제 실패──▶ PAYMENT_FAILED                                    └──no-show (도착 30분 뒤)──▶ NO_SHOW
    └────── retry-payment (다른 카드) ──────┘
픽업 전까지는 고객이 취소할 수 있다 (CANCELLED). 결제 중(PAYING)에는 취소할 수 없다.
```

- **결제** — 고객은 카드를 먼저 등록한다(`/payment-methods`, 카드 번호 대신 PG사의 빌링키를 저장). 요청할 때는 결제하지 않고, **기사가 수락하면 서버가 그 카드로 요금을 결제**한다. 결제되면 배차되고, 안 되면 배차되지 않는다 — 기사는 409 `PAYMENT_DECLINED`, 주문은 `PAYMENT_FAILED`가 되어 대기 목록에서 내려가고, 고객은 사유·해결 방법(`paymentFailure`)을 보고 다른 카드로 다시 요청한다. 카드만 받는다.
- **요금** — 배차 때 결제하는 요금(`fare`) = 기본 요금(`baseFare`, 차종·거리) + 큰 짐 운반 도움(함께 1만·기사 혼자 2만) + 계단(엘리베이터 없는 곳, 2층부터 한 층 3천). 픽업할 때 기사가 넣는 **추가 요금**(과적 1만/단계·큰 짐 1만/개·계단 3천/층)과 **대기료**(도착 뒤 10분 무료, 1분 500원)는 배차 때 쓴 카드로 한 번 더 결제한다. 추가 결제가 안 돼도 픽업은 진행되고 결제가 안 된 금액(`unpaidAmount`)이 남는다. 값은 `order/domain/services/charge-policy.ts`(디자인의 값, **임시**), 앱은 `GET /orders/charge-policy`로 받는다.
- **취소 수수료** — 배차 전·기사 출발 전 0원, 기사가 '출발'한 뒤(도착 포함) 요금의 15%(100원 단위). 결제했으면 수수료를 빼고 자동으로 돌려준다. 픽업한 뒤에는 취소할 수 없다. **노쇼**는 기사가 도착하고 30분이 지나야 신고할 수 있고, 요금 전액을 돌려주지 않는다. 출발을 누르지 않고 도착하면 그때 출발한 것으로 본다.
- **환불** — 운영자가 주문 상세에서 결제한 금액 안에서 일부·전부를 돌려준다(`POST /admin/orders/:id/refunds`). 누가 왜 돌려줬는지 남는다. 영수증(`GET /orders/:id/receipt`)은 결제 금액을 공급가액과 부가세(1/11)로 나눠 보여 준다.
- 차종이 서비스 종류를 정한다: 오토바이·다마스·라보 = 퀵(`QUICK`), 1톤·2.5톤·5톤 = 화물(`FREIGHT`).
- 화물은 종류(서류·박스·쇼핑백·가구/가전·기타)를 고르고, 중량은 차종의 최대 적재 중량을 넘을 수 없다 (`common/domain/vehicle-type.ts`).
- 요금 = 차종별 기본요금 + 기본 거리 초과분 × km당 요금 (`order/domain/services/fare-policy.ts`, **임시 요금표**). `POST /orders/estimates`가 차종별 요금을 한 번에 준다.
- 배차는 선착순이다. 기사는 자기 차종의 배차 대기 주문만 보고, 먼저 수락한 한 명에게 배차된다. 동시에 수락하면 낙관적 잠금(`version`)으로 나머지는 409를 받는다.
- 수락 전 기사에게는 **동 단위 위치(구·동)와 약 1km로 흐린 좌표**만 보여준다. 주소·상세 주소·연락처·요청 사항은 수락한 뒤에 보인다. 구·동은 앱이 주소 검색 결과에서 받아 `sigungu` `dong`으로 보낸다.
- 기사 앱이 위치를 보내면(`PUT /drivers/me/location`) 대기 콜에 픽업지까지의 거리가 붙고, 수락할 때 픽업·도착 예정 시각을 어림하며, 고객은 배송 추적에서 기사 위치를 본다.
- 평가는 배송이 끝난 주문에 고객이 한 번 남긴다 (별점 1~5, 칭찬 태그, 내용). 기사의 평균 별점이 주문 상세에 붙는다.
- 메시지는 고객과 배차된 기사가 배송이 진행 중일 때 주고받는다. 끝난 뒤에는 읽기만 된다.

## 임시 구현 — 출시 전에 바꿔 끼울 것

포트 뒤에 기본 구현을 뒀다. 구현체만 바꾸면 되고 유스케이스는 그대로다.

| 무엇                      | 지금                                                                                                                                                                                                                                                                                         | 바꿀 곳                                                                        |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 경로·거리·소요 시간       | 카카오모빌리티 길찾기(`KakaoDirectionsRoutePlanner`, `KAKAO_REST_API_KEY`) — 승용차 경로. 같은 구간은 2분 동안 다시 묻지 않는다. 키가 없거나 길찾기가 안 되면 직선 거리 × 1.3 어림(`EstimatedRoutePlanner`)                                                                                  | 화물차·이륜차 경로, 무료 한도(하루 10,000건) 넘을 때의 요금 확인 (작업 29)     |
| 비밀번호 재설정 코드 발송 | 보내지 않고 개발 서버 로그에만 남긴다. **운영에서는 코드가 전달되지 않는다**                                                                                                                                                                                                                 | `ResetCodeSender` 포트 → 이메일·문자 구현 (`LoggingResetCodeSender` 대신)      |
| 서류 파일 보관            | 서버 디스크 (`UPLOAD_DIR`). 서버가 한 대일 때만 맞다                                                                                                                                                                                                                                         | `FileStorage` 포트 → 객체 저장소 구현 (`LocalFileStorage` 대신)                |
| 운영자 초대 메일          | 보내지 않고 개발 서버 로그에 초대 링크를 남긴다. **운영에서는 전달되지 않는다**                                                                                                                                                                                                              | `AdminInvitationSender` 포트 → 메일 구현 (`LoggingAdminInvitationSender` 대신) |
| 요금표 · 필요 서류        | 코드에 `TODO`로 표시한 임시 정책                                                                                                                                                                                                                                                             | `FarePolicy` · `REQUIRED_DOCUMENTS`                                            |
| 수수료율 · 정산 지급 요일 | 환경변수의 기본값 (10%, 화요일)                                                                                                                                                                                                                                                              | `COMMISSION_RATE_PERCENT` · `SETTLEMENT_PAYOUT_WEEKDAY`                        |
| 카드 결제 (PG)            | 포트원 V2 + 나이스페이먼츠(`PortOnePaymentGateway`, `PORTONE_*`). 앱은 웹뷰에서 포트원 등록 창으로 빌링키를 받고, 서버는 그 빌링키가 이 고객의 것인지 확인한 뒤 결제·취소에 쓴다. 키가 없으면 개발용(`DevPaymentGateway`) — 돈이 오가지 않고 끝 4자리 0001~0005·0009는 결제 실패 시험용 카드 | 실연동 채널 키와 PG사 빌링 심사 (작업 15.10)                                   |
| 정산금 이체               | 수동 — 운영자가 직접 보내고 지급 처리로 기록한다                                                                                                                                                                                                                                             | `PayoutGateway` 포트 → PG사 지급대행 (`ManualPayoutGateway` 대신)              |
| 정산 계좌 본인 확인       | 예금주 이름 = 가입자 이름인지만 본다                                                                                                                                                                                                                                                         | `AccountVerifier` 포트 → 계좌 실명 조회 (`NameMatchAccountVerifier` 대신)      |
| 추가 요금 · 취소 수수료   | 디자인의 값 (운반 도움 1만·2만, 계단 3천, 대기료 500원/분, 취소 15%, 노쇼 30분)                                                                                                                                                                                                              | `ChargePolicy` (작업 16)                                                       |

아직 없는 것: 결제 중(`PAYING`)에 서버가 멈춘 주문을 되살리는 일, PG사와의 결제 대사(對査), 결제 실패 주문의 자동 취소 시간, 로그인 시도 횟수 제한.

**주소 검색**은 카카오 로컬 API(`KakaoLocalAddressSearch`)로 한다 — 앱이 `GET /address-search`를 부르고 서버가 `KAKAO_REST_API_KEY`로 카카오를 부른다(키를 앱에 넣지 않는다). 주소 검색과 키워드(장소 이름) 검색을 합쳐 15곳까지 준다. 키가 없으면 견본 주소 몇 곳에서만 찾고(`SampleAddressSearch`, e2e도 이것), 운영에서는 키가 없으면 서버가 뜨지 않는다. 카카오가 응답하지 않으면 503 `ADDRESS_SEARCH_UNAVAILABLE`. **확인할 것**: 카카오는 API 응답(주소·좌표)을 저장하지 말라고 안내한다 — 주문·자주 쓰는 주소에 저장하는 우리 구조가 허용되는지 출시 전에 카카오에 물어야 한다 (작업 32).

## 푸시 알림

주문 상태가 바뀌거나 메시지가 오거나 심사 결과가 나오면 FCM으로 알린다 (iOS는 FCM이 APNs로 넘긴다).

| 일어난 일              | 받는 사람                                                              | `data.type`                                | 알림함 |
| ---------------------- | ---------------------------------------------------------------------- | ------------------------------------------ | ------ |
| 배송 요청              | 그 차종의, 승인됐고 운행 중이며 픽업지 반경 안에 최근 위치를 보낸 기사 | `ORDER_REQUESTED`                          | ✕      |
| 배차 완료              | 고객                                                                   | `ORDER_ASSIGNED`                           | ○      |
| 픽업 완료              | 고객                                                                   | `ORDER_PICKED_UP`                          | ○      |
| 배송 완료              | 고객                                                                   | `ORDER_DELIVERED`                          | ○      |
| 주문 취소              | 배차돼 있던 기사 (배차 전이면 없음)                                    | `ORDER_CANCELLED`                          | ○      |
| 메시지                 | 받는 쪽 (고객 또는 배차된 기사)                                        | `ORDER_MESSAGE`                            | ✕      |
| 결제 실패 (배차 안 됨) | 고객 (본문에 사유)                                                     | `ORDER_PAYMENT_FAILED`                     | ○      |
| 기사 출발·도착         | 고객                                                                   | `ORDER_DEPARTED` · `ORDER_ARRIVED`         | ○      |
| 노쇼 처리              | 고객                                                                   | `ORDER_NO_SHOW`                            | ○      |
| 결제 완료 · 추가 결제  | 고객 (본문에 구간·카드)                                                | `PAYMENT_PAID` · `PAYMENT_ADDITIONAL_PAID` | ○      |
| 추가 결제 실패         | 고객                                                                   | `PAYMENT_ADDITIONAL_FAILED`                | ○      |
| 환불                   | 고객 (본문에 취소 수수료나 사유)                                       | `PAYMENT_REFUNDED`                         | ○      |
| 기사 승인              | 그 기사                                                                | `DRIVER_APPROVED`                          | ○      |
| 기사 반려              | 그 기사 (본문에 반려 사유)                                             | `DRIVER_REJECTED`                          | ○      |

모든 알림의 `data`에 `type`이 실리고, 주문에 관한 알림에는 `orderId`도 실린다.

**알림함** — 표에서 ○인 알림은 `GET /notifications`로 다시 볼 수 있다. 푸시를 못 받았거나 꺼 둔(`PATCH /notifications/settings`) 회원에게도 알림함에는 쌓인다. 금방 낡는 알림(새 콜, 메시지)은 쌓지 않는다.

**서버 설정** — 고객 앱과 기사 앱을 **같은 Firebase 프로젝트**에 등록하고, 그 프로젝트의 서비스 계정 키를 `FIREBASE_SERVICE_ACCOUNT_BASE64`에 넣는다 (`.env.local.example` 참고). 서비스 계정 하나로 두 앱 모두에 보낸다. 비워 두면 발송이 꺼지고, 누구에게 무엇이 나갔을지만 서버 로그에 남는다.

**앱이 할 일** (두 앱 공통)

1. 로그인한 뒤, 그리고 FCM 토큰이 바뀔 때마다 `PUT /push-devices` `{ token, platform: "ANDROID" | "IOS" }`. iOS도 APNs 토큰이 아니라 FCM 토큰을 보낸다.
2. 로그아웃하기 전에 `DELETE /push-devices/:token`.
3. Android 알림 채널을 서버와 같은 ID로 만든다: `new-orders`(새 주문), `order-status`(주문 상태), `messages`(메시지), `account`(계정·심사).
4. 알림을 누르면 `data.type`에 맞는 화면을 연다 (주문 알림이면 `data.orderId`의 주문).

**동작 방식**

- 발송은 API 응답을 기다리게 하지 않는다. 푸시가 실패해도 주문 처리는 성공으로 끝난다.
- 한 주문의 상태 알림은 기기에서 쌓이지 않고 최신 상태 하나로 갱신된다.
- 앱을 지운 기기의 토큰은 FCM이 알려주는 대로 지운다.
- 같은 휴대폰에서 다른 계정으로 로그인해 토큰을 다시 등록하면 알림은 새 계정으로 간다.
- 새 주문 알림에는 배차 대기 목록과 같은 범위(동 단위 위치와 요금)만 싣는다. 주소와 연락처는 싣지 않는다.

## API

모든 경로 앞에 `/api`가 붙는다. 자세한 스키마는 Swagger에 있다.

| 누가      | 메서드 · 경로                                                                              | 설명                                                              |
| --------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| 누구나    | `POST /auth/register` `login` `refresh` `logout`                                           | 가입(약관 동의 포함), 로그인, 토큰 갱신(회전)                     |
| 누구나    | `POST /auth/password-reset/request` `confirm`                                              | 비밀번호 찾기: 이메일로 6자리 코드 → 코드와 새 비밀번호           |
| 누구나    | `GET /vehicle-types`                                                                       | 차종 목록                                                         |
| 누구나    | `GET /legal/documents` · `GET /legal/documents/:type`                                      | 약관·정책 (시행 중인 판)                                          |
| 누구나    | `GET /support/contact` · `GET /support/business`                                           | 고객센터 연락처, 사업자 정보                                      |
| 누구나    | `GET /health`                                                                              | 서버·DB 상태                                                      |
| 회원      | `GET /users/me` · `PATCH /users/me`                                                        | 내 정보, 수정 (이름·휴대폰·마케팅 수신)                           |
| 회원      | `POST /users/me/withdraw`                                                                  | 회원 탈퇴 (비밀번호 확인)                                         |
| 회원      | `PUT /push-devices` · `DELETE /push-devices/:token`                                        | 푸시 수신 기기 등록·해제                                          |
| 회원      | `GET /notifications` · `unread-count` · `POST read-all` · `POST :id/read`                  | 알림함                                                            |
| 회원      | `GET /notifications/settings` · `PATCH`                                                    | 푸시 받기 켜기·끄기                                               |
| 회원      | `GET /notices` · `GET /notices/:id`                                                        | 공지사항 (자기 앱 대상만)                                         |
| 회원      | `GET /saved-addresses` · `POST` · `PUT :id` · `DELETE :id`                                 | 자주 쓰는 주소 (20곳까지)                                         |
| 회원      | `GET /address-search?query=`                                                               | 주소·장소 검색 (카카오 로컬 API, 15곳까지)                        |
| 회원      | `GET /orders/:id` · `GET /orders/:id/tracking`                                             | 주문 상세(고객에게는 결제·환불 포함), 배송 추적                   |
| 회원      | `GET /orders/charge-policy`                                                                | 운반 도움·계단·추가 요금·대기료·취소 수수료·노쇼 규칙             |
| 고객·기사 | `GET /orders/:id/messages` · `POST`                                                        | 주문 메시지                                                       |
| 고객      | `POST /orders/estimates`                                                                   | 요금 견적 (거리·시간·경로 + 차종별 요금)                          |
| 고객      | `POST /orders` · `GET /orders`                                                             | 배송 요청, 내 주문 목록 (`?status=` `?serviceType=`)              |
| 고객      | `GET /orders/recent-destinations`                                                          | 최근 보낸 곳                                                      |
| 고객      | `POST /orders/:id/cancel` · `POST /orders/:id/review`                                      | 주문 취소(결제했으면 수수료를 빼고 환불), 기사 평가               |
| 고객      | `POST /orders/:id/retry-payment` · `GET /orders/:id/receipt`                               | 결제 실패 주문을 다른 카드로 다시 요청, 영수증                    |
| 고객      | `GET /payment-methods` · `GET …/registration` · `POST` · `POST :id/default` · `DELETE :id` | 결제 카드 목록, 등록 화면 정보, 등록(PG 인증 키), 기본 카드, 삭제 |
| 기사      | `GET /drivers/me/documents` · `PUT /drivers/me/documents/:type` · `GET …/file`             | 서류 상태, 올리기(multipart `file`), 올린 파일 보기               |
| 기사      | `POST /drivers` · `GET /drivers/me`                                                        | 기사 등록 신청, 내 기사 정보(운행 시간 포함)                      |
| 기사      | `PATCH /drivers/me/availability` · `PUT /drivers/me/location`                              | 운행 시작·종료, 현재 위치 보고                                    |
| 기사      | `POST /drivers/me/vehicle-change`                                                          | 차량 변경 신청                                                    |
| 기사      | `GET /drivers/me/settlement-account` · `PUT` · `POST …/verify`                             | 정산 계좌(저장할 때 본인 확인), 다시 확인                         |
| 기사      | `GET /dispatch/open-orders` · `open-orders/:id`                                            | 배차 대기 주문, 콜 하나                                           |
| 기사      | `POST /dispatch/orders/:id/accept` `depart` `arrive` `pickup` `complete` `no-show`         | 수락(결제), 출발, 도착, 픽업(추가 요금), 배송 완료, 노쇼          |
| 기사      | `GET /dispatch/orders/:id/navigation`                                                      | 다음 목적지까지의 거리·시간·경로                                  |
| 기사      | `GET /dispatch/my-orders` · `GET /dispatch/earnings` · `GET /dispatch/settlements`         | 배송 내역(`?from=&to=`), 수입과 다음 정산, 정산 내역              |
| 누구나    | `GET /auth/admin-invitations/:token` · `POST …/accept`                                     | 운영자 초대 확인, 수락(비밀번호를 정하면 바로 로그인)             |
| 운영자    | `GET /admin/me`                                                                            | 나와 내가 쓸 수 있는 메뉴(`areas`)                                |
| 운영자    | `GET /admin/drivers` · `GET /admin/drivers/:id` · `…/documents/:type/file`                 | 기사 신청 목록(`?status=&q=`, 상태별 건수), 상세, 서류            |
| 운영자    | `PATCH /admin/drivers/:id/approve` `reject`                                                | 기사 심사 (반려는 사유와 반려할 서류)                             |
| 운영자    | `GET /admin/orders/summary?date=` · `GET /admin/orders?date=&status=&payment=`             | 하루의 상태별·결제별 건수와 금액, 주문 목록                       |
| 운영자    | `GET /admin/orders/:id` · `POST /admin/orders/:id/refunds`                                 | 주문 상세(결제·환불 기록), 환불(일부·전부)                        |
| 운영자    | `GET /admin/users?role=&q=&status=` · `GET /admin/users/:id`                               | 회원 찾기(고객·기사), 상세와 정지 이력                            |
| 운영자    | `POST /admin/users/:id/suspensions` · `DELETE …/suspensions/current`                       | 정지(7일·30일·무기한, 사유), 정지 해제                            |
| 운영자    | `GET /admin/settlements?weekStart=` · `POST /admin/settlements/payouts`                    | 한 주의 기사별 정산, 지급 처리(결과: 완료·진행 중·실패)           |
| 운영자    | `GET /admin/payouts`                                                                       | 지급 내역 (실패와 사유 포함)                                      |
| 운영자    | `GET /admin/notices?state=` · `POST` · `DELETE /admin/notices/:id`                         | 공지 목록(게시 중·내린 공지), 올리기, 내리기                      |
| 운영자    | `GET /admin/legal-documents` · `POST`                                                      | 약관의 모든 판(시행 중·예정·이전), 새 판 올리기                   |
| 운영자    | `GET /admin/admins` · `POST` · `PATCH /admin/admins/:id` · `POST …/invitations`            | 운영자 목록, 초대, 권한·활성 변경, 초대 다시 보내기               |

운영자 API는 메뉴(영역)마다 권한이 다르다 — 최고 관리자는 전부, 운영 관리자는 기사 심사·주문·회원·공지·약관, 정산 담당은 주문·정산 (`admin/domain/admin-role.ts`). 요청마다 운영자 계정의 지금 상태를 확인하므로 비활성화와 권한 변경이 바로 적용된다.
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

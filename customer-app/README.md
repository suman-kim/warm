# MOVO 고객 앱

고객이 배송을 요청하고 진행 상황을 확인하는 Flutter 앱 (iOS · Android).
기사 앱·고객 앱 모두 같은 서버(`../backend`)를 쓴다 — API는 `backend/README.md`와 Swagger(`/api/docs`) 참고.

화면은 `../design/MOVO Apps v2.dc.html`의 고객 앱 12화면과 공통 4화면을 옮기고, 결제·추가 요금·노쇼는 `../design/MOVO Apps v4.dc.html`(고객 앱 31화면)을 따랐다.

```bash
flutter pub get
flutter run          # 연결된 기기·시뮬레이터에서 실행 (개발 서버가 떠 있어야 한다)
flutter analyze
flutter test         # 화면마다 가짜 서버로 띄워 본다. 화면 사진이 build/screenshots에 남는다
```

## 구조

```
lib/
├── main.dart · api.dart · launcher.dart   앱 시작, 서버 API, 전화·링크 열기
├── shell.dart                             아래 탭 (홈 · 이용 내역 · 마이)
├── places.dart                            고른 장소 (주소 검색 결과·자주 쓰는 주소·주문의 출발지와 도착지)
├── home/                                  홈(서비스 고르기·최근 보낸 경로 다시 보내기), 주소 검색(1단계)
├── order/                                 배송 정보(운반 도움·층수) → 차종·견적 → 주문 화면(결제·취소·추가 요금·노쇼·영수증)
├── payment/                               결제 카드 고르기·등록·관리, 취소·환불 규정, 사업자 정보
├── history/                               이용 내역
└── my/                                    내 정보, 자주 쓰는 주소
```

- 로그인·가입·비밀번호 찾기, 알림함, 공지·고객센터·약관·탈퇴, 메시지 화면은 기사 앱과 함께 쓰는 `../packages/movo_ui`에 있다. 색·글꼴·버튼 같은 디자인 요소도 거기에 있다.
- `order/order_screen.dart` 하나가 주문의 진행을 따라 모습을 바꾼다: 기사 찾는 중(결제 전) → (결제 실패 → 다른 카드로 다시 요청) → 주문 상세(배차·출발·도착 다섯 단계, 도착 뒤 대기 시간과 대기료) → 배송 중(추가 요금 안내) → 배송 완료(요금 내역·영수증) 또는 노쇼 안내. 진행 중에는 4초마다 서버에서 새로 받는다.
- 결제는 서버가 한다 — 기사가 수락하면 등록한 카드로 요금을, 픽업할 때 추가 요금을 결제한다. 앱은 카드를 등록하고 고르기만 한다. 취소하면 그 시점의 수수료(출발 전 0원, 출발 뒤 15%)를 보여 주고 확인을 받는다.
- 요금 규칙(운반 도움·계단·대기료·취소 수수료)은 서버에서 받는다 (`GET /orders/charge-policy`, `movo_ui`의 `WithChargeRules`).

## 아직 실제가 아닌 것

- **'지도에서 선택'과 현재 위치**: 아직 없다. 주소 검색은 실제다 — 서버(`GET /address-search`)가 카카오 로컬 API로 찾는다. 입력이 0.25초 멈추면 찾는다. 서버에 카카오 키가 없으면 견본 주소 몇 곳에서만 찾는다.
- **지도**: 카카오 지도다 (`movo_ui`의 `MovoMap`). 앱 키(`env/*.json`의 `KAKAO_CUSTOMER_APP_KEY`·`KAKAO_DRIVER_APP_KEY`)로 시작할 때 초기화한다. 키가 없거나 지도를 띄우지 못하면, 그리고 테스트에서는 디자인의 지도 그림으로 그린다. 경로는 서버가 카카오 길찾기로 구한 실제 도로다. Android는 ARM 기기·에뮬레이터만 된다 (x86 에뮬레이터는 그림 지도).
- **푸시**: Firebase를 연결하기 전이라 푸시를 받지 않는다. 알림은 홈의 종 아이콘(알림함)에서 본다.
- **카드 등록 화면**: PG사가 정해지기 전이라 PG사 화면 대신 **개발용 카드 등록 화면**이 뜬다 (카드사·끝 4자리·종류를 고른다. 돈은 오가지 않는다). 끝 4자리 0001~0005는 배차 때 결제가 안 되는 시험용 카드다 (0001 한도 초과 …). PG사를 붙이면 `payment/cards.dart`의 `registerCard`에서 그 SDK 화면을 띄운다.
- **영수증 '이미지로 저장'**: 디자인에 있지만 아직 없다 (이미지 저장·공유 플러그인이 필요하다).
- **사업자 정보**: 서버 설정(`BUSINESS_*`)에 적은 값을 보여 준다. 디자인의 값은 예시다.

디자인에 메뉴만 있고 화면이 없던 것(비밀번호 찾기, 내 정보 수정, 자주 쓰는 주소, 알림함, 공지, 고객센터, 약관, 탈퇴, 메시지)은 같은 모양새로 만들었다.

## 서버 연결

서버 호출은 공용 패키지 `../packages/movo_api`로 한다. `lib/api.dart`의 `api` 하나를 앱 전체가 쓴다 (쓰는 법은 그 패키지의 README).

앱이 볼 서버는 저장소의 환경 파일로 고른다. 주소는 파일마다 고정돼 있고, 빌드할 때 들어가 앱 안에서는 바뀌지 않는다.

| 환경 | 파일 | 서버 | 쓰는 곳 |
| --- | --- | --- | --- |
| 로컬 | `../env/local.json` | 개발 서버 — 파일에 적은 주소 (비우면 `http://localhost:4000/api`) | 시뮬레이터·에뮬레이터, USB로 연결한 기기 |
| 설치용 디바이스 | `../env/device.json` | 시험 서버 — HTTPS 주소(ngrok 등) 또는 같은 와이파이의 사설 IP | 기기에 설치해 USB 없이 시험 |
| 운영 | `../env/prod.json` | 운영 서버 — HTTPS (채워야 함) | 스토어 배포 |

```bash
flutter run --dart-define-from-file=../env/local.json                   # 로컬 (파일 없이 flutter run 해도 로컬)
flutter build apk --release --dart-define-from-file=../env/device.json  # 설치용 — Android
flutter run --release --dart-define-from-file=../env/device.json        # 설치용 — iOS 기기
flutter build appbundle --dart-define-from-file=../env/prod.json        # 운영 — Android
flutter build ipa --dart-define-from-file=../env/prod.json              # 운영 — iOS
```

- 로컬: iOS 시뮬레이터는 그대로 붙는다. Android 에뮬레이터와 USB로 연결한 기기는 먼저 `adb reverse tcp:4000 tcp:4000`.
- 설치용 디바이스: 폰이 맥과 **같은 와이파이**에 있어야 하고, 맥에서 서버(`npm run start:local`)가 떠 있어야 한다. 사설 IP(192.168.x.x 등)에만 HTTP를 허용한다 — 그 밖의 주소는 HTTPS여야 한다. 설치한 앱은 빌드할 때의 주소를 계속 보므로, 맥의 IP가 바뀌면 `device.json`을 고쳐 다시 빌드한다 (공유기에서 맥의 IP를 고정해 두면 편하다). 밖에서도 쓰려면 ngrok 고정 도메인 같은 HTTPS 주소로 바꾼다. iOS는 처음 연결할 때 '로컬 네트워크' 권한을 묻는다 — 허용해야 붙는다.
- 켤 때 환경을 확인한다. 릴리스·프로파일 빌드에 환경 파일이 없거나, 주소가 비었거나, 운영이 HTTPS가 아니거나, 설치용이 HTTPS도 사설 IP도 아니거나, 설치용·운영이 localhost를 보거나, 운영이 터널(ngrok 등) 주소를 보면 앱 대신 이유를 띄우고 멈춘다. 디버그 콘솔에는 `MOVO 서버: device (https://…/api)`처럼 찍힌다.
- 테스트 계정(로컬 DB): `zzsdsdsd@gmail.com` / `12341234` — 결제 카드가 등록돼 있다. 백엔드에서 `node tool/seed-accounts.mjs`로 만든다.

기기에서 실제 서버에 붙어 확인 (로컬 환경 — 개발 서버가 떠 있어야 한다):

```bash
flutter test integration_test -d <기기 ID>     # 기기 ID는 flutter devices
```

- `api_smoke_test.dart` — 서버 연결과 토큰 보관
- `ui_flow_test.dart` — 가입 → 주소 검색 → 견적 → 배송 요청 → 취소 → 로그아웃을 화면으로 해 본다

## 앱 아이콘 · 스플래시

- 아이콘: 라임 바탕에 잉크색 로고. 스플래시: 앱 바탕색에 로고 — 앱이 시작하며 띄우는 로딩 화면(`MovoApp`)과 같은 크기·자리라 이어서 보인다.
- 원본 그림은 `assets/brand/`. 앱의 로고(`MovoLogo`)로 그린다 — 디자인 파일에는 아이콘·스플래시가 없어 앱의 로고와 색으로 만들었다.
- 로고를 바꾸면 그림부터 다시 그리고, 각 플랫폼 파일을 다시 만든다:

  ```bash
  (cd ../packages/movo_ui && flutter test tool/brand_assets_test.dart)
  dart run flutter_launcher_icons
  dart run flutter_native_splash:create
  ```

## 식별자

| 항목 | 값 |
| --- | --- |
| Dart 패키지 | `movo_customer` |
| Android applicationId / iOS 번들 ID | `pixel.movo.customer` |
| 앱 이름(임시) | MOVO |

앱 ID는 기사 앱(`pixel.movo.driver`)과 같은 접두어로 정했다 (2026-10-14). 처음의 `com.movo.*`는 기사 앱 쪽이 Google Play에서 이미 쓰이고 있어 바꿨다. `pixel.movo.customer`로 공개된 Google Play 앱은 없다 (2026-10-14 확인). Firebase·카카오 콘솔에 등록하거나 스토어에 올린 뒤에는 바꾸기 어렵다.

앱 이름은 아직 임시값이다.

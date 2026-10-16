# MOVO 가게 앱

음식점 사장님이 배달을 요청하고 진행 상황·충전금을 확인하는 Flutter 앱 (iOS · Android).
가게 앱·라이더 앱·가게 PC 웹(`../store-web`)이 모두 같은 서버(`../backend`)를 쓴다 — API는 `backend/README.md`와 Swagger(`/api/docs`) 참고.

화면은 사용자가 준 디자인 파일의 가게 앱 화면을 옮겼다. 폴더 이름(`customer-app`)과 Dart 패키지(`movo_customer`)는 퀵·화물 시절의 이름을 그대로 둔다.

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
├── shell.dart                             아래 탭 (홈 · 내역 · 충전금 · 마이)
├── places.dart                            고른 장소 (주소 검색 결과·최근 배달한 손님 주소)
├── store/                                 가게 등록·수정과 심사 대기·반려 화면, 주소 검색
├── delivery/                              홈(충전금·오늘 건수·진행 중 배달), 배달 요청(견적), 배달 상세(진행·취소), 배달 내역
├── wallet/                                충전금 잔액·내역, 충전
└── my/                                    가게 정보, 사업자 정보
```

- 로그인·가입·비밀번호 찾기, 알림함, 공지·고객센터·약관·탈퇴 화면은 라이더 앱과 함께 쓰는 `../packages/movo_ui`에 있다. 색·글꼴·버튼 같은 디자인 요소도 거기에 있다.
- 배달 상세는 진행을 따라 모습을 바꾼다: 라이더 찾는 중 → 가게로 오는 중(라이더·픽업 예정) → 라이더 가게 도착 → 배달 중 → 배달 완료(받은 방식과 금액) 또는 취소 정보. 진행 중에는 서버에서 주기적으로 새로 받는다.
- 대행료는 요청할 때 충전금에서 빠진다. 취소하면 그 시점의 수수료(라이더 출발 전 0원, 출발 뒤 대행료의 15%)를 보여 주고 확인을 받은 뒤 나머지를 충전금으로 돌려받는다.

## 아직 실제가 아닌 것

- **충전**: 포트원 가상계좌·카드 충전을 붙이기 전이라 개발 서버에서만 바로 충전된다 (작업 35.2).
- **'지도에서 선택'과 현재 위치**: 아직 없다. 주소 검색은 실제다 — 서버(`GET /address-search`)가 카카오 로컬 API로 찾는다. 서버에 카카오 키가 없으면 견본 주소 몇 곳에서만 찾는다.
- **지도**: 카카오 지도다 (`movo_ui`의 `MovoMap`). 앱 키(`env/*.json`의 `KAKAO_CUSTOMER_APP_KEY`·`KAKAO_DRIVER_APP_KEY`)로 시작할 때 초기화한다. 키가 없거나 지도를 띄우지 못하면, 그리고 테스트에서는 디자인의 지도 그림으로 그린다. Android는 ARM 기기·에뮬레이터만 된다 (x86 에뮬레이터는 그림 지도).
- **푸시**: Firebase를 연결하기 전이라 푸시를 받지 않는다. 알림은 알림함에서 본다.
- **사업자 정보**: 서버 설정(`BUSINESS_*`)에 적은 값을 보여 준다. 디자인의 값은 예시다.

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
- 테스트 계정(로컬 DB): `zzsdsdsd@gmail.com` / `12341234` — 승인된 가게(모보치킨 역삼점)와 충전금이 있다. 백엔드에서 `node tool/seed-accounts.mjs`로 만든다.

기기에서 실제 서버에 붙어 확인 (로컬 환경 — 개발 서버가 떠 있어야 한다):

```bash
flutter test integration_test -d <기기 ID>     # 기기 ID는 flutter devices
```

- `api_smoke_test.dart` — 서버 연결과 토큰 보관
- `ui_flow_test.dart` — 사장님 가입 → 가게 등록(심사 신청)을 화면으로 해 본다

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

앱 ID는 라이더 앱(`pixel.movo.driver`)과 같은 접두어로 정했다 (2026-10-14). 처음의 `com.movo.*`는 라이더 앱 쪽이 Google Play에서 이미 쓰이고 있어 바꿨다. `pixel.movo.customer`로 공개된 Google Play 앱은 없다 (2026-10-14 확인). Firebase·카카오 콘솔에 등록하거나 스토어에 올린 뒤에는 바꾸기 어렵다.

앱 이름은 아직 임시값이다.

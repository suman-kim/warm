# MOVO 기사 앱

기사가 주문을 수락하고 배송을 진행하는 Flutter 앱 (iOS · Android).
기사 앱·고객 앱 모두 같은 서버(`../backend`)를 쓴다 — API는 `backend/README.md`와 Swagger(`/api/docs`) 참고.

화면은 `../design/MOVO Apps v2.dc.html`의 기사 앱 15화면과 공통 4화면을 옮기고, 결제·진행 단계·추가 요금·노쇼·정산은 `../design/MOVO Apps v4.dc.html`(기사 앱 25화면)을 따랐다.

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
├── gate.dart                              가입 단계에 맞는 화면으로 보낸다
├── driver_scope.dart                      내 기사 정보, 운행 중 위치 보고
├── services.dart                          사진 고르기, 기기 위치, 길안내 열기
├── onboarding/                            차량·서류 등록, 승인 대기, 반려·재신청
├── shell.dart                             아래 탭 (홈 · 배송 내역 · 수입 · 마이)
├── home/                                  운행 켜기·끄기, 대기 콜, 새 콜
├── delivery/                              수락(결제 확인 중·배차 안 됨) → 출발 → 픽업지 도착(대기·추가 요금·노쇼) → 도착지 이동 → 배송 완료
├── history/ · earnings/ · my/             배송 내역과 배송 상세, 수입·정산 내역, 내 정보(차량 변경·정산 계좌와 본인인증)
```

- 로그인한 기사는 `gate.dart`가 상태에 따라 보낸다: 차량 미등록 → 차량·서류, 심사 중 → 승인 대기(10초마다 확인), 반려 → 재신청, 승인 → 홈.
- 운행 중에는 15초마다 위치를 서버에 알린다. 대기 콜은 5초마다 새로 받고, 새로 들어온 콜은 15초 카운트다운과 함께 크게 띄운다.
- 로그인·가입 1단계·비밀번호 찾기, 알림함, 공지·고객센터·약관·탈퇴, 메시지 화면과 디자인 요소는 `../packages/movo_ui`에 있다.

## 아직 실제가 아닌 것

- **지도**: 카카오 지도다 (`movo_ui`의 `MovoMap`). 앱 키(`env/*.json`의 `KAKAO_CUSTOMER_APP_KEY`·`KAKAO_DRIVER_APP_KEY`)로 시작할 때 초기화한다. 키가 없거나 지도를 띄우지 못하면, 그리고 테스트에서는 디자인의 지도 그림으로 그린다. 경로는 서버가 카카오 길찾기로 구한 실제 도로다. Android는 ARM 기기·에뮬레이터만 된다 (x86 에뮬레이터는 그림 지도).
- **길안내**: 내비게이션 방식을 정하기 전이라 '길안내'는 기기의 기본 지도 앱을 연다 (`services.dart`의 `navigationUri`).
- **푸시**: Firebase를 연결하기 전이라 새 콜 푸시를 받지 않는다. 앱이 켜져 있는 동안에만 새 콜이 뜬다 — 꺼져 있으면 콜을 놓친다.
- **위치**: 앱을 쓰는 동안의 위치만 쓴다. 앱이 뒤로 가면 위치 보고가 멈춘다 (백그라운드 위치는 붙이지 않았다).
- **운영자 승인**: 운영자가 관리자 웹(`../admin-web`)의 기사 심사에서 승인한다. 앱만 돌려 볼 때는 `../backend/tool/approve-drivers.sh`로 한 번에 승인할 수 있다.

수입·오늘 운행·배송 내역·배송 완료에 보이는 금액은 디자인 v4를 따라 **수수료를 빼기 전 매출**(최종 요금 = 기본 요금 + 운반 도움 + 계단 + 추가 요금 + 대기료)이다. 수수료(서버 설정 `COMMISSION_RATE_PERCENT`)를 뺀 금액은 **정산 내역**에서 본다. 고객 취소·노쇼는 취소 보상(서버 설정 `DRIVER_CANCELLATION_SHARE_PERCENT`, 기본 0%)만 보인다.

- **정산 계좌 본인인증**: 지금은 서버가 예금주 이름이 가입자 이름과 같은지만 본다 (계좌 실명 조회를 붙이기 전). 확인이 안 되면 정산이 보류된다.

디자인에 메뉴만 있고 화면이 없던 것(제출 서류, 차량 변경, 정산 계좌, 알림함, 공지, 고객센터, 탈퇴, 메시지)은 같은 모양새로 만들었다. 디자인에 없던 메뉴도 넣었다: 심사 화면의 로그아웃, 내 정보의 알림 · 약관 및 정책.

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
- 테스트 계정(로컬 DB): `zzsdsdsd92@daum.net` / `12341234` — 승인된 다마스 기사, 정산 계좌 확인됨. 백엔드에서 `node tool/seed-accounts.mjs`로 만든다.

기기에서 실제 서버에 붙어 확인 (로컬 환경 — 개발 서버가 떠 있어야 한다):

```bash
flutter test integration_test -d <기기 ID> \
  --dart-define=ADMIN_EMAIL=<운영자 이메일> --dart-define=ADMIN_PASSWORD=<비밀번호>
```

- `api_smoke_test.dart` — 서버 연결, 토큰 보관, 서류 올리기
- `ui_flow_test.dart` — 가입 → 서류 → 승인 → 운행 → 콜 수락 → 픽업 → 배송 완료를 화면으로 해 본다. 기사 승인에 운영자 계정이 필요하고(없으면 승인 대기까지만 본다), 개발 DB에 대기 중인 다마스 주문이 없어야 한다. 사진 고르기와 기기 위치는 테스트용 값으로 바꿔 끼운다.

## 앱 아이콘 · 스플래시

- 아이콘: 잉크 바탕에 흰 로고와 라임 '기사' 꼬리표. 스플래시: 앱 바탕색에 로고 — 앱이 시작하며 띄우는 로딩 화면(`MovoApp`)과 같은 크기·자리라 이어서 보인다.
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
| Dart 패키지 | `movo_driver` |
| Android applicationId / iOS 번들 ID | `pixel.movo.driver` |
| 앱 이름 | MOVO Driver |

앱 이름은 MOVO Driver로 정했다 (2026-10-13). 앱 안의 로고는 디자인대로 `movo` + '기사' 배지다.

앱 ID는 `pixel.movo.driver`로 정했다 (2026-10-14). 처음의 `com.movo.driver`는 Google Play에서 다른 회사(MOVO GLOBAL)의 앱 'MOVO Driver'가 이미 쓰고 있어 바꿨다. `pixel.movo.driver`로 공개된 Google Play 앱은 없다 (2026-10-14 확인). Firebase·카카오 콘솔에 등록하거나 스토어에 올린 뒤에는 바꾸기 어렵다.

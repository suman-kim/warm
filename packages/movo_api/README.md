# movo_api

MOVO 서버 API 클라이언트. 고객 앱(`customer-app`)과 기사 앱(`driver-app`)이 함께 쓴다.

## 쓰는 법

```dart
final api = MovoApi(
  baseUrl: Uri.parse('http://localhost:4000/api'),
  appRole: UserRole.customer, // 기사 앱은 UserRole.driver
);

// 앱을 켤 때: 저장된 로그인이 유효하면 회원, 아니면 null
final user = await api.auth.restoreSession();

await api.auth.login(email: email, password: password);
// 견적 한 번에 차종별 요금이 모두 온다 — 고른 차종으로 요청하면 그 요금으로 주문된다.
final estimates = await api.orders.estimates(pickup: from, dropoff: to);
final order = await api.orders.create(vehicleType: VehicleType.damas, pickup: pickup, dropoff: dropoff, cargo: cargo);
```

각 앱의 `lib/api.dart`에 이렇게 만든 `api`가 하나 있다. 화면에서는 그것을 쓴다.

서버 주소는 `MovoEnvironment.fromBuild()`가 빌드 때 넣은 환경 파일(저장소의 `env/local.json` · `device.json` · `prod.json`)에서 읽는다. 값이 잘못됐으면 `MovoEnvironmentError`를 던진다 — 규칙은 `MovoEnvironment.resolve`, 쓰는 법은 각 앱 README의 '서버 연결'.

| 묶음 | 하는 일 | 쓰는 앱 |
| --- | --- | --- |
| `api.auth` | 가입(약관 동의), 로그인, 로그아웃, 로그인 복원, 비밀번호 찾기, 탈퇴 | 둘 다 |
| `api.users` | 내 정보, 수정 | 둘 다 |
| `api.vehicleTypes` | 차종 목록 (로그인 불필요) | 둘 다 |
| `api.pushDevices` | 푸시 수신 기기 등록·해제 | 둘 다 |
| `api.notifications` | 알림함, 읽음 표시, 푸시 받기 켜기·끄기 | 둘 다 |
| `api.notices` | 공지사항 (이 앱 대상만 온다) | 둘 다 |
| `api.legal` · `api.support` | 약관·정책, 고객센터 연락처 (로그인 불필요) | 둘 다 |
| `api.savedAddresses` | 자주 쓰는 주소 | 둘 다 (화면은 고객 앱) |
| `api.addressSearch` | 주소·장소 검색 (서버가 카카오 로컬 API로 찾는다) | 고객 |
| `api.orders` | 견적, 배송 요청, 내 주문, 최근 보낸 곳, 취소, 평가 | 고객 |
| `api.orders` | 주문 상세, 배송 추적, 메시지 | 고객, 배차된 기사 |
| `api.drivers` | 서류 올리기, 등록 신청, 내 기사 정보, 운행 시작·종료, 위치 보고, 차량 변경, 정산 계좌 | 기사 |
| `api.dispatch` | 대기 콜, 수락, 픽업·배송 완료, 길안내, 배송 내역, 수입 | 기사 |

운영자 API(기사 심사, 공지·약관 올리기)는 앱이 쓰지 않아 넣지 않았다.

## 앱이 챙길 것

- **주소의 구·동**: 수락 전 기사에게는 구·동까지만 보인다. 주소 검색 결과에서 `sigungu` `dong`을 받아 `WaypointInput`에 넣는다. 비우면 주소의 앞 두 마디(예: 서울 성동구)가 대신 보인다.
- **기사 위치**: 운행 중에 `api.drivers.reportLocation`을 주기적으로 부른다. 대기 콜의 "픽업지까지 거리", 수락할 때의 픽업·도착 예정 시각, 고객의 배송 추적이 모두 이 위치로 계산된다.
- **새 콜 푸시**: `data.orderId`로 `api.dispatch.openOrder`를 불러 콜 내용을 채운다. 그사이 다른 기사가 수락했으면 `orderNotOpen`.
- **메시지**: 대화 화면에서는 `api.orders.messages(orderId, after: 마지막으로 받은 시각)`을 주기적으로 부르거나, `ORDER_MESSAGE` 푸시를 받았을 때 부른다. 보내기는 배송이 진행 중(`Order.isInProgress`)일 때만 된다.
- **서류**: 사진(JPG·PNG·WEBP·HEIC)이나 PDF, 10MB까지. 형식은 서버가 파일 내용으로 판단한다. 세 가지를 모두 올려야 `api.drivers.register`가 된다. 반려되면 `DriverDocument.needsUpload`인 것만 다시 올린다.
- **날짜**: 수입·정산의 하루는 한국 시간 기준이다. `earnings`와 `myOrders`의 `from` `to`에는 `DateTime`을 주면 되고(그 시각이 속한 한국 날짜로 보낸다), 응답의 날짜는 `YYYY-MM-DD` 문자열이다. 오늘 날짜가 필요하면 `toKstDate(DateTime.now())`.
- **비밀번호 찾기**: `requestPasswordReset` → 메일로 받은 6자리 코드 → `confirmPasswordReset` → `login`. 가입하지 않은 이메일에도 똑같이 성공하므로 화면에서도 "메일을 보냈어요"라고만 한다.

## 로그인과 토큰

- 로그인하면 토큰을 기기의 보안 저장소(iOS 키체인, Android Keystore)에 둔다. 앱을 껐다 켜도 유지된다.
- 이후 호출에는 토큰이 자동으로 붙는다. 액세스 토큰이 만료되면(30분) 자동으로 갱신하고 같은 요청을 다시 보낸다 — 화면 코드는 만료를 신경 쓰지 않는다.
- 리프레시 토큰까지 만료·폐기됐으면 로그인이 풀린다. `api.sessionExpired`를 앱의 한 곳에서 구독해 로그인 화면으로 보낸다.
- **앱 구분**: 서버는 어느 앱에서 로그인했는지 모른다. `appRole`과 다른 역할의 계정이 로그인하면 `WrongAppException`이 나고 로그인되지 않는다. 가입은 항상 `appRole`로 된다.
- 로그아웃 순서: 푸시를 받고 있었다면 `api.pushDevices.unregister(token)` → `api.auth.logout()`.
- 탈퇴(`api.auth.withdraw`)에 성공하면 이 기기에서도 로그아웃된다. 서버가 그 계정의 푸시 기기 등록도 지운다.

## 오류 처리

모든 오류는 `MovoException`의 하위 타입이다.

| 타입 | 언제 | 화면에서 |
| --- | --- | --- |
| `ApiException` | 서버가 거절 (`statusCode`, `code`, `message`) | `code`로 분기하거나 `message`를 그대로 보여준다 (한국어) |
| `SessionExpiredException` | 로그인이 풀림 (`ApiException`의 하위) | `api.sessionExpired`에서 한 번에 처리 |
| `WrongAppException` | 다른 앱의 계정으로 로그인 | "이 앱에서는 사용할 수 없는 계정" 안내 |
| `NetworkException` | 서버에 닿지 못함·시간 초과 | 다시 시도 안내 |
| `UnexpectedResponseException` | 응답을 읽을 수 없음 (앱과 서버 버전 불일치) | 업데이트 안내 |

분기에 쓰는 코드는 `ApiErrorCode`에 있다. 예: 기사가 수락했는데 다른 기사가 먼저였다면 409와 함께 `orderNotOpen` 또는 `staleAggregate`가 온다 — 둘 다 "이미 배차된 주문"으로 처리하고 목록을 새로 고친다.

입력 검증 실패(`validationFailed`)의 메시지는 영어이고 항목별로 여러 줄이다. 사용자에게 보여줄 문구는 앱에서 먼저 검증해 만든다.

## 서버에 값이 추가될 때

차종·주문 상태 같은 enum에는 `unknown`이 있다. 서버에 새 값이 생겨도 예전 버전의 앱이 응답을 읽다가 죽지 않게 하려는 것이다. 목록에서는 `unknown`인 항목을 빼고 보여준다.

## 테스트

```bash
flutter test                  # 단위 테스트 (서버 없이)
tool/integration_test.sh      # 실제 서버에 붙어 모든 엔드포인트 호출 (서버가 떠 있어야 한다)
```

모델은 서버의 응답에 맞춰 손으로 쓴 것이다 (코드 생성 아님). **서버의 API를 바꿨다면** `lib/src/models`와 `lib/src/api`를 함께 고치고 `tool/integration_test.sh`로 맞는지 확인한다. 서버의 응답 형식은 `backend`의 Swagger(`/api/docs`)에 있다.

# movo_testkit

MOVO 앱 테스트 도구. 앱의 `dev_dependencies`로만 쓴다.

- `FakeBackend` — 가짜 서버. 경로마다 응답을 정하고, 받은 요청을 기록한다. `offline = true`로 연결 오류도 흉내 낸다.
- `fixtures.dart` — 서버 응답 모양의 견본 값. 디자인에 나온 사람·주소·금액을 쓴다.
- `testScreen` · `pumpScreen` · `pumpApp` — 디자인의 기기 크기(375×812)로 화면을 띄운다. 실제 글꼴(SUIT)과 그림자로 그린다.
- `screenshot(tester, 이름)` — 지금 화면을 `build/screenshots/이름.png`로 저장한다. 디자인과 눈으로 견줄 때 쓴다.
- 화면 아래 시스템 영역 검사 — `screenshot`과 `testScreen`의 마지막 화면에서 저절로 돈다. 테스트 기기는 아래 안전 영역이 48(Android 3버튼 내비게이션 바)이다. 글자·아이콘·버튼이 그 영역에 걸리거나 4보다 가까이 붙으면 실패한다 (스크롤 내용은 끝까지 내렸을 때를 본다). 한꺼번에 조사하려면 `MOVO_SYSTEM_BAR_AUDIT=report flutter test` — 실패 대신 목록을 출력한다.

```dart
testScreen('배달 상세 — 가게로 오는 중', (tester) async {
  final delivery = deliveryJson(status: 'ASSIGNED');
  final backend = FakeBackend()
    ..on('GET', '/orders/:id', (_, _) => deliveryDetailJson(delivery))
    ..on('GET', '/orders/:id/tracking', (_, _) => trackingJson(status: 'ASSIGNED'));
  await pumpScreen(
    tester,
    api: backend.api(UserRole.customer),
    profile: MovoAppProfile.customer,
    user: userJson(),
    screen: DeliveryDetailScreen(orderId: delivery['id'] as String),
  );

  expect(find.text('라이더가 가게로 오고 있어요'), findsOneWidget);
  await screenshot(tester, 'store-delivery-assigned');
});```

준비하지 않은 경로를 화면이 부르면 테스트가 바로 실패한다 — 화면이 무엇을 부르는지 빠짐없이 드러난다.

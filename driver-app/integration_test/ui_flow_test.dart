import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:integration_test/integration_test.dart';
import 'package:movo_api/movo_api.dart';
import 'package:movo_driver/api.dart';
import 'package:movo_driver/main.dart';
import 'package:movo_driver/services.dart';
import 'package:movo_ui/movo_ui.dart';

// 기기에서 실제 서버에 붙어, 기사 가입부터 콜 수락·픽업·배송 완료까지 화면으로 해 본다.
//
//   flutter test integration_test/ui_flow_test.dart -d <기기> \
//     --dart-define=ADMIN_EMAIL=... --dart-define=ADMIN_PASSWORD=...
//
// 개발 서버가 떠 있어야 하고, 기사 승인에 운영자 계정이 필요하다 (없으면 승인 대기까지만 본다).
// Android 에뮬레이터는 먼저 `adb reverse tcp:4000 tcp:4000`.
// 개발 DB에 대기 중인 다마스 주문이 남아 있으면 안 된다 (콜 대기 화면에서 시작한다고 본다).

const _adminEmail = String.fromEnvironment('ADMIN_EMAIL');
const _adminPassword = String.fromEnvironment('ADMIN_PASSWORD');

/// 사진을 고르는 대신 정해 둔 파일을 올린다 (기기의 사진 고르기 화면은 테스트가 다룰 수 없다).
class _FixedPhoto implements DocumentPicker {
  @override
  Future<UploadFile?> pick(BuildContext context) async => UploadFile(
    bytes: Uint8List.fromList([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a]),
    filename: 'document.jpg',
  );
}

/// 성수동 근처에 있는 것으로 한다 (기기의 위치 권한 창을 띄우지 않는다).
class _FixedLocation implements LocationSource {
  @override
  Future<Coordinates?> current() async =>
      const Coordinates(latitude: 37.5560, longitude: 127.0500);

  @override
  Stream<Coordinates> watch() => const Stream.empty();
}

Future<void> waitFor(
  WidgetTester tester,
  Finder finder, {
  Duration timeout = const Duration(seconds: 20),
}) async {
  final end = DateTime.now().add(timeout);
  while (DateTime.now().isBefore(end)) {
    await tester.pump(const Duration(milliseconds: 100));
    if (finder.evaluate().isNotEmpty) return;
  }
  // 무엇이 떠 있었는지 함께 알려준다.
  final shown = [
    for (final element in find.byType(Text).evaluate())
      (element.widget as Text).data ?? '',
  ].where((text) => text.isNotEmpty).take(40).join(' | ');
  final typed = [
    for (final element in find.byType(EditableText).evaluate())
      (element.widget as EditableText).controller.text,
  ].join(' | ');
  fail('나타나지 않았어요: $finder\n화면: $shown\n입력: $typed');
}

Future<void> tap(WidgetTester tester, Finder finder) async {
  await waitFor(tester, finder);
  // 기기에서는 입력한 뒤 키보드가 떠 있다. 내리고 화면이 다시 자리 잡은 뒤에 누른다.
  FocusManager.instance.primaryFocus?.unfocus();
  await tester.pump(const Duration(milliseconds: 500));
  await tester.ensureVisible(finder.first);
  await tester.pump(const Duration(milliseconds: 100));
  await tester.tap(finder.first);
  // 화면이 넘어가는 움직임이 끝날 때까지 기다린다 — 그 전에는 입력란이 글자를 받지 못한다.
  for (var i = 0; i < 5; i++) {
    await tester.pump(const Duration(milliseconds: 200));
  }
}

/// 밀어서 확인하는 버튼의 손잡이를 끝까지 민다.
Future<void> slide(WidgetTester tester) async {
  final knob = find.descendant(
    of: find.byType(MovoSlideToConfirm),
    matching: find.byType(MovoIcon),
  );
  await waitFor(tester, knob);
  await tester.drag(knob, const Offset(600, 0));
  await tester.pump(const Duration(milliseconds: 300));
}

/// 운영자 권한으로 방금 신청한 기사를 승인한다.
Future<void> approve(String driverUserEmail) async {
  Future<Map<String, dynamic>> call(
    String method,
    String path, {
    String? token,
    Object? body,
  }) async {
    final request = http.Request(
      method,
      Uri.parse('${environment.apiBaseUrl}$path'),
    )..headers['Content-Type'] = 'application/json';
    if (token != null) request.headers['Authorization'] = 'Bearer $token';
    if (body != null) request.body = jsonEncode(body);
    final response = await http.Response.fromStream(await request.send());
    expect(response.statusCode, lessThan(300), reason: response.body);
    return jsonDecode(response.body) as Map<String, dynamic>;
  }

  final login = await call(
    'POST',
    '/auth/login',
    body: {'email': _adminEmail, 'password': _adminPassword},
  );
  final token = login['accessToken'] as String;
  final pending = await call(
    'GET',
    '/admin/drivers?status=PENDING&size=100',
    token: token,
  );
  for (final item in pending['items'] as List<dynamic>) {
    final id = (item as Map<String, dynamic>)['id'] as String;
    final detail = await call('GET', '/admin/drivers/$id', token: token);
    if ((detail['applicant'] as Map?)?['email'] == driverUserEmail) {
      await call('PATCH', '/admin/drivers/$id/approve', token: token);
      return;
    }
  }
  fail('승인할 기사를 찾지 못했어요: $driverUserEmail');
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('가입 → 서류 → 승인 → 운행 → 콜 수락 → 픽업 → 배송 완료', (tester) async {
    documentPicker = _FixedPhoto();
    locationSource = _FixedLocation();
    await api.auth.logout();
    final stamp = DateTime.now().microsecondsSinceEpoch;
    final email = 'ui-driver-$stamp@test.dev';
    await tester.pumpWidget(const DriverApp());

    // 1단계: 계정
    await tap(tester, find.text('기사 회원가입'));
    await waitFor(tester, find.text('1 / 2'));
    // 가입 화면의 입력란만 (화면이 넘어가는 동안에는 로그인 화면의 입력란도 함께 잡힌다).
    final fields = find.descendant(
      of: find.byType(SignupScreen),
      matching: find.byType(EditableText),
    );
    await tester.enterText(fields.at(0), '김도윤');
    await tester.enterText(fields.at(1), '010-9876-5432');
    await tester.enterText(fields.at(2), email);
    await tester.enterText(fields.at(3), 'password123');
    await tap(tester, find.text('전체 동의'));
    await tap(tester, find.text('다음'));

    // 2단계: 차량과 서류
    await waitFor(tester, find.text('차량과 서류'));
    await tap(tester, find.text('다마스'));
    await tester.enterText(find.byType(EditableText).last, '서울 81바 2047');
    for (var i = 0; i < 3; i++) {
      await tap(tester, find.text('사진 올리기'));
      await waitFor(tester, find.text('등록됨').at(i));
    }
    await tap(tester, find.text('가입 신청하기'));
    await waitFor(tester, find.text('제출하신 서류를\n확인하고 있어요'));
    expect(find.text('다마스 · 서울 81바 2047'), findsOneWidget);
    if (_adminEmail.isEmpty) return;

    // 운영자가 승인하면 (화면이 10초마다 확인한다) 홈으로 넘어간다.
    await approve(email);
    await waitFor(tester, find.text('운행이 꺼져 있어요'));
    await tap(tester, find.text('운행 시작'));
    await waitFor(tester, find.text('콜을 기다리고 있어요'));

    // 고객이 다마스 배송을 요청한다 (고객 앱이 하는 일을 API로).
    final customer = MovoApi(
      baseUrl: environment.apiBaseUrl,
      appRole: UserRole.customer,
      tokenStore: MemoryTokenStore(),
    );
    await customer.auth.register(
      email: 'ui-customer-$stamp@test.dev',
      password: 'password123',
      name: '김지은',
      phone: '010-1234-5678',
      agreements: const Agreements(terms: true, privacy: true),
    );
    final order = await customer.orders.create(
      vehicleType: VehicleType.damas,
      pickup: const WaypointInput(
        address: '서울 성동구 성수이로 113',
        detailAddress: '1층 정문',
        sigungu: '성동구',
        dong: '성수동2가',
        latitude: 37.5445,
        longitude: 127.0557,
        contactName: '김지은',
        contactPhone: '010-1234-5678',
      ),
      dropoff: const WaypointInput(
        address: '서울 강남구 테헤란로 152',
        sigungu: '강남구',
        dong: '역삼동',
        latitude: 37.5,
        longitude: 127.0364,
        contactName: '박서준',
        contactPhone: '010-5555-0123',
      ),
      cargo: const CargoInput(
        category: CargoCategory.box,
        weightKg: 15,
        quantity: 3,
      ),
      memo: '1층 경비실에 맡겨주세요',
    );

    // 새 콜이 크게 뜬다 — 구·동과 요금만 보인다.
    await waitFor(tester, find.text('새 배송 요청'));
    // (같은 콜이 뒤의 목록에도 있어 두 번 보인다.)
    expect(find.text('성동구 성수동2가'), findsWidgets);
    expect(find.text(won(order.fare)), findsWidgets);
    expect(find.textContaining('성수이로'), findsNothing);
    await tap(tester, find.text('수락하기'));

    // 수락하면 상세 주소와 요청사항이 열린다.
    await waitFor(tester, find.text('1/2 · 픽업하러 가는 중'));
    expect(find.text('성수이로 113'), findsOneWidget);
    expect(find.text('1층 경비실에 맡겨주세요'), findsOneWidget);
    expect((await customer.orders.get(order.id)).driver?.name, '김도윤');

    await slide(tester);
    await waitFor(tester, find.text('2/2 · 배송하러 가는 중'));
    expect(find.text('박서준 · 010-5555-0123'), findsOneWidget);
    // 고객 쪽에서는 기사 위치가 보인다.
    expect(
      (await customer.orders.tracking(order.id)).driverLocation,
      isNotNull,
    );

    await slide(tester);
    await waitFor(tester, find.text('+${won(order.fare)}'));
    expect(
      (await customer.orders.get(order.id)).order.status,
      OrderStatus.delivered,
    );

    // 다음 콜 받기 → 홈에 오늘 수입이 잡힌다.
    await tap(tester, find.text('다음 콜 받기'));
    await waitFor(tester, find.text('콜을 기다리고 있어요'));
    await waitFor(tester, find.text(won(order.fare)));
    expect(find.text('1건'), findsOneWidget);

    // 수입 탭과 마이 → 로그아웃
    await tap(tester, find.text('수입'));
    await waitFor(tester, find.textContaining('1건 완료'));
    await tap(tester, find.text('마이'));
    await waitFor(tester, find.text('승인 완료'));
    await tap(tester, find.text('홈'));
    await tap(tester, find.byType(MovoToggle));
    await waitFor(tester, find.text('운행이 꺼져 있어요'));
    await tap(tester, find.text('마이'));
    await tap(tester, find.text('로그아웃'));
    await tap(tester, find.text('로그아웃').last);
    await waitFor(tester, find.text('기사님, 오늘도\n안전 운행하세요'));
  });
}

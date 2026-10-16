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

// 기기에서 실제 서버에 붙어, 라이더 가입부터 콜 수락·가게 도착·픽업·만나서 결제·배달 완료까지 화면으로 해 본다.
//
//   flutter test integration_test/ui_flow_test.dart -d <기기> \
//     --dart-define=ADMIN_EMAIL=... --dart-define=ADMIN_PASSWORD=...
//
// 개발 서버가 떠 있어야 하고, 라이더·가게 승인에 운영자 계정이 필요하다 (없으면 심사 대기까지만 본다).
// Android 에뮬레이터는 먼저 `adb reverse tcp:4000 tcp:4000`.
// 개발 DB에 대기 중인 배달 콜이 남아 있으면 안 된다 (빈 콜 목록에서 시작한다고 본다).

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

/// 역삼동 근처에 있는 것으로 한다 (기기의 위치 권한 창을 띄우지 않는다).
class _FixedLocation implements LocationSource {
  @override
  Future<Coordinates?> current() async =>
      const Coordinates(latitude: 37.5010, longitude: 127.0370);

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

/// 운영자 API를 부른다.
Future<Map<String, dynamic>> _call(
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
  return response.body.isEmpty
      ? const {}
      : jsonDecode(response.body) as Map<String, dynamic>;
}

Future<String> _adminToken() async {
  final login = await _call(
    'POST',
    '/auth/login',
    body: {'email': _adminEmail, 'password': _adminPassword},
  );
  return login['accessToken'] as String;
}

/// 운영자 권한으로 방금 신청한 라이더를 승인한다.
Future<void> approveRider(String riderEmail) async {
  final token = await _adminToken();
  final pending = await _call(
    'GET',
    '/admin/drivers?status=PENDING&size=100',
    token: token,
  );
  for (final item in pending['items'] as List<dynamic>) {
    final id = (item as Map<String, dynamic>)['id'] as String;
    final detail = await _call('GET', '/admin/drivers/$id', token: token);
    if ((detail['applicant'] as Map?)?['email'] == riderEmail) {
      await _call('PATCH', '/admin/drivers/$id/approve', token: token);
      return;
    }
  }
  fail('승인할 라이더를 찾지 못했어요: $riderEmail');
}

/// 검증 숫자가 맞는 아무 사업자등록번호 (실행할 때마다 다르게).
String _businessNumber(int seed) {
  final digits = [for (var i = 0; i < 9; i++) (seed ~/ _pow10(i)) % 10];
  const weights = [1, 3, 7, 1, 3, 7, 1, 3, 5];
  var sum = 0;
  for (var i = 0; i < 9; i++) {
    sum += weights[i] * digits[i];
  }
  sum += (digits[8] * 5) ~/ 10;
  return [...digits, (10 - sum % 10) % 10].join();
}

int _pow10(int n) => n == 0 ? 1 : 10 * _pow10(n - 1);

/// 가게 앱이 하는 일을 API로: 사장님 가입 → 가게 등록 → 운영자 승인 → 충전 → 배달 요청.
Future<Order> _requestDelivery(int stamp) async {
  final owner = MovoApi(
    baseUrl: environment.apiBaseUrl,
    appRole: UserRole.customer,
    tokenStore: MemoryTokenStore(),
  );
  await owner.auth.register(
    email: 'ui-owner-$stamp@test.dev',
    password: 'password123',
    name: '박모보',
    phone: '010-1234-5678',
    agreements: const Agreements(terms: true, privacy: true),
  );
  final store = await owner.stores.register(
    StoreInput(
      name: '모보치킨 역삼점',
      businessNumber: _businessNumber(stamp),
      phone: '025551234',
      address: const StoreAddress(
        address: '서울 강남구 테헤란로 152',
        detailAddress: '1층',
        sigungu: '강남구',
        dong: '역삼동',
        latitude: 37.5000,
        longitude: 127.0364,
      ),
    ),
  );
  await _call(
    'PATCH',
    '/admin/stores/${store.id}/approve',
    token: await _adminToken(),
  );
  await owner.stores.topUp(50000);
  return owner.deliveries.request(
    const DeliveryRequestInput(
      dropoff: DeliveryDestination(
        address: '서울 강남구 역삼로 180',
        detailAddress: '101동 1203호',
        sigungu: '강남구',
        dong: '역삼동',
        latitude: 37.4955,
        longitude: 127.0495,
      ),
      phone: '05012345678',
      foodAmount: 23000,
      doorPayment: DoorPayment.cash,
      readyInMinutes: 0,
      memo: '문 앞에 두고 벨 눌러 주세요',
    ),
  );
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('가입 → 서류 → 승인 → 운행 → 콜 수락 → 가게 도착 → 픽업 → 현금 받고 완료', (
    tester,
  ) async {
    documentPicker = _FixedPhoto();
    locationSource = _FixedLocation();
    await api.auth.logout();
    final stamp = DateTime.now().microsecondsSinceEpoch;
    final email = 'ui-rider-$stamp@test.dev';
    await tester.pumpWidget(const DriverApp());

    // 1단계: 계정
    await tap(tester, find.text('처음이에요 · 라이더 가입'));
    await waitFor(tester, find.text('다음 · 서류 올리기'));
    // 가입 화면의 입력란만 (화면이 넘어가는 동안에는 로그인 화면의 입력란도 함께 잡힌다).
    final fields = find.descendant(
      of: find.byType(SignupScreen),
      matching: find.byType(EditableText),
    );
    await tester.enterText(fields.at(0), '김라이더');
    await tester.enterText(fields.at(1), '010-4821-1024');
    await tester.enterText(fields.at(2), email);
    await tester.enterText(fields.at(3), 'password123');
    await tap(tester, find.text('전체 동의'));
    await tap(tester, find.text('다음 · 서류 올리기'));

    // 2단계: 오토바이와 서류
    await waitFor(tester, find.text('오토바이와 서류'));
    await tester.enterText(find.byType(EditableText).first, '서울 강남 가 1234');
    for (var i = 0; i < 3; i++) {
      await tap(tester, find.text('올리기'));
      await waitFor(tester, find.text('올림').at(i));
    }
    await tap(tester, find.text('심사 신청하기'));
    await waitFor(tester, find.text('심사하고 있어요'));
    expect(find.text('서울 강남 가 1234'), findsOneWidget);
    if (_adminEmail.isEmpty) return;

    // 운영자가 승인하면 (화면이 10초마다 확인한다) 홈으로 넘어간다.
    await approveRider(email);
    await waitFor(tester, find.text('운행이 꺼져 있어요'));
    await tap(tester, find.text('운행 시작'));
    await waitFor(tester, find.text('주변에 들어온 콜이 없어요'));

    // 가게가 배달을 요청하면 새 콜이 크게 뜬다.
    final order = await _requestDelivery(stamp);
    await waitFor(tester, find.text('새 콜'));
    expect(find.text('모보치킨 역삼점'), findsWidgets);
    expect(find.text('만나서 현금 · 23,000원 받아요'), findsOneWidget);
    await tap(tester, find.text('수락하기'));

    // 가게로 이동 → 가게 도착 → 픽업
    await waitFor(tester, find.text('픽업할 가게'));
    await tap(tester, find.text('가게 도착').last);
    await waitFor(tester, find.text('가게에 주문번호 끝자리를 말해 주세요'));
    expect(
      find.text(order.code.substring(order.code.length - 4)),
      findsWidgets,
    );
    await tap(tester, find.text('픽업 완료 · 1건'));

    // 손님에게 이동 → 만나서 결제
    await waitFor(tester, find.text('101동 1203호'));
    expect(find.text('문 앞에 두고 벨 눌러 주세요'), findsOneWidget);
    await tap(tester, find.text('전달 완료'));
    await waitFor(tester, find.text('만나서 결제'));
    await tap(tester, find.text('완료'));
    await waitFor(tester, find.text('배달을 완료했어요'));
    expect(find.text('현금 23,000원'), findsOneWidget);
    await tap(tester, find.text('콜 목록으로'));

    // 내역 → 마이 → 운행 끄고 로그아웃
    await tap(tester, find.text('내역'));
    await waitFor(tester, find.text('현금 23,000원'));
    await tap(tester, find.text('홈'));
    await tap(tester, find.text('운행 중'));
    await waitFor(tester, find.text('운행이 꺼져 있어요'));
    await tap(tester, find.text('마이'));
    await tap(tester, find.text('로그아웃'));
    await tap(tester, find.text('로그아웃').last);
    await waitFor(tester, find.text('라이더 계정으로\n로그인해 주세요'));
  });
}

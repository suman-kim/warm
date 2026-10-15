import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:movo_api/movo_api.dart';
import 'package:movo_driver/delivery/accept_screens.dart';
import 'package:movo_driver/delivery/delivery_screen.dart';
import 'package:movo_driver/driver_scope.dart';
import 'package:movo_driver/earnings/settlements_screen.dart';
import 'package:movo_driver/my/my_screen.dart';
import 'package:movo_driver/gate.dart';
import 'package:movo_driver/home/new_call_screen.dart';
import 'package:movo_driver/services.dart';
import 'package:movo_testkit/movo_testkit.dart';
import 'package:movo_ui/movo_ui.dart';

// 화면마다 가짜 서버의 값으로 띄워 보고, 디자인과 견줄 화면 사진을 build/screenshots에 남긴다.

/// 사진을 고르는 대신 정해 둔 파일을 돌려준다.
class _FakePicker implements DocumentPicker {
  int picked = 0;

  @override
  Future<UploadFile?> pick(BuildContext context) async {
    picked++;
    return UploadFile(
      bytes: Uint8List.fromList([0xff, 0xd8, 0xff, 0xe0]),
      filename: 'document.jpg',
    );
  }
}

/// 위치를 알 수 없는 기기.
class _NoLocation implements LocationSource {
  const _NoLocation();

  @override
  Future<Coordinates?> current() async => null;

  @override
  Stream<Coordinates> watch() => const Stream.empty();
}

/// 고객이 운반 도움(함께)과 계단(도착 3층)을 고른 44,000원짜리 주문.
Map<String, dynamic> _withAddOns(String status) => orderJson(
  status: status,
  fare: 44000,
  loadingHelp: 'TOGETHER',
  helpFee: 10000,
  dropoffAccess: const {'floor': 3, 'elevator': false},
  stairFee: 6000,
);

Future<void> _show(WidgetTester tester, FakeBackend backend, Widget screen) =>
    pumpScreen(
      tester,
      api: backend.api(UserRole.driver),
      profile: MovoAppProfile.driver,
      user: driverUserJson(),
      screen: screen,
    );

/// 오늘 완료한 배송 세 건 (디자인의 '오늘 운행').
/// [commission]이면 서버가 수수료 10%를 뗀 금액(earning)을 함께 준다.
List<Map<String, dynamic>> _todayDeliveries({bool commission = false}) => [
  for (final (index, (from, to, fare)) in const [
    ('망원동', '상암동', 12000),
    ('연희동', '공덕동', 30000),
    ('합정동', '여의도동', 42000),
  ].indexed)
    orderJson(
      id: 'done-$index',
      status: 'DELIVERED',
      fare: fare,
      earning: commission ? fare * 9 ~/ 10 : null,
      pickup: {...seongsu, 'dong': from},
      dropoff: {...yeoksam, 'dong': to},
      requestedAgo: Duration(hours: 1 + index * 2),
    ),
];

/// 승인된 기사의 홈이 부르는 것들.
FakeBackend _homeBackend({
  bool available = false,
  List<Object> calls = const [],
  Map<String, dynamic>? active,
  List<int> earnings = const [86000, 104000, 131000, 58000, 0, 151000, 84000],
  bool commission = false,
}) {
  final deliveries = _todayDeliveries(commission: commission);
  var online = available;
  Map<String, dynamic> me() => myDriverJson(
    available: online,
    onlineFor: online ? const Duration(hours: 2, minutes: 14) : null,
  );
  return FakeBackend()
    ..on('GET', '/drivers/me', (_, _) => me())
    ..on('PATCH', '/drivers/me/availability', (request, _) {
      online = (jsonDecode(request.body) as Map)['available'] as bool;
      return me();
    })
    ..on(
      'GET',
      '/dispatch/earnings',
      (request, _) =>
          request.url.queryParameters['from'] ==
              request.url.queryParameters['to']
          ? earningsJson(amounts: [earnings.last], completedCount: 3)
          : earningsJson(amounts: earnings),
    )
    ..on('GET', '/dispatch/my-orders', (request, _) {
      final status = request.url.queryParameters['status'];
      if (status == 'DELIVERED') return pageJson(deliveries);
      if (active != null && status == active['status']) {
        return pageJson([active]);
      }
      if (status == null) {
        return pageJson([
          ?active,
          ...deliveries,
          orderJson(
            id: 'noshow-1',
            status: 'NO_SHOW',
            fare: 22000,
            cancellationFee: 22000,
            earning: 0,
            pickup: {...seongsu, 'dong': '연남동'},
            dropoff: {...yeoksam, 'dong': '합정동'},
            requestedAgo: const Duration(hours: 8),
          ),
          orderJson(
            id: 'extra-1',
            status: 'DELIVERED',
            fare: 44000,
            extraItems: const {'overload': 1, 'bulky': 0, 'stairs': 0},
            extraFee: 10000,
            waitingMinutes: 14,
            waitingFee: 2000,
            // 서버가 주는 정산액: 최종 요금 56,000원 − 수수료 10% 5,600원
            earning: 50400,
            requestedAgo: const Duration(hours: 9),
          ),
          orderJson(
            id: 'cancelled-1',
            status: 'CANCELLED',
            pickup: {...seongsu, 'dong': '신촌동'},
            dropoff: {...yeoksam, 'dong': '아현동'},
            requestedAgo: const Duration(days: 1, hours: 1),
          ),
        ]);
      }
      return pageJson(const []);
    })
    ..on('GET', '/dispatch/open-orders', (_, _) => pageJson(calls))
    ..on('GET', '/drivers/me/documents', (_, _) => documentsJson())
    ..on(
      'GET',
      '/drivers/me/settlement-account',
      (_, _) => settlementAccountJson(),
    )
    ..on('GET', '/dispatch/settlements', (_, _) => driverSettlementsJson())
    ..on('GET', '/notifications/settings', (_, _) => {'pushEnabled': true});
}

void main() {
  setUp(() {
    documentPicker = _FakePicker();
    locationSource = const _NoLocation();
  });

  group('가입 2단계와 심사', () {
    testScreen('차량과 서류 — 서류를 모두 올려야 신청할 수 있다', (tester) async {
      var statuses = ['SUBMITTED', 'SUBMITTED', 'NOT_SUBMITTED'];
      final backend = FakeBackend()
        ..fail('GET', '/drivers/me', status: 404, code: 'DRIVER_NOT_REGISTERED')
        ..on('GET', '/drivers/me/documents', (_, _) => documentsJson(statuses))
        ..on('PUT', '/drivers/me/documents/:type', (_, _) {
          statuses = ['SUBMITTED', 'SUBMITTED', 'SUBMITTED'];
          return documentsJson(statuses);
        })
        ..on(
          'POST',
          '/drivers',
          (_, _) => myDriverJson(status: 'PENDING'),
          status: 201,
        );
      await _show(tester, backend, const DriverGate());
      await tester.tap(find.text('다마스'));
      await tester.enterText(find.byType(EditableText), '서울 81바 2047');
      await settle(tester);

      expect(find.text('등록됨'), findsNWidgets(2));
      expect(find.text('서류 1개를 더 올리면 신청할 수 있어요'), findsOneWidget);
      await screenshot(tester, 'driver-03-vehicle-docs');

      // 서류가 빠져 있으면 신청 버튼이 눌리지 않는다.
      await tester.tap(find.text('가입 신청하기'));
      await settle(tester);
      expect(backend.calls, isNot(contains('POST /drivers')));

      await tester.tap(find.text('사진 올리기'));
      await settle(tester);
      expect(
        backend.calls,
        contains('PUT /drivers/me/documents/FREIGHT_QUALIFICATION'),
      );
      expect(find.text('등록됨'), findsNWidgets(3));

      await tester.tap(find.text('가입 신청하기'));
      await settle(tester);
      expect(backend.bodyOf('POST /drivers'), {
        'vehicleType': 'DAMAS',
        'vehicleNumber': '서울 81바 2047',
      });
      // 신청하면 승인 대기 화면으로 넘어간다.
      expect(find.text('제출하신 서류를\n확인하고 있어요'), findsOneWidget);
    });

    testScreen('승인 대기', (tester) async {
      final backend = FakeBackend()
        ..on('GET', '/drivers/me', (_, _) => myDriverJson(status: 'PENDING'));
      await _show(tester, backend, const DriverGate());

      expect(find.text('가입 심사 중'), findsOneWidget);
      expect(find.text('검토 중이에요'), findsOneWidget);
      expect(find.text('다마스 · 서울 81바 2047'), findsOneWidget);
      await screenshot(tester, 'driver-04-pending');
    });

    testScreen('심사 반려 — 반려된 서류만 다시 올려 재신청한다', (tester) async {
      var statuses = ['APPROVED', 'APPROVED', 'REJECTED'];
      final backend = FakeBackend()
        ..on(
          'GET',
          '/drivers/me',
          (_, _) => myDriverJson(
            status: 'REJECTED',
            rejectionReason: '화물운송 종사 자격증 사진이 흐려서 내용을 확인할 수 없어요.',
          ),
        )
        ..on('GET', '/drivers/me/documents', (_, _) => documentsJson(statuses))
        ..on('PUT', '/drivers/me/documents/:type', (_, _) {
          statuses = ['APPROVED', 'APPROVED', 'SUBMITTED'];
          return documentsJson(statuses);
        })
        ..on(
          'POST',
          '/drivers',
          (_, _) => myDriverJson(status: 'PENDING'),
          status: 201,
        );
      await _show(tester, backend, const DriverGate());

      expect(find.text('서류 한 가지를\n다시 올려주세요'), findsOneWidget);
      expect(find.text('확인됨'), findsNWidgets(2));

      await tester.tap(find.text('사진 올리기'));
      await settle(tester);
      expect(find.text('교체됨'), findsOneWidget);
      expect(find.text('반려됨 → 새 사진 올림'), findsOneWidget);
      await screenshot(tester, 'driver-05-rejected');

      await tester.tap(find.text('재신청하기'));
      await settle(tester);
      expect(backend.bodyOf('POST /drivers')['vehicleType'], 'DAMAS');
      expect(find.text('가입 심사 중'), findsOneWidget);
    });
  });

  group('홈', () {
    testScreen('운행이 꺼져 있을 때 — 켜면 콜을 기다린다', (tester) async {
      final backend = _homeBackend(
        earnings: [86000, 104000, 131000, 58000, 0, 151000, 112000],
      );
      await _show(tester, backend, const DriverGate());

      expect(find.text('운행이 꺼져 있어요'), findsOneWidget);
      expect(find.text('112,000원'), findsOneWidget);
      expect(find.text('6시간 20분'), findsOneWidget);
      await screenshot(tester, 'driver-06-offline');

      await tester.tap(find.text('운행 시작'));
      await settle(tester);
      expect(backend.bodyOf('PATCH /drivers/me/availability'), {
        'available': true,
      });
      expect(find.text('콜을 기다리고 있어요'), findsOneWidget);
    });

    testScreen('운행 중 · 콜 없음', (tester) async {
      await _show(tester, _homeBackend(available: true), const DriverGate());

      expect(find.text('콜을 기다리고 있어요'), findsOneWidget);
      expect(find.text('운행 2시간 14분째'), findsOneWidget);
      expect(find.text('84,000원'), findsOneWidget);
      expect(find.text('망원동 → 상암동'), findsOneWidget);
      expect(find.text('+12,000원'), findsOneWidget);
      await screenshot(tester, 'driver-07-waiting');
    });

    testScreen('배차 대기 목록 — 수락하면 배송 화면으로 간다', (tester) async {
      final backend =
          _homeBackend(
              available: true,
              calls: [
                openOrderJson(),
                openOrderJson(
                  id: 'order-2',
                  pickupArea: '마포구 연남동',
                  dropoffArea: '마포구 합정동',
                  distanceKm: 3.1,
                  durationMinutes: 15,
                  fare: 22000,
                  cargo: {...boxes, 'category': 'SHOPPING_BAG', 'quantity': 2},
                  requestedAgo: const Duration(minutes: 3),
                ),
                openOrderJson(
                  id: 'order-3',
                  pickupArea: '송파구 문정동',
                  dropoffArea: '성남시 분당구',
                  distanceKm: 14.6,
                  durationMinutes: 45,
                  fare: 41000,
                  cargo: {...boxes, 'quantity': 6},
                  scheduledPickupAt: DateTime.now()
                      .add(const Duration(days: 1))
                      .copyWith(hour: 10, minute: 0)
                      .toUtc()
                      .toIso8601String(),
                ),
              ],
            )
            ..on('POST', '/dispatch/orders/:id/accept', (_, _) => orderJson())
            ..on(
              'GET',
              '/dispatch/orders/:id/navigation',
              (_, _) => navigationJson(),
            );
      await _show(tester, backend, const DriverGate());

      expect(find.text('대기 중인 콜'), findsOneWidget);
      expect(find.text('성동구 성수동2가'), findsOneWidget);
      expect(find.text('3.1km · 약 15분 · 쇼핑백 2개'), findsOneWidget);
      expect(find.text('예약 · 내일 10:00'), findsOneWidget);
      // 수락 전에는 상세 주소가 보이지 않는다.
      expect(find.textContaining('성수이로'), findsNothing);
      await screenshot(tester, 'driver-08-calls');

      await tester.tap(find.text('수락').first);
      await settle(tester);
      expect(backend.calls, contains('POST /dispatch/orders/order-1/accept'));
      expect(find.text('1/4 · 출발 전'), findsOneWidget);
      expect(find.text('성수이로 113'), findsOneWidget);
    });

    testScreen('수락했지만 고객 카드 결제가 안 되면 배차되지 않는다', (tester) async {
      final backend = _homeBackend(available: true, calls: [openOrderJson()])
        ..fail(
          'POST',
          '/dispatch/orders/:id/accept',
          status: 409,
          code: 'PAYMENT_DECLINED',
          message: '고객의 카드 결제가 안 돼 배차되지 않았어요.',
        );
      await _show(tester, backend, const DriverGate());

      await tester.tap(find.text('수락'));
      await settle(tester);
      expect(find.text('배차되지 않았어요'), findsOneWidget);
      expect(find.text('성수동2가 → 역삼동'), findsOneWidget);
      await screenshot(tester, 'd11-payment-declined');

      await tester.tap(find.text('콜 목록으로'));
      await settle(tester);
      expect(find.text('대기 중인 콜'), findsOneWidget);
    });

    testScreen('결제 확인 중 — 수락하면 결제가 끝날 때까지 보인다', (tester) async {
      await _show(
        tester,
        FakeBackend(),
        PayingScreen(
          call: OpenOrder.fromJson(openOrderJson(fare: 44000)),
          accept: () => Completer<Order>().future,
        ),
      );
      await tester.pump(const Duration(milliseconds: 500));
      expect(find.text('결제 확인 중'), findsOneWidget);
      expect(find.text('44,000원'), findsOneWidget);
      await screenshot(tester, 'd10-paying');
    });

    testScreen('다른 기사가 먼저 수락했으면 알려주고 목록을 새로 받는다', (tester) async {
      final backend = _homeBackend(available: true, calls: [openOrderJson()])
        ..fail(
          'POST',
          '/dispatch/orders/:id/accept',
          status: 409,
          code: 'ORDER_NOT_OPEN',
          message: '이미 배차됐거나 취소된 주문이에요.',
        );
      await _show(tester, backend, const DriverGate());
      final before = backend.count('GET /dispatch/open-orders');

      await tester.tap(find.text('수락'));
      await settle(tester);

      expect(find.text('다른 기사님이 먼저 수락했어요.'), findsOneWidget);
      expect(backend.count('GET /dispatch/open-orders'), greaterThan(before));
    });
  });

  testScreen('새 콜 — 구간과 요금, 고객이 고른 운반 도움·계단', (tester) async {
    await _show(
      tester,
      FakeBackend(),
      NewCallScreen(
        call: OpenOrder.fromJson(
          openOrderJson(
            fare: 38000,
            loadingHelp: 'TOGETHER',
            helpFee: 10000,
            dropoffAccess: const {'floor': 3, 'elevator': false},
            stairFee: 6000,
          ),
        ),
        countdown: true,
      ),
    );

    expect(find.text('38,000원'), findsOneWidget);
    expect(find.text('기본 22,000원 + 추가 16,000원 포함'), findsOneWidget);
    expect(find.text('운반 도움 · 함께'), findsOneWidget);
    expect(find.text('계단 · 도착 3층'), findsOneWidget);
    expect(find.text('픽업 · 내 위치에서 2.1km'), findsOneWidget);
    expect(find.text('도착 · 총 8.2km'), findsOneWidget);
    expect(find.text('약 15kg'), findsOneWidget);
    await screenshot(tester, 'd09-new-call');
  });

  group('배송 진행', () {
    FakeBackend backend() => FakeBackend()
      ..on('GET', '/dispatch/orders/:id/navigation', (_, _) => navigationJson())
      ..on(
        'POST',
        '/dispatch/orders/:id/depart',
        (_, _) => _withAddOns('DEPARTED'),
      )
      ..on(
        'POST',
        '/dispatch/orders/:id/arrive',
        (_, _) => _withAddOns('ARRIVED'),
      )
      ..on(
        'POST',
        '/dispatch/orders/:id/pickup',
        (_, _) => orderJson(
          status: 'PICKED_UP',
          fare: 44000,
          extraItems: const {'overload': 1, 'bulky': 0, 'stairs': 0},
          extraFee: 10000,
        ),
      )
      ..on(
        'POST',
        '/dispatch/orders/:id/complete',
        (_, _) => orderJson(
          status: 'DELIVERED',
          fare: 44000,
          loadingHelp: 'TOGETHER',
          helpFee: 10000,
          dropoffAccess: const {'floor': 3, 'elevator': false},
          stairFee: 6000,
          extraItems: const {'overload': 1, 'bulky': 0, 'stairs': 0},
          extraFee: 10000,
          waitingMinutes: 14,
          waitingFee: 2000,
        ),
      )
      ..on(
        'GET',
        '/dispatch/earnings',
        (_, _) => earningsJson(amounts: [112000], completedCount: 4),
      );

    Widget screen(FakeBackend server, Map<String, dynamic> order) => Builder(
      builder: (context) => DeliveryScreen(
        order: Order.fromJson(order),
        controller: DriverController(server.api(UserRole.driver)),
      ),
    );

    /// 밀어서 확인하는 막대의 손잡이를 끝까지 민다.
    Future<void> slide(WidgetTester tester, {double distance = 400}) async {
      final knob =
          tester.getTopLeft(find.byType(MovoSlideToConfirm)) +
          const Offset(30, 32);
      await tester.dragFrom(knob, Offset(distance, 0));
      await settle(tester);
    }

    testScreen('출발 → 픽업지 도착 → 추가 요금 넣고 픽업', (tester) async {
      final server = backend();
      await _show(
        tester,
        server,
        screen(
          server,
          orderJson(
            status: 'ASSIGNED',
            fare: 44000,
            loadingHelp: 'TOGETHER',
            helpFee: 10000,
            dropoffAccess: const {'floor': 3, 'elevator': false},
            stairFee: 6000,
          ),
        ),
      );

      expect(find.text('1/4 · 출발 전'), findsOneWidget);
      expect(find.text('2.1km · 출발하면 고객에게 알려요'), findsOneWidget);
      expect(find.text('성수이로 113'), findsOneWidget);
      expect(find.text('김지은 · 010-1234-5678'), findsOneWidget);
      expect(
        find.text('박스 3개 · 약 15kg · 운반 도움 · 함께 · 계단 · 도착 3층'),
        findsOneWidget,
      );
      await screenshot(tester, 'd12-depart');

      // 조금만 밀면 넘어가지 않는다.
      await slide(tester, distance: 60);
      expect(
        server.calls,
        isNot(contains('POST /dispatch/orders/order-1/depart')),
      );

      await slide(tester);
      expect(server.calls, contains('POST /dispatch/orders/order-1/depart'));
      expect(find.text('2/4 · 픽업지로 가는 중'), findsOneWidget);
      expect(find.text('2.1km · 약 7분'), findsOneWidget);
      await screenshot(tester, 'd13-arrive');

      await slide(tester);
      expect(server.calls, contains('POST /dispatch/orders/order-1/arrive'));
      expect(find.text('3/4 · 픽업지 도착'), findsOneWidget);
      expect(find.text('대기 시간'), findsOneWidget);
      expect(find.text('추가 요금 넣기'), findsOneWidget);
      expect(find.text('노쇼 신고'), findsOneWidget);
      await screenshot(tester, 'd14-waiting');

      await tester.tap(find.text('추가 요금 넣기'));
      await settle(tester);
      expect(
        find.text('운반 도움 · 함께 10,000원 · 계단 · 도착 3층 6,000원'),
        findsOneWidget,
      );
      await tester.tap(find.bySemanticsLabel('늘리기').first);
      await settle(tester);
      expect(find.text('1단계'), findsOneWidget);
      expect(find.text('10,000원 넣기'), findsOneWidget);
      await screenshot(tester, 'd15-extras');
      await tester.tap(find.text('10,000원 넣기'));
      await settle(tester);
      expect(find.text('과적 1단계 · +10,000원'), findsOneWidget);

      await slide(tester);
      expect(server.bodyOf('POST /dispatch/orders/order-1/pickup'), {
        'overload': 1,
        'bulky': 0,
        'stairs': 0,
      });
      expect(find.text('4/4 · 배송하러 가는 중'), findsOneWidget);
    });

    testScreen('도착지 이동 — 받는 분 연락처, 배송 완료의 요금 내역', (tester) async {
      final server = backend()
        ..on(
          'GET',
          '/dispatch/orders/:id/navigation',
          (_, _) => navigationJson(toDropoff: true),
        );
      await _show(
        tester,
        server,
        screen(server, orderJson(status: 'PICKED_UP', fare: 44000)),
      );

      expect(find.text('6.1km · 약 25분'), findsOneWidget);
      expect(find.text('테헤란로 152'), findsOneWidget);
      expect(find.text('박서준 · 010-5555-0123'), findsOneWidget);
      await screenshot(tester, 'd18-dropoff');

      await slide(tester);
      expect(server.calls, contains('POST /dispatch/orders/order-1/complete'));
      expect(find.text('+56,000원'), findsOneWidget);
      expect(find.text('오늘 수입 112,000원 · 4건 완료'), findsOneWidget);
      expect(find.text('추가 · 과적 1단계'), findsOneWidget);
      expect(find.text('대기료 · 14분 대기'), findsOneWidget);
      await screenshot(tester, 'd19-delivered');
    });

    testScreen('도착하고 30분이 지나면 노쇼를 신고한다', (tester) async {
      final server = backend()
        ..on(
          'POST',
          '/dispatch/orders/:id/no-show',
          (_, _) => orderJson(
            status: 'NO_SHOW',
            fare: 44000,
            cancellationFee: 44000,
            earning: 0,
            requestedAgo: const Duration(minutes: 40),
          ),
        );
      await _show(
        tester,
        server,
        screen(
          server,
          orderJson(
            status: 'ARRIVED',
            fare: 44000,
            requestedAgo: const Duration(minutes: 40),
          ),
        ),
      );

      expect(find.text('지금 신고할 수 있어요'), findsOneWidget);
      await tester.tap(find.text('노쇼 신고'));
      await settle(tester);
      expect(find.text('노쇼로 처리할까요?'), findsOneWidget);
      expect(find.text('44,000원 · 100%'), findsOneWidget);
      await screenshot(tester, 'd16-no-show');

      await tester.tap(find.text('노쇼로 처리'));
      await settle(tester);
      expect(server.calls, contains('POST /dispatch/orders/order-1/no-show'));
      expect(find.text('노쇼로 처리했어요'), findsOneWidget);
    });

    testScreen('진행 중에 고객이 취소하면 바로 알린다', (tester) async {
      final server = backend();
      await _show(
        tester,
        server,
        screen(
          server,
          orderJson(
            status: 'CANCELLED',
            fare: 44000,
            cancellationFee: 6600,
            earning: 0,
          ),
        ),
      );

      expect(find.text('고객이 주문을\n취소했어요'), findsOneWidget);
      expect(find.text('이 배송은 더 진행하지 않아도 돼요.'), findsOneWidget);
      await screenshot(tester, 'd17-customer-cancelled');
    });
  });

  // 디자인은 375×812 한 가지다. 더 작거나 큰 기기에서도 넘치는 곳이 없는지 본다
  // (넘치면 테스트가 실패한다).
  for (final size in const [Size(360, 640), Size(430, 932)]) {
    final label = '${size.width.toInt()}×${size.height.toInt()}';

    Future<void> show(
      WidgetTester tester,
      FakeBackend backend,
      Widget screen,
    ) => pumpScreen(
      tester,
      api: backend.api(UserRole.driver),
      profile: MovoAppProfile.driver,
      user: driverUserJson(),
      screen: screen,
      size: size,
    );

    testScreen('$label — 홈과 탭 화면들', (tester) async {
      await show(
        tester,
        _homeBackend(calls: [openOrderJson()]),
        const DriverGate(),
      );
      // 꺼짐 → 켜짐(콜 목록) → 탭들
      await tester.tap(find.text('운행 시작'));
      await settle(tester);
      expect(find.text('대기 중인 콜'), findsOneWidget);
      for (final tab in ['배송 내역', '수입', '마이', '홈']) {
        await tester.tap(find.text(tab).last);
        await settle(tester);
      }
    });

    testScreen('$label — 콜 대기', (tester) async {
      await show(tester, _homeBackend(available: true), const DriverGate());
      expect(find.text('콜을 기다리고 있어요'), findsOneWidget);
    });

    testScreen('$label — 새 콜', (tester) async {
      await show(
        tester,
        FakeBackend(),
        NewCallScreen(
          call: OpenOrder.fromJson(openOrderJson()),
          countdown: true,
        ),
      );
      expect(find.text('수락하기'), findsOneWidget);
    });

    for (final status in [
      'ASSIGNED',
      'DEPARTED',
      'ARRIVED',
      'PICKED_UP',
      'DELIVERED',
    ]) {
      testScreen('$label — 배송 화면 ($status)', (tester) async {
        final server = FakeBackend()
          ..on(
            'GET',
            '/dispatch/orders/:id/navigation',
            (_, _) => navigationJson(toDropoff: status == 'PICKED_UP'),
          )
          ..on(
            'GET',
            '/dispatch/earnings',
            (_, _) => earningsJson(amounts: [112000], completedCount: 4),
          );
        await show(
          tester,
          server,
          Builder(
            builder: (context) => DeliveryScreen(
              order: Order.fromJson(orderJson(status: status)),
              controller: DriverController(server.api(UserRole.driver)),
            ),
          ),
        );
        expect(find.textContaining('28,000원'), findsWidgets);
      });
    }

    testScreen('$label — 가입 2단계와 심사', (tester) async {
      final backend = FakeBackend()
        ..on('GET', '/drivers/me', (_, _) => myDriverJson(status: 'PENDING'));
      await show(tester, backend, const DriverGate());
      expect(find.text('가입 심사 중'), findsOneWidget);
    });
  }

  group('탭', () {
    Future<void> tab(WidgetTester tester, String label) async {
      await _show(tester, _homeBackend(), const DriverGate());
      await tester.tap(find.text(label).last);
      await settle(tester);
    }

    testScreen('배송 내역 — 날짜별로 모아 본다', (tester) async {
      await tab(tester, '배송 내역');

      expect(find.textContaining('오늘 ·'), findsOneWidget);
      expect(find.text('망원동 → 상암동'), findsOneWidget);
      expect(find.text('다마스 · 8.2km'), findsNWidgets(3));
      expect(find.text('출발 전 고객 취소'), findsOneWidget);
      expect(find.text('고객 취소'), findsWidgets);
      expect(find.text('추가 요금'), findsOneWidget);
      expect(find.text('다마스 · 8.2km · 추가 12,000원'), findsOneWidget);
      expect(find.text('노쇼'), findsWidgets);
      await screenshot(tester, 'd20-history');
    });

    testScreen('배송 상세 — 완료한 배송: 받은 금액·수수료·정산 주·진행 시각·주문 정보', (tester) async {
      await tab(tester, '배송 내역');
      await tester.tap(find.text('다마스 · 8.2km · 추가 12,000원'));
      await settle(tester);
      await tester.pump(const Duration(seconds: 1));

      expect(find.text('배송 완료'), findsWidgets);
      expect(find.text('이 배송으로 받은 금액'), findsOneWidget);
      expect(find.text('56,000원'), findsOneWidget);
      expect(find.text('기본 요금 · 다마스'), findsOneWidget);
      expect(find.text('+10,000원'), findsOneWidget);
      expect(find.text('대기료 · 14분 대기'), findsOneWidget);
      expect(find.text('수수료 10%'), findsOneWidget);
      expect(find.text('−5,600원'), findsOneWidget);
      expect(find.text('50,400원'), findsOneWidget);
      expect(
        find.textContaining('정산에 들어가요 · 10월 20일 (화) 지급 예정'),
        findsOneWidget,
      );
      await screenshot(tester, 'd20b-trip-detail');

      await tester.scrollUntilVisible(find.text('주문번호'), 200);
      expect(find.text('대기 14분 · 대기료 2,000원'), findsOneWidget);
      expect(find.text('추가 요금 과적 1단계'), findsOneWidget);
      // 고객 이름은 가린다 (김지은 → 김*은).
      expect(find.text('김*은'), findsOneWidget);
      expect(find.text('박스 3개 · 약 15kg'), findsOneWidget);
      await screenshot(tester, 'd20b-trip-detail-info');
    });

    testScreen('배송 상세 — 고객 취소와 노쇼는 보상만, 수수료 없음', (tester) async {
      await tab(tester, '배송 내역');
      await tester.tap(find.text('출발 전 고객 취소'));
      await settle(tester);
      await tester.pump(const Duration(seconds: 1));
      expect(find.text('고객 취소'), findsWidgets);
      expect(find.text('취소 보상'), findsWidgets);
      // 수수료와 운반 도움이 모두 '없음'이다.
      expect(find.text('없음'), findsNWidgets(2));
      await screenshot(tester, 'd20c-trip-cancelled');

      await tester.tap(find.bySemanticsLabel('뒤로 가기'));
      await settle(tester);
      await tester.tap(find.textContaining('노쇼 ·'));
      await settle(tester);
      await tester.pump(const Duration(seconds: 1));
      expect(find.text('노쇼 · 받은 금액'), findsOneWidget);
      expect(find.text('고객 요금 100%'), findsOneWidget);
      await tester.scrollUntilVisible(find.text('노쇼 처리'), 200);
      expect(find.textContaining('도착 후'), findsOneWidget);
      await screenshot(tester, 'd20d-trip-noshow');
    });

    testScreen('배송 내역 — 수수료를 빼기 전 매출을 보여 준다 (수수료는 정산에서 뺀다)', (tester) async {
      await _show(tester, _homeBackend(commission: true), const DriverGate());
      await tester.tap(find.text('배송 내역').last);
      await settle(tester);

      expect(find.text('+12,000원'), findsOneWidget);
      expect(find.text('+10,800원'), findsNothing);
    });

    testScreen('수입 — 날짜별 막대와 다음 정산', (tester) async {
      await tab(tester, '수입');

      expect(find.text('최근 7일 · 23건 완료'), findsOneWidget);
      expect(find.text('614,000원'), findsOneWidget);
      expect(find.text('8.4만'), findsOneWidget);
      expect(find.text('642,000원 입금 예정'), findsOneWidget);
      await screenshot(tester, 'd21-earnings');

      await tester.tap(find.text('642,000원 입금 예정'));
      await settle(tester);
      expect(find.text('75,600원'), findsOneWidget);
      expect(find.text('10월 2주'), findsOneWidget);
      // 지난주: 운행 매출 612,000원 − 수수료 61,200원
      expect(find.text('550,800원'), findsWidgets);
      expect(find.text('지급 완료'), findsWidgets);
      await screenshot(tester, 'd22-settlements');
    });

    testScreen('정산 보류 — 계좌 본인인증이 안 되면 안내가 뜬다', (tester) async {
      await _show(
        tester,
        FakeBackend()..on(
          'GET',
          '/dispatch/settlements',
          (_, _) => driverSettlementsJson(verified: false),
        ),
        const SettlementsScreen(),
      );

      expect(find.text('정산 계좌 인증이 필요해요'), findsOneWidget);
      expect(find.text('보류'), findsOneWidget);
      await screenshot(tester, 'd23-settlement-hold');
    });

    testScreen('정산 계좌 본인인증 실패', (tester) async {
      await _show(
        tester,
        FakeBackend()..on(
          'GET',
          '/drivers/me/settlement-account',
          (_, _) => settlementAccountJson(status: 'FAILED', holder: '김도연'),
        ),
        const AccountVerificationScreen(),
      );

      expect(find.text('본인인증 실패'), findsOneWidget);
      expect(find.text('예금주 김도연'), findsOneWidget);
      expect(find.text('본인 명의 계좌로 다시 인증'), findsOneWidget);
      await screenshot(tester, 'd24-account');
    });

    testScreen('수입 — 오늘이 가장 많이 번 날이어도 막대가 넘치지 않는다', (tester) async {
      await _show(
        tester,
        _homeBackend(earnings: [0, 0, 0, 0, 0, 0, 22400]),
        const DriverGate(),
      );
      await tester.tap(find.text('수입').last);
      await settle(tester);

      expect(find.text('22,400원'), findsOneWidget);
      expect(find.text('2.2만'), findsOneWidget);
    });

    testScreen('내 정보', (tester) async {
      await tab(tester, '마이');

      expect(find.text('김도윤'), findsOneWidget);
      expect(find.text('승인 완료'), findsOneWidget);
      expect(find.text('3개 확인됨'), findsOneWidget);
      expect(find.text('국민은행 ••1024'), findsOneWidget);
      expect(find.text('인증 완료'), findsOneWidget);
      expect(find.text('정산 내역'), findsOneWidget);
      await screenshot(tester, 'd25-my');
    });
  });
}

import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:movo_api/movo_api.dart';
import 'package:movo_driver/gate.dart';
import 'package:movo_driver/home/new_call_screen.dart';
import 'package:movo_driver/services.dart';
import 'package:movo_testkit/movo_testkit.dart';
import 'package:movo_ui/movo_ui.dart';

// 라이더 앱 화면을 가짜 서버의 값으로 띄워 보고, 디자인과 견줄 화면 사진을 build/screenshots에 남긴다.

/// 사진을 고르는 대신 정해 둔 파일을 돌려준다.
class _FakePicker implements DocumentPicker {
  @override
  Future<UploadFile?> pick(BuildContext context) async => UploadFile(
    bytes: Uint8List.fromList([0xff, 0xd8, 0xff, 0xe0]),
    filename: 'document.jpg',
  );
}

/// 위치를 알 수 없는 기기.
class _NoLocation implements LocationSource {
  const _NoLocation();

  @override
  Future<Coordinates?> current() async => null;

  @override
  Stream<Coordinates> watch() => const Stream.empty();
}

Future<void> _show(WidgetTester tester, FakeBackend backend, Widget screen) =>
    pumpScreen(
      tester,
      api: backend.api(UserRole.driver),
      profile: MovoAppProfile.driver,
      user: driverUserJson(),
      screen: screen,
    );

/// 배달 하나의 모양 (상태만 바뀐다).
class _Delivery {
  _Delivery(
    this.id, {
    this.status = 'ASSIGNED',
    this.doorPayment = 'CASH',
    this.foodAmount = 23000,
    this.storeId,
    this.dropoff = customerHomeJson,
  });

  final String id;
  String status;
  final String doorPayment;
  final int foodAmount;
  final String? storeId;
  final Json dropoff;
  String? collectedMethod;
  int? collectedAmount;
  String? cancelReason;

  Json json() => riderDeliveryJson(
    id: id,
    status: status,
    doorPayment: doorPayment,
    foodAmount: foodAmount,
    storeId: storeId,
    dropoff: dropoff,
    collectedMethod: collectedMethod,
    collectedAmount: collectedAmount,
    cancelReason: cancelReason,
  );
}

/// 승인된 라이더의 서버. 수락·도착·픽업·완료하면 배달 상태가 바뀐다.
class _RiderServer {
  _RiderServer({
    this.online = true,
    List<Json> calls = const [],
    List<_Delivery> deliveries = const [],
  }) : calls = [...calls],
       deliveries = [...deliveries] {
    backend
      ..on('GET', '/drivers/me', (_, _) => _me())
      ..on('PATCH', '/drivers/me/availability', (request, _) {
        online = (jsonDecode(request.body) as Map)['available'] as bool;
        return _me();
      })
      ..on(
        'GET',
        '/dispatch/earnings',
        (_, _) => earningsJson(amounts: const [10350], completedCount: 3),
      )
      ..on(
        'GET',
        '/dispatch/my-orders',
        (_, _) => pageJson([for (final d in this.deliveries) d.json()]),
      )
      ..on('GET', '/dispatch/open-orders', (_, _) => pageJson(this.calls))
      ..on('POST', '/dispatch/orders/:id/accept', (_, params) {
        final id = params['id']!;
        this.calls.removeWhere((call) => call['id'] == id);
        final delivery = _Delivery(id);
        this.deliveries.insert(0, delivery);
        return delivery.json();
      })
      ..on('POST', '/dispatch/orders/:id/arrive', (_, p) => _move(p, 'ARRIVED'))
      ..on(
        'POST',
        '/dispatch/orders/:id/pickup',
        (_, p) => _move(p, 'PICKED_UP'),
      )
      ..on('POST', '/dispatch/orders/:id/complete', (request, params) {
        final body = request.body.isEmpty
            ? const <String, dynamic>{}
            : jsonDecode(request.body) as Map<String, dynamic>;
        final delivery = _find(params);
        delivery.collectedMethod = body['collectedMethod'] as String?;
        delivery.collectedAmount = body['collectedAmount'] as int?;
        return _move(params, 'DELIVERED');
      })
      ..on('GET', '/drivers/me/documents', (_, _) => documentsJson())
      ..on(
        'GET',
        '/drivers/me/settlement-account',
        (_, _) => settlementAccountJson(),
      )
      ..on('GET', '/dispatch/settlements', (_, _) => driverSettlementsJson())
      ..on('GET', '/notifications/settings', (_, _) => {'pushEnabled': true});
  }

  final backend = FakeBackend();
  final List<Json> calls;
  final List<_Delivery> deliveries;
  bool online;

  Json _me() => myDriverJson(
    available: online,
    vehicleType: 'MOTORCYCLE',
    onlineFor: online ? const Duration(hours: 2) : null,
  );

  _Delivery _find(Map<String, String> params) =>
      deliveries.firstWhere((d) => d.id == params['id']);

  Json _move(Map<String, String> params, String status) {
    final delivery = _find(params)..status = status;
    return delivery.json();
  }
}

void main() {
  setUp(() {
    documentPicker = _FakePicker();
    locationSource = const _NoLocation();
  });

  group('가입과 심사', () {
    testScreen('서류 — 번호와 서류 세 가지를 올리고 심사를 신청한다', (tester) async {
      var documents = documentsJson(const [
        'NOT_SUBMITTED',
        'NOT_SUBMITTED',
        'NOT_SUBMITTED',
      ]);
      final backend = FakeBackend()
        ..fail('GET', '/drivers/me', status: 404, code: 'DRIVER_NOT_REGISTERED')
        ..on('GET', '/drivers/me/documents', (_, _) => documents)
        ..on('PUT', '/drivers/me/documents/:type', (_, params) {
          documents = [
            for (final d in documents)
              d['type'] == params['type']
                  ? {
                      ...d,
                      'status': 'SUBMITTED',
                      'uploadedAt': isoAt(Duration.zero),
                    }
                  : d,
          ];
          return documents;
        })
        ..on(
          'POST',
          '/drivers',
          (_, _) => myDriverJson(status: 'PENDING', vehicleType: 'MOTORCYCLE'),
        );
      await _show(tester, backend, const DriverGate());

      expect(find.text('서류 3가지를\n올려 주세요'), findsOneWidget);
      expect(find.text('유상운송(배달용) 이륜차 보험 증권'), findsOneWidget);
      await screenshot(tester, 'rider-docs');

      await tester.tap(find.text('심사 신청하기'));
      await settle(tester);
      expect(backend.count('POST /drivers'), 0);
      expect(find.text('차량번호를 적어 주세요'), findsOneWidget);
      // 안내가 사라진 뒤에 이어 간다 (버튼을 가린다).
      await tester.pump(const Duration(seconds: 5));
      await settle(tester);

      await tester.enterText(find.byType(EditableText).first, '서울 강남 가 1234');
      for (var i = 0; i < 3; i++) {
        await tester.tap(find.text('올리기').first);
        await settle(tester);
      }
      expect(find.text('올림'), findsNWidgets(3));
      await tester.tap(find.text('심사 신청하기'));
      await settle(tester);

      expect(backend.bodyOf('POST /drivers'), {
        'vehicleNumber': '서울 강남 가 1234',
      });
      expect(find.text('심사하고 있어요'), findsOneWidget);
      await screenshot(tester, 'rider-pending');
    });

    testScreen('반려 — 반려된 서류와 사유를 보여 주고 다시 올리게 한다', (tester) async {
      final backend = FakeBackend()
        ..on(
          'GET',
          '/drivers/me',
          (_, _) => myDriverJson(status: 'REJECTED', vehicleType: 'MOTORCYCLE'),
        )
        ..on(
          'GET',
          '/drivers/me/documents',
          (_, _) => documentsJson(const [
            'APPROVED',
            'REJECTED',
            'APPROVED',
          ], '차량번호가 잘 보이지 않아요. 번호판 쪽이 잘 보이게 다시 찍어 주세요.'),
        );
      await _show(tester, backend, const DriverGate());

      expect(find.text('서류를 다시\n올려 주세요'), findsOneWidget);
      expect(find.text('이륜차 사용신고필증'), findsOneWidget);
      expect(
        find.text('차량번호가 잘 보이지 않아요. 번호판 쪽이 잘 보이게 다시 찍어 주세요.'),
        findsOneWidget,
      );
      await screenshot(tester, 'rider-rejected');

      await tester.tap(find.text('서류 다시 올리기'));
      await settle(tester);
      expect(find.text('오토바이와 서류'), findsOneWidget);
      expect(find.text('올리기'), findsOneWidget);
    });
  });

  group('홈', () {
    testScreen('운행이 꺼져 있으면 켜게 한다', (tester) async {
      final server = _RiderServer(online: false);
      await _show(tester, server.backend, const DriverGate());

      expect(find.text('운행이 꺼져 있어요'), findsOneWidget);
      expect(find.text('10,350원'), findsOneWidget);
      await screenshot(tester, 'rider-home-off');

      await tester.tap(find.text('운행 시작'));
      await settle(tester);
      expect(server.backend.bodyOf('PATCH /drivers/me/availability'), {
        'available': true,
      });
      expect(find.text('주변에 들어온 콜이 없어요'), findsOneWidget);
    });

    testScreen('콜 목록 — 라이더 몫과 받을 돈, 수락하면 가게로 이동', (tester) async {
      final server = _RiderServer(
        calls: [
          callJson(
            id: 'burger',
            storeName: '버거하우스 강남점',
            dropoffArea: '강남구 대치동',
            fee: 4000,
            foodAmount: 16000,
          ),
          callJson(
            id: 'tteok',
            storeName: '역삼 떡볶이',
            doorPayment: 'PREPAID',
            foodAmount: 0,
            requestedAgo: const Duration(minutes: 2),
          ),
        ],
      );
      await _show(tester, server.backend, const DriverGate());

      expect(find.text('2건'), findsOneWidget);
      expect(find.text('버거하우스 강남점'), findsOneWidget);
      expect(find.text('3,600원'), findsOneWidget);
      expect(find.text('대행료 4,000원 · 수수료 10%를 뺀 금액'), findsOneWidget);
      expect(find.text('만나서 현금 16,000원'), findsOneWidget);
      expect(find.text('선결제'), findsOneWidget);
      await screenshot(tester, 'rider-home');

      await tester.tap(find.text('수락').first);
      await settle(tester);
      expect(server.backend.count('POST /dispatch/orders/burger/accept'), 1);
      expect(find.text('가게로 이동'), findsWidgets);
      expect(find.text('픽업할 가게'), findsOneWidget);
    });

    testScreen('다른 라이더가 먼저 수락했으면 알려 준다', (tester) async {
      final server = _RiderServer(calls: [callJson()]);
      server.backend.fail(
        'POST',
        '/dispatch/orders/:id/accept',
        status: 409,
        code: 'ORDER_NOT_OPEN',
      );
      await _show(tester, server.backend, const DriverGate());

      await tester.tap(find.text('수락'));
      await settle(tester);
      expect(find.text('이미 다른 라이더가 수락한 콜이에요'), findsOneWidget);
    });

    testScreen('3건을 맡고 있으면 더 수락할 수 없다고 알린다', (tester) async {
      final server = _RiderServer(
        calls: [callJson()],
        deliveries: [for (var i = 0; i < 3; i++) _Delivery('busy-$i')],
      );
      await _show(tester, server.backend, const DriverGate());
      // 진행 중 배달이 있어 진행 중 탭이 먼저 열린다.
      await tester.tap(find.text('홈').last);
      await settle(tester);

      expect(find.text('3/3'), findsOneWidget);
      expect(
        find.text('동시에 3건까지 맡을 수 있어요. 진행 중인 배달을 먼저 끝내 주세요.'),
        findsOneWidget,
      );
    });
  });

  testScreen('새 콜 — 라이더 몫과 받을 음식값을 크게 보여 준다', (tester) async {
    await _show(
      tester,
      FakeBackend(),
      NewCallScreen(call: OpenOrder.fromJson(callJson())),
    );

    expect(find.text('모보치킨 역삼점'), findsOneWidget);
    expect(find.text('3,150원'), findsOneWidget);
    expect(find.text('대행료 3,500원에서 수수료 10%를 뺐어요'), findsOneWidget);
    expect(find.text('만나서 현금 · 23,000원 받아요'), findsOneWidget);
    expect(find.text('수락하기'), findsOneWidget);
    await screenshot(tester, 'rider-new-call');
  });

  testScreen('진행 중 — 같은 가게 배달은 묶어서 보여 준다', (tester) async {
    final server = _RiderServer(
      deliveries: [
        _Delivery('a1', storeId: 'store-1'),
        _Delivery(
          'a2',
          storeId: 'store-1',
          dropoff: {
            ...customerHomeJson,
            'dong': '도곡동',
            'detailAddress': '타워팰리스 B동 1802호',
          },
        ),
        _Delivery('b1', status: 'PICKED_UP', storeId: 'store-2'),
      ],
    );
    await _show(tester, server.backend, const DriverGate());

    expect(find.text('진행 중 배달'), findsOneWidget);
    expect(find.text('같은 가게 2건 · 한 번에 픽업해요'), findsOneWidget);
    expect(find.text('도곡동 · 타워팰리스 B동 1802호'), findsOneWidget);
    expect(find.text('손님에게 이동'), findsOneWidget);
    await screenshot(tester, 'rider-active');
  });

  testScreen('배달 진행 — 가게 도착, 두 건 함께 픽업, 만나서 현금 받고 완료', (tester) async {
    final server = _RiderServer(
      deliveries: [
        _Delivery('3f9a', storeId: 'store-1'),
        _Delivery(
          '2c71',
          storeId: 'store-1',
          doorPayment: 'PREPAID',
          foodAmount: 0,
          dropoff: {
            ...customerHomeJson,
            'dong': '도곡동',
            'detailAddress': '타워팰리스 B동 1802호',
          },
        ),
      ],
    );
    await _show(tester, server.backend, const DriverGate());
    await tester.tap(find.text('역삼동 · 101동 1203호'));
    await settle(tester);

    expect(find.text('같은 가게 배달 1건이 더 있어요 · 한 번에 픽업하세요'), findsOneWidget);
    await screenshot(tester, 'rider-flow-store');
    // 진행 막대에도 '가게 도착'이 있다 — 아래 버튼을 누른다.
    await tester.tap(find.text('가게 도착').last);
    await settle(tester);
    expect(server.backend.count('POST /dispatch/orders/3f9a/arrive'), 1);
    expect(server.backend.count('POST /dispatch/orders/2c71/arrive'), 1);

    expect(find.text('3F9A'), findsWidgets);
    expect(find.text('함께 픽업할 배달'), findsOneWidget);
    expect(find.text('픽업 완료 · 2건'), findsOneWidget);
    await screenshot(tester, 'rider-flow-at-store');
    await tester.tap(find.text('픽업 완료 · 2건'));
    await settle(tester);
    expect(server.backend.count('POST /dispatch/orders/3f9a/pickup'), 1);
    expect(server.backend.count('POST /dispatch/orders/2c71/pickup'), 1);

    expect(find.text('101동 1203호'), findsOneWidget);
    expect(find.text('만나서 현금 · 23,000원 받아요'), findsOneWidget);
    await screenshot(tester, 'rider-flow-customer');
    await tester.tap(find.text('전달 완료'));
    await settle(tester);

    expect(find.text('만나서 결제'), findsOneWidget);
    await tester.enterText(find.byType(EditableText).first, '20000');
    await tester.pump();
    expect(find.textContaining('3,000원 달라요'), findsOneWidget);
    await tester.enterText(find.byType(EditableText).first, '23000');
    await settle(tester);
    await screenshot(tester, 'rider-collect');
    await tester.tap(find.text('완료'));
    await settle(tester);

    expect(server.backend.bodyOf('POST /dispatch/orders/3f9a/complete'), {
      'collectedMethod': 'CASH',
      'collectedAmount': 23000,
    });
    expect(find.text('+3,150원'), findsOneWidget);
    expect(find.text('현금 23,000원'), findsOneWidget);
    expect(find.text('다음 배달 · 1건 남았어요'), findsOneWidget);
    await screenshot(tester, 'rider-delivered');

    // 남은 선결제 배달은 받을 돈 없이 바로 완료된다.
    await tester.tap(find.text('다음 배달 · 1건 남았어요'));
    await settle(tester);
    expect(find.text('선결제 · 받을 돈이 없어요'), findsOneWidget);
    await tester.tap(find.text('전달 완료'));
    await settle(tester);
    expect(server.backend.count('POST /dispatch/orders/2c71/complete'), 1);
    expect(find.text('선결제 · 받은 돈 없음'), findsOneWidget);
    expect(find.text('콜 목록으로'), findsOneWidget);
  });

  testScreen('가게가 진행 중이던 배달을 취소하면 알린다', (tester) async {
    final delivery = _Delivery('3f9a');
    final server = _RiderServer(deliveries: [delivery]);
    await _show(tester, server.backend, const DriverGate());
    expect(find.text('가게로 이동'), findsOneWidget);

    delivery
      ..status = 'CANCELLED'
      ..cancelReason = '손님이 주문을 취소했어요';
    await tester.pump(const Duration(seconds: 9));
    await settle(tester);

    expect(find.text('가게가 배달을\n취소했어요'), findsOneWidget);
    expect(find.text('손님이 주문을 취소했어요'), findsOneWidget);
    await screenshot(tester, 'rider-store-cancelled');
  });

  testScreen('내역과 배달 상세', (tester) async {
    final server = _RiderServer(
      online: false,
      deliveries: [
        _Delivery('done-1', status: 'DELIVERED')
          ..collectedMethod = 'CASH'
          ..collectedAmount = 23000,
        _Delivery('done-2', status: 'DELIVERED', doorPayment: 'PREPAID'),
      ],
    );
    await _show(tester, server.backend, const DriverGate());
    await tester.tap(find.text('내역').last);
    await settle(tester);

    expect(find.text('배달 내역'), findsOneWidget);
    expect(find.text('현금 23,000원'), findsOneWidget);
    expect(find.text('선결제'), findsOneWidget);
    await screenshot(tester, 'rider-history');

    await tester.tap(find.text('현금 23,000원'));
    await settle(tester);
    expect(find.text('배달 상세'), findsOneWidget);
    expect(find.text('현금으로 받았어요'), findsOneWidget);
    expect(find.text('진행 시각'), findsOneWidget);
    await screenshot(tester, 'rider-trip');
  });

  testScreen('수입과 마이', (tester) async {
    final server = _RiderServer(
      online: false,
      deliveries: [
        _Delivery('done-1', status: 'DELIVERED')
          ..collectedMethod = 'CASH'
          ..collectedAmount = 27000,
      ],
    );
    await _show(tester, server.backend, const DriverGate());
    await tester.tap(find.text('수입').last);
    await settle(tester);

    expect(find.text('오늘 수입'), findsOneWidget);
    expect(find.text('만나서 받은 현금'), findsOneWidget);
    expect(find.text('27,000원'), findsOneWidget);
    expect(find.text('이번 주 정산'), findsOneWidget);
    await screenshot(tester, 'rider-earnings');

    await tester.tap(find.text('마이').last);
    await settle(tester);
    expect(find.text('승인됨'), findsOneWidget);
    expect(find.textContaining('· 오토바이'), findsOneWidget);
    await screenshot(tester, 'rider-my');
  });
}

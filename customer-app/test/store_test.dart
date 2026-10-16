import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:movo_api/movo_api.dart';
import 'package:movo_customer/delivery/delivery_detail_screen.dart';
import 'package:movo_customer/shell.dart';
import 'package:movo_customer/store/store_gate.dart';
import 'package:movo_testkit/movo_testkit.dart';
import 'package:movo_ui/movo_ui.dart';

// 가게 앱 화면을 가짜 서버의 값으로 띄워 보고, 디자인과 견줄 화면 사진을 build/screenshots에 남긴다.

Future<void> _show(WidgetTester tester, FakeBackend backend, Widget screen) =>
    pumpScreen(
      tester,
      api: backend.api(UserRole.customer),
      profile: MovoAppProfile.customer,
      user: userJson(),
      screen: screen,
    );

/// 스크롤 본문 안의 것을 화면 가운데쯤으로 옮긴 뒤 누른다.
Future<void> _tapInPage(WidgetTester tester, Finder finder) async {
  await Scrollable.ensureVisible(tester.element(finder.first), alignment: 0.4);
  await settle(tester);
  await tester.tap(finder.first);
  await settle(tester);
}

/// 승인된 가게와 배달 목록이 있는 서버.
FakeBackend _storeBackend({
  List<Json> deliveries = const [],
  int balance = 84500,
}) => FakeBackend()
  ..on('GET', '/stores/me', (_, _) => storeJson(walletBalance: balance))
  ..on('GET', '/orders', (_, _) => pageJson(deliveries))
  ..on('GET', '/orders/recent-destinations', (_, _) => <Object>[])
  ..on('GET', '/notifications/settings', (_, _) => {'pushEnabled': true})
  ..on('GET', '/stores/me/wallet', (_, _) => walletJson(const []))
  ..on('POST', '/deliveries/quotes', (_, _) => deliveryQuoteJson());

void main() {
  group('가게 상태에 따른 첫 화면', () {
    testScreen('가게가 없으면 등록부터 — 등록 화면으로 간다', (tester) async {
      final backend = FakeBackend()
        ..fail(
          'GET',
          '/stores/me',
          status: 404,
          code: 'STORE_NOT_REGISTERED',
          message: '가게를 먼저 등록해 주세요.',
        );
      await _show(tester, backend, const StoreGate());

      expect(find.text('가게를 먼저\n등록해 주세요'), findsOneWidget);
      await screenshot(tester, 'store-welcome');

      await tester.tap(find.text('가게 등록하기'));
      await settle(tester);
      expect(find.text('가게 정보를\n알려 주세요'), findsOneWidget);
      expect(find.text('심사 신청하기'), findsOneWidget);
      await screenshot(tester, 'store-register');
    });

    testScreen('가게 등록 — 주소를 검색해서 고르고 심사를 신청한다', (tester) async {
      final backend = FakeBackend()
        ..fail('GET', '/stores/me', status: 404, code: 'STORE_NOT_REGISTERED')
        ..on('POST', '/stores', (_, _) => storeJson(status: 'PENDING'));
      await _show(tester, backend, const StoreGate());
      await tester.tap(find.text('가게 등록하기'));
      await settle(tester);

      // 틀린 사업자등록번호는 칸 아래에 알려 준다.
      final fields = find.byType(EditableText);
      await tester.enterText(fields.at(0), '모보치킨 역삼점');
      await tester.enterText(fields.at(1), '2208162518');
      await tester.enterText(fields.at(2), '025551234');
      await _tapInPage(tester, find.text('심사 신청하기'));
      expect(find.text('사업자등록번호를 확인해 주세요.'), findsOneWidget);
      expect(find.text('가게 주소를 검색해서 골라 주세요.'), findsOneWidget);

      await tester.enterText(fields.at(1), '2208162517');
      await _tapInPage(tester, find.text('가게 주소를 검색해 주세요'));
      await tester.enterText(find.byType(EditableText).last, '테헤란로 152');
      await tester.pump(const Duration(milliseconds: 300));
      await settle(tester);
      await screenshot(tester, 'store-address-search');
      await tester.tap(find.text('서울 강남구 테헤란로 152').first);
      await settle(tester);

      await tester.enterText(find.byType(EditableText).at(3), '1층');
      await _tapInPage(tester, find.text('심사 신청하기'));

      expect(backend.bodyOf('POST /stores'), {
        'name': '모보치킨 역삼점',
        'businessNumber': '2208162517',
        'phone': '025551234',
        'address': {
          'address': '서울 강남구 테헤란로 152',
          'detailAddress': '1층',
          'sigungu': '강남구',
          'dong': '역삼동',
          'latitude': isA<double>(),
          'longitude': isA<double>(),
        },
      });
    });

    testScreen('심사 중 — 신청한 정보와 로그아웃만 있다', (tester) async {
      final backend = FakeBackend()
        ..on('GET', '/stores/me', (_, _) => storeJson(status: 'PENDING'));
      await _show(tester, backend, const StoreGate());

      expect(find.text('심사하고 있어요'), findsOneWidget);
      expect(find.text('모보치킨 역삼점'), findsOneWidget);
      expect(find.text('220-81-62517'), findsOneWidget);
      expect(find.text('로그아웃'), findsOneWidget);
      await screenshot(tester, 'store-pending');
    });

    testScreen('반려 — 사유를 보여 주고 고쳐서 다시 신청한다', (tester) async {
      final backend = FakeBackend()
        ..on(
          'GET',
          '/stores/me',
          (_, _) => storeJson(
            status: 'REJECTED',
            rejectionReason: '사업자등록증의 상호와 입력한 상호가 달라요.',
          ),
        );
      await _show(tester, backend, const StoreGate());

      expect(find.text('반려 사유'), findsOneWidget);
      expect(find.text('사업자등록증의 상호와 입력한 상호가 달라요.'), findsOneWidget);
      await screenshot(tester, 'store-rejected');

      await tester.tap(find.text('정보 고쳐서 다시 신청'));
      await settle(tester);
      expect(find.text('가게 정보 수정'), findsOneWidget);
    });

    testScreen('승인되면 배달 홈으로 들어간다', (tester) async {
      await _show(tester, _storeBackend(), const StoreGate());

      expect(find.text('충전금'), findsWidgets);
      expect(find.text('84,500원'), findsOneWidget);
      expect(find.text('아직 요청한 배달이 없어요'), findsOneWidget);
      await screenshot(tester, 'store-home-empty');
    });
  });

  testScreen('홈 — 충전금, 오늘 건수, 진행 중 배달', (tester) async {
    final backend = _storeBackend(
      deliveries: [
        deliveryJson(
          id: '2d90',
          status: 'REQUESTED',
          driverName: null,
          requestedAgo: const Duration(minutes: 3),
        ),
        deliveryJson(
          id: '2c71',
          status: 'ASSIGNED',
          doorPayment: 'CASH',
          foodAmount: 23000,
        ),
        deliveryJson(id: '1e07', status: 'DELIVERED'),
      ],
    );
    await _show(tester, backend, const CustomerShell());

    expect(find.text('모보치킨 역삼점'), findsOneWidget);
    expect(find.text('3건'), findsOneWidget);
    expect(find.text('라이더 찾는 중'), findsOneWidget);
    expect(find.text('요청 3분째'), findsOneWidget);
    expect(find.text('주변 라이더에게 알렸어요'), findsOneWidget);
    expect(find.text('가게로 오는 중'), findsOneWidget);
    expect(find.text('김라이더 라이더'), findsOneWidget);
    expect(find.text('만나서 현금 23,000원'), findsOneWidget);
    expect(find.text('끝자리 2C71'), findsOneWidget);
    expect(find.text('역삼동 · 역삼로 180'), findsNWidgets(2));
    await screenshot(tester, 'store-home');
  });

  testScreen('홈 — 충전금이 대행료보다 적으면 요청할 수 없다고 알린다', (tester) async {
    await _show(tester, _storeBackend(balance: 2000), const CustomerShell());

    expect(find.text('충전금이 부족해서 배달을 요청할 수 없어요'), findsOneWidget);
  });

  testScreen('배달 요청 — 손님 주소를 고르면 대행료를 보여 주고, 요청하면 상세로 간다', (tester) async {
    final created = deliveryJson(status: 'REQUESTED', driverName: null);
    final backend = _storeBackend()
      ..on('POST', '/deliveries', (_, _) => created)
      ..on('GET', '/orders/:id', (_, _) => deliveryDetailJson(created));
    await _show(tester, backend, const CustomerShell());

    await tester.tap(find.text('배달 요청'));
    await settle(tester);
    expect(find.text('가게에서 10km 안까지 배달할 수 있어요'), findsOneWidget);
    await screenshot(tester, 'store-request-empty');

    // 빈 채로 요청하면 칸마다 알려 준다.
    await _tapInPage(tester, find.text('배달 요청하기'));
    expect(find.text('손님 주소를 검색해 주세요.'), findsOneWidget);
    expect(find.text('손님 연락처를 확인해 주세요.'), findsOneWidget);

    await _tapInPage(tester, find.text('손님 주소를 검색해 주세요'));
    await tester.enterText(find.byType(EditableText).last, '테헤란로 151');
    await tester.pump(const Duration(milliseconds: 300));
    await settle(tester);
    expect(find.textContaining('가게에서 '), findsWidgets);
    await tester.tap(find.text('서울 강남구 테헤란로 151').first);
    await settle(tester);

    expect(find.text('배달대행료 3,500원'), findsOneWidget);
    expect(find.text('81,000원'), findsOneWidget);
    expect(find.text('배달 요청하기 · 3,500원'), findsOneWidget);

    final fields = find.byType(EditableText);
    await tester.enterText(fields.at(0), '101동 1203호');
    await tester.enterText(fields.at(1), '050412345678');
    await tester.enterText(fields.at(2), '23000');
    await tester.pump();
    await _tapInPage(tester, find.text('만나서 현금'));
    expect(find.text('라이더가 손님에게 23,000원을 현금으로 받아요.'), findsOneWidget);
    await _tapInPage(tester, find.text('15분'));
    expect(find.textContaining('에 조리가 끝나요 · 라이더가 맞춰서 와요'), findsOneWidget);
    await screenshot(tester, 'store-request');

    await _tapInPage(tester, find.text('배달 요청하기 · 3,500원'));
    final body = backend.bodyOf('POST /deliveries');
    expect(body['dropoff'], containsPair('phone', '050412345678'));
    expect(body['foodAmount'], 23000);
    expect(body['doorPayment'], 'CASH');
    expect(body['readyInMinutes'], 15);
    expect(body['dropoff'], containsPair('detailAddress', '101동 1203호'));

    // 만든 배달의 상세(라이더 찾는 중)로 간다.
    expect(find.text('라이더를 찾고 있어요'), findsOneWidget);
  });

  testScreen('배달 요청 — 충전금이 모자라면 충전하기로 바꿔 보여 준다', (tester) async {
    final backend = _storeBackend(balance: 2000)
      ..on(
        'POST',
        '/deliveries/quotes',
        (_, _) => deliveryQuoteJson(walletBalance: 2000),
      );
    await _show(tester, backend, const CustomerShell());
    await tester.tap(find.text('배달 요청'));
    await settle(tester);
    await _tapInPage(tester, find.text('손님 주소를 검색해 주세요'));
    await tester.enterText(find.byType(EditableText).last, '테헤란로 151');
    await tester.pump(const Duration(milliseconds: 300));
    await settle(tester);
    await tester.tap(find.text('서울 강남구 테헤란로 151').first);
    await settle(tester);

    expect(find.text('충전금이 부족해요. 잔액 2,000원, 대행료 3,500원.'), findsOneWidget);
    expect(find.text('충전하기'), findsOneWidget);
    expect(find.text('배달 요청하기 · 3,500원'), findsNothing);
    await screenshot(tester, 'store-request-lacking');
  });

  group('배달 상세', () {
    Future<FakeBackend> showDetail(
      WidgetTester tester,
      Json delivery, {
      Json? driver = riderJson,
    }) async {
      final backend = FakeBackend()
        ..on(
          'GET',
          '/orders/:id',
          (_, _) => deliveryDetailJson(delivery, driver: driver),
        )
        ..on(
          'GET',
          '/orders/:id/tracking',
          (_, _) => trackingJson(status: delivery['status'] as String),
        );
      await _show(
        tester,
        backend,
        DeliveryDetailScreen(orderId: delivery['id'] as String),
      );
      return backend;
    }

    testScreen('라이더 찾는 중 — 대행료를 모두 돌려받는다고 알린다', (tester) async {
      await showDetail(
        tester,
        deliveryJson(status: 'REQUESTED', driverName: null),
        driver: null,
      );
      expect(find.text('라이더를 찾고 있어요'), findsOneWidget);
      expect(find.text('지금 취소하면 대행료 3,500원을 모두 돌려드려요'), findsOneWidget);
      await screenshot(tester, 'store-detail-requested');
    });

    testScreen('가게로 오는 중 — 라이더와 픽업·도착 예정', (tester) async {
      await showDetail(tester, deliveryJson());
      expect(find.text('라이더가 가게로 오고 있어요'), findsOneWidget);
      expect(find.text('김라이더 라이더'), findsOneWidget);
      expect(find.text('픽업 예정'), findsWidgets);
      expect(find.text('도착 예정'), findsOneWidget);
      await screenshot(tester, 'store-detail-assigned');
    });

    testScreen('라이더 가게 도착 — 취소하면 수수료 15%를 빼고 돌려받는다', (tester) async {
      final backend =
          await showDetail(
              tester,
              deliveryJson(id: '3f9a-arrived', status: 'ARRIVED'),
            )
            ..on(
              'POST',
              '/orders/:id/cancel',
              (_, _) => deliveryJson(
                status: 'CANCELLED',
                cancellationFee: 500,
                cancelReason: '손님이 주문을 취소했어요',
              ),
            );
      expect(find.text('주문번호 끝자리 3F9A로 음식을 전해 주세요'), findsOneWidget);
      expect(find.text('지금 취소하면 수수료 525원을 빼고 2,975원을 돌려드려요'), findsOneWidget);

      await tester.tap(find.text('배달 취소'));
      await settle(tester);
      expect(find.text('라이더가 이미 가게에 와서 대행료의 15%를 빼고 돌려드려요.'), findsOneWidget);
      expect(find.text('−525원'), findsOneWidget);
      expect(find.text('2,975원'), findsOneWidget);
      // 사유 없이 취소하면 고르라고 한다.
      await tester.tap(find.text('배달 취소하기'));
      await settle(tester);
      expect(find.text('취소 사유를 골라 주세요.'), findsOneWidget);
      await tester.tap(find.text('손님이 주문을 취소했어요'));
      await settle(tester);
      await screenshot(tester, 'store-cancel-sheet');
      await tester.tap(find.text('배달 취소하기'));
      await settle(tester);

      expect(backend.bodyOf('POST /orders/3f9a-arrived/cancel'), {
        'reason': '손님이 주문을 취소했어요',
      });
    });

    testScreen('배달 중 — 픽업 뒤에는 취소할 수 없다', (tester) async {
      await showDetail(tester, deliveryJson(status: 'PICKED_UP'));
      expect(find.text('손님에게 배달하고 있어요'), findsOneWidget);
      expect(find.text('픽업 이후에는 취소할 수 없어요.'), findsOneWidget);
      expect(find.text('배달 취소'), findsNothing);
      await screenshot(tester, 'store-detail-picked-up');
    });

    testScreen('배달 완료 — 받은 방식과 금액', (tester) async {
      await showDetail(
        tester,
        deliveryJson(
          status: 'DELIVERED',
          doorPayment: 'CASH',
          foodAmount: 23000,
          collectedMethod: 'CASH',
          collectedAmount: 23000,
        ),
      );
      expect(find.text('배달을 마쳤어요'), findsOneWidget);
      expect(find.text('현금 23,000원 받았어요'), findsOneWidget);
      await screenshot(tester, 'store-detail-delivered');
    });

    testScreen('배달 완료 — 받은 돈이 음식값과 다르면 알린다', (tester) async {
      await showDetail(
        tester,
        deliveryJson(
          status: 'DELIVERED',
          doorPayment: 'CARD',
          foodAmount: 23000,
          collectedMethod: 'CARD',
          collectedAmount: 20000,
        ),
      );
      expect(find.text('카드 20,000원 받았어요'), findsOneWidget);
      expect(find.text('음식값 23,000원과 달라요'), findsOneWidget);
    });

    testScreen('취소한 배달 — 취소 정보만 보여 준다', (tester) async {
      await showDetail(
        tester,
        deliveryJson(
          status: 'CANCELLED',
          cancellationFee: 525,
          cancelReason: '음식을 준비할 수 없어요',
        ),
      );
      expect(find.text('취소한 배달이에요'), findsOneWidget);
      expect(find.text('음식을 준비할 수 없어요'), findsOneWidget);
      expect(find.text('2,975원'), findsOneWidget);
      expect(find.text('배달 취소'), findsNothing);
      await screenshot(tester, 'store-detail-cancelled');
    });
  });

  testScreen('배달 내역 — 날짜별 건수와 대행료, 완료만 거르기', (tester) async {
    final backend = _storeBackend(
      deliveries: [
        deliveryJson(id: 'a1', status: 'ASSIGNED', fee: 4000),
        deliveryJson(
          id: 'a2',
          status: 'DELIVERED',
          doorPayment: 'CARD',
          foodAmount: 18500,
        ),
        deliveryJson(id: 'a3', status: 'CANCELLED'),
      ],
    );
    await _show(tester, backend, const CustomerShell());
    await tester.tap(find.text('내역').last);
    await settle(tester);

    expect(find.text('배달 내역'), findsOneWidget);
    expect(find.textContaining('3건 · 대행료 7,500원'), findsOneWidget);
    expect(find.text('0원'), findsOneWidget);
    expect(find.text('취소됨'), findsOneWidget);
    expect(find.textContaining('만나서 카드 18,500원'), findsOneWidget);
    await screenshot(tester, 'store-history');

    await tester.tap(find.text('완료').first);
    await settle(tester);
    expect(
      backend.requests.last.url.queryParameters['status'],
      OrderStatus.delivered.wire,
    );
  });

  testScreen('충전금 — 내역을 보고 충전한다', (tester) async {
    final backend = _storeBackend()
      ..on(
        'GET',
        '/stores/me/wallet',
        (_, _) => walletJson([
          walletEntryJson(memo: '삼성동 · 2D90', amount: -4000),
          walletEntryJson(
            id: 'e2',
            kind: 'REFUND',
            amount: 4500,
            balanceAfter: 88500,
            memo: '개포동 · 0B18 · 라이더 출발 전 취소라 모두 돌려받았어요',
          ),
          walletEntryJson(
            id: 'e3',
            kind: 'TOP_UP',
            amount: 100000,
            balanceAfter: 84000,
            memo: '개발 서버 충전',
            ago: const Duration(days: 1),
          ),
        ]),
      )
      ..on(
        'POST',
        '/stores/me/wallet/top-ups',
        (_, _) => walletEntryJson(
          kind: 'TOP_UP',
          amount: 100000,
          balanceAfter: 184500,
        ),
      );
    await _show(tester, backend, const CustomerShell());
    await tester.tap(find.text('충전금').last);
    await settle(tester);

    expect(find.text('지금 잔액'), findsOneWidget);
    expect(find.text('배달대행료'), findsOneWidget);
    expect(find.text('−4,000원'), findsOneWidget);
    expect(find.text('+4,500원'), findsOneWidget);
    expect(find.textContaining('삼성동 · 2D90'), findsOneWidget);
    await screenshot(tester, 'store-wallet');

    await tester.tap(find.text('충전하기').last);
    await settle(tester);
    // 범위를 벗어나면 안내를 빨갛게 바꾼다.
    await tester.enterText(find.byType(EditableText).first, '5000');
    await tester.pump();
    await tester.tap(find.text('5,000원 충전하기'));
    await settle(tester);
    expect(backend.count('POST /stores/me/wallet/top-ups'), 0);

    await tester.tap(find.text('10만원'));
    await settle(tester);
    await screenshot(tester, 'store-top-up-sheet');
    await tester.tap(find.text('100,000원 충전하기'));
    await settle(tester);

    expect(backend.bodyOf('POST /stores/me/wallet/top-ups'), {
      'amount': 100000,
    });
    expect(find.text('충전했어요'), findsOneWidget);
    expect(find.text('184,500원'), findsOneWidget);
    await screenshot(tester, 'store-top-up-done');
  });

  testScreen('마이 — 가게 정보와 수정 (승인 뒤 사업자등록번호는 잠근다)', (tester) async {
    await _show(tester, _storeBackend(), const CustomerShell());
    await tester.tap(find.text('마이').last);
    await settle(tester);

    expect(find.text('모보치킨 역삼점'), findsOneWidget);
    expect(find.text('사업자 220-81-62517 · 02-555-1234'), findsOneWidget);
    expect(find.text('서울 강남구 테헤란로 152 1층'), findsOneWidget);
    await screenshot(tester, 'store-my');

    await tester.tap(find.text('가게 정보 수정'));
    await settle(tester);
    expect(find.text('승인 뒤에는 고객센터 1600-0000에서 바꿀 수 있어요'), findsOneWidget);
    expect(find.text('저장'), findsOneWidget);
    await screenshot(tester, 'store-edit');
  });
}

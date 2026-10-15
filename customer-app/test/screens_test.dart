import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:movo_api/movo_api.dart';
import 'package:movo_customer/history/history_screen.dart';
import 'package:movo_customer/home/address_search_screen.dart';
import 'package:movo_customer/order/delivery_info_screen.dart';
import 'package:movo_customer/order/draft.dart';
import 'package:movo_customer/order/order_screen.dart';
import 'package:movo_customer/order/payment_views.dart';
import 'package:movo_customer/order/quote_screen.dart';
import 'package:movo_customer/payment/cards.dart';
import 'package:movo_customer/payment/policy_screens.dart';
import 'package:movo_customer/places.dart';
import 'package:movo_customer/shell.dart';
import 'package:movo_testkit/movo_testkit.dart';
import 'package:movo_ui/movo_ui.dart';

// 화면마다 가짜 서버의 값으로 띄워 보고, 디자인과 견줄 화면 사진을 build/screenshots에 남긴다.

const _pickup = Place(
  address: '서울 성동구 성수이로 113',
  sigungu: '성동구',
  dong: '성수동2가',
  latitude: 37.5445,
  longitude: 127.0557,
);
const _dropoff = Place(
  address: '서울 강남구 테헤란로 152',
  detail: '강남파이낸스센터',
  sigungu: '강남구',
  dong: '역삼동',
  latitude: 37.5000,
  longitude: 127.0364,
);

OrderDraft _draft() =>
    OrderDraft(
        service: ServiceType.quick,
        pickup: _pickup,
        dropoff: _dropoff,
        senderName: '김지은',
        senderPhone: '01012345678',
      )
      ..quantity = 3
      ..weightKg = 15
      ..receiverName = '박서준'
      ..receiverPhone = '01055550123'
      ..memo = '1층 경비실에 맡겨주세요';

/// 출발지(성수동)를 정해 두고 도착지를 찾는 주소 검색.
AddressSearchScreen _searchDropoff() => AddressSearchScreen(
  service: ServiceType.quick,
  pickup: _pickup,
  editing: AddressSlot.dropoff,
  onComplete: (_, _, _) {},
);

/// 지난 배송의 다른 도착지.
final _mangwon = {
  ...yeoksam,
  'address': '서울 마포구 망원로 52',
  'detailAddress': null,
  'sigungu': '마포구',
  'dong': '망원동',
  'contactName': '이수아',
  'contactPhone': '01033331200',
};

/// 스크롤 본문 안의 것을 화면 가운데쯤으로 옮긴 뒤 누른다 — 아래쪽에는 떠 있는 버튼이 있다.
Future<void> _tapInPage(WidgetTester tester, Finder finder) async {
  await Scrollable.ensureVisible(tester.element(finder.first), alignment: 0.4);
  await settle(tester);
  await tester.tap(finder.first);
  await settle(tester);
}

Future<void> _show(WidgetTester tester, FakeBackend backend, Widget screen) =>
    pumpScreen(
      tester,
      api: backend.api(UserRole.customer),
      profile: MovoAppProfile.customer,
      user: userJson(),
      screen: screen,
    );

FakeBackend _homeBackend() => FakeBackend()
  ..on('GET', '/notifications/unread-count', (_, _) => {'unreadCount': 1})
  ..on('GET', '/orders', (_, _) => pageJson(const []))
  ..on('GET', '/saved-addresses', (_, _) => <Object>[])
  ..on('GET', '/notifications/settings', (_, _) => {'pushEnabled': true});

/// 앱의 뼈대를 띄우고 아래 탭 막대에서 [tab]으로 간다.
Future<void> _showTab(
  WidgetTester tester,
  FakeBackend backend,
  String tab,
) async {
  await _show(tester, backend, const CustomerShell());
  await tester.tap(find.text(tab).last);
  await settle(tester);
}

void main() {
  testScreen('홈 — 서비스 카드와 최근 보낸 경로 (같은 경로는 한 번만)', (tester) async {
    final backend = _homeBackend()
      ..on(
        'GET',
        '/orders',
        (_, _) => pageJson([
          // 진행 중인 주문은 최근 경로에 넣지 않는다.
          orderJson(id: 'live', status: 'PICKED_UP'),
          orderJson(id: 'o1', status: 'DELIVERED'),
          orderJson(id: 'o2', status: 'DELIVERED'),
          orderJson(id: 'o3', status: 'CANCELLED', dropoff: _mangwon),
          // 읍 주소: 도로명 앞에 읍이 이미 있다.
          orderJson(
            id: 'o4',
            status: 'DELIVERED',
            dropoff: {
              ...yeoksam,
              'address': '경기 화성시 남양읍 남양성지로 112',
              'sigungu': '화성시',
              'dong': '남양읍',
            },
          ),
        ]),
      );
    await _show(tester, backend, const CustomerShell());

    expect(find.text('안녕하세요, 지은님'), findsOneWidget);
    expect(find.text('어떤 배송이\n필요하세요?'), findsOneWidget);
    expect(find.text('오토바이 · 다마스 · 라보'), findsOneWidget);
    expect(find.text('1톤 · 2.5톤 · 5톤'), findsOneWidget);
    expect(find.text('최근 보낸 경로'), findsOneWidget);
    expect(find.text('다시 보내기'), findsNWidgets(3));
    expect(find.text('성수동2가 성수이로 113'), findsNWidgets(3));
    expect(find.text('역삼동 테헤란로 152'), findsOneWidget);
    expect(find.text('망원동 망원로 52'), findsOneWidget);
    expect(find.text('남양읍 남양성지로 112'), findsOneWidget);
    await screenshot(tester, 'customer-03-home');
  });

  testScreen('홈 — 최근 보낸 경로가 없으면 그렇다고 알려준다', (tester) async {
    await _show(tester, _homeBackend(), const CustomerShell());

    expect(find.text('아직 보낸 배송이 없어요'), findsOneWidget);
    expect(find.text('다시 보내기'), findsNothing);
  });

  testScreen('홈 — 서비스를 고르면 주소(1단계), 두 곳을 고르면 배송 정보(2단계)', (tester) async {
    await _show(tester, _homeBackend(), const CustomerShell());
    await tester.tap(find.text('화물 운송'));
    await settle(tester);

    // 고른 서비스가 제목이다.
    expect(find.widgetWithText(MovoTopBar, '화물 운송'), findsOneWidget);
    expect(find.text('어디서 어디로\n보낼까요?'), findsOneWidget);
    expect(find.bySemanticsLabel('3단계 중 1단계'), findsOneWidget);
    await tester.pump(const Duration(seconds: 1));
    await screenshot(tester, 'customer-04-address-step');

    await tester.enterText(find.byType(EditableText), '성수이로 113');
    await settle(tester);
    await tester.tap(find.text('성수동2가').last);
    await settle(tester);
    // 같은 곳을 도착지로 고르면 막는다.
    await tester.enterText(find.byType(EditableText), '성수이로 113');
    await settle(tester);
    await tester.tap(find.text('성수동2가').last);
    await settle(tester);
    expect(find.text('출발지와 도착지가 같아요'), findsOneWidget);
    await tester.enterText(find.byType(EditableText), '테헤란로 152');
    await settle(tester);
    await tester.tap(find.text('강남파이낸스센터 · 역삼동'));
    await settle(tester);

    expect(find.text('어떻게 보낼지\n알려 주세요'), findsOneWidget);
    expect(find.bySemanticsLabel('3단계 중 2단계'), findsOneWidget);
    // 배송 정보에서 뒤로 가면 홈이다 (주소 검색은 바꿔 끼웠다).
    // 주소 검색이 배송 정보로 바뀌는 움직임이 끝난 뒤에 누른다.
    await tester.pump(const Duration(seconds: 1));
    expect(find.bySemanticsLabel('뒤로 가기'), findsOneWidget);
    await tester.tap(find.bySemanticsLabel('뒤로 가기'));
    await settle(tester);
    expect(find.text('어떤 배송이\n필요하세요?'), findsOneWidget);
    expect(find.text('어디서 어디로\n보낼까요?'), findsNothing);
  });

  testScreen('홈 — 최근 경로를 다시 보내면 같은 경로·받는 분으로 배송 정보부터', (tester) async {
    final backend = _homeBackend()
      ..on(
        'GET',
        '/orders',
        (_, _) => pageJson([
          orderJson(id: 'o1', status: 'DELIVERED', dropoff: _mangwon),
        ]),
      );
    await _show(tester, backend, const CustomerShell());
    await tester.tap(find.text('다시 보내기'));
    await settle(tester);

    expect(find.text('어떻게 보낼지\n알려 주세요'), findsOneWidget);
    expect(find.textContaining('성수동2가 → 망원동'), findsOneWidget);
    expect(find.text('이수아'), findsOneWidget);
    expect(find.text('010-3333-1200'), findsOneWidget);
  });

  testScreen('주소 검색 — 서버에서 찾은 곳을 거리와 함께 보여준다', (tester) async {
    final backend = FakeBackend();
    await _show(tester, backend, _searchDropoff());
    await tester.enterText(find.byType(EditableText), '테헤란로 15');
    await settle(tester);

    expect(find.text('강남파이낸스센터 · 역삼동'), findsOneWidget);
    // 출발지(성수동)에서의 직선 거리.
    expect(find.text('5.2km'), findsWidgets);
    // 입력이 멈춘 뒤 한 번만 묻는다.
    expect(backend.count('GET /address-search'), 1);
    expect(backend.requests.last.url.queryParameters, {'query': '테헤란로 15'});
    await screenshot(tester, 'customer-04-address-search');
  });

  testScreen('주소 검색 — 칸을 한 번 누르면 바로 입력할 수 있다 (출발지를 고르면 도착지로)', (tester) async {
    // 입력란은 고르는 칸에 하나만 있다. 포커스만으로는 부족하다 — 키보드가 그 입력란에 이어져 있어야
    // 글자가 들어간다 (포커스는 남았는데 키보드 연결이 끊겨 한 번 더 눌러야 했다).
    bool typing() =>
        tester
            .widget<EditableText>(find.byType(EditableText))
            .focusNode
            .hasFocus &&
        tester.testTextInput.hasAnyClients &&
        tester.testTextInput.isVisible;
    await _show(
      tester,
      FakeBackend(),
      AddressSearchScreen(service: ServiceType.quick, onComplete: (_, _, _) {}),
    );
    expect(typing(), isTrue);

    // 도착 칸을 한 번 누르면 그 칸에 입력한다.
    await tester.tap(find.text('눌러서 입력'));
    await tester.pump();
    expect(typing(), isTrue);
    // 출발 칸으로 돌아가도 한 번에.
    await tester.tap(find.text('출발'));
    await tester.pump();
    expect(typing(), isTrue);

    // 출발지를 고르면 도착 칸으로 넘어가 바로 입력할 수 있다.
    await tester.enterText(find.byType(EditableText), '성수이로 113');
    await settle(tester);
    await tester.tap(find.text('성수동2가').last);
    await tester.pump();
    expect(typing(), isTrue);
    await tester.enterText(find.byType(EditableText), '테헤란로');
    await settle(tester);
    expect(find.text('강남파이낸스센터 · 역삼동'), findsOneWidget);
  });

  testScreen('주소 검색 — 검색이 잠시 안 되면 서버의 안내를 보여준다', (tester) async {
    final backend = FakeBackend()
      ..fail(
        'GET',
        '/address-search',
        status: 503,
        code: ApiErrorCode.addressSearchUnavailable,
        message: '주소 검색이 잠시 안 돼요. 잠시 뒤 다시 해 주세요.',
      );
    await _show(tester, backend, _searchDropoff());
    await tester.enterText(find.byType(EditableText), '테헤란로');
    await settle(tester);

    expect(find.text('주소 검색이 잠시 안 돼요. 잠시 뒤 다시 해 주세요.'), findsOneWidget);
    expect(find.text('검색 결과가 없어요'), findsNothing);
  });

  testScreen('배송 정보 — 물품·운반 도움·층수·연락처·픽업 시간', (tester) async {
    final draft = _draft();
    await _show(tester, FakeBackend(), DeliveryInfoScreen(draft: draft));

    expect(find.text('어떻게 보낼지\n알려 주세요'), findsOneWidget);
    // 구간 거리는 서버 견적의 도로 거리다.
    expect(find.text('성수동2가 → 역삼동 · 8.2km'), findsOneWidget);
    expect(find.text('3개'), findsOneWidget);
    expect(find.text('김지은 · 010-1234-5678'), findsOneWidget);
    // 받는 분은 카드 안의 입력란에 채워져 있다.
    expect(find.text('박서준'), findsOneWidget);
    expect(find.text('010-5555-0123'), findsOneWidget);
    expect(find.text('+10,000원'), findsOneWidget);
    expect(find.text('추가 요금 없음'), findsOneWidget);
    await screenshot(tester, 'c05-delivery-info');

    // 기사님과 함께 옮기고, 도착지는 엘리베이터 없는 3층.
    await _tapInPage(tester, find.text('함께'));
    await _tapInPage(tester, find.bySemanticsLabel('도착지 엘리베이터'));
    for (var i = 0; i < 2; i++) {
      await _tapInPage(tester, find.bySemanticsLabel('늘리기').last);
    }
    expect(find.text('3층'), findsOneWidget);
    expect(find.text('엘리베이터 없이 2개 층을 올라요'), findsOneWidget);
    expect(find.text('+6,000원'), findsOneWidget);
    expect(find.text('추가 +16,000원'), findsOneWidget);
    expect(draft.loadingHelp, LoadingHelp.together);
    expect(draft.dropoffAccess.floor, 3);
    expect(draft.dropoffAccess.elevator, isFalse);
    await screenshot(tester, 'c05-delivery-info-floors');

    await _tapInPage(tester, find.text('50kg 이상'));
    expect(draft.weightKg, 50);
    await _tapInPage(tester, find.text('가구·가전'));
    expect(draft.category, CargoCategory.furnitureAppliance);
    // 요청사항: 빠른 입력을 누르면 그 말로 바뀌고, 다시 누르면 지워진다.
    await _tapInPage(tester, find.text('문 앞에 두세요'));
    expect(find.text('문 앞에 두세요'), findsNWidgets(2));
    await _tapInPage(tester, find.text('문 앞에 두세요').last);
    expect(find.text('문 앞에 두세요'), findsOneWidget);
    await screenshot(tester, 'c05-delivery-info-memo');

    await _tapInPage(tester, find.text('예약'));
    expect(find.text('오늘'), findsOneWidget);
    expect(find.text('내일'), findsOneWidget);
    await screenshot(tester, 'customer-05-delivery-info-scheduled');
  });

  testScreen('배송 정보 — 받는 분이 비었거나 연락처가 틀리면 카드 안에 알려준다', (tester) async {
    final draft = _draft()
      ..receiverName = ''
      ..receiverPhone = '';
    await _show(tester, FakeBackend(), DeliveryInfoScreen(draft: draft));

    await tester.tap(find.text('다음 · 차종 선택'));
    await settle(tester);
    expect(find.text('받는 분의 이름과 연락처를 입력해 주세요.'), findsOneWidget);

    final fields = find.byType(TextField);
    await tester.enterText(fields.at(0), '박서준');
    await tester.enterText(fields.at(1), '1234');
    await settle(tester);
    // 고치기 시작하면 안내를 지운다.
    expect(find.text('받는 분의 이름과 연락처를 입력해 주세요.'), findsNothing);
    await tester.tap(find.text('다음 · 차종 선택'));
    await settle(tester);
    expect(find.text('받는 분 연락처를 확인해 주세요.'), findsOneWidget);
    await screenshot(tester, 'c05-delivery-info-error');
    expect(draft.receiverName, isEmpty);
  });

  testScreen('차종 선택과 견적 — 고른 차종의 요금으로 요청한다', (tester) async {
    final backend = FakeBackend()
      ..on('POST', '/orders/estimates', (request, _) {
        final body = jsonDecode(request.body) as Map<String, dynamic>;
        final all = estimatesJson();
        return {
          ...all,
          'options': [
            for (final option in all['options'] as List<dynamic>)
              if ((option as Map)['serviceType'] == body['serviceType']) option,
          ],
        };
      })
      ..on(
        'POST',
        '/orders',
        (_, _) => orderJson(status: 'REQUESTED'),
        status: 201,
      )
      ..on(
        'GET',
        '/orders/:id',
        (_, _) => orderDetailJson(status: 'REQUESTED'),
      );
    final draft = _draft()
      ..loadingHelp = LoadingHelp.together
      ..dropoffAccess = const FloorAccess(floor: 3, elevator: false);
    await _show(tester, backend, QuoteScreen(draft: draft));

    expect(find.text('성수동'), findsWidgets);
    expect(find.text('8.2km · 예상 32분 · 박스 3개'), findsOneWidget);
    // 퀵 배송의 차종만 보인다.
    expect(find.text('1톤 트럭'), findsNothing);
    // 15kg을 실을 수 있는 가장 싼 차종(오토바이)이 먼저 골라져 있다.
    expect(find.text('기본 요금 · 오토바이'), findsOneWidget);
    // 버튼의 금액 = 기본 요금 1만 2천 + 운반 도움 1만 + 계단 6천 (다마스 칸의 28,000원과 겹친다)
    expect(find.text('28,000원'), findsNWidgets(2));

    await tester.tap(find.text('다마스'));
    await settle(tester);
    expect(find.text('기본 요금 · 다마스'), findsOneWidget);
    expect(find.text('운반 도움 · 함께'), findsOneWidget);
    expect(find.text('계단 · 도착 3층'), findsOneWidget);
    expect(find.text('44,000원'), findsOneWidget);
    expect(find.text('신한카드 ••4821'), findsOneWidget);
    expect(find.text('신용카드 · 기본 카드'), findsOneWidget);
    await screenshot(tester, 'c06-quote');

    await tester.tap(find.text('배송 요청하기'));
    await settle(tester);
    final sent = backend.bodyOf('POST /orders');
    expect(sent['vehicleType'], 'DAMAS');
    expect(sent['pickup'], containsPair('dong', '성수동2가'));
    expect(sent['dropoff'], containsPair('contactName', '박서준'));
    expect(sent['cargo'], {'category': 'BOX', 'weightKg': 15.0, 'quantity': 3});
    expect(sent['memo'], '1층 경비실에 맡겨주세요');
    expect(sent['loadingHelp'], 'TOGETHER');
    expect(sent['dropoffAccess'], {'floor': 3, 'elevator': false});
    expect(sent['paymentMethodId'], 'card-1');
    // 요청하면 기사 찾는 중 화면으로 넘어간다.
    expect(find.text('기사님을 찾고 있어요'), findsOneWidget);
  });

  testScreen('견적 · 카드 없음 — 카드를 등록하고 요청한다', (tester) async {
    final backend = FakeBackend()
      ..on('POST', '/orders/estimates', (_, _) => estimatesJson())
      ..on('GET', '/payment-methods', (_, _) => <Object>[])
      ..on(
        'GET',
        '/payment-methods/registration',
        (_, _) => {
          'provider': 'DEV',
          'storeId': null,
          'channelKey': null,
          'customerKey': 'k',
        },
      )
      ..on(
        'POST',
        '/payment-methods',
        (_, _) =>
            paymentMethodJson(brand: '국민카드', last4: '3310', type: 'CHECK'),
        status: 201,
      );
    await _show(tester, backend, QuoteScreen(draft: _draft()));

    expect(find.text('결제할 카드가 없어요'), findsOneWidget);
    expect(find.text('카드 등록하고 요청하기'), findsOneWidget);
    await screenshot(tester, 'c07-quote-no-card');

    await tester.tap(find.text('카드 등록하고 요청하기'));
    await settle(tester);
    expect(find.text('결제할 카드를\n등록해 주세요'), findsOneWidget);
    expect(find.text('배차되면 결제돼요'), findsOneWidget);
    await screenshot(tester, 'c09-card-intro');

    await tester.tap(find.text('카드 등록하기'));
    await settle(tester);
    await tester.tap(find.text('국민카드'));
    await tester.tap(find.text('체크카드'));
    await tester.enterText(find.byType(EditableText), '3310');
    await settle(tester);
    await screenshot(tester, 'c10-dev-card');
    await tester.tap(find.text('카드 등록'));
    await settle(tester);
    expect(backend.bodyOf('POST /payment-methods'), {
      'authKey': 'dev:국민카드:3310:CHECK',
    });
    expect(find.text('카드를 등록했어요'), findsOneWidget);
    expect(find.text('••••  ••••  ••••  3310'), findsOneWidget);
    await screenshot(tester, 'c11-card-done');
  });

  group('주문 화면', () {
    FakeBackend backend(String status, {Map<String, dynamic>? review}) =>
        FakeBackend()
          ..on(
            'GET',
            '/orders/:id',
            (_, _) => orderDetailJson(status: status, review: review),
          )
          ..on('GET', '/orders/:id/tracking', (_, _) => trackingJson());

    testScreen('기사 찾는 중 — 아직 결제 전', (tester) async {
      await _show(
        tester,
        FakeBackend()..on(
          'GET',
          '/orders/:id',
          (_, _) => orderDetailJson(
            status: 'REQUESTED',
            payment: paymentJson(status: 'UNPAID', paid: 0),
          ),
        ),
        const OrderScreen(orderId: 'order-1'),
      );

      expect(find.text('기사님을 찾고 있어요'), findsOneWidget);
      expect(find.text('다마스 · 박스 3개'), findsOneWidget);
      expect(find.text('아직 결제 전이에요. 지금 취소해도 요금이 나가지 않아요.'), findsOneWidget);
      expect(find.text('요청 취소'), findsOneWidget);
      await screenshot(tester, 'c12-searching');
    });

    testScreen('결제 실패 — 다른 카드로 다시 요청한다', (tester) async {
      final server = FakeBackend()
        ..on(
          'GET',
          '/orders/:id',
          (_, _) => orderDetailJson(
            status: 'PAYMENT_FAILED',
            payment: {
              ...paymentJson(status: 'FAILED', paid: 0),
              'charges': [
                {
                  'id': 'charge-1',
                  'kind': 'DISPATCH',
                  'amount': 28000,
                  'status': 'FAILED',
                  'card': shinhanCard,
                  'approvalNumber': null,
                  'approvedAt': null,
                  'failure': {
                    'code': 'LIMIT_EXCEEDED',
                    'title': '한도 초과',
                    'guidance': '카드 한도가 부족해요.',
                  },
                  'failedAt': isoAt(const Duration(minutes: -1)),
                  'cancelledAmount': 0,
                  'cancelledAt': null,
                },
              ],
            },
          ),
        )
        ..on(
          'GET',
          '/payment-methods',
          (_, _) => [
            paymentMethodJson(),
            paymentMethodJson(
              id: 'card-2',
              brand: '국민카드',
              last4: '3310',
              type: 'CHECK',
              isDefault: false,
            ),
          ],
        )
        ..on(
          'POST',
          '/orders/:id/retry-payment',
          (_, _) => orderJson(status: 'REQUESTED'),
        );
      await _show(tester, server, const OrderScreen(orderId: 'order-1'));

      expect(find.text('결제가 안 돼서\n배차되지 않았어요'), findsOneWidget);
      expect(find.text('한도 초과'), findsOneWidget);
      expect(find.text('신한카드 ••4821'), findsOneWidget);
      await screenshot(tester, 'c13-payment-failed');

      await tester.tap(find.text('다른 카드로 다시 요청'));
      await settle(tester);
      expect(find.text('방금 결제가 안 된 카드예요'), findsOneWidget);
      expect(find.text('이 카드로 다시 요청 · 28,000원'), findsOneWidget);
      await screenshot(tester, 'c14-retry-sheet');

      await tester.tap(find.text('이 카드로 다시 요청 · 28,000원'));
      await settle(tester);
      expect(server.bodyOf('POST /orders/order-1/retry-payment'), {
        'paymentMethodId': 'card-2',
      });
    });

    Json paid(String status, {int fee = 0, int refunded = 0}) =>
        orderDetailJson(
          status: status,
          payment: paymentJson(
            status: refunded > 0 ? 'PARTIALLY_REFUNDED' : 'PAID',
            paid: 44000,
            refunded: refunded,
          ),
          edit: (order) => {
            ...order,
            ...orderJson(
              status: status,
              fare: 44000,
              loadingHelp: 'TOGETHER',
              helpFee: 10000,
              dropoffAccess: const {'floor': 3, 'elevator': false},
              stairFee: 6000,
              cancellationFee: fee,
            ),
          },
        );

    testScreen('주문 상세 — 배차 완료 (출발 전)', (tester) async {
      await _show(
        tester,
        FakeBackend()..on('GET', '/orders/:id', (_, _) => paid('ASSIGNED')),
        const OrderScreen(orderId: 'order-1'),
      );

      expect(find.text('기사님이 곧 출발해요'), findsOneWidget);
      expect(find.text('김도윤 기사님'), findsOneWidget);
      expect(find.text('다마스 · 서울 81바 2047'), findsOneWidget);
      expect(find.text('결제 정보'), findsOneWidget);
      expect(find.text('운반 도움 · 함께'), findsOneWidget);
      expect(find.text('신한카드 ••4821 · 일시불'), findsOneWidget);
      expect(find.text('기사님 출발 전이라 지금 취소하면 전액 환불돼요'), findsOneWidget);
      await screenshot(tester, 'c15-order-assigned');

      await tester.tap(find.text('주문 취소'));
      await settle(tester);
      expect(find.text('지금 취소하면 수수료가 없어요'), findsOneWidget);
      expect(find.text('44,000원'), findsWidgets);
      await screenshot(tester, 'c18-cancel-free');
    });

    testScreen('주문 상세 — 기사 출발 뒤 취소하면 수수료 15%', (tester) async {
      final server = FakeBackend()
        ..on('GET', '/orders/:id', (_, _) => paid('DEPARTED'))
        ..on(
          'POST',
          '/orders/:id/cancel',
          (_, _) => orderJson(status: 'CANCELLED', cancellationFee: 6600),
        );
      await _show(tester, server, const OrderScreen(orderId: 'order-1'));

      expect(find.text('기사님이 픽업지로 오고 있어요'), findsOneWidget);
      expect(
        find.text('지금 취소하면 수수료 15% 6,600원을 뺀 37,400원이 환불돼요'),
        findsOneWidget,
      );
      await screenshot(tester, 'c16-order-departed');

      await tester.tap(find.text('주문 취소'));
      await settle(tester);
      expect(find.text('지금 취소하면 수수료 15%가 붙어요'), findsOneWidget);
      expect(find.text('−6,600원'), findsOneWidget);
      expect(find.text('37,400원'), findsOneWidget);
      await screenshot(tester, 'c19-cancel-fee');

      await tester.tap(find.text('취소하고 환불받기'));
      await settle(tester);
      expect(server.calls, contains('POST /orders/order-1/cancel'));
    });

    testScreen('주문 상세 — 도착 후 대기', (tester) async {
      await _show(
        tester,
        FakeBackend()..on('GET', '/orders/:id', (_, _) => paid('ARRIVED')),
        const OrderScreen(orderId: 'order-1'),
      );

      expect(find.text('기사님이 픽업지에 도착했어요'), findsOneWidget);
      expect(find.text('도착 후 대기'), findsOneWidget);
      expect(find.text('쌓인 대기료'), findsOneWidget);
      await screenshot(tester, 'c17-order-waiting');
    });

    testScreen('노쇼 처리 안내', (tester) async {
      await _show(
        tester,
        FakeBackend()..on(
          'GET',
          '/orders/:id',
          (_, _) => orderDetailJson(
            status: 'NO_SHOW',
            payment: paymentJson(paid: 44000),
            edit: (order) => {
              ...order,
              'fare': 44000,
              'cancellationFee': 44000,
            },
          ),
        ),
        const OrderScreen(orderId: 'order-1'),
      );

      expect(find.text('기사님이 30분을\n기다렸어요'), findsOneWidget);
      expect(find.text('44,000원 · 100%'), findsOneWidget);
      expect(find.text('없음'), findsOneWidget);
      await screenshot(tester, 'c25-no-show');
    });

    testScreen('배송 중 — 기사 위치와 도착 예정', (tester) async {
      await _show(
        tester,
        backend('PICKED_UP'),
        const OrderScreen(orderId: 'order-1'),
      );

      expect(find.text('18분 후 도착'), findsOneWidget);
      expect(find.text('물품을 싣고 이동 중이에요'), findsOneWidget);
      // 픽업한 뒤에는 취소할 수 없다.
      expect(find.text('주문 취소'), findsNothing);
      await screenshot(tester, 'customer-09-tracking');
    });

    testScreen('배송 중 — 추가 요금이 결제되면 안내로 이어진다', (tester) async {
      await _show(
        tester,
        FakeBackend()
          ..on(
            'GET',
            '/orders/:id',
            (_, _) => orderDetailJson(
              status: 'PICKED_UP',
              payment: paymentJson(paid: 44000, additional: 12000),
              edit: (order) => {
                ...order,
                ...orderJson(
                  status: 'PICKED_UP',
                  fare: 44000,
                  extraItems: const {'overload': 1, 'bulky': 0, 'stairs': 0},
                  extraFee: 10000,
                  waitingMinutes: 14,
                  waitingFee: 2000,
                ),
              },
            ),
          )
          ..on('GET', '/orders/:id/tracking', (_, _) => trackingJson()),
        const OrderScreen(orderId: 'order-1'),
      );

      await tester.tap(find.text('추가 요금 12,000원이 결제됐어요'));
      await settle(tester);
      expect(find.text('과적 1단계'), findsOneWidget);
      expect(find.text('대기료 · 14분 대기 (10분 무료)'), findsOneWidget);
      expect(find.text('56,000원'), findsOneWidget);
      expect(find.text('30522410'), findsOneWidget);
      await screenshot(tester, 'c20-extra-charge');
    });

    testScreen('배송 완료 — 기사님을 평가한다', (tester) async {
      final server = backend('DELIVERED')
        ..on(
          'POST',
          '/orders/:id/review',
          (_, _) => {
            'rating': 5,
            'tags': ['KIND', 'FAST'],
            'comment': null,
            'createdAt': isoAt(Duration.zero),
          },
          status: 201,
        );
      await _show(tester, server, const OrderScreen(orderId: 'order-1'));
      // 별점을 고르기 전에는 보낼 수 없다.
      await tester.tap(find.text('평가 보내기'));
      await settle(tester);
      expect(server.calls, isNot(contains('POST /orders/order-1/review')));

      await tester.tap(find.bySemanticsLabel('별점 5점'));
      await tester.tap(find.text('친절해요'));
      await tester.tap(find.text('빨라요'));
      await settle(tester);

      expect(find.text('배송이 완료됐어요'), findsOneWidget);
      expect(find.text('기본 요금 · 다마스'), findsOneWidget);
      expect(find.text('총 결제 금액'), findsOneWidget);
      expect(find.text('김도윤 기사님은 어떠셨나요?'), findsOneWidget);
      await screenshot(tester, 'c22-completed');

      await tester.tap(find.text('평가 보내기'));
      await settle(tester);
      expect(server.bodyOf('POST /orders/order-1/review'), {
        'rating': 5,
        'tags': ['KIND', 'FAST'],
      });
    });

    Future<void> openReceipt(WidgetTester tester, Json receipt) => _show(
      tester,
      FakeBackend()..on('GET', '/orders/:id/receipt', (_, _) => receipt),
      ReceiptScreen(
        detail: OrderDetail.fromJson(
          orderDetailJson(
            status: 'DELIVERED',
            edit: (order) => {
              ...order,
              ...orderJson(
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
            },
          ),
        ),
      ),
    );

    testScreen('영수증 — 공급가액과 부가세', (tester) async {
      await openReceipt(tester, receiptJson());

      expect(find.text('56,000원'), findsWidgets);
      expect(find.text('50,909원'), findsOneWidget);
      expect(find.text('5,091원'), findsOneWidget);
      expect(find.text('30521877 외 1건'), findsOneWidget);
      expect(
        find.text(
          '주식회사 무보 · 대표자 한서윤 · 사업자등록번호 214-88-01234\n서울특별시 성동구 성수이로 113, 4층 · 고객센터 1600-0000',
        ),
        findsOneWidget,
      );
      await screenshot(tester, 'c23-receipt');
    });

    testScreen('영수증 — 부분 환불', (tester) async {
      await openReceipt(
        tester,
        receiptJson(
          paid: 25000,
          refunded: 21200,
          cancellationFee: 3800,
          approvals: const ['29601144'],
        ),
      );

      expect(find.text('−21,200원'), findsOneWidget);
      expect(find.text('최종 결제 금액'), findsOneWidget);
      await screenshot(tester, 'c24-receipt-refund');
    });

    testScreen('취소한 주문은 취소 버튼 없이 상세만 보여준다', (tester) async {
      await _show(
        tester,
        backend('CANCELLED'),
        const OrderScreen(orderId: 'order-1'),
      );

      expect(find.text('취소한 주문이에요'), findsOneWidget);
      expect(find.text('주문 취소'), findsNothing);
    });
  });

  testScreen('이용 내역 — 진행 중인 주문과 지난 주문', (tester) async {
    final backend = _homeBackend()
      ..on(
        'GET',
        '/orders',
        (_, _) => pageJson([
          orderJson(status: 'PICKED_UP', driverName: '김도윤'),
          orderJson(
            id: 'order-2',
            status: 'DELIVERED',
            vehicleType: 'MOTORCYCLE',
            fare: 12000,
            pickup: {...seongsu, 'dong': '망원동'},
            dropoff: {...yeoksam, 'dong': '상암동'},
            requestedAgo: const Duration(days: 1),
          ),
          orderJson(
            id: 'order-3',
            status: 'DELIVERED',
            vehicleType: 'TRUCK_1T',
            serviceType: 'FREIGHT',
            fare: 74000,
            dropoff: {...yeoksam, 'dong': '판교동'},
            requestedAgo: const Duration(days: 1),
          ),
          orderJson(
            id: 'order-4',
            status: 'CANCELLED',
            fare: 22000,
            pickup: {...seongsu, 'dong': '연남동'},
            dropoff: {...yeoksam, 'dong': '합정동'},
            requestedAgo: const Duration(days: 4),
          ),
          orderJson(
            id: 'order-5',
            status: 'CANCELLED',
            fare: 25000,
            cancellationFee: 3800,
            payment: paymentJson(
              status: 'PARTIALLY_REFUNDED',
              paid: 25000,
              refunded: 21200,
            ),
            dropoff: {...yeoksam, 'dong': '역삼동'},
            requestedAgo: const Duration(days: 5),
          ),
          orderJson(
            id: 'order-6',
            status: 'NO_SHOW',
            fare: 30000,
            cancellationFee: 30000,
            payment: paymentJson(paid: 30000),
            dropoff: {...yeoksam, 'dong': '문정동'},
            requestedAgo: const Duration(days: 6),
          ),
          orderJson(
            id: 'order-7',
            status: 'PAYMENT_FAILED',
            fare: 44000,
            payment: paymentJson(status: 'FAILED', paid: 0),
            requestedAgo: const Duration(days: 7),
          ),
        ]),
      );
    await _showTab(tester, backend, '이용 내역');

    expect(find.text('배송 중'), findsOneWidget);
    expect(find.text('다마스 · 김도윤 기사님'), findsOneWidget);
    expect(find.text('망원동 → 상암동'), findsOneWidget);
    expect(find.text('완료'), findsNWidgets(2));
    expect(find.text('취소'), findsOneWidget);
    expect(find.text('부분 환불'), findsOneWidget);
    expect(find.textContaining('수수료 3,800원 · 환불 21,200원'), findsOneWidget);
    expect(find.text('노쇼'), findsOneWidget);
    expect(find.text('결제 실패'), findsOneWidget);
    await screenshot(tester, 'c26-history');

    await tester.tap(find.text('화물 운송'));
    await settle(tester);
    expect(backend.requests.last.url.queryParameters['serviceType'], 'FREIGHT');
  });

  testScreen('이용 내역이 비었으면 첫 배송을 권한다', (tester) async {
    await _showTab(tester, _homeBackend(), '이용 내역');

    expect(find.text('아직 주문이 없어요'), findsOneWidget);
    await screenshot(tester, 'common-04-empty');

    // 누르면 홈 탭으로 돌아간다.
    await tester.tap(find.text('첫 배송 요청하기'));
    await settle(tester);
    expect(find.text('어떤 배송이\n필요하세요?').hitTestable(), findsOneWidget);
  });

  testScreen('내 정보 — 프로필과 설정', (tester) async {
    final backend = _homeBackend()
      ..on(
        'GET',
        '/saved-addresses',
        (_, _) => [
          savedAddressJson('a1', '역삼 사무실', '서울 강남구 테헤란로 152'),
          savedAddressJson('a2', '본가', '경기 고양시 일산동구 정발산로 24'),
        ],
      )
      ..on('GET', '/notifications/settings', (_, _) => {'pushEnabled': true})
      ..on(
        'PATCH',
        '/notifications/settings',
        (request, _) => jsonDecode(request.body),
      );
    await _showTab(tester, backend, '마이');

    expect(find.text('김지은'), findsOneWidget);
    expect(find.text('010-1234-5678'), findsOneWidget);
    expect(find.text('2곳'), findsOneWidget);
    expect(find.text('1개'), findsOneWidget);
    expect(find.text('취소·환불 규정'), findsOneWidget);
    expect(find.text('사업자 정보'), findsOneWidget);
    await screenshot(tester, 'c28-my');

    await tester.tap(find.byType(MovoToggle));
    await settle(tester);
    expect(backend.bodyOf('PATCH /notifications/settings'), {
      'pushEnabled': false,
    });
  });

  testScreen('결제 수단 — 기본 카드를 바꾸고 지운다', (tester) async {
    final backend = FakeBackend()
      ..on(
        'GET',
        '/payment-methods',
        (_, _) => [
          paymentMethodJson(),
          paymentMethodJson(
            id: 'card-2',
            brand: '국민카드',
            last4: '3310',
            type: 'CHECK',
            isDefault: false,
            createdAt: '2026-09-14T01:00:00.000Z',
          ),
        ],
      )
      ..on(
        'POST',
        '/payment-methods/:id/default',
        (_, _) => paymentMethodJson(id: 'card-2'),
      )
      ..on('DELETE', '/payment-methods/:id', (_, _) => null);
    await _show(tester, backend, const PaymentMethodsScreen());

    expect(find.text('신한카드 ••4821'), findsOneWidget);
    expect(find.text('기본'), findsOneWidget);
    expect(find.text('체크카드 · 9월 14일 등록'), findsOneWidget);
    await screenshot(tester, 'c29-cards');

    await tester.tap(find.text('기본으로'));
    await settle(tester);
    expect(backend.calls, contains('POST /payment-methods/card-2/default'));
  });

  testScreen('취소·환불 규정과 사업자 정보', (tester) async {
    await _show(tester, FakeBackend(), const RefundPolicyScreen());
    expect(find.text('수수료 15%'), findsOneWidget);
    expect(find.text('요금 100%'), findsOneWidget);
    expect(find.text('대기료는 얼마인가요?'), findsOneWidget);
    await screenshot(tester, 'c30-refund-policy');

    await _show(tester, FakeBackend(), const BusinessInfoScreen());
    expect(find.text('214-88-01234'), findsOneWidget);
    expect(find.text('1600-0000 · 평일 09:00–18:00'), findsOneWidget);
    await screenshot(tester, 'c31-business');
  });

  testScreen('알림함 — 결제·환불·노쇼 알림', (tester) async {
    Json item(String id, String type, String title, String body, int ago) => {
      'id': id,
      'type': type,
      'title': title,
      'body': body,
      'data': {'type': type, 'orderId': 'order-1'},
      'readAt': ago > 60 ? isoAt(Duration(minutes: -ago + 1)) : null,
      'createdAt': isoAt(Duration(minutes: -ago)),
    };
    final backend = FakeBackend()
      ..on(
        'GET',
        '/notifications',
        (_, _) => {
          ...pageJson([
            item(
              'n1',
              'PAYMENT_ADDITIONAL_PAID',
              '추가 요금 12,000원을 결제했어요',
              '성수동 → 역삼동 · 신한카드 ••4821',
              3,
            ),
            item(
              'n2',
              'PAYMENT_PAID',
              '44,000원을 결제했어요',
              '성수동 → 역삼동 · 신한카드 ••4821',
              26,
            ),
            item(
              'n3',
              'ORDER_PAYMENT_FAILED',
              '결제가 안 돼 배차되지 않았어요',
              '한도 초과 · 다른 카드로 다시 요청해 주세요.',
              29,
            ),
            item(
              'n4',
              'PAYMENT_REFUNDED',
              '21,200원을 환불했어요',
              '성수동 → 역삼동 · 취소 수수료 3,800원을 뺐어요',
              2000,
            ),
            item(
              'n5',
              'ORDER_NO_SHOW',
              '노쇼로 처리됐어요',
              '기사님이 30분을 기다렸어요. 요금 30,000원은 환불되지 않아요.',
              3000,
            ),
          ]),
          'unreadCount': 3,
        },
      );
    await _show(tester, backend, const NotificationsScreen());

    expect(find.text('추가 결제'), findsOneWidget);
    expect(find.text('결제 실패'), findsOneWidget);
    expect(find.text('환불'), findsOneWidget);
    await screenshot(tester, 'c27-inbox');
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
      api: backend.api(UserRole.customer),
      profile: MovoAppProfile.customer,
      user: userJson(),
      screen: screen,
      size: size,
    );

    testScreen('$label — 탭 화면들', (tester) async {
      final backend = _homeBackend()
        ..on(
          'GET',
          '/orders',
          (_, _) => pageJson([
            orderJson(status: 'PICKED_UP', driverName: '김도윤'),
            orderJson(id: 'order-2', status: 'DELIVERED'),
            orderJson(id: 'order-3', status: 'CANCELLED'),
          ]),
        );
      await show(tester, backend, const CustomerShell());
      for (final tab in ['이용 내역', '마이', '홈']) {
        await tester.tap(find.text(tab).last);
        await settle(tester);
      }
    });

    testScreen('$label — 배송 정보와 견적', (tester) async {
      final backend = FakeBackend()
        ..on('POST', '/orders/estimates', (_, _) => estimatesJson());
      await show(tester, backend, DeliveryInfoScreen(draft: _draft()));
      // 예약을 펼쳤다 접어 본 뒤 다음으로 넘어간다.
      await _tapInPage(tester, find.text('예약'));
      await _tapInPage(tester, find.text('지금 바로'));
      await tester.tap(find.text('다음 · 차종 선택'));
      await settle(tester);
      expect(find.text('배송 요청하기'), findsOneWidget);
    });

    for (final status in [
      'REQUESTED',
      'ASSIGNED',
      'DEPARTED',
      'ARRIVED',
      'PICKED_UP',
      'DELIVERED',
    ]) {
      testScreen('$label — 주문 화면 ($status)', (tester) async {
        final backend = FakeBackend()
          ..on(
            'GET',
            '/orders/:id',
            (_, _) => orderDetailJson(
              status: status,
              payment: paymentJson(
                status: status == 'REQUESTED' ? 'UNPAID' : 'PAID',
                paid: status == 'REQUESTED' ? 0 : 28000,
              ),
            ),
          )
          ..on('GET', '/orders/:id/tracking', (_, _) => trackingJson());
        await show(tester, backend, const OrderScreen(orderId: 'order-1'));
        expect(
          find.textContaining('김도윤').evaluate().isNotEmpty ||
              find.text('기사님을 찾고 있어요').evaluate().isNotEmpty,
          isTrue,
        );
      });
    }
  }

  testScreen('서버에 닿지 못하면 안내를 보여주고, 다시 시도하면 이어진다', (tester) async {
    final backend = FakeBackend()
      ..offline = true
      ..on('GET', '/orders', (_, _) => pageJson(const []));
    await _show(
      tester,
      backend,
      Scaffold(body: HistoryScreen(onRequest: () {})),
    );

    expect(find.text('인터넷 연결이 불안정해요'), findsOneWidget);
    await screenshot(tester, 'common-01-offline');

    backend.offline = false;
    await tester.tap(find.text('다시 시도'));
    await settle(tester);
    expect(find.text('아직 주문이 없어요'), findsOneWidget);
  });
}

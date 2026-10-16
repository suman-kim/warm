import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:movo_api/movo_api.dart';

import 'models_test.dart' show orderJson;
import 'support/fake_server.dart';

// 각 API가 서버가 기대하는 경로·쿼리·본문으로 요청하는지 본다.
// (서버와 실제로 맞는지는 test/integration의 통합 테스트가 확인한다.)

const emptyPage = {'items': <Object>[], 'total': 0, 'page': 1, 'size': 20};

void main() {
  group('가게', () {
    test('배달 목록은 상태와 요청한 날짜(한국)로 거르고, 취소에는 사유를 보낸다', () async {
      final server = FakeServer(
        (request) async => switch (request.url.path) {
          final path when path.endsWith('/recent-destinations') => json(
            <Object>[],
          ),
          final path when path.endsWith('/cancel') => json({
            ...orderJson,
            'status': 'CANCELLED',
          }),
          _ => json({
            ...emptyPage,
            'items': [
              {...orderJson, 'driverId': 'driver-1', 'driverName': '박라이더'},
            ],
            'total': 1,
          }),
        },
        signedInWith: signedIn,
      );
      // 한국 시간으로는 10월 15일 00:30 — UTC 날짜(14일)를 보내면 하루가 밀린다.
      final midnight = DateTime.utc(2026, 10, 14, 15, 30);

      final page = await server.api.orders.list(status: OrderStatus.delivered);
      await server.api.orders.list(from: midnight, to: midnight);
      await server.api.orders.recentDestinations(limit: 3);
      final cancelled = await server.api.orders.cancel(
        'order-1',
        reason: '손님 주문 취소',
      );

      expect(server.requests[0].url.queryParameters, {
        'status': 'DELIVERED',
        'page': '1',
        'size': '20',
      });
      expect(page.items.single.driverName, '박라이더');
      expect(
        server.requests[1].url.queryParameters,
        containsPair('from', '2026-10-15'),
      );
      expect(
        server.requests[2].url.toString(),
        '$baseUrl/orders/recent-destinations?limit=3',
      );
      expect(server.calls.last, 'POST /api/orders/order-1/cancel');
      expect(bodyOf(server.requests[3]), {'reason': '손님 주문 취소'});
      expect(cancelled.status, OrderStatus.cancelled);
      expect(() => server.api.orders.list(from: midnight), throwsArgumentError);
    });

    test('견적과 배달 요청', () async {
      final server = FakeServer(
        (request) async => request.url.path.endsWith('/quotes')
            ? json({
                'distanceKm': 1.6,
                'durationMinutes': 7,
                'fee': 3500,
                'walletBalance': 20000,
              })
            : json(orderJson, 201),
        signedInWith: signedIn,
      );
      const home = DeliveryDestination(
        address: '서울 강남구 역삼로 180',
        latitude: 37.4955,
        longitude: 127.0495,
      );

      final quote = await server.api.deliveries.quote(home);
      final order = await server.api.deliveries.request(
        const DeliveryRequestInput(
          dropoff: home,
          phone: '0504-1234-5678',
          foodAmount: 23000,
          doorPayment: DoorPayment.cash,
          readyInMinutes: 15,
        ),
      );

      expect(server.calls, [
        'POST /api/deliveries/quotes',
        'POST /api/deliveries',
      ]);
      expect(bodyOf(server.requests[0]), {
        'dropoff': {
          'address': '서울 강남구 역삼로 180',
          'latitude': 37.4955,
          'longitude': 127.0495,
        },
      });
      expect(quote.balanceAfter, 16500);
      expect(order.storeDelivery.doorPayment, DoorPayment.cash);
    });
  });

  group('라이더', () {
    FakeServer driverServer(
      Future<http.Response> Function(http.Request request) handler,
    ) => FakeServer(handler, appRole: UserRole.driver, signedInWith: signedIn);

    test('수입과 배달 내역의 기간은 한국 날짜로 보낸다', () async {
      final server = driverServer(
        (request) async => request.url.path.endsWith('/earnings')
            ? json({
                'from': '2026-10-07',
                'to': '2026-10-14',
                'totalEarnings': 0,
                'totalSales': 0,
                'completedCount': 0,
                'cancelledCount': 0,
                'daily': <Object>[],
                'nextSettlement': {'date': '2026-10-16', 'amount': 0},
              })
            : json(emptyPage),
      );
      // 한국 시간으로는 10월 14일 00:30 — UTC 날짜(13일)를 보내면 하루가 밀린다.
      final now = DateTime.utc(2026, 10, 13, 15, 30);
      final weekAgo = now.subtract(const Duration(days: 7));

      await server.api.dispatch.earnings(from: weekAgo, to: now);
      await server.api.dispatch.myOrders(from: weekAgo, to: now);
      await server.api.dispatch.myOrders(status: OrderStatus.delivered);

      expect(server.requests[0].url.queryParameters, {
        'from': '2026-10-07',
        'to': '2026-10-14',
      });
      expect(
        server.requests[1].url.queryParameters,
        containsPair('to', '2026-10-14'),
      );
      expect(server.requests[2].url.queryParameters.keys, [
        'status',
        'page',
        'size',
      ]);
      // 기간의 한쪽 끝만 주는 것은 서버에 가기 전에 막는다.
      expect(
        () => server.api.dispatch.myOrders(from: weekAgo),
        throwsArgumentError,
      );
      expect(server.requests, hasLength(3));
    });

    test('위치 보고와 오토바이 변경 신청', () async {
      final server = driverServer(
        (request) async => request.method == 'PUT'
            ? http.Response('', 204)
            : json({
                'id': 'driver-1',
                'userId': 'user-2',
                'vehicleType': 'MOTORCYCLE',
                'vehicleNumber': '경기수원가1234',
                'status': 'PENDING',
                'available': false,
                'rejectionReason': null,
                'approvedAt': '2026-10-13T01:00:00.000Z',
                'createdAt': '2026-10-12T01:00:00.000Z',
                'onlineSince': null,
                'todayOnlineSeconds': 0,
              }),
      );

      await server.api.drivers.reportLocation(
        const Coordinates(latitude: 37.51, longitude: 127.04),
      );
      final driver = await server.api.drivers.requestVehicleChange(
        vehicleNumber: '경기 수원 가 1234',
      );

      expect(server.calls, [
        'PUT /api/drivers/me/location',
        'POST /api/drivers/me/vehicle-change',
      ]);
      expect(bodyOf(server.requests[0]), {
        'latitude': 37.51,
        'longitude': 127.04,
      });
      expect(bodyOf(server.requests[1]), {'vehicleNumber': '경기 수원 가 1234'});
      // 다시 심사를 받아야 해서 운행할 수 없다.
      expect(driver.status, DriverStatus.pending);
      expect(driver.canAcceptOrders, isFalse);
    });

    test('라이더 등록 전에는 내 라이더 정보가 null이다', () async {
      final server = driverServer(
        (_) async => error(404, 'DRIVER_NOT_REGISTERED', '라이더 등록을 먼저 해 주세요.'),
      );

      expect(await server.api.drivers.me(), isNull);
    });

    test('정산 계좌는 등록 전이면 null이다 (본문 없는 200)', () async {
      var registered = false;
      final server = driverServer((request) async {
        if (request.method == 'PUT') registered = true;
        return registered
            ? json({
                'bankName': '국민',
                'maskedAccountNumber': '••••1024',
                'accountHolder': '박라이더',
                'verificationStatus': 'FAILED',
                'verificationFailureReason': '예금주 이름이 가입자 이름과 달라요.',
                'verificationAttemptedAt': '2026-10-12T12:04:00.000Z',
                'verifiedAt': null,
              })
            : http.Response('', 200);
      });

      expect(await server.api.drivers.settlementAccount(), isNull);
      final saved = await server.api.drivers.saveSettlementAccount(
        bankName: '국민',
        accountNumber: '123456-78-901024',
        accountHolder: '박라이더',
      );
      expect(saved.maskedAccountNumber, '••••1024');
      expect(saved.isVerified, isFalse);
      expect(saved.verificationFailureReason, contains('예금주'));
      expect((await server.api.drivers.settlementAccount())?.bankName, '국민');
    });

    test('진행 단계와 받은 돈, 정산 내역', () async {
      final server = driverServer((request) async {
        if (request.url.path.endsWith('/settlements')) {
          final week = {
            'weekStart': '2026-10-12',
            'weekEnd': '2026-10-18',
            'payoutDate': '2026-10-20',
            'status': 'IN_PROGRESS',
            'reason': null,
            'trips': 3,
            'gross': 10500,
            'fee': 1050,
            'compensation': 0,
            'net': 9450,
            'paidAt': null,
            'bankName': null,
            'maskedAccountNumber': null,
          };
          return json({
            'commissionPercent': 10,
            'payoutWeekday': 2,
            'account': null,
            'onHold': true,
            'current': week,
            'upcoming': [
              {...week, 'status': 'HOLD', 'reason': '정산 계좌를 등록하지 않았어요'},
            ],
            'paid': [],
          });
        }
        return json({...orderJson, 'status': 'DEPARTED'});
      });

      await server.api.dispatch.depart('order-1');
      await server.api.dispatch.arrive('order-1');
      await server.api.dispatch.pickUp('order-1');
      await server.api.dispatch.complete('order-1');
      await server.api.dispatch.complete(
        'order-1',
        collectedMethod: DoorPayment.cash,
        collectedAmount: 23000,
      );
      final settlements = await server.api.dispatch.settlements();

      expect(server.calls, [
        'POST /api/dispatch/orders/order-1/depart',
        'POST /api/dispatch/orders/order-1/arrive',
        'POST /api/dispatch/orders/order-1/pickup',
        'POST /api/dispatch/orders/order-1/complete',
        'POST /api/dispatch/orders/order-1/complete',
        'GET /api/dispatch/settlements',
      ]);
      // 선결제면 받은 돈 없이 완료한다.
      expect(bodyOf(server.requests[3]), isEmpty);
      expect(bodyOf(server.requests[4]), {
        'collectedMethod': 'CASH',
        'collectedAmount': 23000,
      });
      expect(settlements.onHold, isTrue);
      expect(settlements.current.status, SettlementStatus.inProgress);
      expect(settlements.upcoming.single.status, SettlementStatus.hold);
    });
  });

  group('두 앱 공통', () {
    test('내 정보 수정 — 준 항목만 보낸다', () async {
      final server = FakeServer(
        (_) async => json({...userJson, 'marketingAgreed': true}),
        signedInWith: signedIn,
      );

      final user = await server.api.users.update(marketingAgreed: true);
      await server.api.users.update(name: '김지은', phone: '010-9999-8888');

      expect(server.calls.first, 'PATCH /api/users/me');
      expect(bodyOf(server.requests[0]), {'marketingAgreed': true});
      expect(bodyOf(server.requests[1]), {
        'name': '김지은',
        'phone': '010-9999-8888',
      });
      expect(user.marketingAgreed, isTrue);
    });

    test('알림함과 알림 설정', () async {
      final server = FakeServer((request) async {
        final path = request.url.path;
        if (path.endsWith('/unread-count')) return json({'unreadCount': 3});
        if (path.endsWith('/settings')) {
          return json({
            'pushEnabled': request.method == 'GET'
                ? true
                : bodyOf(request)['pushEnabled'],
          });
        }
        return request.method == 'GET'
            ? json({...emptyPage, 'unreadCount': 3})
            : http.Response('', 204);
      }, signedInWith: signedIn);
      final notifications = server.api.notifications;

      expect((await notifications.list(page: 2)).unreadCount, 3);
      expect(await notifications.unreadCount(), 3);
      await notifications.markRead('n-1');
      await notifications.markAllRead();
      expect(await notifications.isPushEnabled(), isTrue);
      expect(await notifications.setPushEnabled(false), isFalse);

      expect(server.calls, [
        'GET /api/notifications',
        'GET /api/notifications/unread-count',
        'POST /api/notifications/n-1/read',
        'POST /api/notifications/read-all',
        'GET /api/notifications/settings',
        'PATCH /api/notifications/settings',
      ]);
      expect(server.requests.first.url.queryParameters, {
        'page': '2',
        'size': '20',
      });
    });

    test('약관과 고객센터는 로그인 없이 부르고, 아직 없는 약관은 null이다', () async {
      final server = FakeServer((request) async {
        final path = request.url.path;
        if (path == '/api/support/contact') {
          return json({
            'phone': '1588-0000',
            'email': null,
            'hours': '평일 09:00~18:00',
            'kakaoChannelUrl': null,
          });
        }
        if (path == '/api/legal/documents') return json(<Object>[]);
        return error(404, 'LEGAL_DOCUMENT_NOT_FOUND', '문서를 찾을 수 없어요.');
      }, signedInWith: signedIn);

      final contact = await server.api.support.contact();
      expect(await server.api.legal.documents(), isEmpty);
      expect(
        await server.api.legal.document(LegalDocumentType.privacy),
        isNull,
      );

      expect(server.calls.last, 'GET /api/legal/documents/PRIVACY');
      expect(server.requests.map(bearer), everyElement(isNull));
      // 약관 목록은 이 앱에 해당하는 것만 받는다 (라이더 이용약관은 라이더 앱에만).
      expect(
        server.requests
            .firstWhere((request) => request.url.path == '/api/legal/documents')
            .url
            .queryParameters,
        {'audience': 'CUSTOMER'},
      );
      expect(contact.phone, '1588-0000');
      expect(contact.email, isNull);
    });

    test('주소 검색 — 검색어를 다듬어 보내고, 빈 검색어는 묻지 않는다', () async {
      final server = FakeServer(
        (request) async => json([
          {
            'address': '서울 강남구 테헤란로 152',
            'detail': '강남파이낸스센터',
            'sigungu': '강남구',
            'dong': '역삼동',
            'latitude': 37.5000242405515,
            'longitude': 127.036508620542,
          },
          {
            'address': '서울 송파구 올림픽로 300',
            'detail': null,
            'sigungu': null,
            'dong': null,
            'latitude': 37.5126,
            'longitude': 127.1025,
          },
        ]),
        signedInWith: signedIn,
      );

      expect(await server.api.addressSearch.search('   '), isEmpty);
      final found = await server.api.addressSearch.search(' 테헤란로 152 ');

      expect(server.calls, ['GET /api/address-search']);
      expect(server.requests.single.url.queryParameters, {'query': '테헤란로 152'});
      expect(found.first.detail, '강남파이낸스센터');
      expect(found.first.dong, '역삼동');
      expect(found.first.longitude, 127.036508620542);
      expect(found.last.sigungu, isNull);
    });
  });
}

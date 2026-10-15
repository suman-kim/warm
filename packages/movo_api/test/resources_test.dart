import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:movo_api/movo_api.dart';

import 'models_test.dart' show orderJson;
import 'support/fake_server.dart';

// 각 API가 서버가 기대하는 경로·쿼리·본문으로 요청하는지 본다.
// (서버와 실제로 맞는지는 test/integration의 통합 테스트가 확인한다.)

const emptyPage = {'items': <Object>[], 'total': 0, 'page': 1, 'size': 20};

void main() {
  group('고객', () {
    test('요금 견적 — 서비스 종류는 골랐을 때만 보낸다', () async {
      final server = FakeServer(
        (_) async => json({
          'distanceKm': 15.8,
          'durationMinutes': 58,
          'route': [
            {'latitude': 37.5, 'longitude': 127.0364},
            {'latitude': 37.5502, 'longitude': 126.9138},
          ],
          'options': [
            {
              'vehicleType': 'DAMAS',
              'label': '다마스',
              'serviceType': 'QUICK',
              'capacityHint': '박스 10개',
              'maxLoadKg': 400,
              'fare': 33200,
            },
            {
              'vehicleType': 'HELICOPTER',
              'label': '헬기',
              'serviceType': 'QUICK',
              'capacityHint': '급한 서류',
              'maxLoadKg': 100,
              'fare': 990000,
            },
          ],
        }),
        signedInWith: signedIn,
      );
      const pickup = Coordinates(latitude: 37.5, longitude: 127.0364);
      const dropoff = Coordinates(latitude: 37.5502, longitude: 126.9138);

      final estimates = await server.api.orders.estimates(
        pickup: pickup,
        dropoff: dropoff,
      );
      await server.api.orders.estimates(
        pickup: pickup,
        dropoff: dropoff,
        serviceType: ServiceType.freight,
      );

      expect(server.calls.first, 'POST /api/orders/estimates');
      expect(bodyOf(server.requests[0]).keys, ['pickup', 'dropoff']);
      expect(bodyOf(server.requests[1])['serviceType'], 'FREIGHT');
      expect(estimates.route, [pickup, dropoff]);
      expect(estimates.options.first.fare, 33200);
      expect(estimates.options.first.capacityHint, '박스 10개');
      // 이 버전의 앱이 모르는 차종은 unknown — 화면에서 선택지에서 뺀다.
      expect(estimates.options.last.vehicleType, VehicleType.unknown);
    });

    test('평가 — 고르지 않은 태그와 내용은 보내지 않는다', () async {
      final server = FakeServer(
        (_) async => json({
          'rating': 5,
          'tags': <String>[],
          'comment': null,
          'createdAt': '2026-10-13T03:00:00.000Z',
        }, 201),
        signedInWith: signedIn,
      );

      await server.api.orders.review('order-1', rating: 5);
      await server.api.orders.review(
        'order-1',
        rating: 4,
        tags: [ReviewTag.kind, ReviewTag.careful],
        comment: '조심히 옮겨 주셨어요',
      );

      expect(server.calls.first, 'POST /api/orders/order-1/review');
      expect(bodyOf(server.requests[0]), {'rating': 5});
      expect(bodyOf(server.requests[1]), {
        'rating': 4,
        'tags': ['KIND', 'CAREFUL'],
        'comment': '조심히 옮겨 주셨어요',
      });
    });

    test('메시지 — 새 메시지만 받을 때는 마지막 시각을 UTC로 보낸다', () async {
      final server = FakeServer(
        (request) async => request.method == 'GET'
            ? json([
                {
                  'id': 'm-1',
                  'mine': false,
                  'text': '5분 뒤 도착해요',
                  'createdAt': '2026-10-13T01:20:00.000Z',
                },
              ])
            : json({
                'id': 'm-2',
                'mine': true,
                'text': '네',
                'createdAt': '2026-10-13T01:21:00.000Z',
              }, 201),
        signedInWith: signedIn,
      );

      final all = await server.api.orders.messages('order-1');
      await server.api.orders.messages(
        'order-1',
        after: all.last.createdAt.toLocal(),
      );
      final sent = await server.api.orders.sendMessage('order-1', '네');

      expect(server.requests[0].url.query, isEmpty);
      expect(server.requests[1].url.queryParameters, {
        'after': '2026-10-13T01:20:00.000Z',
      });
      expect(bodyOf(server.requests[2]), {'text': '네'});
      expect(all.single.mine, isFalse);
      expect(sent.mine, isTrue);
    });

    test('주문 목록은 상태와 서비스 종류로 거른다', () async {
      final server = FakeServer(
        (request) async => request.url.path.endsWith('/recent-destinations')
            ? json(<Object>[])
            : json({
                ...emptyPage,
                'items': [
                  {...orderJson, 'driverId': 'driver-1', 'driverName': '박기사'},
                ],
                'total': 1,
              }),
        signedInWith: signedIn,
      );

      final page = await server.api.orders.list(
        status: OrderStatus.delivered,
        serviceType: ServiceType.quick,
      );
      await server.api.orders.recentDestinations(limit: 3);

      expect(server.requests[0].url.queryParameters, {
        'status': 'DELIVERED',
        'serviceType': 'QUICK',
        'page': '1',
        'size': '20',
      });
      expect(page.items.single.driverName, '박기사');
      expect(
        server.requests[1].url.toString(),
        '$baseUrl/orders/recent-destinations?limit=3',
      );
    });
  });

  group('기사', () {
    FakeServer driverServer(
      Future<http.Response> Function(http.Request request) handler,
    ) => FakeServer(handler, appRole: UserRole.driver, signedInWith: signedIn);

    test('수입과 배송 내역의 기간은 한국 날짜로 보낸다', () async {
      final server = driverServer(
        (request) async => request.url.path.endsWith('/earnings')
            ? json({
                'from': '2026-10-07',
                'to': '2026-10-14',
                'totalEarnings': 0,
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

    test('길안내 — 지금 위치는 줬을 때만 보낸다', () async {
      final server = driverServer(
        (_) async => json({
          'target': 'DROPOFF',
          'address': '서울 마포구 양화로 45',
          'latitude': 37.5502,
          'longitude': 126.9138,
          'distanceKm': 15.8,
          'durationMinutes': 58,
          'route': <Object>[],
        }),
      );

      await server.api.dispatch.navigation('order-1');
      final route = await server.api.dispatch.navigation(
        'order-1',
        from: const Coordinates(latitude: 37.5, longitude: 127.0364),
      );

      expect(server.calls.first, 'GET /api/dispatch/orders/order-1/navigation');
      expect(server.requests[0].url.query, isEmpty);
      expect(server.requests[1].url.queryParameters, {
        'latitude': '37.5',
        'longitude': '127.0364',
      });
      expect(route.target, NavigationTarget.dropoff);
    });

    test('위치 보고와 차량 변경 신청', () async {
      final server = driverServer(
        (request) async => request.method == 'PUT'
            ? http.Response('', 204)
            : json({
                'id': 'driver-1',
                'userId': 'user-2',
                'vehicleType': 'TRUCK_1T',
                'vehicleNumber': '경기34나5678',
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
        vehicleType: VehicleType.truck1Ton,
        vehicleNumber: '경기 34나 5678',
      );

      expect(server.calls, [
        'PUT /api/drivers/me/location',
        'POST /api/drivers/me/vehicle-change',
      ]);
      expect(bodyOf(server.requests[0]), {
        'latitude': 37.51,
        'longitude': 127.04,
      });
      expect(bodyOf(server.requests[1]), {
        'vehicleType': 'TRUCK_1T',
        'vehicleNumber': '경기 34나 5678',
      });
      // 다시 심사를 받아야 해서 운행할 수 없다.
      expect(driver.status, DriverStatus.pending);
      expect(driver.canAcceptOrders, isFalse);
    });

    test('기사 등록 전에는 내 기사 정보가 null이다', () async {
      final server = driverServer(
        (_) async => error(404, 'DRIVER_NOT_REGISTERED', '기사 등록을 먼저 해 주세요.'),
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
                'accountHolder': '박기사',
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
        accountHolder: '박기사',
      );
      expect(saved.maskedAccountNumber, '••••1024');
      expect(saved.isVerified, isFalse);
      expect(saved.verificationFailureReason, contains('예금주'));
      expect((await server.api.drivers.settlementAccount())?.bankName, '국민');
    });

    test('진행 단계와 추가 요금, 노쇼, 정산 내역', () async {
      final server = driverServer((request) async {
        if (request.url.path.endsWith('/settlements')) {
          final week = {
            'weekStart': '2026-10-12',
            'weekEnd': '2026-10-18',
            'payoutDate': '2026-10-20',
            'status': 'IN_PROGRESS',
            'reason': null,
            'trips': 3,
            'gross': 84000,
            'extraFare': 8000,
            'fee': 8400,
            'compensation': 0,
            'net': 75600,
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
      await server.api.dispatch.pickUp(
        'order-1',
        extraItems: const ExtraItems(overload: 1),
      );
      await server.api.dispatch.reportNoShow('order-1');
      final settlements = await server.api.dispatch.settlements();

      expect(server.calls, [
        'POST /api/dispatch/orders/order-1/depart',
        'POST /api/dispatch/orders/order-1/arrive',
        'POST /api/dispatch/orders/order-1/pickup',
        'POST /api/dispatch/orders/order-1/no-show',
        'GET /api/dispatch/settlements',
      ]);
      expect(bodyOf(server.requests[2]), {
        'overload': 1,
        'bulky': 0,
        'stairs': 0,
      });
      expect(settlements.onHold, isTrue);
      expect(settlements.current.status, SettlementStatus.inProgress);
      expect(settlements.upcoming.single.status, SettlementStatus.hold);
    });
  });

  group('결제', () {
    test('카드를 등록하고 기본 카드를 바꾸고 지운다', () async {
      final card = {
        'id': 'card-1',
        'cardBrand': '신한카드',
        'cardLast4': '4821',
        'cardType': 'CREDIT',
        'isDefault': true,
        'createdAt': '2026-08-03T01:00:00.000Z',
      };
      final server = FakeServer((request) async {
        if (request.method == 'DELETE') return http.Response('', 204);
        if (request.url.path.endsWith('/registration')) {
          return json({
            'provider': 'DEV',
            'storeId': null,
            'channelKey': null,
            'customerKey': 'movo_abc',
          });
        }
        if (request.method == 'GET') return json([card]);
        return json(card, 201);
      }, signedInWith: signedIn);

      final setup = await server.api.paymentMethods.registration();
      final saved = await server.api.paymentMethods.register(
        PaymentMethodsApi.devAuthKey(
          brand: '신한카드',
          last4: '4821',
          type: CardType.credit,
        ),
      );
      await server.api.paymentMethods.setDefault('card-1');
      final cards = await server.api.paymentMethods.list();
      await server.api.paymentMethods.remove('card-1');

      expect(setup.provider, CardProvider.dev);
      expect(bodyOf(server.requests[1]), {'authKey': 'dev:신한카드:4821:CREDIT'});
      expect(saved.label, '신한카드 ••4821');
      expect(cards.single.isDefault, isTrue);
      expect(server.calls, [
        'GET /api/payment-methods/registration',
        'POST /api/payment-methods',
        'POST /api/payment-methods/card-1/default',
        'GET /api/payment-methods',
        'DELETE /api/payment-methods/card-1',
      ]);
    });

    test('다른 카드로 다시 요청하고 영수증을 본다', () async {
      final server = FakeServer((request) async {
        if (request.url.path.endsWith('/receipt')) {
          return json({
            'orderId': 'order-1',
            'code': 'MV261013-ORDE',
            'paidAmount': 56000,
            'supplyAmount': 50909,
            'vat': 5091,
            'refundedAmount': 0,
            'finalAmount': 56000,
            'cancellationFee': 0,
            'card': {'brand': '신한카드', 'last4': '4821', 'type': 'CREDIT'},
            'approvalNumbers': ['30521877', '30522410'],
            'paidAt': '2026-10-13T05:04:00.000Z',
            'additionalPaidAt': '2026-10-13T05:27:00.000Z',
            'refundedAt': null,
          });
        }
        return json(orderJson);
      }, signedInWith: signedIn);

      await server.api.orders.retryPayment('order-1', 'card-2');
      final receipt = await server.api.orders.receipt('order-1');

      expect(bodyOf(server.requests[0]), {'paymentMethodId': 'card-2'});
      expect(receipt.vat + receipt.supplyAmount, receipt.paidAmount);
      expect(receipt.approvalNumbers, hasLength(2));
    });
  });

  group('두 앱 공통', () {
    test('차종 목록', () async {
      final server = FakeServer(
        (_) async => json([
          {
            'type': 'MOTORCYCLE',
            'label': '오토바이',
            'serviceType': 'QUICK',
            'capacityHint': '서류 · 소형 박스',
            'maxLoadKg': 20,
          },
          {
            'type': 'TRUCK_1T',
            'label': '1톤 트럭',
            'serviceType': 'FREIGHT',
            'capacityHint': '가구 · 가전',
            'maxLoadKg': 1000,
          },
        ]),
      );

      final types = await server.api.vehicleTypes.list();

      expect(types.map((type) => type.type), [
        VehicleType.motorcycle,
        VehicleType.truck1Ton,
      ]);
      expect(types.last.serviceType, ServiceType.freight);
      expect(types.last.maxLoadKg, 1000.0);
      expect(types.first.capacityHint, '서류 · 소형 박스');
    });

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
      // 약관 목록은 이 앱에 해당하는 것만 받는다 (기사 운송 약관은 기사 앱에만).
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

    test('자주 쓰는 주소', () async {
      const saved = {
        'id': 'address-1',
        'label': '역삼 사무실',
        'address': '서울 강남구 테헤란로 152',
        'detailAddress': null,
        'sigungu': '강남구',
        'dong': '역삼동',
        'latitude': 37.5,
        'longitude': 127.0364,
        'createdAt': '2026-10-13T01:00:00.000Z',
      };
      final server = FakeServer(
        (request) async => switch (request.method) {
          'GET' => json([saved]),
          'DELETE' => http.Response('', 204),
          _ => json(saved),
        },
        signedInWith: signedIn,
      );
      const input = SavedAddressInput(
        label: '역삼 사무실',
        address: '서울 강남구 테헤란로 152',
        sigungu: '강남구',
        dong: '역삼동',
        latitude: 37.5,
        longitude: 127.0364,
      );
      final addresses = server.api.savedAddresses;

      expect((await addresses.list()).single.label, '역삼 사무실');
      await addresses.add(input);
      await addresses.replace('address-1', input);
      await addresses.remove('address-1');

      expect(server.calls, [
        'GET /api/saved-addresses',
        'POST /api/saved-addresses',
        'PUT /api/saved-addresses/address-1',
        'DELETE /api/saved-addresses/address-1',
      ]);
      expect(bodyOf(server.requests[1]), {
        'label': '역삼 사무실',
        'address': '서울 강남구 테헤란로 152',
        'sigungu': '강남구',
        'dong': '역삼동',
        'latitude': 37.5,
        'longitude': 127.0364,
      });
    });
  });
}

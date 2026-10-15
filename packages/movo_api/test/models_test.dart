import 'package:flutter_test/flutter_test.dart';
import 'package:movo_api/movo_api.dart';

import 'support/fake_server.dart';

/// 서버가 실제로 보내는 주문 응답 모양 (배차 전).
const orderJson = {
  'id': 'order-1',
  'code': 'MV261013-ORDE',
  'customerId': 'user-1',
  'status': 'REQUESTED',
  'serviceType': 'QUICK',
  'vehicleType': 'DAMAS',
  'pickup': {
    'address': '서울 강남구 테헤란로 152',
    'detailAddress': '10층',
    'sigungu': '강남구',
    'dong': '역삼동',
    'latitude': 37.5,
    'longitude': 127.0364,
    'contactName': '김고객',
    'contactPhone': '01011112222',
  },
  'dropoff': {
    'address': '서울 마포구 양화로 45',
    'detailAddress': null,
    'sigungu': null,
    'dong': null,
    'latitude': 37.5502,
    'longitude': 126.9138,
    'contactName': '최수령',
    'contactPhone': '023334444',
  },
  'cargo': {
    'category': 'BOX',
    'weightKg': 45,
    'quantity': 3,
    'description': null,
  },
  'memo': null,
  'distanceKm': 15.8,
  'durationMinutes': 58,
  'baseFare': 33200,
  'loadingHelp': 'NONE',
  'helpFee': 0,
  'pickupAccess': {'floor': 1, 'elevator': true},
  'dropoffAccess': {'floor': 1, 'elevator': true},
  'stairFee': 0,
  'fare': 33200,
  'extraItems': {'overload': 0, 'bulky': 0, 'stairs': 0},
  'extraFee': 0,
  'waitingMinutes': 0,
  'waitingFee': 0,
  'totalFare': 33200,
  'cancellationFee': 0,
  'cancellationFeeNow': 0,
  'noShowAvailableAt': null,
  'paymentFailure': null,
  'driverId': null,
  'scheduledPickupAt': null,
  'estimatedPickupAt': null,
  'estimatedDeliveryAt': null,
  'requestedAt': '2026-10-13T01:07:19.193Z',
  'assignedAt': null,
  'departedAt': null,
  'arrivedAt': null,
  'pickedUpAt': null,
  'deliveredAt': null,
  'cancelledAt': null,
  'noShowAt': null,
  'cancelReason': null,
};

/// 결제 정보 (배차 때 결제했고, 기사 출발 뒤 취소해 일부를 돌려받은 주문).
const paymentJson = {
  'status': 'PARTIALLY_REFUNDED',
  'card': {'brand': '신한카드', 'last4': '4821', 'type': 'CREDIT'},
  'paidAmount': 44000,
  'refundedAmount': 37400,
  'unpaidAmount': 0,
  'paidAt': '2026-10-13T05:04:00.000Z',
  'additionalPaidAt': null,
  'refundedAt': '2026-10-13T05:22:00.000Z',
  'charges': [
    {
      'id': 'charge-1',
      'kind': 'DISPATCH',
      'amount': 44000,
      'status': 'PARTIALLY_CANCELLED',
      'card': {'brand': '신한카드', 'last4': '4821', 'type': 'CREDIT'},
      'approvalNumber': '30521877',
      'approvedAt': '2026-10-13T05:04:00.000Z',
      'failure': null,
      'failedAt': null,
      'cancelledAmount': 37400,
      'cancelledAt': '2026-10-13T05:22:00.000Z',
    },
  ],
  'refunds': [
    {
      'amount': 37400,
      'reason': '고객 취소 · 기사 출발 후 · 취소 수수료를 빼고 환불',
      'automatic': true,
      'refundedAt': '2026-10-13T05:22:00.000Z',
    },
  ],
};

const driverJson = {
  'id': 'driver-1',
  'name': '박기사',
  'phone': '01033334444',
  'vehicleType': 'DAMAS',
  'vehicleNumber': '서울12가3456',
  'rating': 4.5,
  'reviewCount': 2,
};

void main() {
  group('주문', () {
    test('주문 응답을 읽는다 — 정수로 온 숫자와 null 포함', () {
      final order = Order.fromJson(orderJson);

      expect(order.status, OrderStatus.requested);
      expect(order.vehicleType, VehicleType.damas);
      // 서버는 37.5를 37.5로, 45.0을 45로 보낸다.
      expect(order.pickup.latitude, 37.5);
      expect(order.cargo.weightKg, 45.0);
      expect(order.cargo.category, CargoCategory.box);
      expect(order.cargo.description, isNull);
      expect(order.pickup.dong, '역삼동');
      expect(order.dropoff.sigungu, isNull);
      expect(order.durationMinutes, 58);
      expect(order.fare, 33200);
      expect(order.driverId, isNull);
      // 기사 이름은 고객의 주문 목록에서만 온다.
      expect(order.driverName, isNull);
      expect(order.estimatedDeliveryAt, isNull);
      expect(order.requestedAt, DateTime.utc(2026, 10, 13, 1, 7, 19, 193));
      expect(order.isCancellable, isTrue);
      expect(order.isInProgress, isFalse);
    });

    test('기사가 보는 주문에는 기사가 받는 금액이 붙는다', () {
      // 고객의 주문에는 없다.
      expect(Order.fromJson(orderJson).earning, isNull);

      final delivery = Order.fromJson({...orderJson, 'earning': 25200});

      expect(delivery.earning, 25200);
    });

    test('배차된 주문에는 예정 시각이, 목록에는 기사 이름이 붙는다', () {
      final order = Order.fromJson({
        ...orderJson,
        'status': 'ASSIGNED',
        'driverId': 'driver-1',
        'driverName': '박기사',
        'estimatedPickupAt': '2026-10-13T01:15:19.193Z',
        'estimatedDeliveryAt': '2026-10-13T02:13:19.193Z',
      });

      expect(order.driverName, '박기사');
      expect(order.isInProgress, isTrue);
      expect(
        order.estimatedDeliveryAt!.difference(order.estimatedPickupAt!),
        const Duration(minutes: 58),
      );
    });

    test('주문 상세에는 배차된 기사와 평가가 붙는다', () {
      final delivered = OrderDetail.fromJson({
        ...orderJson,
        'status': 'DELIVERED',
        'driverId': 'driver-1',
        'driver': driverJson,
        'review': null,
      });
      final reviewed = OrderDetail.fromJson({
        ...orderJson,
        'status': 'DELIVERED',
        'driver': {...driverJson, 'rating': null, 'reviewCount': 0},
        'review': {
          'rating': 5,
          'tags': ['KIND', 'PUNCTUAL'],
          'comment': null,
          'createdAt': '2026-10-13T03:00:00.000Z',
        },
      });
      final unassigned = OrderDetail.fromJson({
        ...orderJson,
        'driver': null,
        'review': null,
      });

      expect(delivered.driver?.vehicleNumber, '서울12가3456');
      expect(delivered.driver?.rating, 4.5);
      expect(delivered.canReview, isTrue);
      expect(reviewed.driver?.rating, isNull);
      expect(reviewed.review?.rating, 5);
      // 이 버전의 앱이 모르는 태그는 unknown으로 읽는다.
      expect(reviewed.review?.tags, [ReviewTag.kind, ReviewTag.unknown]);
      expect(reviewed.canReview, isFalse);
      expect(unassigned.driver, isNull);
      expect(unassigned.canReview, isFalse);
    });

    test('서버에 새로 생긴 값은 unknown으로 읽고, 요청에는 보낼 수 없다', () {
      final order = Order.fromJson({
        ...orderJson,
        'status': 'RETURNED',
        'vehicleType': 'TRUCK_11T',
        'cargo': {
          ...orderJson['cargo']! as Map<String, dynamic>,
          'category': 'PET',
        },
      });

      expect(order.status, OrderStatus.unknown);
      expect(order.vehicleType, VehicleType.unknown);
      expect(order.cargo.category, CargoCategory.unknown);
      expect(() => VehicleType.unknown.wire, throwsArgumentError);
      expect(() => CargoCategory.unknown.wire, throwsArgumentError);
      expect(VehicleType.truck2HalfTon.wire, 'TRUCK_2_5T');
      expect(VehicleType.truck5Ton.wire, 'TRUCK_5T');
      expect(CargoCategory.furnitureAppliance.wire, 'FURNITURE_APPLIANCE');
      expect(OrderStatus.parse('PICKED_UP'), OrderStatus.pickedUp);
      expect(VehicleType.parse('TRUCK_5T'), VehicleType.truck5Ton);
      // 이 앱이 모르는 차종은 모르는 값으로 읽는다.
      expect(VehicleType.parse('TRUCK_11T'), VehicleType.unknown);
    });

    test('목록 응답과 다음 페이지 여부', () {
      final page = Paged.fromJson({
        'items': [orderJson],
        'total': 21,
        'page': 1,
        'size': 20,
      }, Order.fromJson);

      expect(page.items.single.id, 'order-1');
      expect(page.hasMore, isTrue);
      expect(
        Paged.fromJson({
          'items': <Object>[],
          'total': 20,
          'page': 1,
          'size': 20,
        }, Order.fromJson).hasMore,
        isFalse,
      );
    });

    test('배차 대기 주문에는 동 단위 위치와 흐린 좌표만 있다', () {
      final call = OpenOrder.fromJson({
        'id': 'order-1',
        'serviceType': 'QUICK',
        'vehicleType': 'DAMAS',
        'pickupArea': '강남구 역삼동',
        'pickupLatitude': 37.5,
        'pickupLongitude': 127.04,
        'dropoffArea': '마포구 서교동',
        'dropoffLatitude': 37.55,
        'dropoffLongitude': 126.91,
        'cargo': orderJson['cargo'],
        'distanceKm': 15.8,
        'durationMinutes': 58,
        'baseFare': 23200,
        'loadingHelp': 'TOGETHER',
        'helpFee': 10000,
        'pickupAccess': {'floor': 1, 'elevator': true},
        'dropoffAccess': {'floor': 1, 'elevator': true},
        'stairFee': 0,
        'fare': 33200,
        'scheduledPickupAt': null,
        'requestedAt': '2026-10-13T01:07:19.193Z',
        'distanceFromMeKm': null,
      });

      expect(call.pickupArea, '강남구 역삼동');
      expect(
        call.dropoff,
        const Coordinates(latitude: 37.55, longitude: 126.91),
      );
      expect(call.distanceFromMeKm, isNull);
      expect(call.loadingHelp, LoadingHelp.together);
      expect(call.baseFare + call.helpFee + call.stairFee, call.fare);
    });

    test('요금 내역과 진행 단계, 결제 정보를 읽는다', () {
      final order = Order.fromJson({
        ...orderJson,
        'status': 'CANCELLED',
        'loadingHelp': 'TOGETHER',
        'helpFee': 10000,
        'dropoffAccess': {'floor': 3, 'elevator': false},
        'stairFee': 6000,
        'fare': 49200,
        'totalFare': 49200,
        'cancellationFee': 7400,
        'cancellationFeeNow': null,
        'departedAt': '2026-10-13T05:05:00.000Z',
        'payment': paymentJson,
      });

      expect(order.dropoffAccess.hasStairs, isTrue);
      expect(order.isCancellable, isFalse);
      expect(order.payment?.status, PaymentStatus.partiallyRefunded);
      expect(order.payment?.finalAmount, 6600);
      expect(order.payment?.card?.label, '신한카드 ••4821');
      expect(order.payment?.charges.single.kind, ChargeKind.dispatch);
      expect(order.payment?.refunds.single.automatic, isTrue);
      expect(order.payment?.additionalCharge, isNull);
    });

    test('결제가 안 된 주문에는 사유와 해결 방법이 붙는다', () {
      final failed = Order.fromJson({
        ...orderJson,
        'status': 'PAYMENT_FAILED',
        'paymentFailure': {
          'code': 'LIMIT_EXCEEDED',
          'title': '한도 초과',
          'guidance': '카드 한도가 부족해요.',
        },
      });

      expect(failed.status, OrderStatus.paymentFailed);
      expect(failed.paymentFailure?.title, '한도 초과');
      expect(failed.isInProgress, isFalse);
    });

    test('요금 규칙으로 계단·대기료·취소 수수료를 계산한다', () {
      final rules = ChargeRules.fromJson({
        'helpFees': {'NONE': 0, 'TOGETHER': 10000, 'DRIVER_ONLY': 20000},
        'stairFeePerFloor': 3000,
        'extraUnitPrices': {'overload': 10000, 'bulky': 10000, 'stairs': 3000},
        'freeWaitingMinutes': 10,
        'waitingFeePerMinute': 500,
        'cancellationFeePercent': 15,
        'noShowWaitMinutes': 30,
      });

      expect(rules.helpFeeOf(LoadingHelp.driverOnly), 20000);
      expect(rules.stairFeeOf(3, elevator: false), 6000);
      expect(rules.stairFeeOf(3, elevator: true), 0);
      expect(rules.waitingFeeOf(14), 2000);
      expect(rules.waitingFeeOf(5), 0);
      expect(rules.cancellationFeeOf(44000), 6600);
    });

    test('추적 · 길안내 · 견적의 경로를 좌표 목록으로 읽는다', () {
      final tracking = Tracking.fromJson({
        'status': 'ASSIGNED',
        'driverLocation': {
          'latitude': 37.51,
          'longitude': 127.04,
          'updatedAt': '2026-10-13T01:10:00.000Z',
        },
        'estimatedPickupAt': '2026-10-13T01:18:00.000Z',
        'estimatedDeliveryAt': '2026-10-13T02:16:00.000Z',
      });
      final navigation = NavigationRoute.fromJson({
        'target': 'PICKUP',
        'address': '서울 강남구 테헤란로 152',
        'latitude': 37.5,
        'longitude': 127.0364,
        'distanceKm': 1.5,
        'durationMinutes': 8,
        'route': [
          {'latitude': 37.51, 'longitude': 127.04},
          {'latitude': 37.5, 'longitude': 127.0364},
        ],
      });
      final waiting = Tracking.fromJson({
        'status': 'REQUESTED',
        'driverLocation': null,
        'estimatedPickupAt': null,
        'estimatedDeliveryAt': null,
      });

      expect(
        tracking.driverLocation?.coordinates,
        const Coordinates(latitude: 37.51, longitude: 127.04),
      );
      expect(waiting.driverLocation, isNull);
      expect(navigation.target, NavigationTarget.pickup);
      expect(navigation.route, hasLength(2));
      expect(navigation.route.last, navigation.destination);
    });
  });

  group('기사', () {
    const myDriverJson = {
      'id': 'driver-1',
      'userId': 'user-2',
      'vehicleType': 'DAMAS',
      'vehicleNumber': '서울12가3456',
      'status': 'APPROVED',
      'available': true,
      'rejectionReason': null,
      'approvedAt': '2026-10-13T01:00:00.000Z',
      'createdAt': '2026-10-12T01:00:00.000Z',
      'onlineSince': '2026-10-13T03:00:00.000Z',
      'todayOnlineSeconds': 5400,
    };

    test('내 기사 정보에는 운행 시간이 붙는다', () {
      final driver = Driver.fromJson(myDriverJson);
      final offline = Driver.fromJson({
        ...myDriverJson,
        'available': false,
        'onlineSince': null,
      });

      expect(driver.canAcceptOrders, isTrue);
      expect(driver.todayOnline, const Duration(hours: 1, minutes: 30));
      expect(driver.onlineSince, DateTime.utc(2026, 10, 13, 3));
      expect(offline.canAcceptOrders, isFalse);
      expect(offline.onlineSince, isNull);
    });

    test('올려야 하는 서류를 가려낸다', () {
      DriverDocument document(String status) => DriverDocument.fromJson({
        'type': 'DRIVER_LICENSE',
        'status': status,
        'rejectionReason': status == 'REJECTED' ? '사진이 흐려요' : null,
        'uploadedAt': status == 'NOT_SUBMITTED'
            ? null
            : '2026-10-13T01:00:00.000Z',
      });

      expect(document('NOT_SUBMITTED').needsUpload, isTrue);
      expect(document('REJECTED').needsUpload, isTrue);
      expect(document('REJECTED').rejectionReason, '사진이 흐려요');
      expect(document('SUBMITTED').needsUpload, isFalse);
      expect(document('APPROVED').needsUpload, isFalse);
    });

    test('수입 응답을 읽는다', () {
      final earnings = Earnings.fromJson({
        'from': '2026-10-12',
        'to': '2026-10-13',
        'totalEarnings': 66400,
        'completedCount': 2,
        'cancelledCount': 1,
        'daily': [
          {'date': '2026-10-12', 'earnings': 0, 'completedCount': 0},
          {'date': '2026-10-13', 'earnings': 66400, 'completedCount': 2},
        ],
        'nextSettlement': {'date': '2026-10-16', 'amount': 120000},
      });

      expect(earnings.daily.map((day) => day.earnings), [0, 66400]);
      expect(earnings.nextSettlementDate, '2026-10-16');
      expect(earnings.nextSettlementAmount, 120000);
    });
  });

  group('알림 · 공지 · 약관', () {
    test('알림함', () {
      final inbox = NotificationInbox.fromJson({
        'items': [
          {
            'id': 'n-2',
            'type': 'ORDER_DELIVERED',
            'title': '배송이 완료됐어요',
            'body': '이용해 주셔서 감사해요.',
            'data': {'type': 'ORDER_DELIVERED', 'orderId': 'order-1'},
            'readAt': null,
            'createdAt': '2026-10-13T02:00:00.000Z',
          },
          {
            'id': 'n-1',
            'type': 'DRIVER_APPROVED',
            'title': '가입이 승인됐어요',
            'body': '운행을 시작하면 콜을 받을 수 있어요.',
            'data': {'type': 'DRIVER_APPROVED'},
            'readAt': '2026-10-13T01:30:00.000Z',
            'createdAt': '2026-10-13T01:00:00.000Z',
          },
        ],
        'total': 2,
        'page': 1,
        'size': 20,
        'unreadCount': 1,
      });

      expect(inbox.unreadCount, 1);
      expect(inbox.hasMore, isFalse);
      expect(inbox.items.first.type, NotificationType.orderDelivered);
      expect(inbox.items.first.orderId, 'order-1');
      expect(inbox.items.first.isRead, isFalse);
      expect(inbox.items.last.orderId, isNull);
      expect(inbox.items.last.isRead, isTrue);
    });

    test('공지와 약관은 목록에는 본문이 없고 상세에 있다', () {
      const noticeJson = {
        'id': 'notice-1',
        'title': '추석 연휴 배송 안내',
        'audience': 'ALL',
        'publishedAt': '2026-10-13T01:00:00.000Z',
      };
      const termsJson = {
        'type': 'TERMS',
        'version': '1.0',
        'title': '서비스 이용약관',
        'effectiveAt': '2026-10-01T00:00:00.000Z',
      };

      expect(NoticeSummary.fromJson(noticeJson).audience, NoticeAudience.all);
      expect(Notice.fromJson({...noticeJson, 'body': '내용'}).body, '내용');
      expect(
        LegalDocumentSummary.fromJson(termsJson).type,
        LegalDocumentType.terms,
      );
      final terms = LegalDocument.fromJson({...termsJson, 'body': '제1조'});
      expect(terms.version, '1.0');
      expect(terms.body, '제1조');
    });
  });

  group('입력', () {
    const pickup = WaypointInput(
      address: '서울 강남구 테헤란로 152',
      latitude: 37.5,
      longitude: 127.0364,
      contactName: '김고객',
      contactPhone: '010-1111-2222',
    );

    test('배송 요청 본문 — 비워 둔 선택 항목은 보내지 않는다', () async {
      final server = FakeServer(
        (_) async => json(orderJson, 201),
        signedInWith: signedIn,
      );

      await server.api.orders.create(
        vehicleType: VehicleType.damas,
        pickup: pickup,
        dropoff: pickup,
        cargo: const CargoInput(category: CargoCategory.box, weightKg: 10),
      );
      await server.api.orders.create(
        vehicleType: VehicleType.truck1Ton,
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
        dropoff: pickup,
        cargo: const CargoInput(
          category: CargoCategory.furnitureAppliance,
          weightKg: 400,
          quantity: 2,
          description: '책상과 의자',
        ),
        memo: '조심히',
        // 한국 시간 2030-01-01 09:00
        scheduledPickupAt: DateTime.utc(2030, 1, 1).toLocal(),
      );

      final first = bodyOf(server.requests[0]);
      final second = bodyOf(server.requests[1]);
      expect(first.keys, [
        'vehicleType',
        'pickup',
        'dropoff',
        'cargo',
        'loadingHelp',
        'pickupAccess',
        'dropoffAccess',
      ]);
      expect(first['loadingHelp'], 'NONE');
      expect(first['pickupAccess'], {'floor': 1, 'elevator': true});
      expect(
        (first['pickup'] as Map).keys,
        isNot(containsAll(['detailAddress', 'sigungu', 'dong'])),
      );
      expect(first['cargo'], {'category': 'BOX', 'weightKg': 10.0});
      expect(second['vehicleType'], 'TRUCK_1T');
      expect(second['pickup'], containsPair('sigungu', '성동구'));
      expect(second['pickup'], containsPair('dong', '성수동2가'));
      expect(second['cargo'], {
        'category': 'FURNITURE_APPLIANCE',
        'weightKg': 400.0,
        'quantity': 2,
        'description': '책상과 의자',
      });
      expect(second['memo'], '조심히');
      // 시각은 기기의 시간대와 무관하게 UTC로 보낸다.
      expect(second['scheduledPickupAt'], '2030-01-01T00:00:00.000Z');
    });

    test('저장한 주소와 최근 보낸 곳을 배송 요청의 입력으로 바꾼다', () {
      final saved = SavedAddress.fromJson({
        'id': 'address-1',
        'label': '역삼 사무실',
        'address': '서울 강남구 테헤란로 152',
        'detailAddress': '10층',
        'sigungu': '강남구',
        'dong': '역삼동',
        'latitude': 37.5,
        'longitude': 127.0364,
        'createdAt': '2026-10-13T01:00:00.000Z',
      });
      final recent = RecentDestination.fromJson({
        ...orderJson['dropoff']! as Map<String, dynamic>,
        'lastUsedAt': '2026-10-13T01:07:19.193Z',
      });

      expect(
        saved
            .toWaypoint(contactName: '김고객', contactPhone: '01011112222')
            .toJson(),
        {
          'address': '서울 강남구 테헤란로 152',
          'detailAddress': '10층',
          'sigungu': '강남구',
          'dong': '역삼동',
          'latitude': 37.5,
          'longitude': 127.0364,
          'contactName': '김고객',
          'contactPhone': '01011112222',
        },
      );
      expect(recent.toInput().toJson(), {
        'address': '서울 마포구 양화로 45',
        'latitude': 37.5502,
        'longitude': 126.9138,
        'contactName': '최수령',
        'contactPhone': '023334444',
      });
    });

    test('한국 날짜는 기기의 시간대와 무관하게 구한다', () {
      // 한국 시간 10월 14일 00:30 = UTC 10월 13일 15:30
      final justAfterMidnight = DateTime.utc(2026, 10, 13, 15, 30);

      expect(toKstDate(justAfterMidnight), '2026-10-14');
      expect(toKstDate(justAfterMidnight.toLocal()), '2026-10-14');
      expect(toKstDate(DateTime.utc(2026, 10, 13, 14, 59)), '2026-10-13');
      expect(toKstDate(DateTime.utc(2026, 12, 31, 15)), '2027-01-01');
    });
  });
}

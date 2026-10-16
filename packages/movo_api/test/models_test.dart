import 'package:flutter_test/flutter_test.dart';
import 'package:movo_api/movo_api.dart';

import 'support/fake_server.dart';

/// 서버가 실제로 보내는 배달 응답 모양 (배차 전, 만나서 현금 결제).
const orderJson = {
  'id': 'order-1',
  'code': 'MV261015-ORDE',
  'customerId': 'owner-1',
  'status': 'REQUESTED',
  'storeDelivery': {
    'storeId': 'store-1',
    'foodAmount': 23000,
    'doorPayment': 'CASH',
    'readyAt': '2026-10-15T01:22:19.193Z',
    'collectedMethod': null,
    'collectedAmount': null,
    'cashHandedAt': null,
  },
  'pickup': {
    'address': '서울 강남구 테헤란로 152',
    'detailAddress': '1층',
    'sigungu': '강남구',
    'dong': '역삼동',
    'latitude': 37.5,
    'longitude': 127.0364,
    'contactName': '모보치킨 역삼점',
    'contactPhone': '025551234',
  },
  'dropoff': {
    'address': '서울 강남구 역삼로 180',
    'detailAddress': null,
    'sigungu': null,
    'dong': null,
    'latitude': 37.4955,
    'longitude': 127.0495,
    'contactName': '손님',
    'contactPhone': '050412345678',
  },
  'memo': null,
  'distanceKm': 1.6,
  'durationMinutes': 7,
  'fare': 3500,
  'cancellationFee': 0,
  'cancellationFeeNow': 0,
  'driverId': null,
  'estimatedPickupAt': null,
  'estimatedDeliveryAt': null,
  'requestedAt': '2026-10-15T01:07:19.193Z',
  'assignedAt': null,
  'departedAt': null,
  'arrivedAt': null,
  'pickedUpAt': null,
  'deliveredAt': null,
  'cancelledAt': null,
  'cancelReason': null,
};

const driverJson = {
  'id': 'driver-1',
  'name': '박라이더',
  'phone': '01033334444',
  'vehicleType': 'MOTORCYCLE',
  'vehicleNumber': '서울강남가1234',
};

void main() {
  group('배달', () {
    test('배달 응답을 읽는다 — 정수로 온 숫자와 null 포함', () {
      final order = Order.fromJson(orderJson);

      expect(order.status, OrderStatus.requested);
      // 서버는 37.5를 37.5로, 23000.0을 23000으로 보낸다.
      expect(order.pickup.latitude, 37.5);
      expect(order.pickup.contactName, '모보치킨 역삼점');
      expect(order.dropoff.sigungu, isNull);
      expect(order.storeDelivery.foodAmount, 23000);
      expect(order.storeDelivery.doorPayment, DoorPayment.cash);
      expect(
        order.storeDelivery.readyAt,
        DateTime.utc(2026, 10, 15, 1, 22, 19, 193),
      );
      expect(order.storeDelivery.collectedMethod, isNull);
      expect(order.durationMinutes, 7);
      expect(order.fare, 3500);
      expect(order.driverId, isNull);
      // 라이더 이름은 가게의 배달 목록에서만 온다.
      expect(order.driverName, isNull);
      expect(order.estimatedDeliveryAt, isNull);
      expect(order.requestedAt, DateTime.utc(2026, 10, 15, 1, 7, 19, 193));
      expect(order.isCancellable, isTrue);
      expect(order.isInProgress, isFalse);
    });

    test('라이더가 보는 배달에는 라이더가 받는 금액이 붙는다', () {
      // 가게의 배달에는 없다.
      expect(Order.fromJson(orderJson).earning, isNull);

      final delivery = Order.fromJson({...orderJson, 'earning': 3150});

      expect(delivery.earning, 3150);
    });

    test('배차된 배달에는 예정 시각이, 목록에는 라이더 이름이 붙는다', () {
      final order = Order.fromJson({
        ...orderJson,
        'status': 'ASSIGNED',
        'driverId': 'driver-1',
        'driverName': '박라이더',
        'estimatedPickupAt': '2026-10-15T01:22:19.193Z',
        'estimatedDeliveryAt': '2026-10-15T01:29:19.193Z',
      });

      expect(order.driverName, '박라이더');
      expect(order.isInProgress, isTrue);
      expect(order.isAwaitingPickup, isTrue);
      expect(
        order.estimatedDeliveryAt!.difference(order.estimatedPickupAt!),
        const Duration(minutes: 7),
      );
    });

    test('완료한 배달에는 받은 돈이, 출발 뒤 취소한 배달에는 수수료가 남는다', () {
      final delivered = Order.fromJson({
        ...orderJson,
        'status': 'DELIVERED',
        'cancellationFeeNow': null,
        'storeDelivery': {
          ...orderJson['storeDelivery']! as Map<String, dynamic>,
          'collectedMethod': 'CASH',
          'collectedAmount': 23000,
          'cashHandedAt': '2026-10-15T05:00:00.000Z',
        },
      });
      final cancelled = Order.fromJson({
        ...orderJson,
        'status': 'CANCELLED',
        'cancellationFee': 525,
        'cancellationFeeNow': null,
        'departedAt': '2026-10-15T01:10:00.000Z',
        'cancelReason': '손님이 취소했어요',
      });

      expect(delivered.storeDelivery.collectedMethod, DoorPayment.cash);
      expect(delivered.storeDelivery.collectedAmount, 23000);
      expect(delivered.storeDelivery.cashHandedAt, isNotNull);
      expect(delivered.isCancellable, isFalse);
      expect(cancelled.cancellationFee, 525);
      expect(cancelled.cancelReason, '손님이 취소했어요');
    });

    test('배달 상세에는 배차된 라이더가 붙는다', () {
      final assigned = OrderDetail.fromJson({
        ...orderJson,
        'status': 'ASSIGNED',
        'driverId': 'driver-1',
        'driver': driverJson,
      });
      final unassigned = OrderDetail.fromJson({...orderJson, 'driver': null});

      expect(assigned.driver?.vehicleNumber, '서울강남가1234');
      expect(assigned.driver?.vehicleType, VehicleType.motorcycle);
      expect(unassigned.driver, isNull);
    });

    test('서버에 새로 생긴 값은 unknown으로 읽고, 요청에는 보낼 수 없다', () {
      final order = Order.fromJson({
        ...orderJson,
        'status': 'RETURNED',
        'storeDelivery': {
          ...orderJson['storeDelivery']! as Map<String, dynamic>,
          'doorPayment': 'POINT',
        },
      });

      expect(order.status, OrderStatus.unknown);
      expect(order.storeDelivery.doorPayment, DoorPayment.unknown);
      expect(() => DoorPayment.unknown.wire, throwsArgumentError);
      expect(OrderStatus.parse('PICKED_UP'), OrderStatus.pickedUp);
      expect(VehicleType.parse('MOTORCYCLE'), VehicleType.motorcycle);
      // 이 앱이 모르는 이동 수단은 모르는 값으로 읽는다.
      expect(VehicleType.parse('BICYCLE'), VehicleType.unknown);
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

    test('콜에는 동 단위 위치와 흐린 좌표, 가게 이름과 받을 음식값만 있다', () {
      final call = OpenOrder.fromJson({
        'id': 'order-1',
        'storeDelivery': {
          'storeName': '모보치킨 역삼점',
          'foodAmount': 23000,
          'doorPayment': 'CARD',
          'readyAt': null,
        },
        'pickupArea': '강남구 역삼동',
        'pickupLatitude': 37.5,
        'pickupLongitude': 127.04,
        'dropoffArea': '강남구 역삼동',
        'dropoffLatitude': 37.5,
        'dropoffLongitude': 127.05,
        'distanceKm': 1.6,
        'durationMinutes': 7,
        'fare': 3500,
        'earning': 3150,
        'requestedAt': '2026-10-15T01:07:19.193Z',
        'distanceFromMeKm': null,
      });

      expect(call.pickupArea, '강남구 역삼동');
      expect(
        call.dropoff,
        const Coordinates(latitude: 37.5, longitude: 127.05),
      );
      expect(call.distanceFromMeKm, isNull);
      expect(call.storeDelivery.storeName, '모보치킨 역삼점');
      expect(call.storeDelivery.doorPayment, DoorPayment.card);
      expect(call.earning, 3150);
    });

    test('추적에는 라이더 위치와 다시 어림한 예정 시각이 있다', () {
      final tracking = Tracking.fromJson({
        'status': 'ASSIGNED',
        'driverLocation': {
          'latitude': 37.51,
          'longitude': 127.04,
          'updatedAt': '2026-10-15T01:10:00.000Z',
        },
        'estimatedPickupAt': '2026-10-15T01:18:00.000Z',
        'estimatedDeliveryAt': '2026-10-15T01:25:00.000Z',
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
    });
  });

  group('라이더', () {
    const myDriverJson = {
      'id': 'driver-1',
      'userId': 'user-2',
      'vehicleType': 'MOTORCYCLE',
      'vehicleNumber': '서울강남가1234',
      'status': 'APPROVED',
      'available': true,
      'rejectionReason': null,
      'approvedAt': '2026-10-13T01:00:00.000Z',
      'createdAt': '2026-10-12T01:00:00.000Z',
      'onlineSince': '2026-10-13T03:00:00.000Z',
      'todayOnlineSeconds': 5400,
    };

    test('내 라이더 정보에는 운행 시간이 붙는다', () {
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
        'totalEarnings': 6300,
        'totalSales': 7000,
        'completedCount': 2,
        'cancelledCount': 1,
        'daily': [
          {
            'date': '2026-10-12',
            'earnings': 0,
            'sales': 0,
            'completedCount': 0,
          },
          {
            'date': '2026-10-13',
            'earnings': 6300,
            'sales': 7000,
            'completedCount': 2,
          },
        ],
        'nextSettlement': {'date': '2026-10-16', 'amount': 120000},
      });

      expect(earnings.daily.map((day) => day.earnings), [0, 6300]);
      expect(earnings.totalSales, 7000);
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
            'title': '배달을 마쳤어요',
            'body': '손님에게 음식을 전했어요.',
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
        'title': '추석 연휴 배달 운영 안내',
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
    test('배달 요청 본문 — 비워 둔 선택 항목은 보내지 않는다', () async {
      final server = FakeServer(
        (_) async => json(orderJson, 201),
        signedInWith: signedIn,
      );

      await server.api.deliveries.request(
        const DeliveryRequestInput(
          dropoff: DeliveryDestination(
            address: '서울 강남구 역삼로 180',
            latitude: 37.4955,
            longitude: 127.0495,
          ),
          phone: '0504-1234-5678',
          foodAmount: 0,
          doorPayment: DoorPayment.prepaid,
          readyInMinutes: 0,
          memo: '  ',
        ),
      );
      await server.api.deliveries.request(
        const DeliveryRequestInput(
          dropoff: DeliveryDestination(
            address: '서울 강남구 역삼로 180',
            detailAddress: '101동 1203호',
            sigungu: '강남구',
            dong: '역삼동',
            latitude: 37.4955,
            longitude: 127.0495,
          ),
          phone: '0504-1234-5678',
          foodAmount: 23000,
          doorPayment: DoorPayment.cash,
          readyInMinutes: 15,
          memo: ' 문 앞에 두고 벨 눌러 주세요 ',
        ),
      );

      final first = bodyOf(server.requests[0]);
      final second = bodyOf(server.requests[1]);
      expect(first.keys, [
        'dropoff',
        'foodAmount',
        'doorPayment',
        'readyInMinutes',
      ]);
      expect(first['dropoff'], {
        'address': '서울 강남구 역삼로 180',
        'latitude': 37.4955,
        'longitude': 127.0495,
        'phone': '0504-1234-5678',
      });
      expect(first['doorPayment'], 'PREPAID');
      expect(second['dropoff'], containsPair('sigungu', '강남구'));
      expect(second['dropoff'], containsPair('detailAddress', '101동 1203호'));
      expect(second['doorPayment'], 'CASH');
      expect(second['readyInMinutes'], 15);
      expect(second['memo'], '문 앞에 두고 벨 눌러 주세요');
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

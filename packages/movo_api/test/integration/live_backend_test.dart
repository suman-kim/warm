@Tags(['integration'])
library;

import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:movo_api/movo_api.dart';

// 실제 서버에 붙어 앱이 쓰는 엔드포인트를 모두 부른다. 모델은 손으로 쓴 것이라,
// 서버 응답과 어긋나면 여기서 잡힌다. 서버의 API를 바꿨다면 이 테스트를 돌린다.
//
//   tool/integration_test.sh        (서버가 떠 있어야 한다)
//
// 환경변수가 없으면 건너뛴다. 테스트가 만든 계정·가게·배달은 서버의 DB에 남는다.

final _url = Platform.environment['MOVO_API_URL'];
final _adminEmail = Platform.environment['MOVO_ADMIN_EMAIL'];
final _adminPassword = Platform.environment['MOVO_ADMIN_PASSWORD'];

const _password = 'password123';
var _sequence = 0;

/// 받은 요청을 기록하면서 실제로 보내는 HTTP 클라이언트.
class _RecordingClient extends http.BaseClient {
  final _inner = http.Client();
  final calls = <String>[];

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) {
    calls.add('${request.method} ${request.url.path}');
    return _inner.send(request);
  }

  int count(String suffix) => calls.where((c) => c.endsWith(suffix)).length;
}

class _Session {
  _Session(UserRole role, [AuthTokens? tokens])
    : store = MemoryTokenStore(tokens) {
    api = MovoApi(
      baseUrl: Uri.parse(_url!),
      appRole: role,
      tokenStore: store,
      httpClient: client,
    );
  }

  final MemoryTokenStore store;
  final client = _RecordingClient();
  late final MovoApi api;
  late final String email;

  Future<User> register(String name) {
    final n = ++_sequence;
    final stamp = DateTime.now().microsecondsSinceEpoch;
    email = 'it-$stamp-$n@test.dev';
    return api.auth.register(
      email: email,
      password: _password,
      name: name,
      phone: '0109${(stamp + n) % 10000000}'.padRight(11, '0'),
      agreements: const Agreements(terms: true, privacy: true),
    );
  }

  /// 서류를 모두 올리고 라이더 등록을 신청한다 (심사 대기).
  Future<Driver> applyAsDriver(String number) async {
    for (final type in _documentTypes) {
      await api.drivers.uploadDocument(type, _jpeg);
    }
    return api.drivers.register(vehicleNumber: number);
  }

  /// 승인받고 운행을 시작한 라이더가 된다.
  Future<Driver> goOnline(String number) async {
    final applied = await applyAsDriver(number);
    await _admin('PATCH', '/admin/drivers/${applied.id}/approve');
    return api.drivers.setAvailability(true);
  }

  /// 가게를 등록해 운영자 승인을 받고 [topUp]원을 충전한다.
  Future<Store> openStore({int topUp = 50000}) async {
    final store = await api.stores.register(
      StoreInput(
        name: '모보치킨 역삼점',
        businessNumber: _businessNumber(),
        phone: '02-555-1234',
        address: _storeAddress,
      ),
    );
    await _admin('PATCH', '/admin/stores/${store.id}/approve');
    if (topUp > 0) await api.stores.topUp(topUp);
    return api.stores.mine();
  }
}

final _documentTypes = [...DriverDocumentType.values]
  ..remove(DriverDocumentType.unknown);

/// 내용으로 형식을 알아볼 수 있는 가장 작은 파일들 (서버는 파일 내용으로 형식을 판단한다).
final _jpeg = UploadFile(
  bytes: Uint8List.fromList([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a]),
  filename: 'document.jpg',
);
final _pdf = UploadFile(
  bytes: Uint8List.fromList(utf8.encode('%PDF-1.7\n%%EOF\n')),
  filename: 'document.pdf',
);

String? _adminToken;

/// 운영자 권한으로 부른다 (라이더·가게 심사, 공지·약관 올리기). 운영자 API는 앱이 쓰지 않아
/// 클라이언트에 없다.
Future<Map<String, dynamic>> _admin(
  String method,
  String path, [
  Map<String, Object?>? body,
]) async {
  if (_adminToken == null) {
    final login = await http.post(
      Uri.parse('$_url/auth/login'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'email': _adminEmail, 'password': _adminPassword}),
    );
    _adminToken =
        (jsonDecode(login.body) as Map<String, dynamic>)['accessToken']
            as String;
  }
  final request = http.Request(method, Uri.parse('$_url$path'))
    ..headers['Authorization'] = 'Bearer $_adminToken';
  if (body != null) {
    request
      ..headers['Content-Type'] = 'application/json'
      ..body = jsonEncode(body);
  }
  final response = await http.Response.fromStream(await request.send());
  expect(
    response.statusCode,
    inInclusiveRange(200, 299),
    reason: response.body,
  );
  return response.body.isEmpty
      ? const {}
      : jsonDecode(response.body) as Map<String, dynamic>;
}

Matcher _apiError(String code, [int? status]) {
  var matcher = isA<ApiException>().having((e) => e.code, 'code', code);
  if (status != null) {
    matcher = matcher.having((e) => e.statusCode, 'statusCode', status);
  }
  return matcher;
}

String _plate() => '서울강남가${1000 + (++_sequence)}';

/// 검증 숫자가 맞고 실행마다 겹치지 않는 사업자등록번호.
String _businessNumber() {
  final serial =
      (DateTime.now().microsecondsSinceEpoch + ++_sequence) % 1000000;
  final head = '103${serial.toString().padLeft(6, '0')}';
  final d = head.split('').map(int.parse).toList();
  const weights = [1, 3, 7, 1, 3, 7, 1, 3, 5];
  var sum = 0;
  for (var i = 0; i < 9; i++) {
    sum += weights[i] * d[i];
  }
  sum += d[8] * 5 ~/ 10;
  return '$head${(10 - sum % 10) % 10}';
}

const _storeAddress = StoreAddress(
  address: '서울 강남구 테헤란로 152',
  detailAddress: '1층',
  sigungu: '강남구',
  dong: '역삼동',
  latitude: 37.5,
  longitude: 127.0364,
);
const _storePoint = Coordinates(latitude: 37.5, longitude: 127.0364);

/// 가게(역삼동)에서 약 1.3km 떨어진 손님.
const _home = DeliveryDestination(
  address: '서울 강남구 역삼로 180',
  detailAddress: '101동 1203호',
  sigungu: '강남구',
  dong: '역삼동',
  latitude: 37.4955,
  longitude: 127.0495,
);

/// 선결제 배달 요청 (라이더가 받을 돈이 없다).
DeliveryRequestInput _prepaid({
  DeliveryDestination dropoff = _home,
  String? memo,
}) => DeliveryRequestInput(
  dropoff: dropoff,
  phone: '0504-1234-5678',
  foodAmount: 0,
  doorPayment: DoorPayment.prepaid,
  readyInMinutes: 0,
  memo: memo,
);

void main() {
  final skip = _url == null
      ? 'MOVO_API_URL이 없어요 (tool/integration_test.sh)'
      : null;
  final needsAdmin = _adminEmail == null ? '운영자 계정이 없어요' : skip;

  test('가입 → 내 정보 → 수정, 그리고 다른 앱에서는 로그인되지 않는다', () async {
    final customer = _Session(UserRole.customer);
    final registered = await customer.register('김사장');

    final me = await customer.api.users.me();
    expect(me.id, registered.id);
    expect(me.role, UserRole.customer);
    expect(me.email, customer.email);
    expect(me.marketingAgreed, isFalse);
    expect(me.createdAt.isUtc, isTrue);

    final updated = await customer.api.users.update(
      name: '김지은',
      marketingAgreed: true,
    );
    expect(updated.name, '김지은');
    expect(updated.marketingAgreed, isTrue);
    expect(updated.phone, me.phone);

    final driverApp = _Session(UserRole.driver);
    await expectLater(
      driverApp.api.auth.login(email: customer.email, password: _password),
      throwsA(isA<WrongAppException>()),
    );
    expect(await driverApp.api.auth.isSignedIn(), isFalse);

    await expectLater(
      customer.api.auth.login(email: customer.email, password: 'wrong-pass'),
      throwsA(_apiError(ApiErrorCode.invalidCredentials, 401)),
    );
    Future<User> join({
      String? email,
      String password = _password,
      bool privacy = true,
    }) => _Session(UserRole.customer).api.auth.register(
      email: email ?? 'it-${DateTime.now().microsecondsSinceEpoch}@test.dev',
      password: password,
      name: '가입',
      phone: '01012345678',
      agreements: Agreements(terms: true, privacy: privacy),
    );
    await expectLater(
      join(email: customer.email),
      throwsA(_apiError(ApiErrorCode.emailAlreadyRegistered, 409)),
    );
    await expectLater(
      join(privacy: false),
      throwsA(_apiError(ApiErrorCode.agreementRequired, 400)),
    );
    await expectLater(
      join(password: 'abcdefgh'),
      throwsA(_apiError(ApiErrorCode.weakPassword, 400)),
    );
  }, skip: skip);

  test('견적 → 요청 → 수락 경합 → 추적 → 출발·도착·픽업 → 현금 받고 완료 → 수입', () async {
    final owner = _Session(UserRole.customer);
    final driver = _Session(UserRole.driver);
    final rival = _Session(UserRole.driver);
    await owner.register('김사장');
    await driver.register('박라이더');
    await rival.register('이라이더');

    // 가게: 등록·승인·충전 뒤 견적과 배달 요청
    await expectLater(
      owner.api.stores.mine(),
      throwsA(_apiError(ApiErrorCode.storeNotRegistered, 404)),
    );
    final store = await owner.openStore(topUp: 20000);
    expect(store.status, StoreStatus.approved);
    expect(store.walletBalance, 20000);
    final quote = await owner.api.deliveries.quote(_home);
    expect(quote.fee, greaterThanOrEqualTo(3500));
    expect(quote.walletBalance, 20000);
    final order = await owner.api.deliveries.request(
      DeliveryRequestInput(
        dropoff: _home,
        phone: '0504-1234-5678',
        foodAmount: 23000,
        doorPayment: DoorPayment.cash,
        readyInMinutes: 0,
        memo: '문 앞에 두고 벨 눌러 주세요',
      ),
    );
    expect(order.status, OrderStatus.requested);
    // 견적에서 본 대행료·거리·시간 그대로 요청된다.
    expect(order.fare, quote.fee);
    expect(order.distanceKm, quote.distanceKm);
    expect(order.durationMinutes, quote.durationMinutes);
    expect(order.pickup.contactName, '모보치킨 역삼점');
    expect(order.pickup.contactPhone, '025551234');
    expect(order.dropoff.contactName, '손님');
    expect(order.dropoff.contactPhone, '050412345678');
    expect(order.storeDelivery.storeId, store.id);
    expect(order.storeDelivery.foodAmount, 23000);
    expect(order.estimatedDeliveryAt, isNull);
    expect((await owner.api.stores.mine()).walletBalance, 20000 - order.fare);
    final waiting = await owner.api.orders.tracking(order.id);
    expect(waiting.status, OrderStatus.requested);
    expect(waiting.driverLocation, isNull);

    // 라이더: 서류를 올려야 신청할 수 있고, 심사 전에는 운행도 콜 조회도 안 된다
    expect(await driver.api.drivers.me(), isNull);
    await expectLater(
      driver.api.dispatch.openOrders(),
      throwsA(_apiError(ApiErrorCode.driverNotRegistered, 403)),
    );
    await expectLater(
      driver.api.drivers.register(vehicleNumber: '서울 강남 가 3456'),
      throwsA(_apiError(ApiErrorCode.documentsRequired, 409)),
    );
    final applied = await driver.applyAsDriver('서울 강남 가 3456');
    expect(applied.status, DriverStatus.pending);
    expect(applied.vehicleType, VehicleType.motorcycle);
    expect(applied.vehicleNumber, '서울강남가3456');
    expect(applied.canAcceptOrders, isFalse);
    expect(applied.todayOnline, Duration.zero);
    await expectLater(
      driver.api.drivers.setAvailability(true),
      throwsA(_apiError(ApiErrorCode.driverNotApproved, 409)),
    );
    await expectLater(
      driver.api.drivers.register(vehicleNumber: '서울강남가3456'),
      throwsA(_apiError(ApiErrorCode.driverAlreadyRegistered, 409)),
    );

    // 운영자 승인 뒤 운행 시작
    await _admin('PATCH', '/admin/drivers/${applied.id}/approve');
    expect((await driver.api.drivers.me())?.status, DriverStatus.approved);
    await expectLater(
      driver.api.dispatch.openOrders(),
      throwsA(_apiError(ApiErrorCode.driverNotAvailable, 403)),
    );
    final online = await driver.api.drivers.setAvailability(true);
    expect(online.canAcceptOrders, isTrue);
    expect(online.onlineSince, isNotNull);
    await rival.goOnline(_plate());

    // 콜: 위치는 동 단위까지만, 가게 이름과 받을 음식값은 미리 본다.
    // 위치를 보고하면 가게까지의 거리가 붙는다.
    final open = await driver.api.dispatch.openOrders(size: 100);
    final listed = open.items.firstWhere((item) => item.id == order.id);
    expect(listed.pickupArea, '강남구 역삼동');
    expect(listed.pickup, isNot(_storePoint));
    expect(listed.fare, order.fare);
    expect(listed.earning, lessThan(order.fare));
    expect(listed.storeDelivery.storeName, '모보치킨 역삼점');
    expect(listed.storeDelivery.foodAmount, 23000);
    expect(listed.storeDelivery.doorPayment, DoorPayment.cash);
    expect(listed.distanceFromMeKm, isNull);
    await driver.api.drivers.reportLocation(
      const Coordinates(latitude: 37.51, longitude: 127.04),
    );
    final call = await driver.api.dispatch.openOrder(order.id);
    expect(call.distanceFromMeKm, closeTo(1.2, 0.11));

    // 수락. 늦은 라이더는 409.
    final accepted = await driver.api.dispatch.accept(order.id);
    expect(accepted.status, OrderStatus.assigned);
    expect(accepted.driverId, applied.id);
    expect(accepted.earning, listed.earning);
    expect(accepted.dropoff.detailAddress, '101동 1203호');
    expect(accepted.memo, '문 앞에 두고 벨 눌러 주세요');
    expect(accepted.estimatedPickupAt, isNotNull);
    expect(
      accepted.estimatedDeliveryAt!.difference(accepted.estimatedPickupAt!),
      Duration(minutes: order.durationMinutes),
    );
    await expectLater(
      rival.api.dispatch.accept(order.id),
      throwsA(
        isA<ApiException>()
            .having((e) => e.statusCode, 'statusCode', 409)
            .having(
              (e) => e.code,
              'code',
              anyOf(ApiErrorCode.orderNotOpen, ApiErrorCode.staleAggregate),
            ),
      ),
    );
    await expectLater(
      rival.api.dispatch.openOrder(order.id),
      throwsA(_apiError(ApiErrorCode.orderNotOpen, 409)),
    );

    // 가게: 라이더 위치와 예정 시각
    final tracking = await owner.api.orders.tracking(order.id);
    expect(tracking.status, OrderStatus.assigned);
    expect(
      tracking.driverLocation?.coordinates,
      const Coordinates(latitude: 37.51, longitude: 127.04),
    );
    expect(
      tracking.estimatedDeliveryAt!.isAfter(tracking.estimatedPickupAt!),
      isTrue,
    );

    // 순서를 건너뛸 수 없고, 남의 배달은 진행할 수 없다
    await expectLater(
      driver.api.dispatch.complete(order.id),
      throwsA(_apiError(ApiErrorCode.orderNotInTransit, 409)),
    );
    await expectLater(
      rival.api.dispatch.pickUp(order.id),
      throwsA(_apiError(ApiErrorCode.notAssignedDriver, 403)),
    );
    final departed = await driver.api.dispatch.depart(order.id);
    expect(departed.status, OrderStatus.departed);
    // 출발한 뒤 취소하면 대행료의 15%가 수수료로 빠진다.
    expect(
      (await owner.api.orders.get(order.id)).order.cancellationFeeNow,
      (order.fare * 15 / 100).round(),
    );
    expect(
      (await driver.api.dispatch.arrive(order.id)).status,
      OrderStatus.arrived,
    );
    expect(
      (await driver.api.dispatch.pickUp(order.id)).status,
      OrderStatus.pickedUp,
    );
    await expectLater(
      owner.api.orders.cancel(order.id, reason: '손님 변심'),
      throwsA(_apiError(ApiErrorCode.orderNotCancellable, 409)),
    );
    // 만나서 결제는 받은 방식과 금액이 있어야 완료된다.
    await expectLater(
      driver.api.dispatch.complete(order.id),
      throwsA(_apiError(ApiErrorCode.collectionRequired, 400)),
    );
    final delivered = await driver.api.dispatch.complete(
      order.id,
      collectedMethod: DoorPayment.cash,
      collectedAmount: 23000,
    );
    expect(delivered.status, OrderStatus.delivered);
    expect(delivered.deliveredAt, isNotNull);
    expect(delivered.estimatedDeliveryAt, isNull);
    expect(delivered.storeDelivery.collectedMethod, DoorPayment.cash);
    expect(delivered.storeDelivery.collectedAmount, 23000);

    // 가게: 상세에서 라이더를, 목록에서 라이더 이름을 본다
    final detail = await owner.api.orders.get(order.id);
    expect(detail.order.status, OrderStatus.delivered);
    expect(detail.driver?.name, '박라이더');
    expect(detail.driver?.vehicleNumber, '서울강남가3456');
    final now = DateTime.now();
    final mine = await owner.api.orders.list(
      status: OrderStatus.delivered,
      from: now,
      to: now,
    );
    expect(mine.items.map((o) => o.id), [order.id]);
    expect(mine.items.single.driverName, '박라이더');
    expect(mine.hasMore, isFalse);

    // 가게의 알림함에 진행 알림이 쌓였다 (발송은 응답 뒤에 돌아서 잠깐 기다린다).
    late NotificationInbox inbox;
    for (var attempt = 0; attempt < 20; attempt++) {
      inbox = await owner.api.notifications.list();
      if (inbox.total >= 5) break;
      await Future<void>.delayed(const Duration(milliseconds: 100));
    }
    expect(inbox.items.map((n) => n.type), [
      NotificationType.orderDelivered,
      NotificationType.orderPickedUp,
      NotificationType.orderArrived,
      NotificationType.orderDeparted,
      NotificationType.orderAssigned,
    ]);
    expect(inbox.items.every((n) => n.orderId == order.id), isTrue);
    expect(inbox.unreadCount, 5);
    await owner.api.notifications.markRead(inbox.items.first.id);
    expect(await owner.api.notifications.unreadCount(), 4);
    await owner.api.notifications.markAllRead();
    expect(await owner.api.notifications.unreadCount(), 0);

    // 라이더: 오늘 수입과 배달 내역. 남의 배달 상세는 볼 수 없다.
    final earnings = await driver.api.dispatch.earnings(
      from: now.subtract(const Duration(days: 6)),
      to: now,
    );
    expect(earnings.daily, hasLength(7));
    expect(earnings.daily.last.date, toKstDate(now));
    expect(earnings.daily.last.earnings, delivered.earning);
    expect(earnings.daily.last.sales, order.fare);
    expect(earnings.totalEarnings, delivered.earning);
    expect(earnings.completedCount, 1);
    expect(earnings.nextSettlementDate, matches(r'^\d{4}-\d{2}-\d{2}$'));
    await expectLater(
      driver.api.dispatch.earnings(
        from: now.subtract(const Duration(days: 200)),
        to: now,
      ),
      throwsA(_apiError(ApiErrorCode.periodTooLong, 400)),
    );
    final deliveries = await driver.api.dispatch.myOrders(
      status: OrderStatus.delivered,
      from: now,
      to: now,
    );
    expect(deliveries.items.single.id, order.id);
    expect((await driver.api.orders.get(order.id)).driver?.id, applied.id);
    await expectLater(
      rival.api.orders.get(order.id),
      throwsA(_apiError(ApiErrorCode.orderNotFound, 404)),
    );
    final offline = await driver.api.drivers.setAvailability(false);
    expect(offline.onlineSince, isNull);
  }, skip: needsAdmin);

  test('라이더가 오기 전에 취소하면 대행료를 모두 돌려받는다. 요청할 수 없는 경우들', () async {
    final owner = _Session(UserRole.customer);
    await owner.register('김사장');
    final store = await owner.openStore(topUp: 10000);
    final readyLater = DateTime.now().add(const Duration(minutes: 20));

    final order = await owner.api.deliveries.request(
      DeliveryRequestInput(
        dropoff: _home,
        phone: '0504-1234-5678',
        foodAmount: 18000,
        doorPayment: DoorPayment.card,
        readyInMinutes: 20,
      ),
    );
    expect(
      order.storeDelivery.readyAt?.difference(readyLater).inSeconds.abs(),
      lessThan(60),
    );
    expect(order.isCancellable, isTrue);
    expect(order.cancellationFeeNow, 0);

    final cancelled = await owner.api.orders.cancel(
      order.id,
      reason: '손님 주문 취소',
    );
    expect(cancelled.status, OrderStatus.cancelled);
    expect(cancelled.cancelReason, '손님 주문 취소');
    expect(cancelled.cancelledAt, isNotNull);
    expect(cancelled.cancellationFee, 0);
    expect(cancelled.isCancellable, isFalse);
    final wallet = await owner.api.stores.wallet();
    expect(wallet.balance, store.walletBalance);
    expect(wallet.items.first.kind, WalletEntryKind.refund);
    expect(wallet.items.first.orderId, order.id);

    await expectLater(
      owner.api.deliveries.request(
        const DeliveryRequestInput(
          dropoff: _home,
          phone: '0504-1234-5678',
          foodAmount: 0,
          doorPayment: DoorPayment.cash,
          readyInMinutes: 0,
        ),
      ),
      throwsA(_apiError(ApiErrorCode.foodAmountRequired, 400)),
    );
    await expectLater(
      owner.api.deliveries.quote(
        const DeliveryDestination(
          address: '경기 의정부시 시민로 1',
          latitude: 37.75,
          longitude: 127.1,
        ),
      ),
      throwsA(_apiError(ApiErrorCode.deliveryTooFar, 400)),
    );
    // 충전금보다 대행료가 크면 요청할 수 없다.
    final poor = _Session(UserRole.customer);
    await poor.register('최사장');
    await poor.openStore(topUp: 0);
    await expectLater(
      poor.api.deliveries.request(_prepaid()),
      throwsA(_apiError(ApiErrorCode.insufficientWalletBalance, 409)),
    );
  }, skip: needsAdmin);

  test('서류를 올리고 내려받는다. 반려되면 그 서류만 다시 올려 재신청한다', () async {
    final driver = _Session(UserRole.driver);
    await driver.register('박라이더');
    final documents = driver.api.drivers;

    final initial = await documents.documents();
    expect(initial.map((d) => d.type), _documentTypes);
    expect(initial.every((d) => d.needsUpload), isTrue);

    // 서버는 파일 내용으로 형식을 판단한다.
    await expectLater(
      documents.uploadDocument(
        DriverDocumentType.driverLicense,
        UploadFile(
          bytes: Uint8List.fromList(utf8.encode('<html></html>')),
          filename: 'license.jpg',
        ),
      ),
      throwsA(_apiError(ApiErrorCode.unsupportedDocumentType, 400)),
    );
    final afterFirst = await documents.uploadDocument(
      DriverDocumentType.vehicleRegistration,
      _pdf,
    );
    expect(afterFirst.map((d) => d.status), [
      DriverDocumentStatus.notSubmitted,
      DriverDocumentStatus.submitted,
      DriverDocumentStatus.notSubmitted,
    ]);
    final file = await documents.documentFile(
      DriverDocumentType.vehicleRegistration,
    );
    expect(file.contentType, 'application/pdf');
    expect(file.bytes, _pdf.bytes);
    await expectLater(
      documents.documentFile(DriverDocumentType.driverLicense),
      throwsA(isA<ApiException>().having((e) => e.statusCode, 'status', 404)),
    );

    final applied = await driver.applyAsDriver(_plate());
    await _admin('PATCH', '/admin/drivers/${applied.id}/reject', {
      'reason': '면허증 사진이 흐려요',
      'rejectedDocuments': ['DRIVER_LICENSE'],
    });
    final rejected = await documents.me();
    expect(rejected?.status, DriverStatus.rejected);
    expect(rejected?.rejectionReason, '면허증 사진이 흐려요');
    final afterReject = await documents.documents();
    expect(afterReject.where((d) => d.needsUpload).map((d) => d.type), [
      DriverDocumentType.driverLicense,
    ]);
    expect(afterReject.first.rejectionReason, '면허증 사진이 흐려요');
    await expectLater(
      documents.register(vehicleNumber: applied.vehicleNumber),
      throwsA(_apiError(ApiErrorCode.documentsRequired, 409)),
    );

    await documents.uploadDocument(DriverDocumentType.driverLicense, _jpeg);
    final reapplied = await documents.register(
      vehicleNumber: applied.vehicleNumber,
    );
    expect(reapplied.id, applied.id);
    expect(reapplied.status, DriverStatus.pending);
    expect(reapplied.rejectionReason, isNull);

    // 심사 결과는 알림함에 남는다.
    final inbox = await driver.api.notifications.list();
    expect(inbox.items.first.type, NotificationType.driverRejected);
    expect(inbox.items.first.body, '면허증 사진이 흐려요');
  }, skip: needsAdmin);

  test('오토바이 변경은 운행을 끈 뒤에 신청하고, 다시 승인받아야 한다', () async {
    final driver = _Session(UserRole.driver);
    await driver.register('박라이더');
    await driver.goOnline(_plate());

    await expectLater(
      driver.api.drivers.requestVehicleChange(vehicleNumber: '경기 수원 바 1234'),
      throwsA(_apiError(ApiErrorCode.driverIsOnline, 409)),
    );
    await driver.api.drivers.setAvailability(false);
    final changed = await driver.api.drivers.requestVehicleChange(
      vehicleNumber: '경기 수원 바 1234',
    );

    expect(changed.status, DriverStatus.pending);
    expect(changed.vehicleType, VehicleType.motorcycle);
    expect(changed.vehicleNumber, '경기수원바1234');
    await expectLater(
      driver.api.drivers.setAvailability(true),
      throwsA(_apiError(ApiErrorCode.driverNotApproved, 409)),
    );
  }, skip: needsAdmin);

  test('정산 계좌를 등록하면 끝 네 자리만 돌려받는다', () async {
    final driver = _Session(UserRole.driver);
    await driver.register('박라이더');
    await driver.applyAsDriver(_plate());

    expect(await driver.api.drivers.settlementAccount(), isNull);
    final saved = await driver.api.drivers.saveSettlementAccount(
      bankName: '국민',
      accountNumber: '123456-78-901024',
      accountHolder: '박라이더',
    );
    expect(saved.maskedAccountNumber, '••••1024');
    expect((await driver.api.drivers.settlementAccount())?.bankName, '국민');
    await expectLater(
      driver.api.drivers.saveSettlementAccount(
        bankName: '국민',
        accountNumber: '12-34',
        accountHolder: '박라이더',
      ),
      throwsA(_apiError(ApiErrorCode.validationFailed, 400)),
    );
  }, skip: skip);

  test('푸시 기기를 등록·해제하고, 푸시 받기를 켜고 끈다', () async {
    final customer = _Session(UserRole.customer);
    await customer.register('김사장');
    final token = 'fake:token-${DateTime.now().microsecondsSinceEpoch}';

    await customer.api.pushDevices.register(
      token: token,
      platform: PushPlatform.ios,
    );
    await customer.api.pushDevices.register(
      token: token,
      platform: PushPlatform.android,
    );
    await customer.api.pushDevices.unregister(token);
    await customer.api.pushDevices.unregister(token);
    expect(customer.client.count('/push-devices'), 2);

    final notifications = customer.api.notifications;
    expect(await notifications.isPushEnabled(), isTrue);
    expect(await notifications.setPushEnabled(false), isFalse);
    expect(await notifications.isPushEnabled(), isFalse);
    final empty = await notifications.list();
    expect(empty.items, isEmpty);
    expect(empty.unreadCount, 0);
  }, skip: skip);

  test('최근 배달한 손님 주소를 주소별로 한 번씩 받는다', () async {
    final owner = _Session(UserRole.customer);
    await owner.register('김사장');
    await owner.openStore();

    expect(await owner.api.orders.recentDestinations(), isEmpty);
    final first = await owner.api.deliveries.request(_prepaid());
    final recent = await owner.api.orders.recentDestinations();
    expect(recent.single.waypoint.address, _home.address);
    expect(recent.single.waypoint.detailAddress, _home.detailAddress);
    expect(recent.single.waypoint.contactPhone, '050412345678');
    final again = await owner.api.deliveries.request(_prepaid(memo: '또 왔어요'));
    // 같은 곳으로 두 번 보내도 한 번만 나온다.
    expect(await owner.api.orders.recentDestinations(), hasLength(1));

    for (final each in [first, again]) {
      await owner.api.orders.cancel(each.id);
    }
  }, skip: needsAdmin);

  test('공지는 내 앱 대상만 보이고, 약관과 고객센터는 로그인 없이 본다', () async {
    final stamp = DateTime.now().microsecondsSinceEpoch;
    final forCustomers = await _admin('POST', '/admin/notices', {
      'title': '사장님 공지 $stamp',
      'body': '첫 충전은 3,000원을 더 드려요.',
      'audience': 'CUSTOMER',
    });
    final forDrivers = await _admin('POST', '/admin/notices', {
      'title': '라이더 공지 $stamp',
      'body': '정산일이 금요일로 바뀌어요.',
      'audience': 'DRIVER',
    });
    await _admin('POST', '/admin/legal-documents', {
      'type': 'TERMS',
      'version': '${stamp % 1000000}',
      'title': '서비스 이용약관',
      'body': '제1조 (목적) $stamp',
    });
    final customer = _Session(UserRole.customer);
    await customer.register('김사장');

    final notices = await customer.api.notices.list(size: 100);
    final titles = notices.items.map((notice) => notice.title);
    expect(titles, contains('사장님 공지 $stamp'));
    expect(titles, isNot(contains('라이더 공지 $stamp')));
    final notice = await customer.api.notices.get(forCustomers['id'] as String);
    expect(notice.body, '첫 충전은 3,000원을 더 드려요.');
    expect(notice.audience, NoticeAudience.customer);
    await expectLater(
      customer.api.notices.get(forDrivers['id'] as String),
      throwsA(_apiError(ApiErrorCode.noticeNotFound, 404)),
    );

    // 가입 전(로그인하지 않은 앱)에서도 약관과 고객센터를 본다.
    final guest = _Session(UserRole.customer).api;
    final documents = await guest.legal.documents();
    expect(documents.map((d) => d.type), contains(LegalDocumentType.terms));
    expect(
      documents.map((d) => d.type),
      isNot(contains(LegalDocumentType.unknown)),
    );
    final terms = await guest.legal.document(LegalDocumentType.terms);
    expect(terms?.body, '제1조 (목적) $stamp');
    expect(terms?.effectiveAt.isUtc, isTrue);
    final contact = await guest.support.contact();
    expect([
      contact.phone,
      contact.email,
      contact.hours,
      contact.kakaoChannelUrl,
    ], everyElement(anyOf(isNull, isA<String>())));

    for (final each in [forCustomers, forDrivers]) {
      await _admin('DELETE', '/admin/notices/${each['id']}');
    }
  }, skip: needsAdmin);

  test('비밀번호 찾기를 요청하고, 틀린 코드는 거절된다', () async {
    final customer = _Session(UserRole.customer);
    await customer.register('김사장');
    final guest = _Session(UserRole.customer).api.auth;

    await guest.requestPasswordReset(email: customer.email);
    // 가입하지 않은 이메일에도 똑같이 답한다.
    await guest.requestPasswordReset(email: 'nobody-${customer.email}');
    // 맞는 코드는 메일로만 간다 (개발 서버에서는 서버 로그에 남는다) — 여기서는 틀린 코드만 본다.
    await expectLater(
      guest.confirmPasswordReset(
        email: customer.email,
        code: '000000',
        newPassword: 'newpass456',
      ),
      throwsA(_apiError(ApiErrorCode.invalidResetCode, 400)),
    );
    await expectLater(
      guest.confirmPasswordReset(
        email: customer.email,
        code: '000000',
        newPassword: 'abcdefgh',
      ),
      throwsA(_apiError(ApiErrorCode.weakPassword, 400)),
    );
    expect(
      (await guest.login(email: customer.email, password: _password)).email,
      customer.email,
    );
  }, skip: skip);

  test('탈퇴하면 로그아웃되고, 같은 이메일로 다시 가입할 수 있다', () async {
    final customer = _Session(UserRole.customer);
    final before = await customer.register('김사장');
    await customer.openStore();
    final order = await customer.api.deliveries.request(_prepaid());

    await expectLater(
      customer.api.auth.withdraw(password: 'wrong-pass1'),
      throwsA(_apiError(ApiErrorCode.passwordMismatch, 400)),
    );
    await expectLater(
      customer.api.auth.withdraw(password: _password),
      throwsA(_apiError(ApiErrorCode.orderInProgress, 409)),
    );
    expect(await customer.api.auth.isSignedIn(), isTrue);

    await customer.api.orders.cancel(order.id);
    await customer.api.auth.withdraw(password: _password);

    expect(await customer.api.auth.isSignedIn(), isFalse);
    final guest = _Session(UserRole.customer).api.auth;
    await expectLater(
      guest.login(email: customer.email, password: _password),
      throwsA(isA<ApiException>().having((e) => e.statusCode, 'status', 401)),
    );
    final again = await guest.register(
      email: customer.email,
      password: _password,
      name: '김사장',
      phone: '01012345678',
      agreements: const Agreements(terms: true, privacy: true),
    );
    expect(again.id, isNot(before.id));
  }, skip: needsAdmin);

  test('액세스 토큰이 만료돼도 호출이 이어지고, 갱신은 한 번만 한다', () async {
    final original = _Session(UserRole.customer);
    await original.register('김사장');
    final issued = (await original.store.read())!;

    // 앱을 다시 켰는데 액세스 토큰이 만료돼 있는 상황.
    final restarted = _Session(
      UserRole.customer,
      AuthTokens(accessToken: 'expired', refreshToken: issued.refreshToken),
    );
    final users = await Future.wait([
      for (var i = 0; i < 5; i++) restarted.api.users.me(),
    ]);

    expect(users.map((u) => u.email).toSet(), {original.email});
    expect(restarted.client.count('/auth/refresh'), 1);
    final rotated = (await restarted.store.read())!;
    expect(rotated.refreshToken, isNot(issued.refreshToken));
    expect(rotated.accessToken, isNot('expired'));

    // 이미 쓴 리프레시 토큰으로는 다시 갱신할 수 없다 — 로그인이 풀린다.
    final stale = _Session(
      UserRole.customer,
      AuthTokens(accessToken: 'expired', refreshToken: issued.refreshToken),
    );
    final expired = Completer<void>();
    stale.api.sessionExpired.listen((_) => expired.complete());
    await expectLater(
      stale.api.users.me(),
      throwsA(isA<SessionExpiredException>()),
    );
    await expired.future.timeout(const Duration(seconds: 1));
    expect(await stale.store.read(), isNull);
    expect(await stale.api.auth.restoreSession(), isNull);

    // 로그아웃하면 그 리프레시 토큰도 폐기된다.
    expect((await restarted.api.auth.restoreSession())?.email, original.email);
    await restarted.api.auth.logout();
    expect(await restarted.api.auth.isSignedIn(), isFalse);
    final afterLogout = _Session(
      UserRole.customer,
      AuthTokens(accessToken: 'expired', refreshToken: rotated.refreshToken),
    );
    expect(await afterLogout.api.auth.restoreSession(), isNull);
  }, skip: skip);

  test('서버가 없는 주소면 NetworkException', () async {
    final api = MovoApi(
      baseUrl: Uri.parse('http://127.0.0.1:9/api'),
      appRole: UserRole.customer,
      tokenStore: MemoryTokenStore(),
      timeout: const Duration(seconds: 3),
    );

    await expectLater(api.support.contact(), throwsA(isA<NetworkException>()));
  }, skip: skip);
}

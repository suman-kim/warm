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
// 환경변수가 없으면 건너뛴다. 테스트가 만든 계정과 주문은 서버의 DB에 남는다.

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

  /// 서류를 모두 올리고 기사 등록을 신청한다 (심사 대기).
  Future<Driver> applyAsDriver(VehicleType vehicleType, String number) async {
    for (final type in _documentTypes) {
      await api.drivers.uploadDocument(type, _jpeg);
    }
    return api.drivers.register(
      vehicleType: vehicleType,
      vehicleNumber: number,
    );
  }

  /// 승인받고 운행을 시작한 기사가 된다.
  Future<Driver> goOnline(VehicleType vehicleType, String number) async {
    final applied = await applyAsDriver(vehicleType, number);
    await _admin('PATCH', '/admin/drivers/${applied.id}/approve');
    return api.drivers.setAvailability(true);
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

/// 운영자 권한으로 부른다 (기사 심사, 공지·약관 올리기). 운영자 API는 앱이 쓰지 않아
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

String _plate() => '서울${10 + _sequence}가${1000 + (++_sequence)}';

const _pickupPoint = Coordinates(latitude: 37.5, longitude: 127.0364);
const _dropoffPoint = Coordinates(latitude: 37.5502, longitude: 126.9138);
const _pickup = WaypointInput(
  address: '서울 강남구 테헤란로 152',
  detailAddress: '10층',
  sigungu: '강남구',
  dong: '역삼동',
  latitude: 37.5,
  longitude: 127.0364,
  contactName: '김고객',
  contactPhone: '010-1111-2222',
);
const _dropoff = WaypointInput(
  address: '서울 마포구 양화로 45',
  sigungu: '마포구',
  dong: '서교동',
  latitude: 37.5502,
  longitude: 126.9138,
  contactName: '최수령',
  contactPhone: '02-333-4444',
);
const _boxes = CargoInput(
  category: CargoCategory.box,
  weightKg: 45,
  quantity: 3,
);

void main() {
  final skip = _url == null
      ? 'MOVO_API_URL이 없어요 (tool/integration_test.sh)'
      : null;
  final needsAdmin = _adminEmail == null ? '운영자 계정이 없어요' : skip;

  test('가입 → 내 정보 → 수정, 그리고 다른 앱에서는 로그인되지 않는다', () async {
    final customer = _Session(UserRole.customer);
    final registered = await customer.register('김고객');

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

  test('차종 목록 — 이 버전의 앱이 아는 차종과 정확히 같다', () async {
    final types = await _Session(UserRole.customer).api.vehicleTypes.list();

    expect(types.map((t) => t.type), isNot(contains(VehicleType.unknown)));
    expect(
      types.map((t) => t.type).toSet(),
      {...VehicleType.values}..remove(VehicleType.unknown),
    );
    expect(
      types.every(
        (t) =>
            t.label.isNotEmpty && t.capacityHint.isNotEmpty && t.maxLoadKg > 0,
      ),
      isTrue,
    );
  }, skip: skip);

  test('견적 → 요청 → 수락 경합 → 추적·길안내·메시지 → 완료 → 평가 → 수입', () async {
    final customer = _Session(UserRole.customer);
    final driver = _Session(UserRole.driver);
    final rival = _Session(UserRole.driver);
    await customer.register('김고객');
    await driver.register('박기사');
    await rival.register('이기사');

    // 고객: 견적과 배송 요청
    final estimates = await customer.api.orders.estimates(
      pickup: _pickupPoint,
      dropoff: _dropoffPoint,
    );
    expect(estimates.route, [_pickupPoint, _dropoffPoint]);
    expect(
      estimates.options.map((option) => option.vehicleType).toSet(),
      {...VehicleType.values}..remove(VehicleType.unknown),
    );
    final quickOnly = await customer.api.orders.estimates(
      pickup: _pickupPoint,
      dropoff: _dropoffPoint,
      serviceType: ServiceType.quick,
    );
    expect(
      quickOnly.options.every((o) => o.serviceType == ServiceType.quick),
      isTrue,
    );
    final damas = estimates.options.firstWhere(
      (option) => option.vehicleType == VehicleType.damas,
    );
    final order = await customer.api.orders.create(
      vehicleType: VehicleType.damas,
      pickup: _pickup,
      dropoff: _dropoff,
      cargo: _boxes,
      memo: '조심히 다뤄주세요',
    );
    expect(order.status, OrderStatus.requested);
    expect(order.serviceType, ServiceType.quick);
    // 견적에서 본 요금·거리·시간 그대로 주문된다.
    expect(order.fare, damas.fare);
    expect(order.distanceKm, estimates.distanceKm);
    expect(order.durationMinutes, estimates.durationMinutes);
    expect(order.pickup.contactPhone, '01011112222');
    expect(order.pickup.dong, '역삼동');
    expect(order.dropoff.detailAddress, isNull);
    expect(order.cargo.category, CargoCategory.box);
    expect(order.cargo.quantity, 3);
    expect(order.estimatedDeliveryAt, isNull);
    final waiting = await customer.api.orders.tracking(order.id);
    expect(waiting.status, OrderStatus.requested);
    expect(waiting.driverLocation, isNull);

    // 기사: 서류를 올려야 신청할 수 있고, 심사 전에는 운행도 목록 조회도 안 된다
    expect(await driver.api.drivers.me(), isNull);
    await expectLater(
      driver.api.dispatch.openOrders(),
      throwsA(_apiError(ApiErrorCode.driverNotRegistered, 403)),
    );
    await expectLater(
      driver.api.drivers.register(
        vehicleType: VehicleType.damas,
        vehicleNumber: '서울 12가 3456',
      ),
      throwsA(_apiError(ApiErrorCode.documentsRequired, 409)),
    );
    final applied = await driver.applyAsDriver(
      VehicleType.damas,
      '서울 12가 3456',
    );
    expect(applied.status, DriverStatus.pending);
    expect(applied.vehicleNumber, '서울12가3456');
    expect(applied.canAcceptOrders, isFalse);
    expect(applied.todayOnline, Duration.zero);
    await expectLater(
      driver.api.drivers.setAvailability(true),
      throwsA(_apiError(ApiErrorCode.driverNotApproved, 409)),
    );
    await expectLater(
      driver.api.drivers.register(
        vehicleType: VehicleType.damas,
        vehicleNumber: '서울12가3456',
      ),
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
    await rival.goOnline(VehicleType.damas, '경기34나5678');

    // 대기 콜: 위치는 동 단위까지만. 위치를 보고하면 픽업지까지의 거리가 붙는다.
    final open = await driver.api.dispatch.openOrders(size: 100);
    final listed = open.items.firstWhere((item) => item.id == order.id);
    expect(listed.pickupArea, '강남구 역삼동');
    expect(listed.dropoffArea, '마포구 서교동');
    expect(listed.pickup, isNot(_pickupPoint));
    expect(listed.fare, order.fare);
    expect(listed.distanceFromMeKm, isNull);
    await driver.api.drivers.reportLocation(
      const Coordinates(latitude: 37.51, longitude: 127.04),
    );
    final call = await driver.api.dispatch.openOrder(order.id);
    expect(call.distanceFromMeKm, closeTo(1.2, 0.11));
    expect(call.cargo.category, CargoCategory.box);

    // 수락. 늦은 기사는 409.
    final accepted = await driver.api.dispatch.accept(order.id);
    expect(accepted.status, OrderStatus.assigned);
    expect(accepted.driverId, applied.id);
    expect(accepted.pickup.detailAddress, '10층');
    expect(accepted.memo, '조심히 다뤄주세요');
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

    // 고객: 기사 위치와 예정 시각. 기사: 픽업지까지 길안내.
    final tracking = await customer.api.orders.tracking(order.id);
    expect(tracking.status, OrderStatus.assigned);
    expect(
      tracking.driverLocation?.coordinates,
      const Coordinates(latitude: 37.51, longitude: 127.04),
    );
    expect(
      tracking.estimatedDeliveryAt!.isAfter(tracking.estimatedPickupAt!),
      isTrue,
    );
    final toPickup = await driver.api.dispatch.navigation(order.id);
    expect(toPickup.target, NavigationTarget.pickup);
    expect(toPickup.address, _pickup.address);
    expect(toPickup.destination, _pickupPoint);
    expect(toPickup.route.last, _pickupPoint);
    await expectLater(
      rival.api.dispatch.navigation(order.id, from: _pickupPoint),
      throwsA(_apiError(ApiErrorCode.orderNotFound, 404)),
    );

    // 메시지: 같은 대화가 보는 사람에 따라 mine만 다르다.
    final sent = await customer.api.orders.sendMessage(
      order.id,
      '1층 로비에서 기다릴게요',
    );
    expect(sent.mine, isTrue);
    await driver.api.orders.sendMessage(order.id, '5분 뒤 도착해요');
    final seenByDriver = await driver.api.orders.messages(order.id);
    expect(seenByDriver.map((m) => m.mine), [false, true]);
    final newer = await customer.api.orders.messages(
      order.id,
      after: sent.createdAt,
    );
    expect(newer.single.text, '5분 뒤 도착해요');
    expect(newer.single.mine, isFalse);
    await expectLater(
      rival.api.orders.messages(order.id),
      throwsA(_apiError(ApiErrorCode.orderNotFound, 404)),
    );

    // 순서를 건너뛸 수 없고, 남의 배송은 진행할 수 없다
    await expectLater(
      driver.api.dispatch.complete(order.id),
      throwsA(_apiError(ApiErrorCode.orderNotInTransit, 409)),
    );
    await expectLater(
      rival.api.dispatch.pickUp(order.id),
      throwsA(_apiError(ApiErrorCode.notAssignedDriver, 403)),
    );
    await expectLater(
      customer.api.orders.review(order.id, rating: 5),
      throwsA(_apiError(ApiErrorCode.orderNotDelivered, 409)),
    );
    expect(
      (await driver.api.dispatch.pickUp(order.id)).status,
      OrderStatus.pickedUp,
    );
    expect(
      (await driver.api.dispatch.navigation(
        order.id,
        from: _pickupPoint,
      )).target,
      NavigationTarget.dropoff,
    );
    await expectLater(
      customer.api.orders.cancel(order.id, reason: '변심'),
      throwsA(_apiError(ApiErrorCode.orderNotCancellable, 409)),
    );
    final delivered = await driver.api.dispatch.complete(order.id);
    expect(delivered.status, OrderStatus.delivered);
    expect(delivered.deliveredAt, isNotNull);
    expect(delivered.estimatedDeliveryAt, isNull);
    await expectLater(
      driver.api.orders.sendMessage(order.id, '감사합니다'),
      throwsA(_apiError(ApiErrorCode.orderNotInProgress, 409)),
    );

    // 고객: 평가하고, 상세에서 기사와 평가를 본다
    final beforeReview = await customer.api.orders.get(order.id);
    expect(beforeReview.canReview, isTrue);
    expect(beforeReview.driver?.rating, isNull);
    final review = await customer.api.orders.review(
      order.id,
      rating: 5,
      tags: [ReviewTag.kind, ReviewTag.fast],
      comment: '조심히 옮겨 주셨어요',
    );
    expect(review.tags, [ReviewTag.kind, ReviewTag.fast]);
    await expectLater(
      customer.api.orders.review(order.id, rating: 1),
      throwsA(_apiError(ApiErrorCode.reviewAlreadyWritten, 409)),
    );
    final detail = await customer.api.orders.get(order.id);
    expect(detail.order.status, OrderStatus.delivered);
    expect(detail.driver?.name, '박기사');
    expect(detail.driver?.vehicleNumber, '서울12가3456');
    expect(detail.driver?.rating, 5.0);
    expect(detail.driver?.reviewCount, 1);
    expect(detail.review?.comment, '조심히 옮겨 주셨어요');
    expect(detail.canReview, isFalse);
    final mine = await customer.api.orders.list(
      status: OrderStatus.delivered,
      serviceType: ServiceType.quick,
    );
    expect(mine.items.map((o) => o.id), [order.id]);
    expect(mine.items.single.driverName, '박기사');
    expect(mine.hasMore, isFalse);
    expect(
      (await customer.api.orders.list(serviceType: ServiceType.freight)).total,
      0,
    );

    // 고객의 알림함에 진행 알림이 쌓였다 (발송은 응답 뒤에 돌아서 잠깐 기다린다).
    late NotificationInbox inbox;
    for (var attempt = 0; attempt < 20; attempt++) {
      inbox = await customer.api.notifications.list();
      if (inbox.total >= 3) break;
      await Future<void>.delayed(const Duration(milliseconds: 100));
    }
    expect(inbox.items.map((n) => n.type), [
      NotificationType.orderDelivered,
      NotificationType.orderPickedUp,
      NotificationType.orderAssigned,
    ]);
    expect(inbox.items.every((n) => n.orderId == order.id), isTrue);
    expect(inbox.unreadCount, 3);
    await customer.api.notifications.markRead(inbox.items.first.id);
    expect(await customer.api.notifications.unreadCount(), 2);
    await customer.api.notifications.markAllRead();
    expect(await customer.api.notifications.unreadCount(), 0);

    // 기사: 오늘 수입과 배송 내역. 남의 주문 상세는 볼 수 없다.
    final now = DateTime.now();
    final earnings = await driver.api.dispatch.earnings(
      from: now.subtract(const Duration(days: 6)),
      to: now,
    );
    expect(earnings.daily, hasLength(7));
    expect(earnings.daily.last.date, toKstDate(now));
    expect(earnings.daily.last.earnings, order.fare);
    expect(earnings.totalEarnings, order.fare);
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

  test('예약 주문을 만들고 배차 전에 취소한다. 너무 무거운 화물은 거절된다', () async {
    final customer = _Session(UserRole.customer);
    await customer.register('김고객');
    final pickupAt = DateTime.now().add(const Duration(days: 3));

    final order = await customer.api.orders.create(
      vehicleType: VehicleType.truck1Ton,
      pickup: _pickup,
      dropoff: _dropoff,
      cargo: const CargoInput(
        category: CargoCategory.furnitureAppliance,
        weightKg: 400.5,
        description: '책상',
      ),
      scheduledPickupAt: pickupAt,
    );
    expect(order.serviceType, ServiceType.freight);
    expect(order.cargo.weightKg, 400.5);
    expect(order.cargo.quantity, 1);
    expect(order.cargo.description, '책상');
    expect(
      order.scheduledPickupAt?.difference(pickupAt).inSeconds.abs(),
      lessThan(1),
    );
    expect(order.isCancellable, isTrue);

    final cancelled = await customer.api.orders.cancel(
      order.id,
      reason: '일정 변경',
    );
    expect(cancelled.status, OrderStatus.cancelled);
    expect(cancelled.cancelReason, '일정 변경');
    expect(cancelled.cancelledAt, isNotNull);
    expect(cancelled.isCancellable, isFalse);

    await expectLater(
      customer.api.orders.create(
        vehicleType: VehicleType.motorcycle,
        pickup: _pickup,
        dropoff: _dropoff,
        cargo: const CargoInput(
          category: CargoCategory.furnitureAppliance,
          weightKg: 80,
        ),
      ),
      throwsA(_apiError(ApiErrorCode.cargoTooHeavy, 400)),
    );
    await expectLater(
      customer.api.orders.create(
        vehicleType: VehicleType.damas,
        pickup: _pickup,
        dropoff: _dropoff,
        cargo: _boxes,
        scheduledPickupAt: DateTime.utc(2020),
      ),
      throwsA(_apiError(ApiErrorCode.scheduleInPast, 400)),
    );
  }, skip: skip);

  test('서류를 올리고 내려받는다. 반려되면 그 서류만 다시 올려 재신청한다', () async {
    final driver = _Session(UserRole.driver);
    await driver.register('박기사');
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

    final applied = await driver.applyAsDriver(VehicleType.labo, _plate());
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
      documents.register(
        vehicleType: VehicleType.labo,
        vehicleNumber: applied.vehicleNumber,
      ),
      throwsA(_apiError(ApiErrorCode.documentsRequired, 409)),
    );

    await documents.uploadDocument(DriverDocumentType.driverLicense, _jpeg);
    final reapplied = await documents.register(
      vehicleType: VehicleType.labo,
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

  test('차량 변경은 운행을 끈 뒤에 신청하고, 다시 승인받아야 한다', () async {
    final driver = _Session(UserRole.driver);
    await driver.register('박기사');
    await driver.goOnline(VehicleType.damas, _plate());

    await expectLater(
      driver.api.drivers.requestVehicleChange(
        vehicleType: VehicleType.truck1Ton,
        vehicleNumber: '경기 80바 1234',
      ),
      throwsA(_apiError(ApiErrorCode.driverIsOnline, 409)),
    );
    await driver.api.drivers.setAvailability(false);
    final changed = await driver.api.drivers.requestVehicleChange(
      vehicleType: VehicleType.truck1Ton,
      vehicleNumber: '경기 80바 1234',
    );

    expect(changed.status, DriverStatus.pending);
    expect(changed.vehicleType, VehicleType.truck1Ton);
    expect(changed.vehicleNumber, '경기80바1234');
    await expectLater(
      driver.api.drivers.setAvailability(true),
      throwsA(_apiError(ApiErrorCode.driverNotApproved, 409)),
    );
  }, skip: needsAdmin);

  test('정산 계좌를 등록하면 끝 네 자리만 돌려받는다', () async {
    final driver = _Session(UserRole.driver);
    await driver.register('박기사');
    await driver.applyAsDriver(VehicleType.damas, _plate());

    expect(await driver.api.drivers.settlementAccount(), isNull);
    final saved = await driver.api.drivers.saveSettlementAccount(
      bankName: '국민',
      accountNumber: '123456-78-901024',
      accountHolder: '박기사',
    );
    expect(saved.maskedAccountNumber, '••••1024');
    expect((await driver.api.drivers.settlementAccount())?.bankName, '국민');
    await expectLater(
      driver.api.drivers.saveSettlementAccount(
        bankName: '국민',
        accountNumber: '12-34',
        accountHolder: '박기사',
      ),
      throwsA(_apiError(ApiErrorCode.validationFailed, 400)),
    );
  }, skip: skip);

  test('푸시 기기를 등록·해제하고, 푸시 받기를 켜고 끈다', () async {
    final customer = _Session(UserRole.customer);
    await customer.register('김고객');
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

  test('자주 쓰는 주소와 최근 보낸 곳으로 배송을 요청한다', () async {
    final customer = _Session(UserRole.customer);
    await customer.register('김고객');
    final addresses = customer.api.savedAddresses;
    const office = SavedAddressInput(
      label: '역삼 사무실',
      address: '서울 강남구 테헤란로 152',
      detailAddress: '10층',
      sigungu: '강남구',
      dong: '역삼동',
      latitude: 37.5,
      longitude: 127.0364,
    );

    expect(await addresses.list(), isEmpty);
    final saved = await addresses.add(office);
    expect(saved.label, '역삼 사무실');
    final renamed = await addresses.replace(
      saved.id,
      const SavedAddressInput(
        label: '본사',
        address: '서울 강남구 테헤란로 152',
        latitude: 37.5,
        longitude: 127.0364,
      ),
    );
    expect(renamed.id, saved.id);
    expect(renamed.label, '본사');
    // 통째로 바뀌므로 비워 둔 항목은 지워진다.
    expect(renamed.detailAddress, isNull);
    expect((await addresses.list()).single.label, '본사');

    expect(await customer.api.orders.recentDestinations(), isEmpty);
    final order = await customer.api.orders.create(
      vehicleType: VehicleType.damas,
      pickup: saved.toWaypoint(contactName: '김고객', contactPhone: '01011112222'),
      dropoff: _dropoff,
      cargo: _boxes,
    );
    expect(order.pickup.detailAddress, '10층');
    final recent = await customer.api.orders.recentDestinations();
    expect(recent.single.waypoint.address, _dropoff.address);
    expect(recent.single.waypoint.contactPhone, '023334444');
    final again = await customer.api.orders.create(
      vehicleType: VehicleType.damas,
      pickup: _pickup,
      dropoff: recent.single.toInput(),
      cargo: _boxes,
    );
    expect(again.dropoff.dong, '서교동');
    // 같은 곳으로 두 번 보내도 한 번만 나온다.
    expect(await customer.api.orders.recentDestinations(), hasLength(1));

    await addresses.remove(saved.id);
    expect(await addresses.list(), isEmpty);
    for (final each in [order, again]) {
      await customer.api.orders.cancel(each.id);
    }
  }, skip: skip);

  test('공지는 내 앱 대상만 보이고, 약관과 고객센터는 로그인 없이 본다', () async {
    final stamp = DateTime.now().microsecondsSinceEpoch;
    final forCustomers = await _admin('POST', '/admin/notices', {
      'title': '고객 공지 $stamp',
      'body': '첫 주문은 3,000원 할인돼요.',
      'audience': 'CUSTOMER',
    });
    final forDrivers = await _admin('POST', '/admin/notices', {
      'title': '기사 공지 $stamp',
      'body': '정산일이 금요일로 바뀌어요.',
      'audience': 'DRIVER',
    });
    await _admin('POST', '/admin/legal-documents', {
      'type': 'TERMS',
      'version': 'it-${stamp % 100000000}',
      'title': '서비스 이용약관',
      'body': '제1조 (목적) $stamp',
    });
    final customer = _Session(UserRole.customer);
    await customer.register('김고객');

    final notices = await customer.api.notices.list(size: 100);
    final titles = notices.items.map((notice) => notice.title);
    expect(titles, contains('고객 공지 $stamp'));
    expect(titles, isNot(contains('기사 공지 $stamp')));
    final notice = await customer.api.notices.get(forCustomers['id'] as String);
    expect(notice.body, '첫 주문은 3,000원 할인돼요.');
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
    await customer.register('김고객');
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
    final before = await customer.register('김고객');
    final order = await customer.api.orders.create(
      vehicleType: VehicleType.damas,
      pickup: _pickup,
      dropoff: _dropoff,
      cargo: _boxes,
    );

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
      name: '김고객',
      phone: '01012345678',
      agreements: const Agreements(terms: true, privacy: true),
    );
    expect(again.id, isNot(before.id));
  }, skip: skip);

  test('액세스 토큰이 만료돼도 호출이 이어지고, 갱신은 한 번만 한다', () async {
    final original = _Session(UserRole.customer);
    await original.register('김고객');
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

    await expectLater(
      api.vehicleTypes.list(),
      throwsA(isA<NetworkException>()),
    );
  }, skip: skip);
}

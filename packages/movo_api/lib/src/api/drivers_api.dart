import '../api_exception.dart';
import '../api_transport.dart';
import '../json.dart';
import '../models/coordinates.dart';
import '../models/driver.dart';
import '../models/enums.dart';
import '../models/inputs.dart';
import '../models/order.dart';
import '../models/paged.dart';

/// 라이더 서류·등록·운행 상태·정산 계좌 (라이더 앱).
class DriversApi {
  DriversApi(this._transport);

  final ApiTransport _transport;

  /// 내 서류. 필요한 서류 전부의 상태가 온다 (아직 올리지 않은 것도 포함).
  Future<List<DriverDocument>> documents() async => parseListResponse(
    await _transport.send('GET', '/drivers/me/documents'),
    DriverDocument.fromJson,
  );

  /// 서류 한 종류를 올린다 (사진 또는 PDF, 10MB까지). 같은 종류를 다시 올리면 바뀐다.
  /// 올린 뒤의 서류 전체 상태를 돌려준다.
  ///
  /// 받지 않는 형식이면 [ApiErrorCode.unsupportedDocumentType].
  Future<List<DriverDocument>> uploadDocument(
    DriverDocumentType type,
    UploadFile file,
  ) async => parseListResponse(
    await _transport.upload(
      'PUT',
      '/drivers/me/documents/${type.wire}',
      field: 'file',
      file: file,
    ),
    DriverDocument.fromJson,
  );

  /// 올려 둔 서류 파일. 다시 올리기 전에 미리 보여줄 때 쓴다.
  Future<FileContent> documentFile(DriverDocumentType type) =>
      _transport.download('/drivers/me/documents/${type.wire}/file');

  /// 라이더 등록 신청. 심사 대기 상태로 시작한다. 반려된 뒤 다시 신청할 때도 부른다.
  /// [vehicleNumber]는 오토바이 번호판이다.
  ///
  /// 서류가 빠졌거나 반려된 채면 [ApiErrorCode.documentsRequired],
  /// 이미 신청했으면(심사 대기·승인) [ApiErrorCode.driverAlreadyRegistered].
  Future<Driver> register({required String vehicleNumber}) async =>
      parseResponse(
        await _transport.send(
          'POST',
          '/drivers',
          body: {'vehicleNumber': vehicleNumber},
        ),
        Driver.fromJson,
      );

  /// 내 라이더 정보. 아직 등록 신청을 하지 않았으면 null.
  Future<Driver?> me() async {
    try {
      return parseResponse(
        await _transport.send('GET', '/drivers/me'),
        Driver.fromJson,
      );
    } on ApiException catch (error) {
      if (error.code == ApiErrorCode.driverNotRegistered) return null;
      rethrow;
    }
  }

  /// 운행 시작(true)·종료(false). 승인 전에 시작하면 [ApiErrorCode.driverNotApproved].
  Future<Driver> setAvailability(bool available) async => parseResponse(
    await _transport.send(
      'PATCH',
      '/drivers/me/availability',
      body: {'available': available},
    ),
    Driver.fromJson,
  );

  /// 오토바이 변경 신청. 다시 심사 대기가 되고, 승인받기 전까지 운행할 수 없다.
  ///
  /// 운행 중이면 [ApiErrorCode.driverIsOnline] — 먼저 운행을 끈다.
  Future<Driver> requestVehicleChange({required String vehicleNumber}) async =>
      parseResponse(
        await _transport.send(
          'POST',
          '/drivers/me/vehicle-change',
          body: {'vehicleNumber': vehicleNumber},
        ),
        Driver.fromJson,
      );

  /// 현재 위치 보고. 운행 중에 주기적으로 보낸다 — 콜의 거리, 픽업·도착 예정 시각,
  /// 가게의 배달 추적이 이 위치로 계산된다.
  Future<void> reportLocation(Coordinates location) =>
      _transport.send('PUT', '/drivers/me/location', body: location.toJson());

  /// 정산 계좌. 아직 등록하지 않았으면 null.
  Future<SettlementAccount?> settlementAccount() async {
    final response = await _transport.send(
      'GET',
      '/drivers/me/settlement-account',
    );
    return response == null
        ? null
        : parseResponse(response, SettlementAccount.fromJson);
  }

  /// 저장한 정산 계좌로 본인 확인을 다시 한다. 결과는 [SettlementAccount.verificationStatus].
  Future<SettlementAccount> verifySettlementAccount() async => parseResponse(
    await _transport.send('POST', '/drivers/me/settlement-account/verify'),
    SettlementAccount.fromJson,
  );

  /// 정산 계좌 등록·변경. [accountNumber]에는 하이픈이 있어도 된다.
  /// 저장하면서 본인 명의인지 확인한다 — 예금주가 가입자 이름과 다르면 저장은 되지만
  /// [AccountVerificationStatus.failed]이고 정산이 보류된다.
  Future<SettlementAccount> saveSettlementAccount({
    required String bankName,
    required String accountNumber,
    required String accountHolder,
  }) async => parseResponse(
    await _transport.send(
      'PUT',
      '/drivers/me/settlement-account',
      body: {
        'bankName': bankName,
        'accountNumber': accountNumber,
        'accountHolder': accountHolder,
      },
    ),
    SettlementAccount.fromJson,
  );
}

/// 배차와 배달 진행, 수입 (라이더 앱).
class DispatchApi {
  DispatchApi(this._transport);

  final ApiTransport _transport;

  String _path(String orderId, String action) =>
      '/dispatch/orders/${Uri.encodeComponent(orderId)}/$action';

  /// 콜 목록. 위치를 보내고 있으면 배차 반경 안의 콜만 가까운 순으로 온다.
  ///
  /// 라이더 등록 전이면 [ApiErrorCode.driverNotRegistered],
  /// 승인 전이거나 운행을 시작하지 않았으면 [ApiErrorCode.driverNotAvailable].
  Future<Paged<OpenOrder>> openOrders({int page = 1, int size = 20}) async =>
      parseResponse(
        await _transport.send(
          'GET',
          '/dispatch/open-orders',
          query: {'page': page, 'size': size},
        ),
        (json) => Paged.fromJson(json, OpenOrder.fromJson),
      );

  /// 콜 하나. 새 콜 푸시(`data.orderId`)를 받았을 때 그 콜의 내용을 가져온다.
  ///
  /// 그사이 다른 라이더가 수락했거나 취소됐으면 [ApiErrorCode.orderNotOpen].
  Future<OpenOrder> openOrder(String orderId) async => parseResponse(
    await _transport.send(
      'GET',
      '/dispatch/open-orders/${Uri.encodeComponent(orderId)}',
    ),
    OpenOrder.fromJson,
  );

  /// 내가 배차받은 배달 목록.
  ///
  /// [from]과 [to]를 함께 주면 그 기간(두 시각이 속한 한국 날짜, 양 끝 포함)의 것만 온다.
  Future<Paged<Order>> myOrders({
    OrderStatus? status,
    DateTime? from,
    DateTime? to,
    int page = 1,
    int size = 20,
  }) async {
    if ((from == null) != (to == null)) {
      throw ArgumentError('from과 to는 함께 줘야 해요');
    }
    return parseResponse(
      await _transport.send(
        'GET',
        '/dispatch/my-orders',
        query: {
          'status': status?.wire,
          'from': from == null ? null : toKstDate(from),
          'to': to == null ? null : toKstDate(to),
          'page': page,
          'size': size,
        },
      ),
      (json) => Paged.fromJson(json, Order.fromJson),
    );
  }

  /// 수입. [from]부터 [to]까지(두 시각이 속한 한국 날짜, 양 끝 포함, 92일까지)의
  /// 날짜별 수입과 다음 정산 예정액.
  Future<Earnings> earnings({
    required DateTime from,
    required DateTime to,
  }) async => parseResponse(
    await _transport.send(
      'GET',
      '/dispatch/earnings',
      query: {'from': toKstDate(from), 'to': toKstDate(to)},
    ),
    Earnings.fromJson,
  );

  /// 정산 내역: 이번 주(진행 중), 지급 예정, 지급 완료와 정산 계좌의 본인 확인 상태.
  Future<DriverSettlements> settlements() async => parseResponse(
    await _transport.send('GET', '/dispatch/settlements'),
    DriverSettlements.fromJson,
  );

  /// 콜 수락. 먼저 수락한 라이더가 배달을 잡는다.
  ///
  /// 다른 라이더가 먼저 수락했으면 409 — 코드는 [ApiErrorCode.orderNotOpen] 또는
  /// [ApiErrorCode.staleAggregate]. 어느 쪽이든 목록을 새로 고친다.
  /// 이미 3건을 맡고 있으면 [ApiErrorCode.tooManyActiveDeliveries].
  Future<Order> accept(String orderId) => _transition(orderId, 'accept');

  /// 가게로 출발. 가게에 알림이 가고, 이때부터 취소 수수료가 붙는다.
  Future<Order> depart(String orderId) => _transition(orderId, 'depart');

  /// 가게 도착. 가게에 알림이 간다.
  Future<Order> arrive(String orderId) => _transition(orderId, 'arrive');

  /// 픽업 완료. 출발·도착을 누르지 않았으면 지금 한 것으로 본다.
  Future<Order> pickUp(String orderId) => _transition(orderId, 'pickup');

  /// 배달 완료. 만나서 결제하는 배달이면 손님에게 받은 방식([collectedMethod])과
  /// 금액([collectedAmount])을 함께 보낸다 — 빠지면 [ApiErrorCode.collectionRequired].
  Future<Order> complete(
    String orderId, {
    DoorPayment? collectedMethod,
    int? collectedAmount,
  }) => _transition(orderId, 'complete', {
    'collectedMethod': ?collectedMethod?.wire,
    'collectedAmount': ?collectedAmount,
  });

  Future<Order> _transition(
    String orderId,
    String action, [
    Json? body,
  ]) async => parseResponse(
    await _transport.send('POST', _path(orderId, action), body: body),
    Order.fromJson,
  );
}

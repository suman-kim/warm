import '../api_transport.dart';
import '../json.dart';
import '../models/order.dart';
import '../models/store.dart';

// 가게(사장님) 앱이 쓰는 API — 가게·충전금·배달 요청.

/// 내 가게와 충전금. `/stores`.
class StoresApi {
  StoresApi(this._transport);

  final ApiTransport _transport;

  /// 가게 등록. 운영자가 승인하면 배달을 요청할 수 있다.
  Future<Store> register(StoreInput input) async => parseResponse(
    await _transport.send('POST', '/stores', body: input.toJson()),
    Store.fromJson,
  );

  /// 내 가게 (심사 상태·충전금 잔액). 등록하지 않았으면 ApiException(404 STORE_NOT_REGISTERED).
  Future<Store> mine() async =>
      parseResponse(await _transport.send('GET', '/stores/me'), Store.fromJson);

  /// 가게 정보 수정. 반려된 가게는 고치면 다시 심사를 받는다.
  Future<Store> update(StoreInput input) async => parseResponse(
    await _transport.send('PUT', '/stores/me', body: input.toJson()),
    Store.fromJson,
  );

  /// 충전금 잔액과 내역 (최근 것부터).
  Future<Wallet> wallet({int page = 1, int size = 20}) async => parseResponse(
    await _transport.send(
      'GET',
      '/stores/me/wallet',
      query: {'page': page, 'size': size},
    ),
    Wallet.fromJson,
  );

  /// 충전. 지금은 개발 서버에서만 바로 충전된다 (운영은 503 TOP_UP_NOT_READY).
  Future<WalletEntry> topUp(int amount) async => parseResponse(
    await _transport.send(
      'POST',
      '/stores/me/wallet/top-ups',
      body: {'amount': amount},
    ),
    WalletEntry.fromJson,
  );
}

/// 가게 배달 요청. `/deliveries`. 진행 상황은 `orders`로 본다.
class DeliveriesApi {
  DeliveriesApi(this._transport);

  final ApiTransport _transport;

  /// 손님 주소까지의 거리와 대행료, 지금 잔액.
  Future<DeliveryQuote> quote(DeliveryDestination dropoff) async =>
      parseResponse(
        await _transport.send(
          'POST',
          '/deliveries/quotes',
          body: {'dropoff': dropoff.toJson()},
        ),
        DeliveryQuote.fromJson,
      );

  /// 배달 요청. 대행료가 충전금에서 빠지고 근처 라이더들에게 콜이 간다.
  Future<Order> request(DeliveryRequestInput input) async => parseResponse(
    await _transport.send('POST', '/deliveries', body: input.toJson()),
    Order.fromJson,
  );
}

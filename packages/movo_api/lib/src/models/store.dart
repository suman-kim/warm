import '../json.dart';
import 'enums.dart';

/// 가게 주소 — 배달의 픽업지.
class StoreAddress {
  const StoreAddress({
    required this.address,
    required this.detailAddress,
    required this.sigungu,
    required this.dong,
    required this.latitude,
    required this.longitude,
  });

  factory StoreAddress.fromJson(Json json) => StoreAddress(
    address: json['address'] as String,
    detailAddress: json['detailAddress'] as String?,
    sigungu: json['sigungu'] as String,
    dong: json['dong'] as String,
    latitude: (json['latitude'] as num).toDouble(),
    longitude: (json['longitude'] as num).toDouble(),
  );

  final String address;
  final String? detailAddress;
  final String sigungu;
  final String dong;
  final double latitude;
  final double longitude;

  Json toJson() => {
    'address': address,
    if (detailAddress != null && detailAddress!.isNotEmpty)
      'detailAddress': detailAddress,
    'sigungu': sigungu,
    'dong': dong,
    'latitude': latitude,
    'longitude': longitude,
  };
}

/// 내 가게.
class Store {
  const Store({
    required this.id,
    required this.name,
    required this.businessNumber,
    required this.phone,
    required this.address,
    required this.status,
    required this.rejectionReason,
    required this.walletBalance,
    required this.appliedAt,
    required this.reviewedAt,
  });

  factory Store.fromJson(Json json) => Store(
    id: json['id'] as String,
    name: json['name'] as String,
    businessNumber: json['businessNumber'] as String,
    phone: json['phone'] as String,
    address: StoreAddress.fromJson(json['address'] as Json),
    status: StoreStatus.parse(json['status'] as String),
    rejectionReason: json['rejectionReason'] as String?,
    walletBalance: (json['walletBalance'] as num).toInt(),
    appliedAt: parseDate(json['appliedAt']),
    reviewedAt: parseDateOrNull(json['reviewedAt']),
  );

  final String id;
  final String name;

  /// 숫자 10자리
  final String businessNumber;

  /// 숫자만
  final String phone;
  final StoreAddress address;
  final StoreStatus status;
  final String? rejectionReason;

  /// 충전금 잔액 (원)
  final int walletBalance;
  final DateTime appliedAt;
  final DateTime? reviewedAt;
}

/// 가게 등록·수정 입력.
class StoreInput {
  const StoreInput({
    required this.name,
    required this.businessNumber,
    required this.phone,
    required this.address,
  });

  final String name;
  final String businessNumber;
  final String phone;
  final StoreAddress address;

  Json toJson() => {
    'name': name,
    'businessNumber': businessNumber,
    'phone': phone,
    'address': address.toJson(),
  };
}

/// 충전금 내역 한 줄.
class WalletEntry {
  const WalletEntry({
    required this.id,
    required this.kind,
    required this.amount,
    required this.balanceAfter,
    required this.orderId,
    required this.memo,
    required this.createdAt,
  });

  factory WalletEntry.fromJson(Json json) => WalletEntry(
    id: json['id'] as String,
    kind: WalletEntryKind.parse(json['kind'] as String),
    amount: (json['amount'] as num).toInt(),
    balanceAfter: (json['balanceAfter'] as num).toInt(),
    orderId: json['orderId'] as String?,
    memo: json['memo'] as String?,
    createdAt: parseDate(json['createdAt']),
  );

  final String id;
  final WalletEntryKind kind;

  /// 늘면 +, 줄면 − (원)
  final int amount;
  final int balanceAfter;
  final String? orderId;
  final String? memo;
  final DateTime createdAt;
}

/// 충전금 잔액과 내역 한 페이지 (최근 것부터).
class Wallet {
  const Wallet({
    required this.balance,
    required this.items,
    required this.total,
    required this.page,
    required this.size,
  });

  factory Wallet.fromJson(Json json) => Wallet(
    balance: (json['balance'] as num).toInt(),
    items: [
      for (final item in json['items'] as List<dynamic>)
        WalletEntry.fromJson(item as Json),
    ],
    total: (json['total'] as num).toInt(),
    page: (json['page'] as num).toInt(),
    size: (json['size'] as num).toInt(),
  );

  final int balance;
  final List<WalletEntry> items;
  final int total;
  final int page;
  final int size;
}

/// 손님 주소까지의 거리와 배달대행료.
class DeliveryQuote {
  const DeliveryQuote({
    required this.distanceKm,
    required this.durationMinutes,
    required this.fee,
    required this.walletBalance,
  });

  factory DeliveryQuote.fromJson(Json json) => DeliveryQuote(
    distanceKm: (json['distanceKm'] as num).toDouble(),
    durationMinutes: (json['durationMinutes'] as num).toInt(),
    fee: (json['fee'] as num).toInt(),
    walletBalance: (json['walletBalance'] as num).toInt(),
  );

  final double distanceKm;
  final int durationMinutes;

  /// 배달대행료 (원)
  final int fee;

  /// 지금 충전금 잔액 (원)
  final int walletBalance;

  /// 요청한 뒤 남을 잔액
  int get balanceAfter => walletBalance - fee;
}

/// 손님 (도착지).
class DeliveryDestination {
  const DeliveryDestination({
    required this.address,
    this.detailAddress,
    this.sigungu,
    this.dong,
    required this.latitude,
    required this.longitude,
  });

  final String address;
  final String? detailAddress;
  final String? sigungu;
  final String? dong;
  final double latitude;
  final double longitude;

  Json toJson() => {
    'address': address,
    if (detailAddress != null && detailAddress!.isNotEmpty)
      'detailAddress': detailAddress,
    if (sigungu != null && sigungu!.isNotEmpty) 'sigungu': sigungu,
    if (dong != null && dong!.isNotEmpty) 'dong': dong,
    'latitude': latitude,
    'longitude': longitude,
  };
}

/// 배달 요청 입력.
class DeliveryRequestInput {
  const DeliveryRequestInput({
    required this.dropoff,
    required this.phone,
    required this.foodAmount,
    required this.doorPayment,
    required this.readyInMinutes,
    this.memo,
  });

  final DeliveryDestination dropoff;

  /// 손님 연락처
  final String phone;

  /// 음식값 (원)
  final int foodAmount;
  final DoorPayment doorPayment;

  /// 조리가 끝나 픽업할 수 있을 때까지 남은 분. 0이면 바로.
  final int readyInMinutes;
  final String? memo;

  Json toJson() => {
    'dropoff': {...dropoff.toJson(), 'phone': phone},
    'foodAmount': foodAmount,
    'doorPayment': doorPayment.wire,
    'readyInMinutes': readyInMinutes,
    if (memo != null && memo!.trim().isNotEmpty) 'memo': memo!.trim(),
  };
}

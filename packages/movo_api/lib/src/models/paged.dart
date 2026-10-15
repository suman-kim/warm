import '../json.dart';

/// 목록 한 페이지.
class Paged<T> {
  const Paged({
    required this.items,
    required this.total,
    required this.page,
    required this.size,
  });

  factory Paged.fromJson(Json json, T Function(Json json) parseItem) => Paged(
    items: [
      for (final item in json['items'] as List<dynamic>)
        parseItem(item as Json),
    ],
    total: (json['total'] as num).toInt(),
    page: (json['page'] as num).toInt(),
    size: (json['size'] as num).toInt(),
  );

  final List<T> items;

  /// 페이지와 무관한 전체 건수
  final int total;

  /// 1부터 센다
  final int page;
  final int size;

  bool get hasMore => page * size < total;
}

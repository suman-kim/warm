import 'api_exception.dart';

typedef Json = Map<String, dynamic>;

/// 서버가 보낸 ISO 8601 시각(UTC). 화면에 보여줄 때는 `toLocal()`로 바꾼다.
DateTime parseDate(Object? value) => DateTime.parse(value as String);

DateTime? parseDateOrNull(Object? value) =>
    value == null ? null : parseDate(value);

/// 서버에 보내는 시각. 기기의 시간대와 무관하게 UTC로 보낸다.
String toWireDate(DateTime at) => at.toUtc().toIso8601String();

/// 그 시각이 속한 한국 날짜 (`YYYY-MM-DD`). 서버는 수입·정산 같은 '하루'를 한국 시간으로 센다 —
/// 기기가 다른 시간대에 있어도 같은 날짜가 나오도록 기기의 날짜가 아니라 이걸 쓴다.
String toKstDate(DateTime at) =>
    at.toUtc().add(const Duration(hours: 9)).toIso8601String().substring(0, 10);

/// 응답 본문을 모델로 바꾼다. 모양이 예상과 다르면 [UnexpectedResponseException].
T parseResponse<T>(Object? body, T Function(Json json) parse) =>
    _guard(() => parse(body as Json));

/// 배열로 온 응답 본문을 모델 목록으로 바꾼다.
List<T> parseListResponse<T>(Object? body, T Function(Json json) parse) =>
    _guard(
      () => [for (final item in body as List<dynamic>) parse(item as Json)],
    );

T _guard<T>(T Function() parse) {
  try {
    return parse();
  } on TypeError catch (error) {
    throw UnexpectedResponseException('$error');
  } on FormatException catch (error) {
    throw UnexpectedResponseException(error.message);
  }
}

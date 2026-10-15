import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;

import 'api_exception.dart';
import 'json.dart';
import 'models/inputs.dart';
import 'token_store.dart';

/// 서버와 주고받는 한 가지 길. 주소 조립, JSON, 인증 헤더, 토큰 갱신, 오류 변환을 맡는다.
class ApiTransport {
  ApiTransport({
    required Uri baseUrl,
    required this._tokenStore,
    http.Client? httpClient,
    this.timeout = const Duration(seconds: 15),
  }) : _baseUrl = baseUrl.toString().replaceFirst(RegExp(r'/+$'), ''),
       _http = httpClient ?? http.Client();

  /// 파일을 올리고 내릴 때는 [timeout]의 몇 배를 기다린다 (10MB까지 오간다).
  static const _fileTimeoutFactor = 4;

  final String _baseUrl;
  final TokenStore _tokenStore;
  final http.Client _http;
  final Duration timeout;

  final _sessionExpired = StreamController<void>.broadcast();

  // 보관소(키체인 등)를 요청마다 읽지 않도록 한 번 읽은 토큰을 들고 있는다.
  AuthTokens? _tokens;
  bool _tokensLoaded = false;
  Future<AuthTokens>? _refreshing;

  /// 로그인이 풀렸을 때 알린다.
  Stream<void> get sessionExpired => _sessionExpired.stream;

  Future<AuthTokens?> readTokens() async {
    if (!_tokensLoaded) {
      _tokens = await _tokenStore.read();
      _tokensLoaded = true;
    }
    return _tokens;
  }

  Future<void> saveTokens(AuthTokens tokens) async {
    _tokens = tokens;
    _tokensLoaded = true;
    await _tokenStore.write(tokens);
  }

  Future<void> clearTokens() async {
    _tokens = null;
    _tokensLoaded = true;
    await _tokenStore.clear();
  }

  /// 요청을 보내고 응답 본문(JSON)을 돌려준다. 본문이 없으면 null.
  ///
  /// 액세스 토큰이 만료돼 401이 오면 토큰을 갱신하고 같은 요청을 한 번 다시 보낸다.
  Future<Object?> send(
    String method,
    String path, {
    Map<String, Object?>? query,
    Object? body,
    bool authenticated = true,
  }) async => _decode(
    await _authorized(
      authenticated,
      (accessToken) => _request(
        method,
        path,
        query: query,
        body: body,
        accessToken: accessToken,
      ),
    ),
  );

  /// 파일 하나를 multipart/form-data의 [field] 항목으로 올리고 응답 본문(JSON)을 돌려준다.
  Future<Object?> upload(
    String method,
    String path, {
    required String field,
    required UploadFile file,
  }) async => _decode(
    await _authorized(
      true,
      // 다시 보낼 수 있도록 시도할 때마다 요청을 새로 만든다 (보낸 요청은 다시 쓸 수 없다).
      (accessToken) => _dispatch(
        http.MultipartRequest(method, _uri(path, null))
          ..files.add(
            http.MultipartFile.fromBytes(
              field,
              file.bytes,
              filename: file.filename,
            ),
          ),
        accessToken,
        timeout: timeout * _fileTimeoutFactor,
      ),
    ),
  );

  /// 파일을 내려받는다.
  Future<FileContent> download(String path) async {
    final response = await _authorized(
      true,
      (accessToken) => _dispatch(
        http.Request('GET', _uri(path, null)),
        accessToken,
        accept: '*/*',
        timeout: timeout * _fileTimeoutFactor,
      ),
    );
    if (!_succeeded(response)) {
      throw _failure(response, _parseBody(response).$1);
    }
    return FileContent(
      bytes: response.bodyBytes,
      contentType:
          response.headers['content-type'] ?? 'application/octet-stream',
    );
  }

  /// [attempt]를 지금 토큰으로 해 보고, 토큰이 만료돼 401이 오면 갱신한 토큰으로 한 번 더 한다.
  Future<http.Response> _authorized(
    bool authenticated,
    Future<http.Response> Function(String? accessToken) attempt,
  ) async {
    final tokens = authenticated ? await readTokens() : null;
    final response = await attempt(tokens?.accessToken);
    if (response.statusCode != HttpStatus.unauthorized || tokens == null) {
      return response;
    }
    final fresh = await _freshTokens(staleAccessToken: tokens.accessToken);
    return attempt(fresh.accessToken);
  }

  void close() {
    _sessionExpired.close();
    _http.close();
  }

  /// 만료된 토큰을 대신할 새 토큰. 동시에 여러 요청이 401을 받아도 갱신은 한 번만 한다 —
  /// 리프레시 토큰은 한 번 쓰면 폐기되므로, 같은 토큰으로 두 번 갱신하면 두 번째는 실패한다.
  Future<AuthTokens> _freshTokens({required String staleAccessToken}) async {
    final current = await readTokens();
    if (current == null) {
      throw const SessionExpiredException(messages: ['다시 로그인해 주세요.']);
    }
    // 이 요청이 답을 기다리는 사이 다른 요청이 이미 갱신을 끝냈다.
    if (current.accessToken != staleAccessToken) return current;
    return _refreshing ??= _refresh(
      current,
    ).whenComplete(() => _refreshing = null);
  }

  Future<AuthTokens> _refresh(AuthTokens current) async {
    final response = await _request(
      'POST',
      '/auth/refresh',
      body: {'refreshToken': current.refreshToken},
    );
    if (response.statusCode == HttpStatus.unauthorized) {
      await clearTokens();
      _sessionExpired.add(null);
      throw const SessionExpiredException(messages: ['다시 로그인해 주세요.']);
    }
    // 그 밖의 실패(서버 오류 등)는 로그인을 풀지 않는다 — 다음 요청에서 다시 갱신을 시도한다.
    final tokens = parseResponse(
      _decode(response),
      (json) => AuthTokens(
        accessToken: json['accessToken'] as String,
        refreshToken: json['refreshToken'] as String,
      ),
    );
    await saveTokens(tokens);
    return tokens;
  }

  Future<http.Response> _request(
    String method,
    String path, {
    Map<String, Object?>? query,
    Object? body,
    String? accessToken,
  }) {
    final request = http.Request(method, _uri(path, query));
    if (body != null) {
      request.headers['Content-Type'] = 'application/json';
      request.body = jsonEncode(body);
    }
    return _dispatch(request, accessToken);
  }

  Future<http.Response> _dispatch(
    http.BaseRequest request,
    String? accessToken, {
    String accept = 'application/json',
    Duration? timeout,
  }) async {
    request.headers['Accept'] = accept;
    if (accessToken != null) {
      request.headers['Authorization'] = 'Bearer $accessToken';
    }
    try {
      return await _http
          .send(request)
          .then(http.Response.fromStream)
          .timeout(timeout ?? this.timeout);
    } on TimeoutException catch (error) {
      throw NetworkException(cause: error);
    } on http.ClientException catch (error) {
      throw NetworkException(cause: error);
    } on IOException catch (error) {
      throw NetworkException(cause: error);
    }
  }

  Uri _uri(String path, Map<String, Object?>? query) {
    final uri = Uri.parse('$_baseUrl$path');
    final parameters = {
      for (final MapEntry(:key, :value) in (query ?? const {}).entries)
        if (value != null) key: '$value',
    };
    return parameters.isEmpty ? uri : uri.replace(queryParameters: parameters);
  }

  Object? _decode(http.Response response) {
    final (json, isJson) = _parseBody(response);
    if (!_succeeded(response)) throw _failure(response, json);
    if (!isJson) {
      throw UnexpectedResponseException(
        '${response.statusCode} 응답이 JSON이 아니에요',
      );
    }
    return json;
  }

  /// 본문을 JSON으로 읽는다. 빈 본문은 null로 읽는다 (JSON으로 친다).
  (Object? json, bool isJson) _parseBody(http.Response response) {
    final text = utf8.decode(response.bodyBytes, allowMalformed: true);
    if (text.isEmpty) return (null, true);
    try {
      return (jsonDecode(text), true);
    } on FormatException {
      return (null, false);
    }
  }

  bool _succeeded(http.Response response) =>
      response.statusCode >= 200 && response.statusCode < 300;

  /// 실패한 응답을 오류로 바꾼다. [json]은 [_parseBody]로 읽은 본문이다.
  MovoException _failure(http.Response response, Object? json) {
    // 서버의 오류 형식: { statusCode, code, message(문자열 또는 문자열 배열), ... }
    if (json is Json && json['code'] is String) {
      final message = json['message'];
      return ApiException(
        statusCode: response.statusCode,
        code: json['code'] as String,
        messages: switch (message) {
          final String text => [text],
          final List<dynamic> list => [for (final item in list) '$item'],
          _ => const [],
        },
      );
    }
    // 서버 앞단(프록시 등)이 만든 오류라 형식이 다르다.
    return ApiException(
      statusCode: response.statusCode,
      code: 'HTTP_${response.statusCode}',
      messages: const ['요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.'],
    );
  }
}

/// 로그인하면 받는 토큰 한 쌍.
class AuthTokens {
  const AuthTokens({required this.accessToken, required this.refreshToken});

  /// API 호출에 쓴다. 30분쯤 뒤 만료된다.
  final String accessToken;

  /// 액세스 토큰을 다시 받을 때 쓴다. 쓸 때마다 새 값으로 바뀐다.
  final String refreshToken;
}

/// 토큰을 보관하는 곳. 앱에서는 [SecureTokenStore]를 쓴다.
abstract interface class TokenStore {
  Future<AuthTokens?> read();
  Future<void> write(AuthTokens tokens);
  Future<void> clear();
}

/// 메모리에만 두는 보관소. 앱을 끄면 사라진다 — 테스트용.
class MemoryTokenStore implements TokenStore {
  MemoryTokenStore([this._tokens]);

  AuthTokens? _tokens;

  @override
  Future<AuthTokens?> read() async => _tokens;

  @override
  Future<void> write(AuthTokens tokens) async => _tokens = tokens;

  @override
  Future<void> clear() async => _tokens = null;
}

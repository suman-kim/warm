import '../api_exception.dart';
import '../api_transport.dart';
import '../json.dart';
import '../models/enums.dart';
import '../models/inputs.dart';
import '../models/user.dart';
import '../token_store.dart';

/// 가입·로그인·로그아웃·비밀번호 찾기·탈퇴. 토큰을 받아 보관하는 일까지 한다.
class AuthApi {
  AuthApi(this._transport, this._appRole);

  final ApiTransport _transport;
  final UserRole _appRole;

  /// 이 앱의 역할(고객 앱이면 고객)로 가입한다. 가입하면 바로 로그인된 상태가 된다.
  ///
  /// 이미 가입된 이메일이면 [ApiErrorCode.emailAlreadyRegistered],
  /// 필수 약관에 동의하지 않았으면 [ApiErrorCode.agreementRequired],
  /// 비밀번호가 규칙(8자 이상, 영문과 숫자 포함)에 맞지 않으면 [ApiErrorCode.weakPassword].
  Future<User> register({
    required String email,
    required String password,
    required String name,
    required String phone,
    required Agreements agreements,
  }) => _signIn('/auth/register', {
    'email': email,
    'password': password,
    'name': name,
    'phone': phone,
    'role': _appRole.wire,
    'agreements': agreements.toJson(),
  });

  /// 이메일이나 비밀번호가 틀리면 [ApiErrorCode.invalidCredentials],
  /// 다른 앱의 계정이면 [WrongAppException] (로그인되지 않는다).
  Future<User> login({required String email, required String password}) =>
      _signIn('/auth/login', {'email': email, 'password': password});

  /// 이 기기에서 로그아웃한다. 서버에 닿지 못해도 기기에서는 로그아웃된다.
  ///
  /// 푸시를 받고 있었다면 이 메서드보다 먼저 `pushDevices.unregister`를 부른다 —
  /// 로그아웃한 뒤에는 해제 요청을 보낼 수 없다.
  Future<void> logout() async {
    final tokens = await _transport.readTokens();
    if (tokens == null) return;
    await _transport.clearTokens();
    await _revoke(tokens.refreshToken);
  }

  Future<bool> isSignedIn() async => await _transport.readTokens() != null;

  /// 앱을 켤 때 부른다. 저장된 로그인이 아직 유효하면 회원을, 아니면 null을 준다.
  /// 서버에 닿지 못하면 [NetworkException] — 로그인은 풀리지 않는다.
  Future<User?> restoreSession() async {
    if (!await isSignedIn()) return null;
    try {
      return parseResponse(
        await _transport.send('GET', '/users/me'),
        User.fromJson,
      );
    } on SessionExpiredException {
      return null;
    }
  }

  /// 비밀번호 찾기 1단계: 이메일로 6자리 인증 코드를 보낸다 (10분 유효).
  ///
  /// 가입하지 않은 이메일이어도 똑같이 성공한다 — 화면에서도 "메일을 보냈어요"라고만 한다.
  /// 1분 안에 다시 부르면 새 코드를 보내지 않는다 (앞서 받은 코드를 그대로 쓴다).
  Future<void> requestPasswordReset({required String email}) => _transport.send(
    'POST',
    '/auth/password-reset/request',
    body: {'email': email},
    authenticated: false,
  );

  /// 비밀번호 찾기 2단계: 받은 코드와 새 비밀번호를 보낸다. 로그인되지는 않는다 —
  /// 이어서 [login]을 부른다. 그 계정으로 로그인해 있던 다른 기기는 모두 로그아웃된다.
  ///
  /// 코드가 틀렸거나 만료됐으면 [ApiErrorCode.invalidResetCode] (다섯 번 틀리면 코드를
  /// 다시 받아야 한다), 새 비밀번호가 규칙에 맞지 않으면 [ApiErrorCode.weakPassword].
  Future<void> confirmPasswordReset({
    required String email,
    required String code,
    required String newPassword,
  }) => _transport.send(
    'POST',
    '/auth/password-reset/confirm',
    body: {'email': email, 'code': code, 'newPassword': newPassword},
    authenticated: false,
  );

  /// 회원 탈퇴. 성공하면 이 기기에서도 로그아웃된다. 되돌릴 수 없다.
  ///
  /// 비밀번호가 틀리면 [ApiErrorCode.passwordMismatch], 끝나지 않은 주문(기사는 진행 중인
  /// 배송)이 있으면 [ApiErrorCode.orderInProgress].
  Future<void> withdraw({required String password}) async {
    await _transport.send(
      'POST',
      '/users/me/withdraw',
      body: {'password': password},
    );
    await _transport.clearTokens();
  }

  Future<User> _signIn(String path, Json body) async {
    final response = await _transport.send(
      'POST',
      path,
      body: body,
      authenticated: false,
    );
    final (user, tokens) = parseResponse(
      response,
      (json) => (
        User.fromJson(json['user'] as Json),
        AuthTokens(
          accessToken: json['accessToken'] as String,
          refreshToken: json['refreshToken'] as String,
        ),
      ),
    );
    if (user.role != _appRole) {
      // 서버는 어느 앱에서 로그인했는지 모른다. 방금 받은 토큰을 폐기하고 로그인시키지 않는다.
      await _revoke(tokens.refreshToken);
      throw WrongAppException(expected: _appRole, actual: user.role);
    }
    await _transport.saveTokens(tokens);
    return user;
  }

  /// 리프레시 토큰을 서버에서 폐기한다. 실패해도 넘어간다 — 토큰은 어차피 만료된다.
  Future<void> _revoke(String refreshToken) async {
    try {
      await _transport.send(
        'POST',
        '/auth/logout',
        body: {'refreshToken': refreshToken},
        authenticated: false,
      );
    } on MovoException {
      return;
    }
  }
}

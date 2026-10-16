import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:movo_api/movo_api.dart';

enum SessionStatus {
  /// 앱을 켠 직후 — 저장된 로그인을 확인하는 중
  restoring,

  /// 서버에 닿지 못해 로그인 여부를 확인하지 못했다
  offline,
  signedOut,
  signedIn,
}

/// 로그인 상태. 앱 전체에 하나다.
class Session extends ChangeNotifier {
  Session(this.api);

  final MovoApi api;

  SessionStatus _status = SessionStatus.restoring;
  User? _user;

  SessionStatus get status => _status;

  /// 로그인한 회원. 로그인하지 않았으면 null.
  User? get user => _user;

  void _set(SessionStatus status, [User? user]) {
    _status = status;
    _user = user;
    notifyListeners();
  }

  /// 앱을 켤 때 부른다. 저장된 로그인이 유효하면 로그인 상태가 된다.
  Future<void> restore() async {
    _set(SessionStatus.restoring);
    try {
      final user = await api.auth.restoreSession();
      _set(
        user == null ? SessionStatus.signedOut : SessionStatus.signedIn,
        user,
      );
    } on NetworkException {
      _set(SessionStatus.offline);
    } on MovoException {
      _set(SessionStatus.signedOut);
    }
  }

  Future<void> login({required String email, required String password}) async {
    final user = await api.auth.login(email: email, password: password);
    _set(SessionStatus.signedIn, user);
  }

  Future<void> register({
    required String email,
    required String password,
    required String name,
    required String phone,
    required Agreements agreements,
  }) async {
    final user = await api.auth.register(
      email: email,
      password: password,
      name: name,
      phone: phone,
      agreements: agreements,
    );
    _set(SessionStatus.signedIn, user);
  }

  Future<void> logout() async {
    await api.auth.logout();
    _set(SessionStatus.signedOut);
  }

  Future<void> withdraw({required String password}) async {
    await api.auth.withdraw(password: password);
    _set(SessionStatus.signedOut);
  }

  /// 내 정보를 고친 뒤 화면에 반영한다.
  void updateUser(User user) => _set(SessionStatus.signedIn, user);

  /// 로그인이 풀렸다 (토큰은 이미 지워졌다).
  void expire() {
    if (_status == SessionStatus.signedIn) _set(SessionStatus.signedOut);
  }
}

/// 전화 걸기·링크 열기처럼 앱 밖으로 나가는 일. 각 앱이 구현을 넣는다.
abstract interface class ExternalLauncher {
  /// 전화 앱을 연다. 열지 못했으면 false.
  Future<bool> call(String phoneNumber);

  /// 주소를 바깥 앱(브라우저 등)에서 연다. 열지 못했으면 false.
  Future<bool> open(Uri uri);
}

/// 아무것도 열지 않는 구현 (테스트와, 구현을 넣기 전의 기본값).
class NoExternalLauncher implements ExternalLauncher {
  const NoExternalLauncher();

  @override
  Future<bool> call(String phoneNumber) async => false;

  @override
  Future<bool> open(Uri uri) async => false;
}

/// 화면들이 함께 쓰는 것을 내려 준다: 서버 API, 로그인 상태, 앱 밖으로 나가는 길.
class MovoScope extends InheritedNotifier<Session> {
  const MovoScope({
    super.key,
    required Session session,
    required this.role,
    this.launcher = const NoExternalLauncher(),
    required super.child,
  }) : super(notifier: session);

  /// 이 앱이 누구의 앱인지 (가게 앱·라이더 앱).
  final UserRole role;
  final ExternalLauncher launcher;

  static MovoScope of(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<MovoScope>()!;

  /// 로그인 상태가 바뀌어도 다시 그리지 않아도 되는 곳에서 쓴다.
  static MovoScope read(BuildContext context) =>
      context.getInheritedWidgetOfExactType<MovoScope>()!;
}

extension MovoScopeOf on BuildContext {
  /// 로그인 상태. 바뀌면 이 위젯을 다시 그린다.
  Session get session => MovoScope.of(this).notifier!;

  MovoApi get api => MovoScope.read(this).notifier!.api;
  UserRole get appRole => MovoScope.read(this).role;
  ExternalLauncher get launcher => MovoScope.read(this).launcher;
}

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:movo_api/movo_api.dart';

import '../design/colors.dart';
import '../design/states.dart';
import '../design/widgets.dart';
import '../features/auth/login_screen.dart';
import 'profile.dart';
import 'session.dart';

/// 앱의 뿌리. 테마를 입히고, 로그인 상태에 따라 로그인 화면이나 [home]을 보여준다.
class MovoApp extends StatefulWidget {
  const MovoApp({
    super.key,
    required this.api,
    required this.profile,
    required this.title,
    required this.home,
    this.launcher = const NoExternalLauncher(),
  });

  final MovoApi api;
  final MovoAppProfile profile;

  /// 기기의 앱 전환 화면에 보이는 이름.
  final String title;

  /// 로그인한 뒤의 첫 화면.
  final WidgetBuilder home;
  final ExternalLauncher launcher;

  @override
  State<MovoApp> createState() => _MovoAppState();
}

class _MovoAppState extends State<MovoApp> {
  final _navigator = GlobalKey<NavigatorState>();
  late final Session _session = Session(widget.api);
  StreamSubscription<void>? _expired;

  @override
  void initState() {
    super.initState();
    _expired = widget.api.sessionExpired.listen((_) => _onExpired());
    _session.restore();
  }

  /// 리프레시 토큰까지 만료됐다. 안내를 띄우고 로그인 화면으로 돌려보낸다.
  Future<void> _onExpired() async {
    if (_session.status != SessionStatus.signedIn) return;
    final context = _navigator.currentContext;
    if (context != null) await showSessionExpiredSheet(context);
    _navigator.currentState?.popUntil((route) => route.isFirst);
    _session.expire();
  }

  @override
  void dispose() {
    _expired?.cancel();
    _session.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => MovoHost(
    session: _session,
    profile: widget.profile,
    launcher: widget.launcher,
    navigatorKey: _navigator,
    title: widget.title,
    home: _Gate(profile: widget.profile, home: widget.home),
  );
}

/// 테마와 [MovoScope]를 입힌 MaterialApp. 화면 하나만 띄워 보는 테스트에서도 쓴다.
class MovoHost extends StatelessWidget {
  const MovoHost({
    super.key,
    required this.session,
    required this.profile,
    required this.home,
    this.launcher = const NoExternalLauncher(),
    this.navigatorKey,
    this.title = 'MOVO',
  });

  final Session session;
  final MovoAppProfile profile;
  final Widget home;
  final ExternalLauncher launcher;
  final GlobalKey<NavigatorState>? navigatorKey;
  final String title;

  @override
  Widget build(BuildContext context) {
    final dark = profile.role == UserRole.driver;
    return MovoScope(
      session: session,
      role: profile.role,
      launcher: launcher,
      child: MaterialApp(
        navigatorKey: navigatorKey,
        title: title,
        debugShowCheckedModeBanner: false,
        theme: movoTheme(dark ? Brightness.dark : Brightness.light),
        home: home,
        builder: (context, child) => AnnotatedRegion<SystemUiOverlayStyle>(
          // 상태 표시줄과 Android 내비게이션 바를 투명하게 두고 앱 바탕이 그 아래까지 깔리게 한다.
          // 3버튼 내비게이션에서 Android가 덧씌우는 옅은 회색 막을 끄고, 버튼 색은 앱 바탕에 맞춘다.
          value: (dark ? SystemUiOverlayStyle.light : SystemUiOverlayStyle.dark)
              .copyWith(
                statusBarColor: Colors.transparent,
                systemNavigationBarColor: Colors.transparent,
                systemNavigationBarDividerColor: Colors.transparent,
                systemNavigationBarIconBrightness: dark
                    ? Brightness.light
                    : Brightness.dark,
                systemNavigationBarContrastEnforced: false,
              ),
          child: GestureDetector(
            // 입력란 밖을 누르면 키보드를 내린다.
            onTap: () => FocusManager.instance.primaryFocus?.unfocus(),
            child: child,
          ),
        ),
      ),
    );
  }
}

class _Gate extends StatelessWidget {
  const _Gate({required this.profile, required this.home});

  final MovoAppProfile profile;
  final WidgetBuilder home;

  @override
  Widget build(BuildContext context) {
    final session = context.session;
    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 220),
      child: KeyedSubtree(
        key: ValueKey(session.status),
        child: switch (session.status) {
          SessionStatus.restoring => Scaffold(
            body: Center(child: MovoLogo(size: 36, badge: profile.logoBadge)),
          ),
          SessionStatus.offline => Scaffold(
            body: MovoStateView.offline(onRetry: session.restore),
          ),
          SessionStatus.signedOut => LoginScreen(profile: profile),
          SessionStatus.signedIn => home(context),
        },
      ),
    );
  }
}

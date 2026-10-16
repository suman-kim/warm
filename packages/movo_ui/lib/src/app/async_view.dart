import 'dart:async';

import 'package:flutter/material.dart';
import 'package:movo_api/movo_api.dart';

import '../design/colors.dart';
import '../design/icons.dart';
import '../design/states.dart';
import '../design/widgets.dart';
import 'format.dart';

/// 서버에서 값을 받아 와 그린다. 받는 동안은 진행 표시, 실패하면 다시 시도할 수 있는 안내를 보여준다.
///
/// [controller]로 밖에서 다시 불러올 수 있다. [interval]을 주면 그 간격으로 조용히 새로 받는다
/// (배달 추적처럼 계속 바뀌는 값) — 이때는 받는 동안에도 앞의 값을 그대로 보여준다.
class MovoAsync<T> extends StatefulWidget {
  const MovoAsync({
    super.key,
    required this.load,
    required this.builder,
    this.controller,
    this.interval,
    this.keepPolling,
  });

  final Future<T> Function() load;
  final Widget Function(BuildContext context, T data) builder;
  final MovoAsyncController? controller;
  final Duration? interval;

  /// 받은 값을 보고 계속 새로 받을지 정한다 (끝난 배달은 더 받지 않는다).
  /// 주지 않으면 [interval]이 있는 동안 계속 받는다.
  final bool Function(T data)? keepPolling;

  @override
  State<MovoAsync<T>> createState() => _MovoAsyncState<T>();
}

/// [MovoAsync]를 밖에서 다시 불러오게 한다.
class MovoAsyncController extends ChangeNotifier {
  /// 지금 값을 유지한 채 새로 받는다.
  void reload() => notifyListeners();
}

class _MovoAsyncState<T> extends State<MovoAsync<T>> {
  T? _data;
  bool _hasData = false;
  Object? _error;
  int _generation = 0;

  @override
  void initState() {
    super.initState();
    widget.controller?.addListener(_load);
    _load();
  }

  @override
  void didUpdateWidget(MovoAsync<T> oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.controller != widget.controller) {
      oldWidget.controller?.removeListener(_load);
      widget.controller?.addListener(_load);
    }
  }

  @override
  void dispose() {
    widget.controller?.removeListener(_load);
    _generation++;
    super.dispose();
  }

  Future<void> _load() async {
    final generation = ++_generation;
    try {
      final data = await widget.load();
      if (!mounted || generation != _generation) return;
      setState(() {
        _data = data;
        _hasData = true;
        _error = null;
      });
    } on Object catch (error) {
      if (!mounted || generation != _generation) return;
      // 이미 보여주고 있는 값이 있으면 조용히 넘어간다 — 다음 주기에 다시 받는다.
      if (!_hasData) setState(() => _error = error);
    }
    final interval = widget.interval;
    final keep = widget.keepPolling;
    if (_hasData && keep != null && !keep(_data as T)) return;
    if (interval != null) {
      await Future<void>.delayed(interval);
      if (mounted && generation == _generation) unawaited(_load());
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_hasData) return widget.builder(context, _data as T);
    final error = _error;
    if (error == null) return const MovoLoading();
    return MovoErrorView(
      error,
      onRetry: () {
        setState(() => _error = null);
        _load();
      },
    );
  }
}

/// 불러오지 못했을 때의 안내. 연결 문제면 연결 오류 화면을, 그 밖에는 서버의 메시지를 보여준다.
class MovoErrorView extends StatelessWidget {
  const MovoErrorView(this.error, {super.key, this.onRetry});

  final Object error;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) => error is NetworkException
      ? MovoStateView.offline(onRetry: onRetry)
      : MovoStateView(
          icon: MovoIcons.wifiOff,
          title: '불러오지 못했어요',
          body: errorMessage(error),
          actionLabel: '다시 시도',
          onAction: onRetry,
        );
}

/// 서버에 보내는 동작을 실행한다. 실패하면 안내를 띄우고 null을 돌려준다.
Future<T?> runAction<T>(
  BuildContext context,
  Future<T> Function() action,
) async {
  try {
    return await action();
  } on SessionExpiredException {
    // 로그인 풀림은 앱 전체에서 한 번에 안내한다.
    return null;
  } on Object catch (error) {
    if (context.mounted) showMovoToast(context, errorMessage(error));
    return null;
  }
}

/// 공용 화면 뼈대: 위에 뒤로 가기와 제목, 아래에 스크롤되는 본문.
class MovoPage extends StatelessWidget {
  const MovoPage({
    super.key,
    this.title,
    required this.child,
    this.bottom,
    this.padding = const EdgeInsets.fromLTRB(20, 8, 20, 24),
    this.scrollable = true,
    this.trailing,
    this.onBack,
  });

  final String? title;
  final Widget child;

  /// 뒤로 가기를 눌렀을 때. 주지 않으면 이전 화면으로 돌아간다.
  final VoidCallback? onBack;

  /// 화면 아래에 붙박이로 놓을 것 (주 버튼).
  final Widget? bottom;
  final EdgeInsets padding;
  final bool scrollable;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    // 아래에 붙박이 버튼이 없으면 본문이 화면 끝까지 내려온다 — 마지막 내용이 시스템 영역에 걸리지 않게
    // 그 높이만큼 더 띄운다 (스크롤하는 동안에는 그 아래로 지나간다).
    final body = bottom == null
        ? padding.copyWith(
            bottom: padding.bottom + MediaQuery.paddingOf(context).bottom,
          )
        : padding;
    return Scaffold(
      backgroundColor: context.colors.background,
      body: SafeArea(
        bottom: false,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            MovoTopBar(title: title, trailing: trailing, onBack: onBack),
            Expanded(
              child: scrollable
                  ? SingleChildScrollView(padding: body, child: child)
                  : Padding(padding: body, child: child),
            ),
            if (bottom != null) MovoBottomBar(child: bottom!),
          ],
        ),
      ),
    );
  }
}

/// 화면 아래에 붙박이로 놓는 영역. 시스템 영역 위에 놓고([bottomSafeSpace]), 영역이 없는 기기에서도 아래가 붙지 않게 띄운다.
class MovoBottomBar extends StatelessWidget {
  const MovoBottomBar({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final keyboard = MediaQuery.viewInsetsOf(context).bottom;
    return Padding(
      padding: EdgeInsets.fromLTRB(
        20,
        8,
        20,
        // 키보드가 올라와 있으면 키보드 바로 위에 붙인다.
        keyboard > 0 ? 12 : bottomSafeSpace(context),
      ),
      child: child,
    );
  }
}

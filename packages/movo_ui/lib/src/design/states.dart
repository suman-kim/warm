import 'package:flutter/material.dart';

import 'colors.dart';
import 'icons.dart';
import 'widgets.dart';

/// 화면 가운데에 놓는 안내 (연결 오류, 빈 목록).
class MovoStateView extends StatelessWidget {
  const MovoStateView({
    super.key,
    required this.icon,
    required this.title,
    required this.body,
    this.actionLabel,
    this.onAction,
    this.compact = false,
  });

  /// 인터넷이 끊기거나 서버가 응답하지 않을 때.
  const MovoStateView.offline({super.key, VoidCallback? onRetry})
    : icon = MovoIcons.wifiOff,
      title = '인터넷 연결이 불안정해요',
      body = '연결 상태를 확인한 뒤 다시 시도해 주세요.',
      actionLabel = '다시 시도',
      onAction = onRetry,
      compact = false;

  final MovoIcons icon;
  final String title;
  final String body;
  final String? actionLabel;
  final VoidCallback? onAction;

  /// 목록 안에 놓는 조금 작은 모양 (빈 목록).
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final tile = compact ? 76.0 : 84.0;
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 40),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            MovoIconTile(
              icon,
              size: tile,
              radius: compact ? 26 : 28,
              iconSize: compact ? 34 : 38,
              background: colors.surfaceMuted,
            ),
            SizedBox(height: compact ? 20 : 22),
            Text(
              title,
              textAlign: TextAlign.center,
              style: mv(compact ? 20 : 22, 800, ls: compact ? 0 : -0.02),
            ),
            const SizedBox(height: 12),
            Text(
              body,
              textAlign: TextAlign.center,
              style: compact
                  ? mv(14, 600, color: colors.textMuted)
                  : mv(15, 500, color: colors.textMuted, height: 1.6),
            ),
            if (actionLabel != null) ...[
              SizedBox(height: compact ? 24 : 26),
              MovoButton(
                actionLabel!,
                onPressed: onAction,
                expand: false,
                height: compact ? 48 : 52,
                radius: compact ? 15 : 16,
                fontSize: compact ? 15 : 16,
                horizontalPadding: compact ? 22 : 30,
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// 가운데의 진행 표시.
class MovoLoading extends StatelessWidget {
  const MovoLoading({super.key});

  @override
  Widget build(BuildContext context) => Center(
    child: SizedBox(
      width: 28,
      height: 28,
      child: CircularProgressIndicator(
        strokeWidth: 3,
        color: context.colors.text,
      ),
    ),
  );
}

/// 로그인이 풀렸을 때 띄우는 시트. 닫을 수 없고, 버튼을 누르면 닫힌다.
Future<void> showSessionExpiredSheet(
  BuildContext context,
) => showModalBottomSheet<void>(
  context: context,
  isDismissible: false,
  enableDrag: false,
  backgroundColor: Colors.transparent,
  barrierColor: context.colors.isDark
      ? const Color(0x99000000)
      : const Color(0x66000000),
  builder: (context) {
    final colors = context.colors;
    return PopScope(
      canPop: false,
      child: Container(
        padding: EdgeInsets.fromLTRB(
          24,
          12,
          24,
          MediaQuery.paddingOf(context).bottom + 34,
        ),
        decoration: BoxDecoration(
          color: colors.surface,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(30)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const MovoSheetHandle(),
            const SizedBox(height: 28),
            Center(
              child: MovoIconTile(
                MovoIcons.lock,
                size: 64,
                radius: 22,
                iconSize: 28,
                background: colors.surfaceMuted,
                foreground: colors.isDark ? MovoPalette.lime : colors.text,
              ),
            ),
            const SizedBox(height: 16),
            Text(
              '다시 로그인해 주세요',
              textAlign: TextAlign.center,
              style: mv(22, 800, ls: -0.02),
            ),
            const SizedBox(height: 12),
            Text(
              '로그인 정보가 만료됐어요. 보안을 위해 한 번 더 로그인해 주세요.',
              textAlign: TextAlign.center,
              style: mv(15, 500, color: colors.textMuted, height: 1.6),
            ),
            const SizedBox(height: 24),
            MovoButton('다시 로그인', onPressed: () => Navigator.of(context).pop()),
          ],
        ),
      ),
    );
  },
);

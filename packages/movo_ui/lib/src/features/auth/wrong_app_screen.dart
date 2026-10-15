import 'package:flutter/material.dart';

import '../../app/async_view.dart';
import '../../app/profile.dart';
import '../../design/colors.dart';
import '../../design/icons.dart';
import '../../design/widgets.dart';

/// 다른 앱의 계정으로 로그인했을 때의 안내. 로그인은 되지 않은 상태다.
class WrongAppScreen extends StatelessWidget {
  const WrongAppScreen({super.key, required this.profile, required this.email});

  final MovoAppProfile profile;
  final String email;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Scaffold(
      backgroundColor: colors.background,
      body: SafeArea(
        bottom: false,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(28, 100, 28, 24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    MovoIconTile(
                      profile.otherAppIcon == MovoIcons.van
                          ? MovoIcons.vanWindow
                          : profile.otherAppIcon,
                      size: 72,
                      radius: 24,
                      iconSize: 34,
                      background: colors.isDark
                          ? colors.surfaceMuted
                          : MovoPalette.ink,
                      foreground: MovoPalette.lime,
                    ),
                    const SizedBox(height: 22),
                    Text(
                      profile.wrongAppTitle,
                      style: mv(28, 800, ls: -0.035, height: 1.3),
                    ),
                    const SizedBox(height: 10),
                    Text(
                      profile.wrongAppBody,
                      style: mv(15, 500, color: colors.textMuted, height: 1.6),
                    ),
                    const SizedBox(height: 22),
                    MovoCard(
                      radius: 18,
                      padding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 14,
                      ),
                      child: Row(
                        children: [
                          MovoAvatar(
                            email.toUpperCase(),
                            size: 40,
                            background: colors.surfaceMuted,
                            foreground: colors.text,
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  email,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: mv(15, 700),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  profile.otherAccountLabel,
                                  style: mv(13, 600, color: colors.textMuted),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            MovoBottomBar(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  MovoButton(
                    '${profile.otherAppName} 열기',
                    onPressed: () => showMovoToast(
                      context,
                      '${profile.otherAppName}을 설치해 로그인해 주세요.',
                    ),
                  ),
                  const SizedBox(height: 6),
                  MovoButton(
                    '다른 계정으로 로그인',
                    kind: MovoButtonKind.text,
                    height: 46,
                    fontSize: 15,
                    weight: 700,
                    onPressed: () => Navigator.of(context).pop(),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

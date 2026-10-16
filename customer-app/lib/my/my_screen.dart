import 'package:flutter/material.dart';
import 'package:movo_api/movo_api.dart';
import 'package:movo_ui/movo_ui.dart';

import '../store/store_form_screen.dart';
import '../store/store_widgets.dart';
import 'business_info_screen.dart';

/// 마이. 가게 정보와 수정, 알림, 공지·약관·고객센터·사업자 정보, 로그아웃과 탈퇴.
class MyScreen extends StatefulWidget {
  const MyScreen({super.key});

  @override
  State<MyScreen> createState() => _MyScreenState();
}

class _MyScreenState extends State<MyScreen> {
  final _reload = MovoAsyncController();

  @override
  void dispose() {
    _reload.dispose();
    super.dispose();
  }

  Future<(Store, bool)> _load() async {
    final api = context.api;
    return (api.stores.mine(), api.notifications.isPushEnabled()).wait;
  }

  Future<void> _open(Widget screen) async {
    await Navigator.of(
      context,
    ).push(MaterialPageRoute<void>(builder: (_) => screen));
    _reload.reload();
  }

  Future<void> _logout() async {
    final confirmed = await showMovoConfirm(
      context,
      title: '로그아웃할까요?',
      confirmLabel: '로그아웃',
    );
    if (!confirmed || !mounted) return;
    await context.session.logout();
  }

  @override
  Widget build(BuildContext context) => SafeArea(
    bottom: false,
    child: MovoAsync<(Store, bool)>(
      controller: _reload,
      load: _load,
      builder: (context, data) {
        final (store, pushEnabled) = data;
        return ListView(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
          children: [
            Text('마이', style: mv(28, 800, ls: -0.03)),
            const SizedBox(height: 18),
            _StoreCard(
              store,
              onEdit: () => _open(StoreFormScreen(store: store)),
            ),
            const SizedBox(height: 14),
            MovoRows(
              children: [
                _ToggleRow(
                  title: '배달 진행 알림',
                  body: '배정·픽업·완료를 알려 드려요',
                  value: pushEnabled,
                  onChanged: (value) async {
                    final api = context.api;
                    await runAction(
                      context,
                      () => api.notifications.setPushEnabled(value),
                    );
                    _reload.reload();
                  },
                ),
              ],
            ),
            const SizedBox(height: 14),
            MovoRows(
              children: [
                MovoMenuRow('공지사항', onTap: () => _open(const NoticesScreen())),
                MovoMenuRow(
                  '약관 및 정책',
                  onTap: () => _open(const LegalListScreen()),
                ),
                MovoMenuRow('고객센터', onTap: () => _open(const SupportScreen())),
                MovoMenuRow(
                  '사업자 정보',
                  onTap: () => _open(const BusinessInfoScreen()),
                ),
              ],
            ),
            const SizedBox(height: 14),
            MovoRows(
              children: [
                MovoMenuRow('로그아웃', chevron: false, onTap: _logout),
                MovoMenuRow(
                  '회원 탈퇴',
                  chevron: false,
                  muted: true,
                  onTap: () => _open(const WithdrawScreen()),
                ),
              ],
            ),
          ],
        );
      },
    ),
  );
}

class _StoreCard extends StatelessWidget {
  const _StoreCard(this.store, {required this.onEdit});

  final Store store;
  final VoidCallback onEdit;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return MovoCard(
      radius: 24,
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(store.name, style: mv(19, 800)),
          const SizedBox(height: 6),
          Text(
            '사업자 ${businessNumberLabel(store.businessNumber)} · ${phone(store.phone)}',
            style: mv(13, 600, color: colors.textSecondary, tabular: true),
          ),
          const SizedBox(height: 3),
          Text(
            storeAddressLine(store.address),
            style: mv(13, 600, color: colors.textSecondary),
          ),
          const SizedBox(height: 14),
          MovoButton(
            '가게 정보 수정',
            kind: MovoButtonKind.surface,
            height: 44,
            radius: 14,
            fontSize: 14,
            background: colors.surfaceMuted,
            onPressed: onEdit,
          ),
        ],
      ),
    );
  }
}

/// 제목·설명과 켜고 끄는 스위치 한 줄.
class _ToggleRow extends StatelessWidget {
  const _ToggleRow({
    required this.title,
    required this.body,
    required this.value,
    required this.onChanged,
  });

  final String title;
  final String body;
  final bool value;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 14),
    child: Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: mv(15, 800)),
              const SizedBox(height: 2),
              Text(body, style: mv(12, 600, color: context.colors.textMuted)),
            ],
          ),
        ),
        MovoToggle(value: value, onChanged: onChanged),
      ],
    ),
  );
}

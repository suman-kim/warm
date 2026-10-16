import 'package:flutter/material.dart';
import 'package:movo_api/movo_api.dart';
import 'package:movo_ui/movo_ui.dart';

import '../shell.dart';
import 'store_form_screen.dart';
import 'store_widgets.dart';

/// 로그인한 사장님의 가게 상태에 따라 첫 화면을 고른다.
/// 가게가 없으면 등록, 심사 중이면 대기, 반려면 사유와 다시 신청, 승인되면 배달 화면.
class StoreGate extends StatefulWidget {
  const StoreGate({super.key});

  @override
  State<StoreGate> createState() => _StoreGateState();
}

class _StoreGateState extends State<StoreGate> with WidgetsBindingObserver {
  final _reload = MovoAsyncController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _reload.dispose();
    super.dispose();
  }

  /// 앱으로 돌아오면 심사 결과를 다시 본다 (승인 알림을 받고 들어온 경우).
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && !_approved) _reload.reload();
  }

  bool _approved = false;

  /// 내 가게. 등록하지 않았으면 null.
  Future<Store?> _load() async {
    try {
      final store = await context.api.stores.mine();
      _approved = store.status == StoreStatus.approved;
      return store;
    } on ApiException catch (error) {
      if (error.code == 'STORE_NOT_REGISTERED') return null;
      rethrow;
    }
  }

  Future<void> _openForm(Store? store) async {
    final saved = await Navigator.of(context).push<Store>(
      MaterialPageRoute(builder: (_) => StoreFormScreen(store: store)),
    );
    if (saved != null) _reload.reload();
  }

  @override
  Widget build(BuildContext context) => MovoAsync<Store?>(
    controller: _reload,
    load: _load,
    builder: (context, store) => switch (store?.status) {
      null => _Welcome(onRegister: () => _openForm(null)),
      StoreStatus.approved => const CustomerShell(),
      StoreStatus.rejected => StoreReviewScreen(
        store: store!,
        onRetry: () => _openForm(store),
      ),
      _ => StoreReviewScreen(store: store!),
    },
  );
}

/// 가입 직후 — 가게부터 등록한다.
class _Welcome extends StatelessWidget {
  const _Welcome({required this.onRegister});

  final VoidCallback onRegister;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return MovoPage(
      bottom: MovoButton('가게 등록하기', onPressed: onRegister),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(height: 40),
          const MovoIconTile(
            MovoIcons.store,
            size: 68,
            radius: 22,
            iconSize: 30,
            background: MovoPalette.lime,
            foreground: MovoPalette.ink,
          ),
          const SizedBox(height: 22),
          Text('가게를 먼저\n등록해 주세요', style: mv(28, 800, ls: -0.03, height: 1.3)),
          const SizedBox(height: 10),
          Text(
            '심사가 끝나면 배달을 요청할 수 있어요',
            style: mv(14, 600, color: colors.textMuted, height: 1.6),
          ),
        ],
      ),
    );
  }
}

/// 심사 대기 또는 반려. 반려면 사유와 [다시 신청], 대기면 로그아웃만 있다.
class StoreReviewScreen extends StatelessWidget {
  const StoreReviewScreen({super.key, required this.store, this.onRetry});

  final Store store;

  /// 반려된 가게를 고쳐서 다시 신청한다.
  final VoidCallback? onRetry;

  bool get _rejected => store.status == StoreStatus.rejected;

  Future<void> _logout(BuildContext context) async {
    final confirmed = await showMovoConfirm(
      context,
      title: '로그아웃할까요?',
      confirmLabel: '로그아웃',
    );
    if (!confirmed || !context.mounted) return;
    await context.session.logout();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return MovoPage(
      bottom: _rejected
          ? MovoButton('정보 고쳐서 다시 신청', onPressed: onRetry)
          : MovoButton(
              '로그아웃',
              kind: MovoButtonKind.outline,
              onPressed: () => _logout(context),
            ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SizedBox(height: 40),
          Align(
            alignment: Alignment.centerLeft,
            child: MovoIconTile(
              _rejected ? MovoIcons.alert : MovoIcons.clock,
              size: 68,
              radius: 22,
              iconSize: 30,
              background: _rejected ? MovoPalette.dangerSoft : MovoPalette.lime,
              foreground: _rejected ? MovoPalette.danger : MovoPalette.ink,
            ),
          ),
          const SizedBox(height: 22),
          Text(
            _rejected ? '가게 등록이\n반려됐어요' : '심사하고 있어요',
            style: mv(28, 800, ls: -0.03, height: 1.3),
          ),
          const SizedBox(height: 10),
          Text(
            _rejected
                ? '사유를 확인하고 정보를 고쳐서 다시 신청해 주세요.'
                : '승인되면 알려 드릴게요. 승인 전에는 배달을 요청할 수 없어요.',
            style: mv(14, 600, color: colors.textMuted, height: 1.6),
          ),
          const SizedBox(height: 20),
          if (_rejected && store.rejectionReason != null) ...[
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: MovoPalette.dangerSoft,
                borderRadius: BorderRadius.circular(18),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('반려 사유', style: mv(12, 800, color: MovoPalette.danger)),
                  const SizedBox(height: 6),
                  Text(
                    store.rejectionReason!,
                    style: mv(14, 700, color: MovoPalette.ink, height: 1.55),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
          ],
          StoreInfoCard(store),
          if (!_rejected) ...[
            const SizedBox(height: 14),
            Text(
              '정보를 잘못 넣었다면 고객센터 1600-0000으로 알려 주세요.',
              style: mv(12, 600, color: colors.textMuted),
            ),
          ],
        ],
      ),
    );
  }
}

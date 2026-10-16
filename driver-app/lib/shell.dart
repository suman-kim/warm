import 'package:flutter/material.dart';
import 'package:movo_api/movo_api.dart';
import 'package:movo_ui/movo_ui.dart';

import 'delivery/active_screen.dart';
import 'delivery/finish_screens.dart';
import 'delivery/flow_screen.dart';
import 'delivery/rider_board.dart';
import 'driver_scope.dart';
import 'earnings/earnings_screen.dart';
import 'history/history_screen.dart';
import 'home/home_screen.dart';
import 'my/my_screen.dart';

/// 승인된 라이더의 뼈대. 아래 탭으로 홈·진행 중·내역·수입·마이를 오간다.
/// 맡은 배달은 [RiderBoard] 하나가 들고 있고, 가게가 진행 중이던 배달을 취소하면 알린다.
class DriverShell extends StatefulWidget {
  const DriverShell({super.key, required this.controller});

  final DriverController controller;

  @override
  State<DriverShell> createState() => _DriverShellState();
}

class _DriverShellState extends State<DriverShell> {
  static const _activeTab = 1;

  int _index = 0;
  final _reloads = [for (var i = 0; i < 5; i++) MovoAsyncController()];
  late final RiderBoard _board = RiderBoard(context.api)
    ..onCancelled = _cancelled
    ..addListener(_firstLoad);

  /// 앱을 켰을 때 진행 중인 배달이 있으면 진행 중 탭을 먼저 보여 준다.
  bool _checked = false;

  @override
  void initState() {
    super.initState();
    _board.start();
  }

  @override
  void dispose() {
    _board.dispose();
    for (final reload in _reloads) {
      reload.dispose();
    }
    super.dispose();
  }

  void _firstLoad() {
    if (_checked || !_board.loaded) return;
    _checked = true;
    if (_board.active.isNotEmpty && mounted) {
      setState(() => _index = _activeTab);
    }
  }

  void _select(int index) {
    setState(() => _index = index);
    // 탭으로 돌아올 때마다 새로 받는다.
    _reloads[index].reload();
    if (index == _activeTab) _board.refresh();
  }

  Future<void> _open(Order order) async {
    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => RiderFlowScreen(
          orderId: order.id,
          board: _board,
          controller: widget.controller,
        ),
      ),
    );
    if (!mounted) return;
    await _board.refresh();
    for (final reload in _reloads) {
      reload.reload();
    }
  }

  void _cancelled(Order order) {
    if (!mounted) return;
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        fullscreenDialog: true,
        builder: (_) => StoreCancelledScreen(order: order),
      ),
    );
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: context.colors.background,
    body: IndexedStack(
      index: _index,
      children: [
        ListenableBuilder(
          listenable: widget.controller,
          builder: (context, _) => DriverHomeScreen(
            controller: widget.controller,
            board: _board,
            reload: _reloads[0],
            onAccepted: _open,
          ),
        ),
        ActiveDeliveriesScreen(board: _board, onOpen: _open),
        DeliveryHistoryScreen(reload: _reloads[2]),
        EarningsScreen(reload: _reloads[3]),
        DriverMyScreen(controller: widget.controller, reload: _reloads[4]),
      ],
    ),
    bottomNavigationBar: MovoBottomNav(
      index: _index,
      onChanged: _select,
      items: const [
        MovoNavItem(MovoIcons.home, '홈'),
        MovoNavItem(MovoIcons.motorcycle, '진행 중'),
        MovoNavItem(MovoIcons.list, '내역'),
        MovoNavItem(MovoIcons.wallet, '수입'),
        MovoNavItem(MovoIcons.person, '마이'),
      ],
    ),
  );
}

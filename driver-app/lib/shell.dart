import 'package:flutter/material.dart';
import 'package:movo_ui/movo_ui.dart';

import 'driver_scope.dart';
import 'earnings/earnings_screen.dart';
import 'history/history_screen.dart';
import 'home/home_screen.dart';
import 'my/my_screen.dart';

/// 승인된 기사의 뼈대. 아래 탭으로 홈·배송 내역·수입·마이를 오간다.
class DriverShell extends StatefulWidget {
  const DriverShell({super.key, required this.controller});

  final DriverController controller;

  @override
  State<DriverShell> createState() => _DriverShellState();
}

class _DriverShellState extends State<DriverShell> {
  int _index = 0;
  final _reloads = [for (var i = 0; i < 4; i++) MovoAsyncController()];

  @override
  void dispose() {
    for (final reload in _reloads) {
      reload.dispose();
    }
    super.dispose();
  }

  void _select(int index) {
    setState(() => _index = index);
    // 탭으로 돌아올 때마다 새로 받는다.
    _reloads[index].reload();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: context.colors.background,
    body: IndexedStack(
      index: _index,
      children: [
        DriverHomeScreen(controller: widget.controller, reload: _reloads[0]),
        DeliveryHistoryScreen(reload: _reloads[1]),
        EarningsScreen(reload: _reloads[2]),
        DriverMyScreen(controller: widget.controller, reload: _reloads[3]),
      ],
    ),
    bottomNavigationBar: MovoBottomNav(
      index: _index,
      onChanged: _select,
      items: const [
        MovoNavItem(MovoIcons.home, '홈'),
        MovoNavItem(MovoIcons.route, '배송 내역'),
        MovoNavItem(MovoIcons.wallet, '수입'),
        MovoNavItem(MovoIcons.person, '마이'),
      ],
    ),
  );
}

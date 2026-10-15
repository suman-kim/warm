import 'package:flutter/material.dart';
import 'package:movo_ui/movo_ui.dart';

import 'history/history_screen.dart';
import 'home/home_screen.dart';
import 'my/my_screen.dart';

/// 로그인한 뒤의 뼈대. 아래 탭으로 홈·이용 내역·마이를 오간다.
class CustomerShell extends StatefulWidget {
  const CustomerShell({super.key});

  @override
  State<CustomerShell> createState() => _CustomerShellState();
}

class _CustomerShellState extends State<CustomerShell> {
  int _index = 0;

  /// 탭으로 돌아올 때마다 목록을 새로 받게 한다.
  final _history = MovoAsyncController();
  final _home = MovoAsyncController();

  @override
  void dispose() {
    _history.dispose();
    _home.dispose();
    super.dispose();
  }

  void _select(int index) {
    setState(() => _index = index);
    if (index == 0) _home.reload();
    if (index == 1) _history.reload();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: context.colors.background,
    body: IndexedStack(
      index: _index,
      children: [
        HomeScreen(controller: _home),
        HistoryScreen(controller: _history, onRequest: () => _select(0)),
        const MyScreen(),
      ],
    ),
    bottomNavigationBar: MovoBottomNav(
      index: _index,
      onChanged: _select,
      items: const [
        MovoNavItem(MovoIcons.home, '홈'),
        MovoNavItem(MovoIcons.list, '이용 내역'),
        MovoNavItem(MovoIcons.person, '마이'),
      ],
    ),
  );
}

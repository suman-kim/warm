import 'package:flutter/material.dart';
import 'package:movo_api/movo_api.dart';
import 'package:movo_ui/movo_ui.dart';

import 'delivery/delivery_detail_screen.dart';
import 'delivery/delivery_history_screen.dart';
import 'delivery/delivery_home_screen.dart';
import 'delivery/delivery_request_screen.dart';
import 'my/my_screen.dart';
import 'wallet/wallet_screen.dart';

/// 승인된 가게의 뼈대. 아래 탭으로 홈·내역·충전금·마이를 오간다.
class CustomerShell extends StatefulWidget {
  const CustomerShell({super.key});

  @override
  State<CustomerShell> createState() => _CustomerShellState();
}

class _CustomerShellState extends State<CustomerShell> {
  static const _wallet = 2;

  int _index = 0;

  /// 탭으로 돌아올 때마다 새로 받게 한다.
  final _controllers = List.generate(3, (_) => MovoAsyncController());

  @override
  void dispose() {
    for (final controller in _controllers) {
      controller.dispose();
    }
    super.dispose();
  }

  void _select(int index) {
    setState(() => _index = index);
    if (index < _controllers.length) _controllers[index].reload();
  }

  void _reloadAll() {
    for (final controller in _controllers) {
      controller.reload();
    }
  }

  Future<void> _open(String orderId) async {
    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => DeliveryDetailScreen(orderId: orderId),
      ),
    );
    _reloadAll();
  }

  /// 요청을 마치면 그 배달 상세(라이더 찾는 중)로 간다.
  Future<void> _request(Store store) async {
    final order = await Navigator.of(context).push<Order>(
      MaterialPageRoute(builder: (_) => DeliveryRequestScreen(store: store)),
    );
    _reloadAll();
    if (order != null && mounted) await _open(order.id);
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: context.colors.background,
    body: IndexedStack(
      index: _index,
      children: [
        DeliveryHomeScreen(
          controller: _controllers[0],
          onRequest: _request,
          onCharge: () => _select(_wallet),
          onOpen: (order) => _open(order.id),
        ),
        DeliveryHistoryScreen(
          controller: _controllers[1],
          onOpen: (order) => _open(order.id),
        ),
        WalletScreen(controller: _controllers[_wallet]),
        const MyScreen(),
      ],
    ),
    bottomNavigationBar: MovoBottomNav(
      index: _index,
      onChanged: _select,
      items: const [
        MovoNavItem(MovoIcons.home, '홈'),
        MovoNavItem(MovoIcons.list, '내역'),
        MovoNavItem(MovoIcons.wallet, '충전금'),
        MovoNavItem(MovoIcons.person, '마이'),
      ],
    ),
  );
}

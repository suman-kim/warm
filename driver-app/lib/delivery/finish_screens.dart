import 'package:flutter/material.dart';
import 'package:movo_api/movo_api.dart';
import 'package:movo_ui/movo_ui.dart';

import '../driver_scope.dart';
import 'flow_screen.dart';
import 'rider_board.dart';
import 'rider_format.dart';

/// 배달 완료. 라이더 몫과 받은 음식값을 보여 주고, 남은 배달이 있으면 다음 배달로 잇는다.
class DeliveredScreen extends StatelessWidget {
  const DeliveredScreen({
    super.key,
    required this.order,
    required this.board,
    required this.controller,
  });

  final Order order;
  final RiderBoard board;
  final DriverController controller;

  void _next(BuildContext context) {
    final next = board.next;
    final navigator = Navigator.of(context);
    if (next == null) {
      navigator.pop();
      return;
    }
    navigator.pushReplacement(
      MaterialPageRoute<void>(
        builder: (_) => RiderFlowScreen(
          orderId: next.id,
          board: board,
          controller: controller,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final delivery = order.storeDelivery;
    final earning = order.earning ?? order.fare;
    final fee = commissionOf(order.fare, earning);
    final collected = delivery.collectedMethod != null;
    return ListenableBuilder(
      listenable: board,
      builder: (context, _) => _FinishPage(
        icon: MovoIcons.check,
        iconBackground: MovoPalette.lime,
        iconColor: MovoPalette.ink,
        bottom: MovoButton(
          board.active.isEmpty
              ? '콜 목록으로'
              : '다음 배달 · ${board.active.length}건 남았어요',
          onPressed: () => _next(context),
        ),
        children: [
          Text('배달을 완료했어요', style: mv(14, 700, color: colors.textMuted)),
          const SizedBox(height: 6),
          Text(
            '+${won(earning)}',
            style: mv(
              40,
              800,
              ls: -0.03,
              tabular: true,
              color: MovoPalette.lime,
            ),
          ),
          const SizedBox(height: 22),
          _Rows([
            ('가게', storeNameOf(order), null),
            ('배달지', destinationLine(order), null),
            (
              '받은 음식값',
              collected ? collectedText(delivery) : '선결제 · 받은 돈 없음',
              collected ? MovoPalette.lime : null,
            ),
            ('대행료', won(order.fare), null),
            (
              '수수료 ${commissionPercentOf(order.fare, earning)}%',
              '−${won(fee)}',
              null,
            ),
            ('라이더 몫', won(earning), null),
          ], strongLast: true),
          if (collected && delivery.collectedMethod == DoorPayment.cash) ...[
            const SizedBox(height: 14),
            Text(
              '받은 현금 ${won(delivery.collectedAmount ?? 0)}은 현금 수금 내역에 기록했어요',
              style: mv(13, 600, color: colors.textSecondary),
            ),
          ],
        ],
      ),
    );
  }
}

/// 가게가 배달을 취소함. 진행 중 배달에서 뺐다는 것과 취소 사유를 알린다.
class StoreCancelledScreen extends StatelessWidget {
  const StoreCancelledScreen({super.key, required this.order});

  final Order order;

  @override
  Widget build(BuildContext context) => _FinishPage(
    icon: MovoIcons.close,
    iconBackground: MovoPalette.dangerNight,
    iconColor: MovoPalette.dangerOnNight,
    bottom: MovoButton('확인', onPressed: () => Navigator.of(context).pop()),
    children: [
      Text('가게가 배달을\n취소했어요', style: mv(28, 800, ls: -0.035, height: 1.3)),
      const SizedBox(height: 10),
      Text(
        '진행 중 배달에서 뺐어요. 가게로 가지 않아도 돼요.',
        style: mv(14, 600, color: context.colors.textMuted, height: 1.6),
      ),
      const SizedBox(height: 22),
      _Rows([
        ('가게', storeNameOf(order), null),
        ('배달지', destinationLine(order), null),
        if (order.cancelReason?.isNotEmpty ?? false)
          ('취소 사유', order.cancelReason!, null),
      ]),
    ],
  );
}

class _FinishPage extends StatelessWidget {
  const _FinishPage({
    required this.icon,
    required this.iconBackground,
    required this.iconColor,
    required this.children,
    required this.bottom,
  });

  final MovoIcons icon;
  final Color iconBackground;
  final Color iconColor;
  final List<Widget> children;
  final Widget bottom;

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: context.colors.background,
    body: SafeArea(
      bottom: false,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 56, 20, 24),
              children: [
                Align(
                  alignment: Alignment.centerLeft,
                  child: MovoIconTile(
                    icon,
                    size: 68,
                    radius: 22,
                    iconSize: 26,
                    background: iconBackground,
                    foreground: iconColor,
                  ),
                ),
                const SizedBox(height: 22),
                ...children,
              ],
            ),
          ),
          MovoBottomBar(child: bottom),
        ],
      ),
    ),
  );
}

/// 이름·값 줄들. 값의 색을 따로 줄 수 있다.
class _Rows extends StatelessWidget {
  const _Rows(this.rows, {this.strongLast = false});

  final List<(String, String, Color?)> rows;
  final bool strongLast;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return MovoCard(
      radius: 22,
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 4),
      child: Column(
        children: [
          for (final (i, (label, value, color)) in rows.indexed) ...[
            if (i > 0) Divider(height: 1, color: colors.divider),
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 13),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label, style: mv(14, 600, color: colors.textMuted)),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Text(
                      value,
                      textAlign: TextAlign.right,
                      style: mv(
                        14,
                        strongLast && i == rows.length - 1 ? 800 : 700,
                        color: color,
                        tabular: true,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

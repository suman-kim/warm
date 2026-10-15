import 'package:flutter/material.dart';
import 'package:movo_api/movo_api.dart';
import 'package:movo_ui/movo_ui.dart';

/// 배차 → 출발 → 도착 → 픽업 → 완료의 다섯 단계. 지난 단계는 시각을, 남은 단계는 '예정'을 보여준다.
class OrderTimeline extends StatelessWidget {
  const OrderTimeline(this.order, {super.key});

  final Order order;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    (String, DateTime?, String?) step(String label, DateTime? at) =>
        (label, at, at == null ? '예정' : clock(at));
    final steps = [
      step('배차', order.assignedAt),
      step('출발', order.departedAt),
      step('도착', order.arrivedAt),
      step('픽업', order.pickedUpAt),
      step('완료', order.deliveredAt),
    ];
    // 마지막으로 끝난 단계가 '지금' 단계다.
    final current = steps.lastIndexWhere((step) => step.$2 != null);
    return LayoutBuilder(
      builder: (context, constraints) {
        final cell = constraints.maxWidth / steps.length;
        return Stack(
          children: [
            Positioned(
              top: 6,
              left: cell / 2,
              right: cell / 2,
              child: Container(height: 2, color: colors.progressOff),
            ),
            Positioned(
              top: 6,
              left: cell / 2,
              width: cell * current,
              child: Container(height: 2, color: colors.text),
            ),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                for (final (index, step) in steps.indexed)
                  Expanded(
                    child: Column(
                      children: [
                        Container(
                          width: 14,
                          height: 14,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: index < current
                                ? colors.text
                                : index == current
                                ? MovoPalette.lime
                                : colors.surface,
                            border: index == current
                                ? Border.all(
                                    color: colors.text,
                                    width: 3,
                                    strokeAlign: BorderSide.strokeAlignOutside,
                                  )
                                : index > current
                                ? Border.all(color: colors.separator, width: 2)
                                : null,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          step.$1,
                          style: index <= current
                              ? mv(12, 800)
                              : mv(12, 700, color: colors.textMuted),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          step.$3 ?? '',
                          style: mv(
                            11,
                            600,
                            color: colors.textMuted,
                            tabular: true,
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ],
        );
      },
    );
  }
}

/// 배차된 기사. 메시지와 전화 버튼이 붙는다.
class DriverCard extends StatelessWidget {
  const DriverCard(
    this.driver, {
    super.key,
    required this.onChat,
    required this.onCall,
    this.onSurface = false,
  });

  final AssignedDriver driver;
  final VoidCallback? onChat;

  /// null이면 전화 버튼을 숨긴다 (끝난 주문).
  final VoidCallback? onCall;

  /// 흰 패널 위에 놓일 때 — 카드가 바탕색, 버튼이 흰색이 된다.
  final bool onSurface;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final buttonColor = onSurface ? colors.surface : colors.background;
    return MovoCard(
      color: onSurface ? colors.background : colors.surface,
      padding: const EdgeInsets.fromLTRB(14, 12, 12, 12),
      child: Row(
        children: [
          MovoAvatar(driver.name),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        '${driver.name} 기사님',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: mv(16, 800),
                      ),
                    ),
                    if (driver.rating case final rating?) ...[
                      const SizedBox(width: 6),
                      const MovoIcon(MovoIcons.star, size: 13),
                      const SizedBox(width: 6),
                      Text(
                        rating.toStringAsFixed(1),
                        style: mv(13, 700, color: colors.textMuted),
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 3),
                Text(
                  '${vehicleLabel(driver.vehicleType)} · ${plate(driver.vehicleNumber)}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: mv(13, 600, color: colors.textMuted),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          _Round(MovoIcons.chat, '메시지', buttonColor, onChat),
          if (onCall != null) ...[
            const SizedBox(width: 8),
            _Round(MovoIcons.phone, '전화', buttonColor, onCall),
          ],
        ],
      ),
    );
  }
}

class _Round extends StatelessWidget {
  const _Round(this.icon, this.label, this.color, this.onTap);

  final MovoIcons icon;
  final String label;
  final Color color;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    label: label,
    excludeSemantics: true,
    child: Pressable(
      onTap: onTap,
      child: MovoIconTile(icon, size: 42, circle: true, background: color),
    ),
  );
}

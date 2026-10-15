import 'package:flutter/material.dart';
import 'package:movo_ui/movo_ui.dart';

/// 배송 요청의 단계 막대 — 1 주소, 2 배송 정보, 3 차종 선택. [step]칸까지 채운다.
class OrderSteps extends StatelessWidget {
  const OrderSteps({super.key, required this.step});

  final int step;

  static const total = 3;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Semantics(
      label: '$total단계 중 $step단계',
      child: Row(
        children: [
          for (var index = 0; index < total; index++) ...[
            if (index > 0) const SizedBox(width: 4),
            Expanded(
              child: Container(
                height: 4,
                decoration: BoxDecoration(
                  color: index < step ? colors.text : colors.progressOff,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

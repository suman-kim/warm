import 'package:flutter/material.dart';
import 'package:movo_api/movo_api.dart';
import 'package:movo_ui/movo_ui.dart';

import '../delivery/rider_format.dart';

/// 배달 상세 (내역). 라이더 몫과 수수료, 받은 돈, 진행 시각, 주문 정보.
class TripDetailScreen extends StatelessWidget {
  const TripDetailScreen({super.key, required this.order});

  final Order order;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final delivery = order.storeDelivery;
    final cancelled = order.status == OrderStatus.cancelled;
    final earning = order.earning ?? 0;
    final finished = order.deliveredAt ?? order.cancelledAt;
    return MovoPage(
      title: '배달 상세',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (finished != null)
            Text(
              dayClock(finished).replaceFirst(clock(finished), ampm(finished)),
              style: mv(13, 600, color: colors.textMuted),
            ),
          const SizedBox(height: 4),
          Row(
            children: [
              Flexible(
                child: Text(storeNameOf(order), style: mv(22, 800, ls: -0.02)),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 6),
                child: MovoIcon(
                  MovoIcons.chevronRight,
                  size: 18,
                  color: colors.text,
                ),
              ),
              Text(dongOf(order.dropoff), style: mv(22, 800, ls: -0.02)),
            ],
          ),
          const SizedBox(height: 16),
          MovoCard(
            radius: 24,
            padding: const EdgeInsets.fromLTRB(18, 18, 18, 6),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  cancelled ? '취소 보상' : '라이더 몫',
                  style: mv(12, 700, color: colors.textMuted),
                ),
                const SizedBox(height: 4),
                Text(
                  won(earning),
                  style: mv(
                    28,
                    800,
                    ls: -0.03,
                    tabular: true,
                    color: MovoPalette.lime,
                  ),
                ),
                const SizedBox(height: 8),
                if (!cancelled) ...[
                  MovoKeyValue('대행료', won(order.fare), tabular: true),
                  MovoKeyValue(
                    '수수료 ${commissionPercentOf(order.fare, earning)}%',
                    '−${won(commissionOf(order.fare, earning))}',
                    tabular: true,
                  ),
                  MovoKeyValue(
                    '라이더 몫',
                    won(earning),
                    tabular: true,
                    strong: true,
                  ),
                ] else
                  MovoKeyValue('취소 사유', order.cancelReason ?? '가게가 취소했어요'),
              ],
            ),
          ),
          if (!cancelled) ...[const SizedBox(height: 12), _Collected(delivery)],
          const SizedBox(height: 12),
          _Card(
            title: '진행 시각',
            rows: [
              ('수락', order.assignedAt),
              ('가게 도착', order.arrivedAt),
              ('픽업', order.pickedUpAt),
              (cancelled ? '취소' : '전달', finished),
            ].map((r) => (r.$1, r.$2 == null ? '—' : ampm(r.$2!))).toList(),
          ),
          const SizedBox(height: 12),
          _Card(
            title: '주문 정보',
            rows: [
              (
                '가게',
                [
                  order.pickup.address,
                  if (order.pickup.detailAddress?.isNotEmpty ?? false)
                    order.pickup.detailAddress!,
                ].join(' '),
              ),
              (
                '배달지',
                [
                  roadOnly(order.dropoff.address),
                  if (order.dropoff.detailAddress?.isNotEmpty ?? false)
                    order.dropoff.detailAddress!,
                ].join(' '),
              ),
              ('결제 방식', payLabel(delivery.doorPayment)),
              ('주문번호', order.code),
            ],
          ),
        ],
      ),
    );
  }
}

/// 받은 돈 띠: 현금으로 받았어요 27,000원 / 선결제 주문이에요 받은 돈 없음
class _Collected extends StatelessWidget {
  const _Collected(this.delivery);

  final StoreDelivery? delivery;

  @override
  Widget build(BuildContext context) {
    final method = delivery?.collectedMethod;
    final collected = method != null;
    final foreground = collected ? MovoPalette.ink : const Color(0xFFC9CBCF);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
      decoration: BoxDecoration(
        color: collected ? MovoPalette.lime : context.colors.surface,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(
              !collected
                  ? '선결제 주문이에요'
                  : method == DoorPayment.card
                  ? '카드로 받았어요'
                  : '현금으로 받았어요',
              style: mv(14, 800, color: foreground),
            ),
          ),
          Text(
            collected ? won(delivery!.collectedAmount ?? 0) : '받은 돈 없음',
            style: mv(
              collected ? 18 : 14,
              800,
              color: foreground,
              tabular: true,
            ),
          ),
        ],
      ),
    );
  }
}

class _Card extends StatelessWidget {
  const _Card({required this.title, required this.rows});

  final String title;
  final List<(String, String)> rows;

  @override
  Widget build(BuildContext context) => MovoCard(
    radius: 24,
    padding: const EdgeInsets.fromLTRB(18, 18, 18, 6),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(title, style: mv(16, 800)),
        const SizedBox(height: 6),
        for (final (label, value) in rows)
          MovoKeyValue(label, value, tabular: true),
      ],
    ),
  );
}

import 'package:flutter/material.dart';
import 'package:movo_api/movo_api.dart';
import 'package:movo_ui/movo_ui.dart';

import '../driver_scope.dart';
import 'trip_detail_screen.dart';

enum _Range { week, month, custom }

/// 배송 내역. 완료한 배송과 고객이 취소한 배송을 날짜별로 모아 본다.
/// 취소된 배송은 수입에 들어가지 않는다. 한 건을 누르면 배송 상세.
class DeliveryHistoryScreen extends StatefulWidget {
  const DeliveryHistoryScreen({super.key, required this.reload});

  final MovoAsyncController reload;

  @override
  State<DeliveryHistoryScreen> createState() => _DeliveryHistoryScreenState();
}

class _DeliveryHistoryScreenState extends State<DeliveryHistoryScreen> {
  _Range _range = _Range.week;
  DateTimeRange? _custom;

  (DateTime, DateTime) get _period {
    final now = DateTime.now();
    return switch (_range) {
      _Range.week => (now.subtract(const Duration(days: 6)), now),
      _Range.month => (DateTime(now.year, now.month), now),
      _Range.custom => (_custom!.start, _custom!.end),
    };
  }

  Future<void> _pickRange() async {
    final now = DateTime.now();
    final picked = await showDateRangePicker(
      context: context,
      firstDate: now.subtract(const Duration(days: 365)),
      lastDate: now,
      initialDateRange: _custom,
      helpText: '기간 선택',
      saveText: '확인',
    );
    if (picked == null || !mounted) return;
    if (picked.duration.inDays >= 92) {
      showMovoToast(context, '기간은 92일까지 볼 수 있어요.');
      return;
    }
    setState(() {
      _custom = picked;
      _range = _Range.custom;
    });
    widget.reload.reload();
  }

  void _select(_Range range) {
    setState(() => _range = range);
    widget.reload.reload();
  }

  Future<List<Order>> _load() async {
    final (from, to) = _period;
    final page = await context.api.dispatch.myOrders(
      from: from,
      to: to,
      size: 100,
    );
    // 끝난 배송만 (진행 중인 배송은 홈에서 본다).
    return [
      for (final order in page.items)
        if (order.status == OrderStatus.delivered ||
            order.status == OrderStatus.cancelled ||
            order.status == OrderStatus.noShow)
          order,
    ];
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    Widget chip(String label, bool selected, VoidCallback onTap) => MovoChip(
      label,
      selected: selected,
      height: 38,
      radius: 13,
      horizontalPadding: 15,
      selectedBackground: colors.text,
      selectedForeground: colors.background,
      onTap: onTap,
    );
    final custom = _custom;
    return SafeArea(
      bottom: false,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('배송 내역', style: mv(28, 800, ls: -0.03)),
                const SizedBox(height: 16),
                Row(
                  children: [
                    chip(
                      '최근 7일',
                      _range == _Range.week,
                      () => _select(_Range.week),
                    ),
                    const SizedBox(width: 8),
                    chip(
                      '이번 달',
                      _range == _Range.month,
                      () => _select(_Range.month),
                    ),
                    const SizedBox(width: 8),
                    chip(
                      _range == _Range.custom && custom != null
                          ? '${monthDay(custom.start)} ~ ${monthDay(custom.end)}'
                          : '기간 선택',
                      _range == _Range.custom,
                      _pickRange,
                    ),
                  ],
                ),
              ],
            ),
          ),
          Expanded(
            child: MovoAsync<List<Order>>(
              controller: widget.reload,
              load: _load,
              builder: (context, orders) {
                if (orders.isEmpty) {
                  return const MovoStateView(
                    icon: MovoIcons.route,
                    title: '이 기간에 배송이 없어요',
                    body: '완료한 배송은 여기에 모여요',
                    compact: true,
                  );
                }
                int count(OrderStatus status) =>
                    orders.where((order) => order.status == status).length;
                final done = count(OrderStatus.delivered);
                final cancelled = count(OrderStatus.cancelled);
                final noShow = count(OrderStatus.noShow);
                // 날짜별로 묶는다 (최근 날짜부터).
                final days = <String, List<Order>>{};
                for (final order in orders) {
                  days.putIfAbsent(dayHeading(_at(order)), () => []).add(order);
                }
                return ListView(
                  padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
                  children: [
                    Row(
                      children: [
                        _Count('$done건', '완료'),
                        if (cancelled > 0) ...[
                          const SizedBox(width: 16),
                          _Count('$cancelled건', '고객 취소'),
                        ],
                        if (noShow > 0) ...[
                          const SizedBox(width: 16),
                          _Count('$noShow건', '노쇼'),
                        ],
                      ],
                    ),
                    for (final MapEntry(key: heading, value: list)
                        in days.entries) ...[
                      const SizedBox(height: 16),
                      Text(
                        heading,
                        style: mv(13, 800, color: colors.textMuted),
                      ),
                      const SizedBox(height: 10),
                      MovoRows(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 2,
                        ),
                        children: [for (final order in list) _Row(order)],
                      ),
                    ],
                  ],
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

/// 배송이 끝난 시각 (완료, 취소 또는 노쇼).
DateTime _at(Order order) =>
    order.deliveredAt ??
    order.cancelledAt ??
    order.noShowAt ??
    order.requestedAt;

class _Count extends StatelessWidget {
  const _Count(this.count, this.label);

  final String count;
  final String label;

  @override
  Widget build(BuildContext context) => Text.rich(
    TextSpan(
      style: mv(14, 700, color: context.colors.textMuted),
      children: [
        TextSpan(
          text: count,
          style: mv(14, 800, color: context.colors.text),
        ),
        TextSpan(text: ' $label'),
      ],
    ),
  );
}

class _Row extends StatelessWidget {
  const _Row(this.order);

  final Order order;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final cancelled = order.status == OrderStatus.cancelled;
    final noShow = order.status == OrderStatus.noShow;
    final departed = order.departedAt != null;
    final (tag, tagBackground, tagForeground) = switch (order.status) {
      OrderStatus.cancelled => (
        '고객 취소',
        colors.surfaceMuted,
        colors.textSecondary,
      ),
      OrderStatus.noShow => (
        '노쇼',
        MovoPalette.dangerNight,
        MovoPalette.dangerOnNight,
      ),
      _ when order.additionalFare > 0 => (
        '추가 요금',
        MovoPalette.lime.withValues(alpha: 0.16),
        MovoPalette.lime,
      ),
      _ => (null, null, null),
    };
    final waited = order.arrivedAt != null && order.noShowAt != null
        ? order.noShowAt!.difference(order.arrivedAt!).inMinutes
        : null;
    final subtitle = switch (order.status) {
      OrderStatus.cancelled when departed =>
        '출발 후 고객 취소 · 수수료 ${order.fare == 0 ? 0 : (order.cancellationFee * 100 / order.fare).round()}%',
      OrderStatus.cancelled => '출발 전 고객 취소',
      OrderStatus.noShow => '노쇼${waited == null ? '' : ' · $waited분 대기'}',
      _ => [
        vehicleLabel(order.vehicleType),
        km(order.distanceKm),
        if (order.additionalFare > 0) '추가 ${won(order.additionalFare)}',
      ].join(' · '),
    };
    return Pressable(
      onTap: () => Navigator.of(context).push(
        MaterialPageRoute<void>(builder: (_) => TripDetailScreen(order: order)),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 13),
        child: Row(
          children: [
            SizedBox(
              width: 40,
              child: Text(
                clock(_at(order)),
                style: mv(13, 700, color: colors.textMuted, tabular: true),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Flexible(
                        child: Text(
                          routeTitle(order),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: mv(15, 700),
                        ),
                      ),
                      if (tag != null) ...[
                        const SizedBox(width: 6),
                        MovoTag(
                          tag,
                          background: tagBackground,
                          foreground: tagForeground,
                          fontSize: 11,
                          padding: const EdgeInsets.symmetric(
                            horizontal: 6,
                            vertical: 3,
                          ),
                          radius: 6,
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(subtitle, style: mv(12, 600, color: colors.textMuted)),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Text(
              '+${won(driverAmountOf(order))}',
              style: mv(
                15,
                800,
                tabular: true,
                color: (cancelled || noShow) && driverAmountOf(order) == 0
                    ? colors.textMuted
                    : null,
              ),
            ),
            const SizedBox(width: 8),
            Transform.translate(
              offset: const Offset(4, 0),
              child: const MovoIcon(
                MovoIcons.chevronRight,
                size: 18,
                color: Color(0xFF5C5F64),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:movo_api/movo_api.dart';
import 'package:movo_ui/movo_ui.dart';

import '../payment/cards.dart';

String paymentStatusLabel(PaymentStatus status) => switch (status) {
  PaymentStatus.unpaid => '결제 전',
  PaymentStatus.paid => '결제 완료',
  PaymentStatus.failed => '결제 실패',
  PaymentStatus.partiallyRefunded => '부분 환불',
  PaymentStatus.refunded => '전액 환불',
  PaymentStatus.unknown => '결제',
};

/// 결제 정보: 요금 내역, 결제 수단, 결제 일시, 총 결제 금액과 환불. 결제했으면 영수증으로 이어진다.
class PaymentInfoCard extends StatelessWidget {
  const PaymentInfoCard({
    super.key,
    required this.order,
    required this.payment,
    required this.onReceipt,
  });

  final Order order;
  final OrderPayment payment;
  final VoidCallback onReceipt;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final paid = payment.paidAmount > 0;
    return WithChargeRules(
      builder: (context, rules) => MovoCard(
        padding: const EdgeInsets.fromLTRB(18, 16, 18, 6),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Text('결제 정보', style: mv(16, 800)),
                const SizedBox(width: 8),
                MovoTag(
                  paymentStatusLabel(payment.status),
                  background: paid ? MovoPalette.ink : colors.surfaceMuted,
                  foreground: paid ? MovoPalette.white : colors.textSecondary,
                  fontSize: 11,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 7,
                    vertical: 4,
                  ),
                  radius: 7,
                ),
                const Spacer(),
                if (paid)
                  Pressable(
                    onTap: onReceipt,
                    child: Row(
                      children: [
                        Text(
                          '영수증',
                          style: mv(13, 700, color: colors.textSecondary),
                        ),
                        MovoIcon(
                          MovoIcons.chevronRight,
                          size: 16,
                          color: colors.textSecondary,
                        ),
                      ],
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 8),
            for (final line in fareLines(order, rules))
              _Line(line.label, line.amountText),
            if (payment.card case final card?)
              _Line('결제 수단', '${card.label} · 일시불'),
            if (payment.paidAt case final at?) _Line('결제 일시', dayClock(at)),
            if (payment.additionalPaidAt case final at?)
              _Line('추가 결제 일시', dayClock(at)),
            if (order.cancellationFee > 0)
              _Line(
                order.status == OrderStatus.noShow ? '노쇼 · 요금 100%' : '취소 수수료',
                won(order.cancellationFee),
              ),
            if (payment.refundedAmount > 0)
              _Line('환불', '−${won(payment.refundedAmount)}'),
            if (payment.unpaidAmount > 0)
              _Line('결제 안 된 추가 요금', won(payment.unpaidAmount)),
            _Line(
              paid
                  ? (payment.refundedAmount > 0 ? '최종 결제 금액' : '총 결제 금액')
                  : '결제할 금액',
              won(paid ? payment.finalAmount : order.totalFare),
              strong: true,
              last: true,
            ),
          ],
        ),
      ),
    );
  }
}

class _Line extends StatelessWidget {
  const _Line(this.label, this.value, {this.strong = false, this.last = false});

  final String label;
  final String value;
  final bool strong;
  final bool last;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12),
      decoration: BoxDecoration(
        border: Border(top: BorderSide(color: colors.divider)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(
              label,
              style: strong
                  ? mv(14, 800)
                  : mv(14, 600, color: colors.textMuted),
            ),
          ),
          Text(value, style: mv(14, strong ? 800 : 700, tabular: true)),
        ],
      ),
    );
  }
}

/// 기사님이 도착한 뒤 흐르는 대기 시간과 쌓인 대기료. 1초마다 바뀐다.
class WaitingCard extends StatefulWidget {
  const WaitingCard({super.key, required this.arrivedAt});

  final DateTime arrivedAt;

  @override
  State<WaitingCard> createState() => _WaitingCardState();
}

class _WaitingCardState extends State<WaitingCard> {
  late final Timer _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) => setState(() {}));
  }

  @override
  void dispose() {
    _timer.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => WithChargeRules(
    builder: (context, rules) {
      final passed = DateTime.now().difference(widget.arrivedAt);
      final minutes = passed.inMinutes;
      final free = rules?.freeWaitingMinutes ?? 10;
      final limit = rules?.noShowWaitMinutes ?? 30;
      final fee = rules?.waitingFeeOf(minutes) ?? 0;
      return Container(
        padding: const EdgeInsets.fromLTRB(18, 16, 18, 16),
        decoration: BoxDecoration(
          color: MovoPalette.ink,
          borderRadius: BorderRadius.circular(22),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '도착 후 대기',
                        style: mv(12, 700, color: const Color(0xFFBDBDB7)),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        stopwatch(passed),
                        style: mv(
                          26,
                          900,
                          color: MovoPalette.white,
                          tabular: true,
                        ),
                      ),
                    ],
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      '쌓인 대기료',
                      style: mv(12, 700, color: const Color(0xFFBDBDB7)),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      won(fee),
                      style: mv(
                        20,
                        900,
                        color: MovoPalette.lime,
                        tabular: true,
                      ),
                    ),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 12),
            WaitingBar(
              minutes: passed.inSeconds / 60,
              free: free,
              limit: limit,
              track: const Color(0xFF3A3A38),
            ),
            const SizedBox(height: 10),
            Text(
              minutes < free
                  ? '$free분까지는 무료예요. 그 뒤로는 1분에 ${won(rules?.waitingFeePerMinute ?? 500)}씩 붙어요. $limit분이 지나면 기사님이 노쇼로 처리할 수 있어요.'
                  : '$free분이 지나 1분에 ${won(rules?.waitingFeePerMinute ?? 500)}씩 붙고 있어요. $limit분이 지나면 기사님이 노쇼로 처리할 수 있어요.',
              style: mv(12, 600, color: const Color(0xFFBDBDB7), height: 1.5),
            ),
          ],
        ),
      );
    },
  );
}

/// 취소 확인. 지금 취소하면 붙는 수수료와 돌려받는 금액을 보여 주고, 확인하면 true.
Future<bool> confirmCancel(
  BuildContext context, {
  required Order order,
  required OrderPayment? payment,
}) async {
  final fee = order.cancellationFeeNow ?? 0;
  final paid = payment?.paidAmount ?? 0;
  if (paid == 0) {
    return showMovoConfirm(
      context,
      title: '요청을 취소할까요?',
      body: '아직 결제 전이라 요금이 나가지 않아요.',
      confirmLabel: '요청 취소',
    );
  }
  final result = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    barrierColor: context.colors.scrim,
    builder: (context) => WithChargeRules(
      builder: (context, rules) {
        final colors = context.colors;
        final percent = rules?.cancellationFeePercent ?? 15;
        return Container(
          padding: EdgeInsets.fromLTRB(
            24,
            12,
            24,
            MediaQuery.paddingOf(context).bottom + 20,
          ),
          decoration: BoxDecoration(
            color: colors.surface,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(30)),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const MovoSheetHandle(),
              const SizedBox(height: 22),
              Text(
                fee == 0 ? '지금 취소하면 수수료가 없어요' : '지금 취소하면 수수료 $percent%가 붙어요',
                style: mv(21, 800, ls: -0.02, height: 1.3),
              ),
              const SizedBox(height: 8),
              Text(
                fee == 0
                    ? '기사님이 아직 출발하지 않아 결제 금액을 모두 돌려드려요.'
                    : '기사님이 픽업지로 출발해서 요금의 $percent%가 취소 수수료로 나가요.',
                style: mv(14, 500, color: colors.textMuted, height: 1.55),
              ),
              const SizedBox(height: 18),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                decoration: BoxDecoration(
                  color: colors.background,
                  borderRadius: BorderRadius.circular(18),
                ),
                child: Column(
                  children: [
                    _SheetLine('결제 금액', won(paid)),
                    _SheetLine(
                      '취소 수수료 · ${fee == 0 ? 0 : percent}%',
                      fee == 0 ? '0원' : '−${won(fee)}',
                    ),
                    _SheetLine(
                      '환불 금액',
                      won(paid - fee),
                      strong: true,
                      last: true,
                    ),
                  ],
                ),
              ),
              if (payment?.card case final card?) ...[
                const SizedBox(height: 10),
                Text(
                  '${card.label}로 환불돼요. 카드사에 따라 3~7영업일 걸려요.',
                  style: mv(12, 600, color: colors.textMuted),
                ),
              ],
              const SizedBox(height: 18),
              Row(
                children: [
                  Expanded(
                    flex: 2,
                    child: MovoButton(
                      '돌아가기',
                      kind: MovoButtonKind.surface,
                      background: colors.surfaceMuted,
                      height: 54,
                      fontSize: 16,
                      onPressed: () => Navigator.of(context).pop(false),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    flex: 3,
                    child: MovoButton(
                      '취소하고 환불받기',
                      height: 54,
                      fontSize: 16,
                      onPressed: () => Navigator.of(context).pop(true),
                    ),
                  ),
                ],
              ),
            ],
          ),
        );
      },
    ),
  );
  return result ?? false;
}

class _SheetLine extends StatelessWidget {
  const _SheetLine(
    this.label,
    this.value, {
    this.strong = false,
    this.last = false,
  });

  final String label;
  final String value;
  final bool strong;
  final bool last;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Container(
      padding: EdgeInsets.symmetric(vertical: strong ? 16 : 13),
      decoration: BoxDecoration(
        border: last
            ? null
            : Border(bottom: BorderSide(color: colors.fieldBorder)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(
              label,
              style: strong
                  ? mv(15, 800)
                  : mv(14, 600, color: colors.textMuted),
            ),
          ),
          Text(
            value,
            style: mv(strong ? 20 : 14, strong ? 900 : 700, tabular: true),
          ),
        ],
      ),
    );
  }
}

/// 결제 실패. 기사님이 수락했지만 카드 결제가 안 돼 배차되지 않았다. 다른 카드로 다시 요청한다.
class PaymentFailedView extends StatelessWidget {
  const PaymentFailedView({
    super.key,
    required this.detail,
    required this.onRetried,
  });

  final OrderDetail detail;

  /// 다른 카드로 다시 요청한 뒤.
  final VoidCallback onRetried;

  Future<void> _retry(BuildContext context) async {
    final order = detail.order;
    final failedId = detail.payment?.charges.lastOrNull?.card == null
        ? null
        : await _failedCardId(context);
    if (!context.mounted) return;
    final card = await pickCard(
      context,
      title: '다른 카드로 다시 요청',
      subtitle: '고른 카드로 기사님을 다시 찾아요. 배차되면 결제돼요.',
      failedId: failedId,
      confirmLabel: '이 카드로 다시 요청 · ${won(order.fare)}',
    );
    if (card == null || !context.mounted) return;
    final api = context.api;
    final retried = await runAction(
      context,
      () => api.orders.retryPayment(order.id, card.id),
    );
    if (retried != null) onRetried();
  }

  /// 방금 결제가 안 된 카드의 ID. 결제 기록에는 카드사·끝 4자리만 있어 등록한 카드에서 찾는다.
  Future<String?> _failedCardId(BuildContext context) async {
    final failed = detail.payment?.charges.lastOrNull?.card;
    final cards = await context.api.paymentMethods.list().catchError(
      (Object _) => <PaymentMethod>[],
    );
    return cards
        .where(
          (card) =>
              card.cardBrand == failed?.brand &&
              card.cardLast4 == failed?.last4,
        )
        .firstOrNull
        ?.id;
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final order = detail.order;
    final failure = order.paymentFailure;
    final card =
        detail.payment?.charges.lastOrNull?.card ?? detail.payment?.card;
    return Scaffold(
      backgroundColor: colors.background,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Align(
              alignment: Alignment.centerLeft,
              child: MovoTopBar(onBack: () => Navigator.of(context).pop()),
            ),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(24, 16, 24, 24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const MovoIconTile(
                      MovoIcons.cardOff,
                      size: 64,
                      radius: 20,
                      iconSize: 28,
                      background: MovoPalette.dangerSoft,
                      foreground: MovoPalette.danger,
                    ),
                    const SizedBox(height: 20),
                    Text(
                      '결제가 안 돼서\n배차되지 않았어요',
                      style: mv(28, 800, ls: -0.03, height: 1.3),
                    ),
                    const SizedBox(height: 10),
                    Text(
                      '기사님이 요청을 수락했지만 카드 결제가 되지 않았어요. 요금은 나가지 않았어요.',
                      style: mv(14, 500, color: colors.textMuted, height: 1.6),
                    ),
                    const SizedBox(height: 22),
                    MovoRows(
                      children: [
                        MovoKeyValue('실패 사유', failure?.title ?? '결제 실패'),
                        if (card != null) MovoKeyValue('결제 카드', card.label),
                        MovoKeyValue(
                          '요금',
                          '${won(order.fare)} · 결제 안 됨',
                          tabular: true,
                        ),
                      ],
                    ),
                    if (failure != null) ...[
                      const SizedBox(height: 10),
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: colors.surfaceMuted,
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: Text(
                          failure.guidance,
                          style: mv(
                            13,
                            600,
                            color: colors.textSecondary,
                            height: 1.55,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
            MovoBottomBar(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  MovoButton('다른 카드로 다시 요청', onPressed: () => _retry(context)),
                  const SizedBox(height: 6),
                  MovoButton(
                    '나중에 할게요',
                    kind: MovoButtonKind.text,
                    height: 44,
                    fontSize: 15,
                    weight: 700,
                    onPressed: () => Navigator.of(context).pop(),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// 노쇼 처리 안내. 기사님이 도착하고 정해진 시간을 기다렸고, 요금 전액이 결제됐다.
class NoShowView extends StatelessWidget {
  const NoShowView({super.key, required this.detail, required this.onClose});

  final OrderDetail detail;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final order = detail.order;
    final arrived = order.arrivedAt;
    final noShow = order.noShowAt;
    final card = detail.payment?.card;
    return Scaffold(
      backgroundColor: colors.background,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(24, 60, 24, 24),
                child: WithChargeRules(
                  builder: (context, rules) => Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const MovoIconTile(
                        MovoIcons.clock,
                        size: 64,
                        radius: 20,
                        iconSize: 28,
                        background: MovoPalette.dangerSoft,
                        foreground: MovoPalette.danger,
                      ),
                      const SizedBox(height: 20),
                      Text(
                        '기사님이 ${rules?.noShowWaitMinutes ?? 30}분을\n기다렸어요',
                        style: mv(28, 800, ls: -0.03, height: 1.3),
                      ),
                      const SizedBox(height: 10),
                      Text(
                        '물품을 받지 못해 노쇼로 처리됐어요. 취소·환불 규정에 따라 요금의 100%가 결제됐어요.',
                        style: mv(
                          14,
                          500,
                          color: colors.textMuted,
                          height: 1.6,
                        ),
                      ),
                      const SizedBox(height: 22),
                      MovoRows(
                        children: [
                          if (arrived != null)
                            MovoKeyValue('기사님 도착', dayClock(arrived)),
                          if (noShow != null)
                            MovoKeyValue('노쇼 처리', dayClock(noShow)),
                          if (arrived != null && noShow != null)
                            MovoKeyValue(
                              '기다린 시간',
                              '${noShow.difference(arrived).inMinutes}분',
                            ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      MovoRows(
                        children: [
                          MovoKeyValue(
                            '요금',
                            '${won(order.cancellationFee)} · 100%',
                            tabular: true,
                          ),
                          if (card != null) MovoKeyValue('결제 카드', card.label),
                          const MovoKeyValue('환불', '없음'),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ),
            MovoBottomBar(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  MovoButton('확인', onPressed: onClose),
                  const SizedBox(height: 6),
                  MovoButton(
                    '잘못 처리됐다면 고객센터에 알려 주세요',
                    kind: MovoButtonKind.text,
                    height: 44,
                    fontSize: 14,
                    weight: 700,
                    onPressed: () => Navigator.of(context).push(
                      MaterialPageRoute<void>(
                        builder: (_) => const SupportScreen(),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// 추가 요금 안내. 기사님이 픽업하며 넣은 추가 요금과 대기료, 처음 결제와 합친 최종 금액, 다시 결제한 결과.
class ExtraChargeScreen extends StatelessWidget {
  const ExtraChargeScreen({super.key, required this.detail});

  final OrderDetail detail;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final order = detail.order;
    final payment = detail.payment;
    final charge = payment?.additionalCharge;
    final driver = detail.driver;
    return MovoPage(
      title: '추가 요금',
      bottom: MovoButton(
        '배송 현황 보기',
        onPressed: () => Navigator.of(context).pop(),
      ),
      child: WithChargeRules(
        builder: (context, rules) => Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const SizedBox(height: 8),
            Text(
              charge == null
                  ? '추가 요금 ${won(order.additionalFare)}을\n결제하지 못했어요'
                  : '추가 요금 ${won(order.additionalFare)}이\n결제됐어요',
              style: mv(26, 800, ls: -0.03, height: 1.3),
            ),
            const SizedBox(height: 10),
            Text(
              '${routeTitle(order)} · ${driver?.name ?? ''} 기사님이 픽업하면서 넣은 요금이에요. 처음 결제한 카드로 다시 결제했어요.',
              style: mv(14, 500, color: colors.textMuted, height: 1.6),
            ),
            const SizedBox(height: 20),
            MovoRows(
              children: [
                for (final line in additionalFareLines(order, rules))
                  MovoKeyValue(
                    line.label.startsWith('대기료')
                        ? '${line.label} (${rules?.freeWaitingMinutes ?? 10}분 무료)'
                        : line.label.replaceFirst('추가 · ', ''),
                    line.amountText,
                    tabular: true,
                  ),
              ],
            ),
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.fromLTRB(18, 14, 18, 16),
              decoration: BoxDecoration(
                color: MovoPalette.ink,
                borderRadius: BorderRadius.circular(22),
              ),
              child: Column(
                children: [
                  _DarkLine('처음 결제', won(order.fare)),
                  _DarkLine('추가 결제', '+${won(order.additionalFare)}'),
                  const SizedBox(height: 8),
                  const Divider(height: 1, color: Color(0xFF3A3A38)),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          '최종 금액',
                          style: mv(15, 800, color: MovoPalette.white),
                        ),
                      ),
                      Text(
                        won(order.totalFare),
                        style: mv(
                          24,
                          900,
                          color: MovoPalette.lime,
                          tabular: true,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            if (charge != null) ...[
              const SizedBox(height: 10),
              MovoCard(
                padding: const EdgeInsets.fromLTRB(18, 14, 18, 4),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      children: [
                        Text('다시 결제한 결과', style: mv(15, 800)),
                        const SizedBox(width: 8),
                        const MovoTag(
                          '결제 완료',
                          background: MovoPalette.ink,
                          foreground: MovoPalette.white,
                          fontSize: 11,
                        ),
                      ],
                    ),
                    MovoKeyValue('결제 카드', '${charge.card.label} · 일시불'),
                    if (charge.approvalNumber case final number?)
                      MovoKeyValue('승인번호', number, tabular: true),
                    if (charge.approvedAt case final at?)
                      MovoKeyValue('결제 일시', dayClock(at)),
                  ],
                ),
              ),
            ],
            const SizedBox(height: 12),
            Text(
              '내역이 실제와 다르면 고객센터로 알려 주세요. 확인한 뒤 환불해 드려요.',
              style: mv(12, 600, color: colors.textMuted, height: 1.5),
            ),
          ],
        ),
      ),
    );
  }
}

class _DarkLine extends StatelessWidget {
  const _DarkLine(this.label, this.value);

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 4),
    child: Row(
      children: [
        Expanded(
          child: Text(
            label,
            style: mv(14, 600, color: const Color(0xFFBDBDB7)),
          ),
        ),
        Text(
          value,
          style: mv(14, 700, color: MovoPalette.white, tabular: true),
        ),
      ],
    ),
  );
}

/// 영수증 (앱 안에서 보는 카드 매출전표). 취소한 주문은 환불과 취소 수수료를 따로 보여준다.
class ReceiptScreen extends StatelessWidget {
  const ReceiptScreen({super.key, required this.detail});

  final OrderDetail detail;

  @override
  Widget build(BuildContext context) {
    final order = detail.order;
    return MovoPage(
      title: '영수증',
      child: MovoAsync<(Receipt, BusinessInfo)>(
        load: () async {
          final api = context.api;
          return (api.orders.receipt(order.id), api.support.business()).wait;
        },
        builder: (context, data) => WithChargeRules(
          builder: (context, rules) => _ReceiptCard(
            order: order,
            receipt: data.$1,
            business: data.$2,
            rules: rules,
          ),
        ),
      ),
    );
  }
}

class _ReceiptCard extends StatelessWidget {
  const _ReceiptCard({
    required this.order,
    required this.receipt,
    required this.business,
    required this.rules,
  });

  final Order order;
  final Receipt receipt;
  final BusinessInfo business;
  final ChargeRules? rules;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final refunded = receipt.refundedAmount > 0;
    Widget dashed() => Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Row(
        children: [
          for (var i = 0; i < 40; i++)
            Expanded(
              child: Container(
                height: 1,
                color: i.isEven ? colors.separator : Colors.transparent,
              ),
            ),
        ],
      ),
    );
    Widget line(String label, String value, {bool strong = false}) => Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: strong ? mv(13, 800) : mv(13, 600, color: colors.textMuted),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              value,
              textAlign: TextAlign.right,
              style: mv(13, strong ? 800 : 700, tabular: true),
            ),
          ),
        ],
      ),
    );
    final businessLine = [
      ?business.name,
      if (business.representative case final name?) '대표자 $name',
      if (business.registrationNumber case final number?) '사업자등록번호 $number',
    ].join(' · ');
    final contactLine = [
      ?business.address,
      if (business.phone case final phone?) '고객센터 $phone',
    ].join(' · ');
    return MovoCard(
      radius: 24,
      padding: const EdgeInsets.fromLTRB(20, 22, 20, 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              const MovoLogo(size: 18),
              const Spacer(),
              Text('카드 매출전표', style: mv(11, 700, color: colors.textMuted)),
            ],
          ),
          const SizedBox(height: 16),
          Text(
            refunded ? '결제 금액 · 일부 환불' : '결제 금액',
            style: mv(12, 600, color: colors.textMuted),
          ),
          const SizedBox(height: 4),
          Text(
            won(receipt.paidAmount),
            style: mv(30, 900, ls: -0.03, tabular: true),
          ),
          const SizedBox(height: 14),
          line('주문번호', receipt.code),
          if (receipt.paidAt case final at?) line('결제 일시', dayClock(at)),
          if (receipt.additionalPaidAt case final at?)
            line('추가 결제 일시', dayClock(at)),
          if (receipt.card case final card?)
            line('결제 수단', '${card.label} · 일시불'),
          if (receipt.approvalNumbers.isNotEmpty)
            line(
              '승인번호',
              receipt.approvalNumbers.length == 1
                  ? receipt.approvalNumbers.first
                  : '${receipt.approvalNumbers.first} 외 ${receipt.approvalNumbers.length - 1}건',
            ),
          line('구간', routeTitle(order)),
          dashed(),
          for (final fare in fareLines(order, rules))
            line(fare.label, fare.amountText),
          line('공급가액', won(receipt.supplyAmount)),
          line('부가세', won(receipt.vat)),
          line('합계', won(receipt.paidAmount)),
          if (refunded) ...[
            dashed(),
            Text('환불', style: mv(13, 800)),
            const SizedBox(height: 4),
            if (receipt.refundedAt case final at?) line('환불 일시', dayClock(at)),
            line('환불 금액', '−${won(receipt.refundedAmount)}'),
            if (receipt.cancellationFee > 0)
              line('취소 수수료', won(receipt.cancellationFee)),
            line('최종 결제 금액', won(receipt.finalAmount), strong: true),
          ],
          if (businessLine.isNotEmpty || contactLine.isNotEmpty) ...[
            dashed(),
            Text(
              [businessLine, contactLine].where((e) => e.isNotEmpty).join('\n'),
              style: mv(11, 600, color: colors.textMuted, height: 1.6),
            ),
          ],
        ],
      ),
    );
  }
}

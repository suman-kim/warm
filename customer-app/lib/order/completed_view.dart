import 'package:flutter/material.dart';
import 'package:movo_api/movo_api.dart';
import 'package:movo_ui/movo_ui.dart';

/// 배송 완료. 요금 내역(기본·추가)과 결제 금액을 확인하고 기사님을 평가한다. 영수증으로 이어진다.
class CompletedView extends StatefulWidget {
  const CompletedView({
    super.key,
    required this.detail,
    required this.onReviewed,
    required this.onSkip,
    required this.onReceipt,
  });

  final OrderDetail detail;

  /// 영수증을 연다.
  final VoidCallback onReceipt;

  /// 평가를 보낸 뒤.
  final VoidCallback onReviewed;

  /// 평가하지 않고 주문 상세를 볼 때.
  final VoidCallback onSkip;

  @override
  State<CompletedView> createState() => _CompletedViewState();
}

class _CompletedViewState extends State<CompletedView> {
  /// 고른 별점. 0이면 아직 고르지 않았다.
  int _rating = 0;
  final _tags = <ReviewTag>{};
  bool _busy = false;

  static const _tagLabels = {
    ReviewTag.kind: '친절해요',
    ReviewTag.fast: '빨라요',
    ReviewTag.careful: '꼼꼼해요',
  };

  Future<void> _send() async {
    setState(() => _busy = true);
    final api = context.api;
    final review = await runAction(
      context,
      () => api.orders.review(
        widget.detail.order.id,
        rating: _rating,
        tags: _tags.toList(),
      ),
    );
    if (!mounted) return;
    setState(() => _busy = false);
    if (review != null) {
      showMovoToast(context, '평가를 보냈어요. 고마워요!');
      widget.onReviewed();
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final order = widget.detail.order;
    final driver = widget.detail.driver;
    final payment = widget.detail.payment;
    final deliveredAt = order.deliveredAt ?? DateTime.now();
    return Scaffold(
      backgroundColor: colors.background,
      body: SafeArea(
        bottom: false,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(20, 46, 20, 24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const MovoIconTile(
                      MovoIcons.check,
                      size: 68,
                      radius: 24,
                      iconSize: 32,
                      background: MovoPalette.lime,
                      foreground: MovoPalette.ink,
                    ),
                    const SizedBox(height: 22),
                    Text(
                      '배송이 완료됐어요',
                      style: mv(30, 800, ls: -0.035, height: 1.25),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      '${clock(deliveredAt)} · ${shortAddress(order.dropoff.address)}에 도착했어요',
                      style: mv(15, 600, color: colors.textMuted),
                    ),
                    const SizedBox(height: 22),
                    WithChargeRules(
                      builder: (context, rules) => MovoCard(
                        radius: 24,
                        padding: const EdgeInsets.symmetric(
                          horizontal: 18,
                          vertical: 4,
                        ),
                        child: Column(
                          children: [
                            for (final line in fareLines(order, rules))
                              DecoratedBox(
                                decoration: BoxDecoration(
                                  border: Border(
                                    bottom: BorderSide(color: colors.divider),
                                  ),
                                ),
                                child: MovoKeyValue(
                                  line.label,
                                  line.amountText,
                                  verticalPadding: 13,
                                  tabular: true,
                                ),
                              ),
                            Padding(
                              padding: const EdgeInsets.only(
                                top: 15,
                                bottom: 13,
                              ),
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.baseline,
                                textBaseline: TextBaseline.alphabetic,
                                children: [
                                  Expanded(
                                    child: Text('총 결제 금액', style: mv(15, 800)),
                                  ),
                                  Text(
                                    won(
                                      payment?.finalAmount ?? order.totalFare,
                                    ),
                                    style: mv(20, 900, tabular: true),
                                  ),
                                ],
                              ),
                            ),
                            if (payment?.card case final card?)
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  vertical: 12,
                                ),
                                decoration: BoxDecoration(
                                  border: Border(
                                    top: BorderSide(color: colors.divider),
                                  ),
                                ),
                                child: Row(
                                  children: [
                                    Expanded(
                                      child: Text(
                                        payment?.additionalCharge == null
                                            ? card.label
                                            : '${card.label} · 추가 결제 포함',
                                        style: mv(
                                          13,
                                          600,
                                          color: colors.textMuted,
                                        ),
                                      ),
                                    ),
                                    Pressable(
                                      onTap: widget.onReceipt,
                                      child: Row(
                                        children: [
                                          Text('영수증', style: mv(13, 800)),
                                          const MovoIcon(
                                            MovoIcons.chevronRight,
                                            size: 16,
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 22),
                    MovoCard(
                      radius: 24,
                      padding: const EdgeInsets.symmetric(
                        horizontal: 18,
                        vertical: 20,
                      ),
                      child: SizedBox(
                        width: double.infinity,
                        child: Column(
                          children: [
                            Text(
                              '${driver?.name ?? ''} 기사님은 어떠셨나요?',
                              style: mv(16, 800),
                            ),
                            const SizedBox(height: 14),
                            Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                for (var star = 1; star <= 5; star++)
                                  Semantics(
                                    button: true,
                                    label: '별점 $star점',
                                    selected: star == _rating,
                                    excludeSemantics: true,
                                    child: GestureDetector(
                                      onTap: () =>
                                          setState(() => _rating = star),
                                      child: Padding(
                                        padding: const EdgeInsets.symmetric(
                                          horizontal: 3,
                                        ),
                                        child: MovoIcon(
                                          MovoIcons.star,
                                          size: 34,
                                          color: star <= _rating
                                              ? colors.text
                                              : colors.separator,
                                        ),
                                      ),
                                    ),
                                  ),
                              ],
                            ),
                            const SizedBox(height: 14),
                            Wrap(
                              spacing: 6,
                              runSpacing: 6,
                              alignment: WrapAlignment.center,
                              children: [
                                for (final MapEntry(key: tag, value: label)
                                    in _tagLabels.entries)
                                  MovoChip(
                                    label,
                                    selected: _tags.contains(tag),
                                    height: 33,
                                    radius: 14,
                                    horizontalPadding: 13,
                                    onTap: () => setState(
                                      () => _tags.contains(tag)
                                          ? _tags.remove(tag)
                                          : _tags.add(tag),
                                    ),
                                  ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Center(
                      child: MovoButton(
                        '다음에 할게요',
                        kind: MovoButtonKind.text,
                        expand: false,
                        height: 40,
                        fontSize: 13,
                        weight: 700,
                        foreground: colors.textMuted,
                        onPressed: widget.onSkip,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            MovoBottomBar(
              child: MovoButton(
                '평가 보내기',
                onPressed: _rating == 0 ? null : _send,
                loading: _busy,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

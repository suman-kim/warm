import 'package:flutter/material.dart';
import 'package:movo_api/movo_api.dart';
import 'package:movo_ui/movo_ui.dart';

import '../payment/cards.dart';
import 'draft.dart';
import 'order_screen.dart';

/// 차종 선택과 견적. 차종별 요금을 비교하고, 요금 내역과 결제할 카드를 확인한 뒤 배송을 요청한다.
/// 결제는 요청할 때가 아니라 기사님이 배차될 때 한다. 등록한 카드가 없으면 카드부터 등록한다.
class QuoteScreen extends StatefulWidget {
  const QuoteScreen({super.key, required this.draft});

  final OrderDraft draft;

  @override
  State<QuoteScreen> createState() => _QuoteScreenState();
}

class _QuoteData {
  const _QuoteData(this.estimates, this.cards);

  final FareEstimates estimates;
  final List<PaymentMethod> cards;
}

class _QuoteScreenState extends State<QuoteScreen> {
  OrderDraft get _draft => widget.draft;
  final _reload = MovoAsyncController();
  VehicleType? _selected;
  bool _busy = false;

  @override
  void dispose() {
    _reload.dispose();
    super.dispose();
  }

  Future<_QuoteData> _load() async {
    final api = context.api;
    final (estimates, cards) = await (
      api.orders.estimates(
        pickup: _draft.pickup.coordinates,
        dropoff: _draft.dropoff.coordinates,
        serviceType: _draft.service,
      ),
      api.paymentMethods.list(),
    ).wait;
    // 다시 보내는 배송이면 지난번 차종을, 아니면 이 화물을 실을 수 있는 가장 싼 차종을 먼저 골라 둔다.
    final loadable = _usable(
      estimates,
    ).where((option) => option.maxLoadKg >= _draft.weightKg);
    _selected ??=
        loadable
            .where((option) => option.vehicleType == _draft.vehicleType)
            .firstOrNull
            ?.vehicleType ??
        loadable.firstOrNull?.vehicleType;
    return _QuoteData(estimates, cards);
  }

  /// 이 버전의 앱이 아는 차종만.
  List<FareOption> _usable(FareEstimates estimates) => [
    for (final option in estimates.options)
      if (option.vehicleType != VehicleType.unknown) option,
  ];

  /// 이번 주문에 쓸 카드: 고른 카드, 없으면 기본 카드.
  PaymentMethod? _cardOf(List<PaymentMethod> cards) =>
      cards.where((card) => card.id == _draft.paymentMethodId).firstOrNull ??
      cards.where((card) => card.isDefault).firstOrNull ??
      cards.firstOrNull;

  Future<void> _changeCard(PaymentMethod? current) async {
    final picked = await pickCard(
      context,
      title: '결제할 카드',
      subtitle: '배차되면 고른 카드로 결제돼요',
      selectedId: current?.id,
    );
    if (picked == null || !mounted) return;
    _draft.paymentMethodId = picked.id;
    _reload.reload();
  }

  Future<void> _registerCard() async {
    final card = await registerCard(context, backLabel: '견적으로 돌아가기');
    if (card == null || !mounted) return;
    _draft.paymentMethodId = card.id;
    _reload.reload();
  }

  Future<void> _request(FareOption option, PaymentMethod card) async {
    setState(() => _busy = true);
    final api = context.api;
    final navigator = Navigator.of(context);
    final order = await runAction(
      context,
      () => api.orders.create(
        vehicleType: option.vehicleType,
        pickup: _draft.pickupInput,
        dropoff: _draft.dropoffInput,
        cargo: _draft.cargoInput,
        memo: _draft.memo.isEmpty ? null : _draft.memo,
        scheduledPickupAt: _draft.scheduledAt,
        loadingHelp: _draft.loadingHelp,
        pickupAccess: _draft.pickupAccess,
        dropoffAccess: _draft.dropoffAccess,
        paymentMethodId: card.id,
      ),
    );
    if (!mounted) return;
    setState(() => _busy = false);
    if (order == null) return;
    // 요청했으니 입력 화면들을 걷어 내고 주문 화면으로 간다.
    navigator.pushAndRemoveUntil(
      MaterialPageRoute<void>(builder: (_) => OrderScreen(orderId: order.id)),
      (route) => route.isFirst,
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final top = MediaQuery.paddingOf(context).top;
    return Scaffold(
      backgroundColor: colors.surface,
      body: MovoAsync<_QuoteData>(
        controller: _reload,
        load: _load,
        builder: (context, data) => WithChargeRules(
          builder: (context, rules) {
            final estimates = data.estimates;
            final options = _usable(estimates);
            final selected = options
                .where((option) => option.vehicleType == _selected)
                .firstOrNull;
            final card = _cardOf(data.cards);
            final addOns = rules == null ? 0 : _draft.addOnFare(rules);
            final total = selected == null ? null : selected.fare + addOns;
            final pickupName =
                _draft.pickup.dong?.replaceFirst(RegExp(r'\d+가$'), '') ??
                shortAddress(_draft.pickup.address).split(' ').first;
            final dropoffName =
                _draft.dropoff.dong?.replaceFirst(RegExp(r'\d+가$'), '') ??
                shortAddress(_draft.dropoff.address).split(' ').first;
            return Stack(
              children: [
                Positioned(
                  top: 0,
                  left: 0,
                  right: 0,
                  height: top + 320,
                  child: MovoMap(
                    dark: false,
                    route: estimates.route,
                    padding: EdgeInsets.fromLTRB(70, top + 100, 70, 70),
                    markers: [
                      MovoMapMarker(
                        estimates.route.first,
                        const MovoMapPickupDot(),
                      ),
                      MovoMapMarker(
                        estimates.route.first,
                        MovoMapLabel(pickupName, prefix: '출발'),
                        offset: const Offset(0, -34),
                      ),
                      MovoMapMarker(
                        estimates.route.last,
                        const MovoMapDropoffDot(),
                      ),
                      MovoMapMarker(
                        estimates.route.last,
                        MovoMapLabel(dropoffName, prefix: '도착', inverse: true),
                        offset: const Offset(0, -32),
                      ),
                    ],
                  ),
                ),
                Positioned(
                  top: top + 6,
                  left: 20,
                  child: const MovoFloatingBack(),
                ),
                Positioned(
                  top: top + 276,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  child: MovoBottomPanel(
                    child: ListView(
                      padding: const EdgeInsets.only(bottom: 120),
                      children: [
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      Flexible(
                                        child: Text(
                                          pickupName,
                                          style: mv(21, 800, ls: -0.02),
                                        ),
                                      ),
                                      const MovoIcon(
                                        MovoIcons.chevronRight,
                                        size: 20,
                                      ),
                                      Flexible(
                                        child: Text(
                                          dropoffName,
                                          style: mv(21, 800, ls: -0.02),
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    '${km(estimates.distanceKm)} · 예상 ${estimates.durationMinutes}분 · ${cargoLabel(_draft.category)} ${_draft.quantity}개',
                                    style: mv(14, 600, color: colors.textMuted),
                                  ),
                                ],
                              ),
                            ),
                            MovoTag(
                              serviceLabel(_draft.service),
                              background: MovoPalette.lime,
                              foreground: MovoPalette.ink,
                              padding: const EdgeInsets.symmetric(
                                horizontal: 10,
                                vertical: 6,
                              ),
                              radius: 10,
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            for (final (index, option) in options.indexed) ...[
                              if (index > 0) const SizedBox(width: 8),
                              Expanded(
                                child: _OptionTile(
                                  option,
                                  selected: option.vehicleType == _selected,
                                  tooHeavy: option.maxLoadKg < _draft.weightKg,
                                  onTap: () => setState(
                                    () => _selected = option.vehicleType,
                                  ),
                                ),
                              ),
                            ],
                          ],
                        ),
                        if (selected != null) ...[
                          const SizedBox(height: 10),
                          _FareCard(
                            option: selected,
                            draft: _draft,
                            rules: rules,
                            card: card,
                            onChangeCard: () => _changeCard(card),
                            onRegisterCard: _registerCard,
                          ),
                        ],
                        const SizedBox(height: 12),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 4),
                          child: Text(
                            '배차되면 결제돼요. 기사님 출발 전에는 수수료 없이 취소할 수 있고, 출발한 뒤에는 요금의 ${rules?.cancellationFeePercent ?? 15}%가 취소 수수료예요.',
                            style: mv(
                              12,
                              600,
                              color: colors.textMuted,
                              height: 1.5,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                Positioned(
                  left: 0,
                  right: 0,
                  bottom: 0,
                  child: MovoBottomBar(
                    child: MovoButton(
                      card == null ? '카드 등록하고 요청하기' : '배송 요청하기',
                      loading: _busy,
                      onPressed: selected == null || rules == null
                          ? null
                          : card == null
                          ? _registerCard
                          : () => _request(selected, card),
                      trailing: total == null || rules == null
                          ? null
                          : Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 12,
                                vertical: 8,
                              ),
                              decoration: BoxDecoration(
                                color: MovoPalette.lime,
                                borderRadius: BorderRadius.circular(11),
                              ),
                              child: Text(
                                won(total),
                                style: mv(
                                  15,
                                  800,
                                  color: MovoPalette.ink,
                                  tabular: true,
                                ),
                              ),
                            ),
                    ),
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

/// 요금 내역(기본 요금 · 운반 도움 · 계단)과 결제할 카드.
class _FareCard extends StatelessWidget {
  const _FareCard({
    required this.option,
    required this.draft,
    required this.rules,
    required this.card,
    required this.onChangeCard,
    required this.onRegisterCard,
  });

  final FareOption option;
  final OrderDraft draft;
  final ChargeRules? rules;
  final PaymentMethod? card;
  final VoidCallback onChangeCard;
  final VoidCallback onRegisterCard;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final rules = this.rules;
    final helpFee = rules?.helpFeeOf(draft.loadingHelp) ?? 0;
    final stairFee = rules == null
        ? 0
        : rules.stairFeeOf(
                draft.pickupAccess.floor,
                elevator: draft.pickupAccess.elevator,
              ) +
              rules.stairFeeOf(
                draft.dropoffAccess.floor,
                elevator: draft.dropoffAccess.elevator,
              );
    final lines = [
      FareLine('기본 요금 · ${option.label}', option.fare, addition: false),
      if (helpFee > 0)
        FareLine('운반 도움 · ${loadingHelpLabel(draft.loadingHelp)}', helpFee),
      if (stairFee > 0)
        FareLine(
          '계단 · ${stairsLabel(draft.pickupAccess, draft.dropoffAccess)}',
          stairFee,
        ),
    ];
    final card = this.card;
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 8, 14, 12),
      decoration: BoxDecoration(
        color: colors.background,
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        children: [
          for (final line in lines)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      line.label,
                      style: mv(13, 600, color: colors.textMuted),
                    ),
                  ),
                  Text(line.amountText, style: mv(14, 700, tabular: true)),
                ],
              ),
            ),
          const SizedBox(height: 6),
          Divider(height: 1, color: colors.fieldBorder),
          const SizedBox(height: 12),
          if (card == null)
            Row(
              children: [
                Container(
                  width: 40,
                  height: 28,
                  decoration: BoxDecoration(
                    color: colors.surfaceMuted,
                    borderRadius: BorderRadius.circular(6),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('결제할 카드가 없어요', style: mv(15, 800)),
                      const SizedBox(height: 2),
                      Text(
                        '카드를 등록하면 바로 요청할 수 있어요',
                        style: mv(12, 600, color: colors.textMuted),
                      ),
                    ],
                  ),
                ),
                _CardButton('등록', onRegisterCard, lime: true),
              ],
            )
          else
            Row(
              children: [
                Expanded(
                  child: CardSummary(
                    label: card.label,
                    last4: card.cardLast4,
                    subtitle: cardSubtitle(card),
                  ),
                ),
                _CardButton('변경', onChangeCard),
              ],
            ),
        ],
      ),
    );
  }
}

class _CardButton extends StatelessWidget {
  const _CardButton(this.label, this.onTap, {this.lime = false});

  final String label;
  final VoidCallback onTap;
  final bool lime;

  @override
  Widget build(BuildContext context) => Pressable(
    onTap: onTap,
    child: Container(
      height: 30,
      padding: const EdgeInsets.symmetric(horizontal: 11),
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: lime ? MovoPalette.lime : context.colors.surface,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Text(
        label,
        style: mv(12, 800, color: lime ? MovoPalette.ink : null),
      ),
    ),
  );
}

class _OptionTile extends StatelessWidget {
  const _OptionTile(
    this.option, {
    required this.selected,
    required this.tooHeavy,
    required this.onTap,
  });

  final FareOption option;
  final bool selected;

  /// 화물이 이 차종의 한도보다 무겁다 — 고를 수 없다.
  final bool tooHeavy;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Semantics(
      button: true,
      selected: selected,
      enabled: !tooHeavy,
      child: Pressable(
        onTap: tooHeavy ? null : onTap,
        child: Opacity(
          opacity: tooHeavy ? 0.45 : 1,
          child: Container(
            padding: const EdgeInsets.fromLTRB(10, 10, 10, 10),
            decoration: BoxDecoration(
              color: colors.surface,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(
                color: selected ? colors.text : colors.fieldBorder,
                width: selected ? 2.5 : 1.5,
                strokeAlign: BorderSide.strokeAlignInside,
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                MovoIconTile(
                  vehicleIcon(option.vehicleType),
                  size: 40,
                  radius: 12,
                  iconSize: 22,
                  background: selected ? MovoPalette.lime : null,
                  foreground: MovoPalette.ink,
                ),
                const SizedBox(height: 10),
                Text(
                  option.label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: mv(15, 800),
                ),
                const SizedBox(height: 2),
                Text(
                  tooHeavy ? '${kg(option.maxLoadKg)}까지' : won(option.fare),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: mv(13, 600, color: colors.textMuted, tabular: true),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
